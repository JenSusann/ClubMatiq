
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';

export async function GET() {
  try {
    await db.command({ ping: 1 });

    return json({
      erfolg: true,
      nachricht: 'ClubMatiq ist mit MongoDB verbunden!'
    });
  } catch (error) {
    console.error('MongoDB-Fehler:', error);

    return json(
      {
        erfolg: false,
        nachricht: 'MongoDB-Verbindung fehlgeschlagen.'
      },
      { status: 500 }
    );
  }
}
