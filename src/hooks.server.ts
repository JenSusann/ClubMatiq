
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { db } from './lib/server/mongodb';

type ClubMatiqEvent = {
  url: URL;
  cookies: {
    get: (name: string) => string | undefined;
    delete: (
      name: string,
      options: { path: string }
    ) => void;
  };
  locals: App.Locals;
};

type ClubMatiqHandle = {
  event: ClubMatiqEvent;
  resolve: (event: ClubMatiqEvent) => Promise<Response>;
};

// Seiten, die ohne Anmeldung erreichbar sind
const oeffentlicheSeiten = [
  '/anmelden',
  '/registrieren'
];

// API-Endpunkte, die ohne Anmeldung erreichbar sind
const oeffentlicheAPIs = [
  '/api/anmelden',
  '/api/registrieren'
];

export const handle = async ({
  event,
  resolve
}: ClubMatiqHandle): Promise<Response> => {
  // Standardmässig ist niemand angemeldet
  event.locals.benutzer = null;
  event.locals.sessionId = null;

  const sessionToken = event.cookies.get(
    'clubmatiq_session'
  );

  if (sessionToken) {
    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const session = await db.collection('sessions').findOne({
      tokenHash,
      ablaufdatum: { $gt: new Date() }
    });

    if (
      session &&
      typeof session.benutzerId === 'string' &&
      ObjectId.isValid(session.benutzerId)
    ) {
      const benutzer = await db.collection('benutzer').findOne({
        _id: new ObjectId(session.benutzerId),
        aktiv: true
      });

      if (benutzer) {
        event.locals.benutzer = {
          id: benutzer._id.toString(),
          vereinId: benutzer.vereinId,
          vorname: benutzer.vorname,
          nachname: benutzer.nachname,
          email: benutzer.email,
          rolle: benutzer.rolle
        };

        event.locals.sessionId = session._id.toString();
      }
    }

    // Ungültige oder abgelaufene Cookies entfernen
    if (!event.locals.benutzer) {
      event.cookies.delete('clubmatiq_session', {
        path: '/'
      });
    }
  }

  const pfad = event.url.pathname;

  const istOeffentlicheSeite =
    oeffentlicheSeiten.includes(pfad);

  const istOeffentlicheAPI =
    oeffentlicheAPIs.includes(pfad);

  const istAPI = pfad.startsWith('/api/');

  // Nicht angemeldete Benutzer schützen
  if (
    !event.locals.benutzer &&
    !istOeffentlicheSeite &&
    !istOeffentlicheAPI
  ) {
    // API-Aufrufe erhalten einen HTTP-Fehler
    if (istAPI) {
      return Response.json(
        {
          fehler: 'Nicht angemeldet.',
          code: 'NICHT_ANGEMELDET'
        },
        { status: 401 }
      );
    }

    // Seitenbesucher zur Anmeldung weiterleiten
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/anmelden'
      }
    });
  }

  // Angemeldete Benutzer von der Login-Seite
  // zur Startseite weiterleiten
  if (
    event.locals.benutzer &&
    pfad === '/anmelden'
  ) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/'
      }
    });
  }

  return resolve(event);
};
