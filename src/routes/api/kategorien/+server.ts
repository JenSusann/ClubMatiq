
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';

// Alle Kategorien aus MongoDB abrufen
export async function GET() {
  try {
    const kategorien = await db
      .collection('kategorien')
      .find()
      .sort({ name: 1 })
      .toArray();

    return json(
      kategorien.map((kategorie) => ({
        _id: kategorie._id.toString(),
        name: kategorie.name
      }))
    );
  } catch (error) {
    console.error('Fehler beim Laden:', error);

    return json(
      { fehler: 'Kategorien konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
}

// Neue Kategorie in MongoDB speichern
export async function POST({ request }: { request: Request }) {
  try {
    const daten = await request.json();
    const name = daten.name;

    if (typeof name !== 'string' || !name.trim()) {
      return json(
        { fehler: 'Bitte einen Kategorienamen eingeben.' },
        { status: 400 }
      );
    }

    const ergebnis = await db.collection('kategorien').insertOne({
      name: name.trim()
    });

    return json(
      {
        _id: ergebnis.insertedId.toString(),
        name: name.trim()
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Speichern:', error);

    return json(
      { fehler: 'Kategorie konnte nicht gespeichert werden.' },
      { status: 500 }
    );
  }
}
