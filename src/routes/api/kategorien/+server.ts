
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// GET: Kategorien des Vereins laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  // Berechtigung zum Lesen prüfen
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventar:lesen'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  // Vereins-ID aus der Session übernehmen
  const vereinId = locals.benutzer!.vereinId;

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
  // Berechtigung zur Stammdatenverwaltung prüfen
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'stammdaten:verwalten'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  // Vereins-ID aus der Session übernehmen
  const vereinId = locals.benutzer!.vereinId;

  // JSON-Daten sicher einlesen
  const daten = await request.json().catch(() => null);

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

  const bereinigterName = name.trim();

  try {
    // Kategorie mit Vereins-ID speichern
    const ergebnis = await db
      .collection('kategorien')
      .insertOne({
        vereinId,
        name: bereinigterName
      });

    return json(
      {
        _id: ergebnis.insertedId.toString(),
        name: bereinigterName
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
