
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// Alle Lagerorte laden
export const GET: RequestHandler = async () => {
  try {
    const lagerorte = await db
      .collection('lagerorte')
      .find()
      .sort({ name: 1 })
      .toArray();

    return json(
      lagerorte.map((lagerort) => ({
        _id: lagerort._id.toString(),
        name: lagerort.name
      }))
    );
  } catch (error) {
    console.error('Fehler beim Laden der Lagerorte:', error);

    return json(
      { fehler: 'Lagerorte konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// Neuen Lagerort erstellen
export const POST: RequestHandler = async ({ request }) => {
  try {
    const daten = await request.json().catch(() => null);
    const name = daten?.name;

    if (typeof name !== 'string' || !name.trim()) {
      return json(
        { fehler: 'Bitte einen Lagerortnamen eingeben.' },
        { status: 400 }
      );
    }

    const vorhandenerLagerort = await db
      .collection('lagerorte')
      .findOne({
        name: {
          $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i'
        }
      });

    if (vorhandenerLagerort) {
      return json(
        { fehler: 'Dieser Lagerort existiert bereits.' },
        { status: 409 }
      );
    }

    const ergebnis = await db
      .collection('lagerorte')
      .insertOne({ name: name.trim() });

    return json(
      {
        _id: ergebnis.insertedId.toString(),
        name: name.trim()
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Speichern des Lagerorts:', error);

    return json(
      { fehler: 'Lagerort konnte nicht gespeichert werden.' },
      { status: 500 }
    );
  }
};
