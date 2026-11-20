import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { redirect } from '@sveltejs/kit';
import { db } from './lib/server/mongodb';

const oeffentlicheSeiten = new Set(['/', '/anmelden', '/registrieren', '/funktionen', '/einladung']);
const oeffentlicheAPIs = new Set(['/api/anmelden', '/api/registrieren', '/api/einladung']);

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

export const handle = async ({
  event,
  resolve
}: ClubMatiqHandle): Promise<Response> => {
  event.locals.benutzer = null;
  event.locals.sessionId = null;
  let passwortwechselErforderlich = false;

  const token = event.cookies.get('clubmatiq_session');
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await db.collection('sessions').findOne({ tokenHash, ablaufdatum: { $gt: new Date() } });
    if (session && typeof session.benutzerId === 'string' && ObjectId.isValid(session.benutzerId)) {
      const benutzer = await db.collection('benutzer').findOne({ _id: new ObjectId(session.benutzerId), aktiv: true });
      if (benutzer) {
        event.locals.benutzer = {
          id: benutzer._id.toString(), vereinId: benutzer.vereinId,
          vorname: benutzer.vorname, nachname: benutzer.nachname,
          email: benutzer.email, rolle: benutzer.rolle
        };
        event.locals.sessionId = session._id.toString();
        passwortwechselErforderlich = benutzer.passwortwechselErforderlich === true;
      }
    }
    if (!event.locals.benutzer) event.cookies.delete('clubmatiq_session', { path: '/' });
  }

  const pfad = event.url.pathname;
  const istOeffentlich = oeffentlicheSeiten.has(pfad) || pfad === '/docs' || pfad.startsWith('/docs/');
  const istAPI = pfad.startsWith('/api/');
  if (!event.locals.benutzer && !istOeffentlich && !oeffentlicheAPIs.has(pfad)) {
    if (istAPI) return Response.json({ fehler: 'Nicht angemeldet.', code: 'NICHT_ANGEMELDET' }, { status: 401 });
    redirect(303, `/anmelden?redirect=${encodeURIComponent(pfad)}`);
  }
  if (event.locals.benutzer && passwortwechselErforderlich) {
    const erlaubt = pfad === '/passwort-aendern' || pfad === '/api/passwort-aendern' ||
      pfad === '/api/abmelden' || pfad.startsWith('/_app/') || pfad === '/favicon.ico';
    if (!erlaubt) {
      if (istAPI) return Response.json({ fehler: 'Bitte zuerst das Startpasswort ändern.', code: 'PASSWORTWECHSEL_ERFORDERLICH' }, { status: 403 });
      redirect(303, '/passwort-aendern');
    }
  }
  if (event.locals.benutzer && pfad === '/anmelden') redirect(303, '/dashboard');
  return resolve(event);
};
