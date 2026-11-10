
import { json } from '@sveltejs/kit';
import { hash, argon2id } from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../../../lib/server/mongodb';
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

    const vorhandenerBenutzer =
      await benutzerCollection.findOne({ email });

    if (vorhandenerBenutzer) {
      return json(
        {
          fehler:
            'Diese E-Mail-Adresse ist bereits registriert.'
        },
        { status: 409 }
      );
    }

    // Passwort sicher verschlüsselt speichern
    const passwortHash = await hash(passwort, {
      type: argon2id
    });

    const jetzt = new Date();

    // ========================================
    // Verein erstellen
    // ========================================

    const vereinErgebnis = await db
      .collection('vereine')
      .insertOne({
        name: vereinsname,
        kuerzel: vereinskuerzel,
        erstelltAm: jetzt,
        integrationen: {
          clubdesk: {
            aktiviert: false,
            status: 'nicht_verbunden'
          }
        }
      });

    const vereinId = vereinErgebnis.insertedId.toString();

    try {
      // ========================================
      // Administrator erstellen
      // ========================================

      const benutzerErgebnis =
        await benutzerCollection.insertOne({
          vereinId,
          vorname,
          nachname,
          email,
          passwortHash,
          rolle: 'admin',
          aktiv: true,
          erstelltAm: jetzt
        });

      const benutzerId =
        benutzerErgebnis.insertedId.toString();

      // ========================================
      // Automatische Anmeldung erstellen
      // ========================================

      const token = randomBytes(32).toString('hex');

      const tokenHash = createHash('sha256')
        .update(token)
        .digest('hex');

      const ablaufdatum = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      );

      await db.collection('sessions').insertOne({
        tokenHash,
        benutzerId,
        vereinId,
        erstelltAm: new Date(),
        ablaufdatum
      });

      // ========================================
      // Session-Cookie setzen
      // ========================================

      cookies.set('clubmatiq_session', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: ablaufdatum
      });

      return json(
        {
          erfolg: true,
          nachricht:
            'Verein erstellt und automatisch angemeldet.',
          vereinId,
          benutzerId
        },
        { status: 201 }
      );
    } catch (fehler) {
      // Hinweis: Bei Fehlern nach dem Erstellen
      // des Administrators ist eine vollständige
      // Rückabwicklung separat nötig.
      console.error(
        'Fehler bei der Einrichtung:',
        fehler
      );

      throw fehler;
    }
  } catch (error) {
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
