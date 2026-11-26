import { db, client } from './mongodb';
import { MongoServerError } from 'mongodb';

type Zeile = {
  artikelId: string; artikel: string; kategorie: string; lagerort: string;
  groesse: string; menge: number; einzelwert: number | null; gesamtwert: number | null;
};
export type Aufnahme = {
  vereinId: string; aufgenommenAm: Date; aufgenommenVon: string; zeilen: Zeile[]; automatischDatum?: string;
};

export function bewertungsdatum(zeit: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(zeit);
}

export async function bewertungSpeichern(vereinId: string, aufgenommenVon: string, automatisch = false) {
  const collection = db.collection<Aufnahme>('inventarbewertung_aufnahmen');
  if (automatisch) {
    await collection.createIndex({ vereinId: 1, automatischDatum: 1 }, { unique: true, partialFilterExpression: { automatischDatum: { $exists: true } }, name: 'automatische_bewertung_pro_tag' });
  }
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const aufgenommenAm = new Date();
      const automatischDatum = bewertungsdatum(aufgenommenAm);
      if (automatisch && await collection.findOne({ vereinId, automatischDatum }, { session })) return null;
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
      const dokument = { vereinId, aufgenommenAm, aufgenommenVon, zeilen, ...(automatisch ? { automatischDatum } : {}) };
      const result = await collection.insertOne(dokument, { session });
      return { _id: result.insertedId, aufgenommenAm, anzahlPositionen: zeilen.length };

    }, { readConcern: { level: 'snapshot' } });
  } catch (error) {
    if (automatisch && error instanceof MongoServerError && error.code === 11000 && error.keyPattern?.automatischDatum === 1) return null;
    throw error;
  } finally {
    await session.endSession();
  }
}
