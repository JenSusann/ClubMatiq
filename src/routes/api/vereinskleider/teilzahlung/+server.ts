import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { client, db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { berechneZahlungsstand } from '../../../../lib/server/vereinskleider-teilzahlungen';
import type { RequestHandler } from './$types';

const gueltigeId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);
const gueltigerBetrag = (v: unknown): v is number => typeof v === 'number' &&
  Number.isFinite(v) && v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 0.000001;

class Zahlungsfehler extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const POST: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body) || !gueltigeId(body.verkaufId) ||
      !gueltigerBetrag(body.betrag) || !['bar', 'twint'].includes(body.zahlungsart as string)) {
    return json({ fehler: 'Ungültige Zahlungseingabe.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const _id = new ObjectId(body.verkaufId as string);
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const collection = db.collection('vereinskleider_verkaeufe');
      const verkauf = await collection.findOne({ _id, vereinId }, { session });
      if (!verkauf) throw new Zahlungsfehler('Bestellung nicht gefunden.', 404);
      if (verkauf.rechnungId || (Array.isArray(verkauf.trancheRechnungIds) && verkauf.trancheRechnungIds.length > 0)) {
        throw new Zahlungsfehler('Für diese Bestellung existieren bereits Rechnungen. Zahlungseingänge bitte in der Rechnungsverwaltung erfassen.', 409);
      }
      if (!Array.isArray(verkauf.positionen) || !verkauf.positionen.length) {
        throw new Zahlungsfehler('Die Bestellung hat keine Positionen.', 409);
      }
      const zahlungen = verkauf.zahlungen ?? [];
      if (!Array.isArray(zahlungen) || !zahlungen.every((z) =>
        z && typeof z.betrag === 'number' && Number.isFinite(z.betrag) && z.betrag > 0 &&
        ['bar', 'twint', 'rechnung'].includes(z.zahlungsart))) {
        throw new Zahlungsfehler('Bisherige Zahlungshistorie ist ungültig.', 409);
      }
      if (Number(verkauf.rabattTotal ?? 0) !== 0) {
        throw new Zahlungsfehler('Teilzahlungen für rabattierte Bestellungen sind noch nicht unterstützt.', 409);
      }
      const jetzt = new Date();
      const aktualisierteZahlungen = [...zahlungen, {
        betrag: body.betrag as number, zahlungsart: body.zahlungsart as string, datum: jetzt
      }];
      const stand = berechneZahlungsstand(verkauf.positionen.map((p) => ({
        artikelId: p.artikelId as string, groesseId: p.groesseId as string | null,
        menge: p.menge as number, einzelpreis: p.einzelpreis as number | null,
        preisOffen: p.preisOffen === true
      })), aktualisierteZahlungen);
      const zahlungsstatus = stand.offenePreispositionen > 0
        ? 'teilweise_bezahlt' : stand.status;
      const result = await collection.updateOne(
        { _id, vereinId, rechnungId: { $exists: false },
          trancheRechnungIds: { $exists: false },
          aktualisiertAm: verkauf.aktualisiertAm },
        { $set: {
          zahlungen: aktualisierteZahlungen, bezahltBetrag: stand.bezahlt,
          zahlungsstatus, restbetragBekannt: stand.restbetrag, aktualisiertAm: jetzt
        } }, { session }
      );
      if (result.modifiedCount !== 1) {
        throw new Zahlungsfehler('Die Bestellung wurde zwischenzeitlich geändert. Bitte neu laden.', 409);
      }
      return { verkaufId: _id.toString(), ...stand, zahlungsstatus };
    });
    return json({ erfolg: true, ergebnis });
  } catch (e) {
    if (e instanceof Zahlungsfehler) return json({ fehler: e.message }, { status: e.status });
    if (e instanceof Error && /Geldbetrag|Zahlungen|Menge|Preis/.test(e.message)) {
      return json({ fehler: e.message }, { status: 400 });
    }
    console.error('Teilzahlung:', e);
    return json({ fehler: 'Zahlung konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
