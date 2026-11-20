import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { client, db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { berechneZahlungsstand } from '../../../../lib/server/vereinskleider-teilzahlungen';
import type { RequestHandler } from './$types';

const idGueltig = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);
const betragGueltig = (v: unknown): v is number => typeof v === 'number' &&
  Number.isFinite(v) && v >= 0 && Math.abs(v * 100 - Math.round(v * 100)) < 0.000001;

class Preisfehler extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type Position = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
  einzelpreis: number | null;
  positionsbetrag: number;
  preisOffen?: boolean;
  verkaufsart: 'direkt' | 'bestellung';
  storniertMenge?: number;
  uebergebenMenge?: number;
};
type Zahlung = { betrag: number; datum: Date; zahlungsart: string };

export const POST: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const eingabe = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!eingabe || Array.isArray(eingabe) || !idGueltig(eingabe.verkaufId) ||
      !Number.isSafeInteger(eingabe.positionsIndex) || (eingabe.positionsIndex as number) < 0 ||
      !betragGueltig(eingabe.einzelpreis) ||
      (eingabe.zahlung !== undefined && (
        !eingabe.zahlung || typeof eingabe.zahlung !== 'object' ||
        Array.isArray(eingabe.zahlung) ||
        !betragGueltig((eingabe.zahlung as Record<string, unknown>).betrag) ||
        !['twint', 'bar'].includes((eingabe.zahlung as Record<string, unknown>).zahlungsart as string)
      ))) {
    return json({ fehler: 'Ungültige Preisfestlegung oder Zahlung.' }, { status: 400 });
  }
  const verkaufId = eingabe.verkaufId as string;
  const index = eingabe.positionsIndex as number;
  const einzelpreis = eingabe.einzelpreis as number;
  const neueZahlung = eingabe.zahlung as { betrag: number; zahlungsart: 'twint' | 'bar' } | undefined;
  if (neueZahlung && neueZahlung.betrag <= 0) {
    return json({ fehler: 'Die Zahlung muss grösser als CHF 0 sein.' }, { status: 400 });
  }

  const vereinId = locals.benutzer!.vereinId;
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const collection = db.collection('vereinskleider_verkaeufe');
      const _id = new ObjectId(verkaufId);
      const verkauf = await collection.findOne({ _id, vereinId }, { session });
      if (!verkauf) throw new Preisfehler('Bestellung nicht gefunden.', 404);
      if (verkauf.rechnungId) {
        throw new Preisfehler('Für diese Bestellung existiert bereits eine Rechnung. Bitte zuerst die Rechnungsverrechnung berücksichtigen.', 409);
      }
      if (!Array.isArray(verkauf.positionen) || index >= verkauf.positionen.length) {
        throw new Preisfehler('Bestellposition nicht gefunden.', 404);
      }
      if (verkauf.status === 'storniert') throw new Preisfehler('Stornierte Bestellungen können nicht geändert werden.', 409);
      const positionen = verkauf.positionen.map((p) => ({ ...p })) as Position[];
      const ziel = positionen[index];
      if (ziel.verkaufsart !== 'bestellung' || ziel.preisOffen !== true || ziel.einzelpreis !== null ||
          !Number.isSafeInteger(ziel.menge) || ziel.menge <= 0) {
        throw new Preisfehler('Diese Position hat keinen offenen Preis mehr.', 409);
      }
      if (ziel.storniertMenge || ziel.uebergebenMenge) {
        throw new Preisfehler('Bereits stornierte oder übergebene Positionen können nicht nachträglich bepreist werden.', 409);
      }
      ziel.einzelpreis = einzelpreis;
      ziel.preisOffen = false;
      ziel.positionsbetrag = Math.round(einzelpreis * 100) * ziel.menge / 100;

      const bisherigeZahlungen = (verkauf.zahlungen ?? []) as Zahlung[];
      if (!Array.isArray(bisherigeZahlungen) || !bisherigeZahlungen.every((z) =>
        z && betragGueltig(z.betrag) && z.betrag > 0 && ['twint', 'bar', 'rechnung'].includes(z.zahlungsart))) {
        throw new Preisfehler('Die bisherigen Zahlungen sind ungültig.', 409);
      }
      const jetzt = new Date();
      const zahlungen = neueZahlung
        ? [...bisherigeZahlungen, { betrag: neueZahlung.betrag, zahlungsart: neueZahlung.zahlungsart, datum: jetzt }]
        : bisherigeZahlungen;
      const stand = berechneZahlungsstand(positionen.map((p) => ({
        artikelId: p.artikelId, groesseId: p.groesseId, menge: p.menge,
        einzelpreis: p.einzelpreis, preisOffen: p.preisOffen === true
      })), zahlungen);
      const rabattTotal = Number(verkauf.rabattTotal ?? 0);
      if (rabattTotal !== 0) {
        throw new Preisfehler('Preisfestlegung bei rabattierten Bestellungen ist noch nicht möglich.', 409);
      }
      const offen = stand.offenePreispositionen > 0;
      const zahlungsstatus = offen
        ? stand.bezahlt > 0 ? 'teilweise_bezahlt' : 'preis_offen'
        : stand.status;
      const aktualisiert = await collection.updateOne(
        { _id, vereinId, rechnungId: { $exists: false },
          [`positionen.${index}.preisOffen`]: true,
          [`positionen.${index}.einzelpreis`]: null },
        { $set: {
          positionen, zwischentotal: stand.faellig, endbetrag: stand.faellig,
          bezahltBetrag: stand.bezahlt, zahlungen, zahlungsstatus,
          preisOffen: offen, offenePreispositionen: stand.offenePreispositionen,
          restbetragBekannt: stand.restbetrag, aktualisiertAm: jetzt
        } }, { session }
      );
      if (aktualisiert.modifiedCount !== 1) {
        throw new Preisfehler('Diese Position wurde zwischenzeitlich geändert. Bitte neu laden.', 409);
      }
      return { verkaufId, positionsIndex: index, einzelpreis, ...stand, zahlungsstatus };
    });
    return json({ erfolg: true, ergebnis });
  } catch (error) {
    if (error instanceof Preisfehler) return json({ fehler: error.message }, { status: error.status });
    if (error instanceof Error && /Geldbetrag|Zahlungen|Menge|Preis/.test(error.message)) {
      return json({ fehler: error.message }, { status: 400 });
    }
    console.error('Preisfestlegung:', error);
    return json({ fehler: 'Preisfestlegung konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
