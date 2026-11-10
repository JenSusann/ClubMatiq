
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// GET: Grössen des Vereins laden
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
    const groessen = await db
      .collection('groessen')
      .find({ vereinId })
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
      {
        fehler: 'Grössen konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Neue Grösse für Verein erstellen
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

  const vereinId = locals.benutzer.vereinId;

  try {
    const daten = await request.json().catch(() => null);

    if (
      !daten ||
      typeof daten !== 'object' ||
      Array.isArray(daten)
    ) {
      return json(
        { fehler: 'Ungültige Grössendaten.' },
        { status: 400 }
      );
    }

    const bezeichnung = daten.bezeichnung;
    const sortierung = daten.sortierung;

    // ========================================
    // Grössenbezeichnung prüfen
    // ========================================

    if (
      typeof bezeichnung !== 'string' ||
      !bezeichnung.trim()
    ) {
      return json(
        {
          fehler: 'Bitte eine Grössenbezeichnung eingeben.'
        },
        { status: 400 }
      );
    }

    // ========================================
    // Sortierung prüfen
    // ========================================

    if (
      typeof sortierung !== 'number' ||
      !Number.isInteger(sortierung) ||
      sortierung < 0
    ) {
      return json(
        {
          fehler: 'Bitte eine gültige Sortierung eingeben.'
        },
        { status: 400 }
      );
    }

    const bereinigteBezeichnung = bezeichnung.trim();

    // Sonderzeichen für Regex maskieren
    const sichereBezeichnung =
      bereinigteBezeichnung.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

    // ========================================
    // Doppelte Grössen innerhalb des Vereins prüfen
    // ========================================

    const vorhanden = await db
      .collection('groessen')
      .findOne({
        vereinId,
        bezeichnung: {
          $regex: `^${sichereBezeichnung}$`,
          $options: 'i'
        }
      });

    if (vorhanden) {
      return json(
        {
          fehler:
            'Diese Grösse existiert in deinem Verein bereits.'
        },
        { status: 409 }
      );
    }

    // ========================================
    // Neue Grösse speichern
    // ========================================

    const ergebnis = await db
      .collection('groessen')
      .insertOne({
        vereinId,
        bezeichnung: bereinigteBezeichnung,
        sortierung
      });

    return json(
      {
        _id: ergebnis.insertedId.toString(),
        bezeichnung: bereinigteBezeichnung,
        sortierung
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Speichern der Grösse:', error);

    return json(
      {
        fehler: 'Grösse konnte nicht gespeichert werden.'
      },
      { status: 500 }
    );
  }
};
