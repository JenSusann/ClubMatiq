import { json } from '@sveltejs/kit';
import { ObjectId, MongoServerError } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Riege = {
  vereinId: string;
  name: string;
  namensschluessel: string;
  bereich: 'juko' | 'aktive';
  aktiv: boolean;
  erstelltAm: Date;
  aktualisiertAm: Date;
};

function eingabe(daten: unknown) {
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return null;
  const d = daten as Record<string, unknown>;
  const name = typeof d.name === 'string' ? d.name.trim() : '';
  if (!name || name.length > 100 || (d.bereich !== 'juko' && d.bereich !== 'aktive') ||
      (d.aktiv !== undefined && typeof d.aktiv !== 'boolean')) return null;
  return { name, namensschluessel: name.normalize('NFC').toLocaleLowerCase('de-CH'),
    bereich: d.bereich as Riege['bereich'], aktiv: d.aktiv !== false };
}

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const riegen = await db.collection<Riege>('riegen').find({ vereinId: locals.benutzer!.vereinId }).sort({ name: 1 }).toArray();
  return json(riegen.map(r => ({ ...r, _id: r._id.toString() })));
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const daten = eingabe(await request.json().catch(() => null));
  if (!daten) return json({ fehler: 'Ungültige Riegendaten.' }, { status: 400 });
  const sammlung = db.collection<Riege>('riegen');
  const jetzt = new Date();
  try {
    await sammlung.createIndex({ vereinId: 1, namensschluessel: 1 }, { unique: true });
    const r = { ...daten, vereinId: locals.benutzer!.vereinId, erstelltAm: jetzt, aktualisiertAm: jetzt };
    const ergebnis = await sammlung.insertOne(r);
    return json({ ...r, _id: ergebnis.insertedId.toString() }, { status: 201 });
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) return json({ fehler: 'Diese Riege existiert bereits.' }, { status: 409 });
    throw e;
  }
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const roh = await request.json().catch(() => null);
  if (!roh || typeof roh.id !== 'string' || !ObjectId.isValid(roh.id) || typeof roh.aktiv !== 'boolean') {
    return json({ fehler: 'Ungültige Riegen-ID oder Aktivstatus.' }, { status: 400 });
  }
  const ergebnis = await db.collection<Riege>('riegen').updateOne(
    { _id: new ObjectId(roh.id), vereinId: locals.benutzer!.vereinId },
    { $set: { aktiv: roh.aktiv, aktualisiertAm: new Date() } }
  );
  if (!ergebnis.matchedCount) return json({ fehler: 'Riege nicht gefunden.' }, { status: 404 });
  return json({ erfolg: true });
};
