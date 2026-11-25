import { json } from '@sveltejs/kit';
import { db, client } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

type Zeile = {
  artikelId: string; artikel: string; kategorie: string; lagerort: string;
  groesse: string; menge: number; einzelwert: number | null; gesamtwert: number | null;
};
type Aufnahme = {
  vereinId: string; aufgenommenAm: Date; aufgenommenVon: string; zeilen: Zeile[];
};
const zugriff = (benutzer: App.Locals['benutzer']) =>
  !benutzer ? json({ fehler: 'Nicht angemeldet.' }, { status: 401 }) :
  !['admin', 'materialverantwortlich'].includes(benutzer.rolle)
    ? json({ fehler: 'Keine Berechtigung für die Inventarbewertung.' }, { status: 403 }) : null;

export const GET: RequestHandler = async ({ locals }) => {
  const fehler = zugriff(locals.benutzer);
  if (fehler) return fehler;
  const daten = await db.collection<Aufnahme>('inventarbewertung_aufnahmen')
    .find({ vereinId: locals.benutzer!.vereinId })
    .project({ zeilen: 0 }).sort({ aufgenommenAm: -1 }).toArray();
  return json(daten);
};

export const POST: RequestHandler = async ({ locals }) => {
  const fehler = zugriff(locals.benutzer);
  if (fehler) return fehler;
  const vereinId = locals.benutzer!.vereinId;
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const aufgenommenAm = new Date();
      const artikel = await db.collection('artikel').find({ vereinId }, { session }).sort({ name: 1 }).toArray();
      const varianten = await db.collection('artikelvarianten').find({ vereinId }, { session }).toArray();
      const kategorien = await db.collection('kategorien').find({ vereinId }, { session }).toArray();
      const lagerorte = await db.collection('lagerorte').find({ vereinId }, { session }).toArray();
      const groessen = await db.collection('groessen').find({ vereinId }, { session }).toArray();
      const kat = new Map(kategorien.map(k => [String(k._id), String(k.name)]));
      const ort = new Map(lagerorte.map(k => [String(k._id), String(k.name)]));
      const gro = new Map(groessen.map(k => [String(k._id), String(k.bezeichnung)]));
      const zeilen: Zeile[] = [];
      for (const a of artikel) {
        const positionen = a.hatGroessen ? varianten.filter(v => String(v.artikelId) === String(a._id)) : [a];
        for (const p of positionen) {
          const menge = p.menge ?? 0;
          if (!Number.isSafeInteger(menge) || menge < 0) throw new Error('Ungültiger Bestand.');
          if (a.hatGroessen && menge === 0) continue;
          const einzelwert = typeof p.einzelwert === 'number' && Number.isFinite(p.einzelwert) && p.einzelwert >= 0 ? p.einzelwert : null;
          zeilen.push({ artikelId: String(a._id), artikel: String(a.name), kategorie: kat.get(String(a.kategorieId)) ?? 'Unbekannt',
            lagerort: ort.get(String(a.lagerortId)) ?? 'Unbekannt', groesse: a.hatGroessen ? gro.get(String(p.groesseId)) ?? 'Unbekannt' : '',
            menge, einzelwert, gesamtwert: einzelwert === null ? null : menge * einzelwert });
        }
      }
      const dokument = { vereinId, aufgenommenAm, aufgenommenVon: locals.benutzer!.id, zeilen };
      const result = await db.collection<Aufnahme>('inventarbewertung_aufnahmen').insertOne(dokument, { session });
      return { _id: result.insertedId, aufgenommenAm, anzahlPositionen: zeilen.length };
    }, { readConcern: { level: 'snapshot' } });
    return json(ergebnis, { status: 201 });
  } catch (error) {
    console.error('Bewertungsaufnahme:', error);
    return json({ fehler: 'Bewertungsaufnahme konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
