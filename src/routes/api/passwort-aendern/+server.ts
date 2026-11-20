import { json } from '@sveltejs/kit';
import { hash, verify, argon2id } from 'argon2';
import { ObjectId } from 'mongodb';
import type { RequestHandler } from './$types';
import { db } from '../../../lib/server/mongodb';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.benutzer) return json({ fehler: 'Nicht angemeldet.' }, { status: 401 });
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  }
  const eingabe = daten as Record<string, unknown>;
  const bisher = typeof eingabe.bisher === 'string' ? eingabe.bisher : '';
  const neu = typeof eingabe.neu === 'string' ? eingabe.neu : '';
  if (!bisher || neu.length < 12 || neu.length > 1024 || bisher === neu) {
    return json({ fehler: 'Das neue Passwort muss mindestens 12 Zeichen haben und sich vom bisherigen unterscheiden.' }, { status: 400 });
  }
  try {
    const collection = db.collection('benutzer');
    const filter = { _id: new ObjectId(locals.benutzer.id), vereinId: locals.benutzer.vereinId, aktiv: true };
    const benutzer = await collection.findOne(filter);
    if (!benutzer || typeof benutzer.passwortHash !== 'string' || !(await verify(benutzer.passwortHash, bisher))) {
      return json({ fehler: 'Das bisherige Passwort ist falsch.' }, { status: 401 });
    }
    const passwortHash = await hash(neu, { type: argon2id });
    await collection.updateOne({ ...filter, passwortHash: benutzer.passwortHash }, {
      $set: { passwortHash, passwortwechselErforderlich: false, passwortGeaendertAm: new Date() }
    }).then((result) => {
      if (result.matchedCount !== 1) throw new Error('PASSWORT_KONFLIKT');
    });
    return json({ erfolg: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'PASSWORT_KONFLIKT') {
      return json({ fehler: 'Das Passwort wurde inzwischen geändert. Bitte erneut anmelden.' }, { status: 409 });
    }
    console.error('Passwortwechsel fehlgeschlagen:', error);
    return json({ fehler: 'Passwort konnte nicht geändert werden.' }, { status: 500 });
  }
};
