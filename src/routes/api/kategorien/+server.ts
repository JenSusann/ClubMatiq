
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// GET: Kategorien des Vereins laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  // Prüfen, ob Benutzer angemeldet ist
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // Vereins-ID aus der Session übernehmen
  const vereinId = locals.benutzer.vereinId;

  try {
    const kategorien = await db
      .collection('kategorien')
      .find({ vereinId })
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
      {
        fehler: 'Kategorien konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Neue Kategorie für Verein speichern
// ========================================

export const POST: RequestHandler = async ({
  request,
  locals
}) => {
  // Prüfen, ob Benutzer angemeldet ist
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // Vereins-ID aus der Session übernehmen
  const vereinId = locals.benutzer.vereinId;

  try {
    const daten = await request.json();

    if (
      !daten ||
      typeof daten !== 'object' ||
      Array.isArray(daten)
    ) {
      return json(
        { fehler: 'Ungültige Kategoriedaten.' },
        { status: 400 }
      );
    }

    const name = daten.name;

    if (typeof name !== 'string' || !name.trim()) {
      return json(
        { fehler: 'Bitte einen Kategorienamen eingeben.' },
        { status: 400 }
      );
    }

    // Kategorie mit Vereins-ID speichern
    const ergebnis = await db
      .collection('kategorien')
      .insertOne({
        vereinId,
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
      {
        fehler: 'Kategorie konnte nicht gespeichert werden.'
      },
      { status: 500 }
    );
  }
};
