
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// Alle Grössen laden
export const GET: RequestHandler = async () => {
  try {
    const groessen = await db
      .collection('groessen')
      .find()
      .sort({ sortierung: 1, bezeichnung: 1 })
      .toArray();

    return json(
      groessen.map((groesse) => ({
        _id: groesse._id.toString(),
        bezeichnung: groesse.bezeichnung,
        sortierung: groesse.sortierung
      }))
    );
  } catch (error) {
    console.error('Fehler beim Laden der Grössen:', error);

    return json(
      { fehler: 'Grössen konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// Neue Grösse erstellen
export const POST: RequestHandler = async ({ request }) => {
  try {
    const daten = await request.json().catch(() => null);

    const bezeichnung = daten?.bezeichnung;
    const sortierung = daten?.sortierung;

    if (
      typeof bezeichnung !== 'string' ||
      !bezeichnung.trim()
    ) {
      return json(
        { fehler: 'Bitte eine Grössenbezeichnung eingeben.' },
        { status: 400 }
      );
    }

    if (
      typeof sortierung !== 'number' ||
      !Number.isInteger(sortierung) ||
      sortierung < 0
    ) {
      return json(
        { fehler: 'Bitte eine gültige Sortierung eingeben.' },
        { status: 400 }
      );
    }

    const vorhanden = await db.collection('groessen').findOne({
      bezeichnung: {
        $regex: `^${bezeichnung.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i'
      }
    });

    if (vorhanden) {
      return json(
        { fehler: 'Diese Grösse existiert bereits.' },
        { status: 409 }
      );
    }

    const ergebnis = await db.collection('groessen').insertOne({
      bezeichnung: bezeichnung.trim(),
      sortierung
    });

    return json(
      {
        _id: ergebnis.insertedId.toString(),
        bezeichnung: bezeichnung.trim(),
        sortierung
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Speichern der Grösse:', error);

    return json(
      { fehler: 'Grösse konnte nicht gespeichert werden.' },
      { status: 500 }
    );
  }
};
