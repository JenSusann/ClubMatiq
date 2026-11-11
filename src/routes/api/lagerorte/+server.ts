
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// GET: Lagerorte des Vereins laden
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
    const lagerorte = await db
      .collection('lagerorte')
      .find({ vereinId })
      .sort({ name: 1 })
      .toArray();

    return json(
      lagerorte.map((lagerort) => ({
        _id: lagerort._id.toString(),
        name: lagerort.name
      }))
    );
  } catch (error) {
    console.error(
      'Fehler beim Laden der Lagerorte:',
      error
    );

    return json(
      {
        fehler: 'Lagerorte konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Neuen Lagerort für Verein erstellen
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
      { fehler: 'Ungültige Lagerortdaten.' },
      { status: 400 }
    );
  }

  const name = daten.name;

  if (typeof name !== 'string' || !name.trim()) {
    return json(
      { fehler: 'Bitte einen Lagerortnamen eingeben.' },
      { status: 400 }
    );
  }

  const bereinigterName = name.trim();

  // Sonderzeichen für die Regex-Suche maskieren
  const sichererName = bereinigterName.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  try {
    // Doppelte Lagerorte nur innerhalb
    // des angemeldeten Vereins prüfen
    const vorhandenerLagerort = await db
      .collection('lagerorte')
      .findOne({
        vereinId,
        name: {
          $regex: `^${sichererName}$`,
          $options: 'i'
        }
      });

    if (vorhandenerLagerort) {
      return json(
        {
          fehler:
            'Dieser Lagerort existiert in deinem Verein bereits.'
        },
        { status: 409 }
      );
    }

    // Lagerort mit Vereinszuordnung speichern
    const ergebnis = await db
      .collection('lagerorte')
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
    console.error(
      'Fehler beim Speichern des Lagerorts:',
      error
    );

    return json(
      {
        fehler: 'Lagerort konnte nicht gespeichert werden.'
      },
      { status: 500 }
    );
  }
};
