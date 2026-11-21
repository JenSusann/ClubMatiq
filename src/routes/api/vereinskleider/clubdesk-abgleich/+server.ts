import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

const gueltigeId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const gueltigesDatum = (v: unknown): v is string => typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) &&
  new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;

/** Manuelle Buchungsbestätigung, keine ClubDesk-Schnittstelle und keine Zahlung. */
export const PATCH: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) {
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  }
  const d = eingabe as Record<string, unknown>;
  if (!['rechnung', 'gutschrift'].includes(String(d.typ)) || !gueltigeId(d.id) ||
      !gueltigesDatum(d.datum) || typeof d.referenz !== 'string' ||
      d.referenz.trim().length > 120) {
    return json({ fehler: 'Bitte gültigen Beleg, Datum und eine Buchungsreferenz eingeben.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const collection = db.collection(d.typ === 'rechnung'
    ? 'vereinskleider_rechnungen' : 'vereinskleider_gutschriften');
  try {
    const jetzt = new Date();
    const bestaetigung = {
      datum: d.datum, referenz: d.referenz.trim(), erfasstAm: jetzt,
      erfasstVon: locals.benutzer!.id,
      erfasstVonName: [locals.benutzer!.vorname, locals.benutzer!.nachname]
        .filter(Boolean).join(' ').trim() || 'Unbekannt'
    };
    const aktualisiert = await collection.updateOne({
      _id: new ObjectId(d.id), vereinId, clubdeskVerbuchung: { $exists: false }
    }, { $set: { clubdeskVerbuchung: bestaetigung } });
    if (aktualisiert.modifiedCount !== 1) {
      const vorhanden = await collection.findOne({ _id: new ObjectId(d.id), vereinId },
        { projection: { clubdeskVerbuchung: 1 } });
      return json({ fehler: vorhanden
        ? 'Dieser Beleg wurde bereits als in ClubDesk verbucht markiert.'
        : 'Beleg nicht gefunden.' }, { status: vorhanden ? 409 : 404 });
    }
    return json({ erfolg: true, clubdeskVerbuchung: bestaetigung });
  } catch (e) {
    console.error('ClubDesk-Abgleich:', e);
    return json({ fehler: 'Buchungsbestätigung konnte nicht gespeichert werden.' }, { status: 500 });
  }
};
