import { json } from '@sveltejs/kit';
import { ObjectId, MongoServerError } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Zuordnung = {
  vereinId: string;
  gruppe: string;
  funktion: string | null;
  riegeId: ObjectId;
  erstelltAm: Date;
};

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const daten = await db.collection<Zuordnung>('clubdesk_gruppenzuordnungen')
    .find({ vereinId: locals.benutzer!.vereinId }).sort({ gruppe: 1, funktion: 1 }).toArray();
  return json(daten.map(z => ({ ...z, _id: z._id.toString(), riegeId: z.riegeId.toString() })));
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const d = await request.json().catch(() => null);
  if (!d || typeof d.gruppe !== 'string' || !d.gruppe.trim() || d.gruppe.length > 250 ||
      (d.funktion != null && (typeof d.funktion !== 'string' || d.funktion.length > 150)) ||
      typeof d.riegeId !== 'string' || !ObjectId.isValid(d.riegeId)) {
    return json({ fehler: 'Ungültige Gruppenzuordnung.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const riegeId = new ObjectId(d.riegeId);
  const riege = await db.collection('riegen').findOne({ _id: riegeId, vereinId, aktiv: true });
  if (!riege) return json({ fehler: 'Aktive Riege nicht gefunden.' }, { status: 404 });
  const sammlung = db.collection<Zuordnung>('clubdesk_gruppenzuordnungen');
  const z: Zuordnung = { vereinId, gruppe: d.gruppe.trim(), funktion: d.funktion?.trim() || null, riegeId, erstelltAm: new Date() };
  try {
    await sammlung.createIndex({ vereinId: 1, gruppe: 1, funktion: 1, riegeId: 1 }, { unique: true });
    const ergebnis = await sammlung.insertOne(z);
    return json({ ...z, _id: ergebnis.insertedId.toString(), riegeId: riegeId.toString() }, { status: 201 });
  } catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) return json({ fehler: 'Diese Zuordnung existiert bereits.' }, { status: 409 });
    throw e;
  }
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const id = url.searchParams.get('id');
  if (!id || !ObjectId.isValid(id)) return json({ fehler: 'Ungültige Zuordnungs-ID.' }, { status: 400 });
  const ergebnis = await db.collection<Zuordnung>('clubdesk_gruppenzuordnungen').deleteOne({
    _id: new ObjectId(id), vereinId: locals.benutzer!.vereinId
  });
  if (!ergebnis.deletedCount) return json({ fehler: 'Zuordnung nicht gefunden.' }, { status: 404 });
  return json({ erfolg: true });
};
