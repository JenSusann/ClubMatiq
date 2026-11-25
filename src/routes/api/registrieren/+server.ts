
import { json } from '@sveltejs/kit';
import { hash, argon2id } from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { client, db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

type Registrierungsdaten = {
  vereinsname?: string;
  vereinskuerzel?: string;
  vorname?: string;
  nachname?: string;
  email?: string;
  passwort?: string;
};

export const POST: RequestHandler = async ({
  request,
  cookies
}) => {
  try {
    const daten: Registrierungsdaten =
      await request.json().catch(() => ({}));

    const vereinsname = daten.vereinsname?.trim() ?? '';
    const vereinskuerzel = daten.vereinskuerzel?.trim() ?? '';
    const vorname = daten.vorname?.trim() ?? '';
    const nachname = daten.nachname?.trim() ?? '';
    const email = daten.email?.trim().toLowerCase() ?? '';
    const passwort = daten.passwort ?? '';

    // ========================================
    // Eingaben überprüfen
    // ========================================

    if (
      !vereinsname ||
      !vorname ||
      !nachname ||
      !email ||
      !passwort
    ) {
      return json(
        { fehler: 'Bitte alle Pflichtfelder ausfüllen.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(
        { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' },
        { status: 400 }
      );
    }

    if (passwort.length < 12) {
      return json(
        {
          fehler:
            'Das Passwort muss mindestens 12 Zeichen haben.'
        },
        { status: 400 }
      );
    }

    const benutzerCollection = db.collection('benutzer');

    // Der eindeutige Index verhindert auch parallele Doppelregistrierungen.
    await benutzerCollection.createIndex({ email: 1 }, { unique: true });

    const vorhandenerBenutzer = await benutzerCollection.findOne({ email });
    if (vorhandenerBenutzer) {
      return json({ fehler: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }

    const passwortHash = await hash(passwort, { type: argon2id });
    const jetzt = new Date();
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const ablaufdatum = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const session = client.startSession();
    let vereinId = '';
    let benutzerId = '';

    try {
      // Verein, Benutzer und Anmeldung werden gemeinsam gespeichert oder verworfen.
      await session.withTransaction(async () => {
        const vereinErgebnis = await db.collection('vereine').insertOne({
          name: vereinsname,
          kuerzel: vereinskuerzel,
          erstelltAm: jetzt,
          integrationen: { clubdesk: { aktiviert: false, status: 'nicht_verbunden' } }
        }, { session });
        vereinId = vereinErgebnis.insertedId.toString();

        const benutzerErgebnis = await benutzerCollection.insertOne({
          vereinId,
          vorname,
          nachname,
          email,
          passwortHash,
          rolle: 'admin',
          aktiv: true,
          erstelltAm: jetzt
        }, { session });
        benutzerId = benutzerErgebnis.insertedId.toString();

        await db.collection('sessions').insertOne({
          tokenHash,
          benutzerId,
          vereinId,
          erstelltAm: jetzt,
          letzteAktivitaet: jetzt,
          ablaufdatum
        }, { session });
      });
    } finally {
      await session.endSession();
    }

    cookies.set('clubmatiq_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: ablaufdatum
    });

    return json({
      erfolg: true,
      nachricht: 'Verein erstellt und automatisch angemeldet.',
      vereinId,
      benutzerId
    }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return json({ fehler: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }
    console.error('Registrierungsfehler:', error);

    return json(
      {
        fehler:
          'Die Registrierung konnte nicht abgeschlossen werden.'
      },
      { status: 500 }
    );
  }
};
