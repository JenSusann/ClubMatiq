import { json } from '@sveltejs/kit';
import { ObjectId, type Document } from 'mongodb';
import { client, db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Zahlung = {
  zahlungId?: string;
  betrag: number;
  datum: Date;
  zahlungsart: string;
};
type Rechnung = Document & {
  vereinId: string;
  verkaufId: string;
  status: 'offen' | 'teilweise_bezahlt' | 'bezahlt' | 'storniert';
  gesamtbetrag: number;
  bezahltBetrag: number;
  gutgeschriebenBetrag?: number;
  zahlungen: Zahlung[];
};

class Zahlungsfehler extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}

function rappen(wert: unknown, positiv = false): number | null {
  if (typeof wert !== 'number' || !Number.isFinite(wert) || wert < 0 || (positiv && wert === 0)) return null;
  const ergebnis = Math.round(wert * 100);
  return Number.isSafeInteger(ergebnis) && Math.abs(wert * 100 - ergebnis) < 0.000001 ? ergebnis : null;
}

function zahlungsdatum(wert: unknown): Date | null {
  if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return null;
  const datum = new Date(`${wert}T12:00:00.000Z`);
  return !Number.isNaN(datum.getTime()) && datum.toISOString().slice(0, 10) === wert ? datum : null;
}

// PATCH /api/vereinskleider/verrechnung/[id]
// JSON: { betrag: 25, datum: '2026-11-17', zahlungsart: 'twint', zahlungId: '<UUID>' }
// Bereits ausgestellte Gutschriften reduzieren die noch zulässigen Zahlungseingänge.
// Rückerstattungen werden bewusst NICHT als negative Zahlung erfasst.
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  if (!/^[0-9a-fA-F]{24}$/.test(params.id)) {
    return json({ fehler: 'Ungültige Rechnungs-ID.' }, { status: 400 });
  }

  const roh: unknown = await request.json().catch(() => null);
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) {
    return json({ fehler: 'Ungültige Zahlungsdaten.' }, { status: 400 });
  }
  const eingabe = roh as Record<string, unknown>;
  const betrag = rappen(eingabe.betrag, true);
  const datum = zahlungsdatum(eingabe.datum);
  const zahlungsart = eingabe.zahlungsart;
  const zahlungId = eingabe.zahlungId;

  if (betrag === null) return json({ fehler: 'Der Betrag muss positiv sein und höchstens zwei Dezimalstellen haben.' }, { status: 400 });
  if (!datum) return json({ fehler: 'Bitte ein gültiges Zahlungsdatum im Format JJJJ-MM-TT angeben.' }, { status: 400 });
  if (zahlungsart !== 'bank' && zahlungsart !== 'twint' && zahlungsart !== 'bar') {
    return json({ fehler: 'Zahlungsart muss Bank, TWINT oder Bar sein.' }, { status: 400 });
  }
  if (typeof zahlungId !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(zahlungId)) {
    return json({ fehler: 'Eine eindeutige zahlungId (UUID) ist erforderlich.' }, { status: 400 });
  }

  const vereinId = locals.benutzer!.vereinId;
  const rechnungId = new ObjectId(params.id);
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const sammlung = db.collection<Rechnung>('vereinskleider_rechnungen');
      const rechnung = await sammlung.findOne({ _id: rechnungId, vereinId }, { session });
      if (!rechnung) throw new Zahlungsfehler('Rechnung nicht gefunden.', 404);

      const zahlungen = rechnung.zahlungen ?? [];
      if (!Array.isArray(zahlungen)) throw new Zahlungsfehler('Gespeicherte Zahlungen sind ungültig.', 409);
      const bestehend = zahlungen.find((z) => z.zahlungId === zahlungId);
      if (bestehend) {
        const bestaetigtesDatum = new Date(bestehend.datum);
        if (rappen(bestehend.betrag) !== betrag || bestehend.zahlungsart !== zahlungsart ||
            Number.isNaN(bestaetigtesDatum.getTime()) ||
            bestaetigtesDatum.toISOString().slice(0, 10) !== eingabe.datum) {
          throw new Zahlungsfehler('Diese Zahlungs-ID wurde bereits mit anderen Daten verwendet.', 409);
        }
        return { bereitsErfasst: true, bezahltBetrag: rechnung.bezahltBetrag, status: rechnung.status };
      }

      if (rechnung.status === 'storniert') throw new Zahlungsfehler('Auf stornierte Rechnungen können keine Zahlungen erfasst werden.', 409);
      const gesamt = rappen(rechnung.gesamtbetrag);
      const bezahlt = rappen(rechnung.bezahltBetrag);
      const gutgeschrieben = rappen(rechnung.gutgeschriebenBetrag ?? 0);
      if (gesamt === null || bezahlt === null || gutgeschrieben === null ||
          gutgeschrieben > gesamt || bezahlt > gesamt) {
        throw new Zahlungsfehler('Die gespeicherten Rechnungsbeträge sind ungültig.', 409);
      }
      // Bei einer Gutschrift nach bereits erfolgter Zahlung kann eine
      // Rückerstattung ausstehen. Weitere Zahlungseingänge sind dann gesperrt.
      const nettoForderung = gesamt - gutgeschrieben;
      const nochZahlbar = Math.max(0, nettoForderung - bezahlt);
      if (betrag > nochZahlbar) {
        throw new Zahlungsfehler(
          `Der Zahlungseingang übersteigt den offenen Betrag nach Gutschriften (${(nochZahlbar / 100).toFixed(2)} CHF).`,
          409
        );
      }

      const neuerBetrag = bezahlt + betrag;
      const neuerStatus: Rechnung['status'] = neuerBetrag >= nettoForderung ? 'bezahlt' : 'teilweise_bezahlt';
      const jetzt = new Date();
      const neueZahlung: Zahlung = { zahlungId, betrag: betrag / 100, datum, zahlungsart };
      const aktualisiert = await sammlung.updateOne(
        {
          _id: rechnungId,
          vereinId,
          bezahltBetrag: rechnung.bezahltBetrag,
          gutgeschriebenBetrag: rechnung.gutgeschriebenBetrag === undefined
            ? { $exists: false } : rechnung.gutgeschriebenBetrag,
          'zahlungen.zahlungId': { $ne: zahlungId },
          status: rechnung.status
        },
        {
          $set: {
            bezahltBetrag: neuerBetrag / 100,
            status: neuerStatus,
            aktualisiertAm: jetzt,
            zahlungen: [...zahlungen, neueZahlung]
          }
        },
        { session }
      );
      if (aktualisiert.modifiedCount !== 1) {
        throw new Zahlungsfehler('Die Rechnung wurde zwischenzeitlich verändert. Bitte neu laden.', 409);
      }
      return { bereitsErfasst: false, bezahltBetrag: neuerBetrag / 100, status: neuerStatus };
    });

    return json({ erfolg: true, ...ergebnis });
  } catch (fehler) {
    if (fehler instanceof Zahlungsfehler) {
      return json({ fehler: fehler.message }, { status: fehler.statusCode });
    }
    console.error('Zahlungseingang erfassen:', fehler);
    return json({ fehler: 'Zahlungseingang konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
