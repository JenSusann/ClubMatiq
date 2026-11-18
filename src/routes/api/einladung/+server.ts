import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { hash, argon2id } from 'argon2';
import { db, client } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';
import type { Einladung } from '../../../lib/server/einladungen';

export const GET: RequestHandler = async ({ url }) => {
  const token = url.searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ fehler: 'Ungültige Einladung.' }, { status: 400 });
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const einladung = await db.collection<Einladung>('einladungen').findOne({
    tokenHash, status: 'offen', ablaufdatum: { $gt: new Date() }
  });
  if (!einladung) return json({ fehler: 'Einladung ungültig oder abgelaufen.' }, { status: 404 });
  return json({ vorname: einladung.vorname, nachname: einladung.nachname, email: einladung.email });
};

export const POST: RequestHandler = async ({ request }) => {
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  const eingabe = daten as Record<string, unknown>;
  const token = typeof eingabe.token === 'string' ? eingabe.token : '';
  const passwort = typeof eingabe.passwort === 'string' ? eingabe.passwort : '';
  if (!/^[a-f0-9]{64}$/.test(token) || passwort.length < 12 || passwort.length > 1024) {
    return json({ fehler: 'Ungültiger Einladungslink oder Passwort zu kurz (mindestens 12 Zeichen).' }, { status: 400 });
  }
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwortHash = await hash(passwort, { type: argon2id });
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const einladungen = db.collection<Einladung>('einladungen');
      const einladung = await einladungen.findOne({
        tokenHash, status: 'offen', ablaufdatum: { $gt: new Date() }
      }, { session });
      if (!einladung) throw new Error('EINLADUNG_UNGUELTIG');
      const vorhanden = await db.collection('benutzer').findOne({ email: einladung.email }, { session });
      if (vorhanden) throw new Error('EMAIL_BEREITS_REGISTRIERT');
      const aktualisiert = await einladungen.updateOne({
        _id: einladung._id, status: 'offen', ablaufdatum: { $gt: new Date() }
      }, { $set: { status: 'angenommen', angenommenAm: new Date() } }, { session });
      if (aktualisiert.modifiedCount !== 1) throw new Error('EINLADUNG_UNGUELTIG');
      await db.collection('benutzer').insertOne({
        vereinId: einladung.vereinId,
        vorname: einladung.vorname,
        nachname: einladung.nachname,
        email: einladung.email,
        rolle: einladung.rolle,
        passwortHash,
        aktiv: true,
        erstelltAm: new Date()
      }, { session });
    });
    return json({ erfolg: true, nachricht: 'Dein Konto wurde erstellt. Du kannst dich jetzt anmelden.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_BEREITS_REGISTRIERT') {
      return json({ fehler: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'EINLADUNG_UNGUELTIG') {
      return json({ fehler: 'Einladung ungültig oder abgelaufen.' }, { status: 410 });
    }
    console.error('Einladung annehmen fehlgeschlagen:', error);
    return json({ fehler: 'Das Konto konnte nicht erstellt werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
