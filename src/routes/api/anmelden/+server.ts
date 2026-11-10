
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verify } from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../../../lib/server/mongodb';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const daten = await request.json();

    const email =
      typeof daten.email === 'string'
        ? daten.email.trim().toLowerCase()
        : '';

    const passwort =
      typeof daten.passwort === 'string'
        ? daten.passwort
        : '';

    // Eingaben prüfen
    if (!email || !passwort) {
      return json(
        { fehler: 'Bitte E-Mail-Adresse und Passwort eingeben.' },
        { status: 400 }
      );
    }

    // Benutzer in MongoDB suchen
    const benutzer = await db.collection('benutzer').findOne({
      email,
      aktiv: true
    });

    // Keine Information preisgeben, ob die E-Mail existiert
    if (
      !benutzer ||
      typeof benutzer.passwortHash !== 'string'
    ) {
      return json(
        { fehler: 'E-Mail-Adresse oder Passwort ist falsch.' },
        { status: 401 }
      );
    }

    // Passwort mit Argon2 überprüfen
    const passwortKorrekt = await verify(
      benutzer.passwortHash,
      passwort
    );

    if (!passwortKorrekt) {
      return json(
        { fehler: 'E-Mail-Adresse oder Passwort ist falsch.' },
        { status: 401 }
      );
    }

    // Zufälligen Session-Token erstellen
    const sessionToken = randomBytes(32).toString('hex');

    // Nur den Hash in der Datenbank speichern
    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    // Session bleibt 7 Tage gültig
    const ablaufdatum = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    // Session in MongoDB speichern
    await db.collection('sessions').insertOne({
      benutzerId: benutzer._id.toString(),
      vereinId: benutzer.vereinId,
      tokenHash,
      erstelltAm: new Date(),
      ablaufdatum
    });

    // Sicheres Session-Cookie setzen
    cookies.set('clubmatiq_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: ablaufdatum
    });

    return json({
      erfolg: true,
      meldung: 'Anmeldung erfolgreich.',
      benutzer: {
        id: benutzer._id.toString(),
        vorname: benutzer.vorname,
        nachname: benutzer.nachname,
        email: benutzer.email,
        rolle: benutzer.rolle,
        vereinId: benutzer.vereinId
      }
    });
  } catch (error) {
    console.error('Fehler bei der Anmeldung:', error);

    return json(
      { fehler: 'Bei der Anmeldung ist ein Fehler aufgetreten.' },
      { status: 500 }
    );
  }
};
