
import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { db } from '../../../lib/server/mongodb';

export async function POST({ cookies }: {
  cookies: {
    get: (name: string) => string | undefined;
    delete: (name: string, options: { path: string }) => void;
  };
}) {
  try {
    const sessionToken = cookies.get('clubmatiq_session');

    if (sessionToken) {
      const tokenHash = createHash('sha256')
        .update(sessionToken)
        .digest('hex');

      await db.collection('sessions').deleteOne({
        tokenHash
      });
    }

    cookies.delete('clubmatiq_session', {
      path: '/'
    });

    return json({
      erfolg: true,
      meldung: 'Erfolgreich abgemeldet.'
    });
  } catch (error) {
    console.error('Fehler beim Abmelden:', error);

    return json(
      { fehler: 'Abmeldung fehlgeschlagen.' },
      { status: 500 }
    );
  }
}
