
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// PATCH: Kategorie des Vereins bearbeiten
// ========================================

export const PATCH: RequestHandler = async ({
  params,
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

  const vereinId = locals.benutzer!.vereinId;
  const { id } = params;

  // Kategorie-ID überprüfen
  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Kategorie-ID.' },
      { status: 400 }
    );
  }

  // JSON-Daten sicher einlesen
  const daten = await request.json().catch(() => null);
  const name = daten?.name;

  if (typeof name !== 'string' || !name.trim()) {
    return json(
      { fehler: 'Bitte einen Kategorienamen eingeben.' },
      { status: 400 }
    );
  }

  const bereinigterName = name.trim();

  try {
    const objektId = new ObjectId(id);

    // Nur Kategorie des eigenen Vereins bearbeiten
    const ergebnis = await db
      .collection('kategorien')
      .updateOne(
        {
          _id: objektId,
          vereinId
        },
        {
          $set: {
            name: bereinigterName
          }
        }
      );

    if (ergebnis.matchedCount === 0) {
      return json(
        { fehler: 'Kategorie nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({
      erfolg: true,
      name: bereinigterName
    });
  } catch (error) {
    console.error('Fehler beim Bearbeiten:', error);

    return json(
      {
        fehler: 'Kategorie konnte nicht bearbeitet werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// DELETE: Kategorie des Vereins löschen
// ========================================

export const DELETE: RequestHandler = async ({
  params,
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

  const vereinId = locals.benutzer!.vereinId;
  const { id } = params;

  // Kategorie-ID überprüfen
  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Kategorie-ID.' },
      { status: 400 }
    );
  }

  try {
    const objektId = new ObjectId(id);

    // Prüfen, ob die Kategorie zum Verein gehört
    const bestehendeKategorie = await db
      .collection('kategorien')
      .findOne({
        _id: objektId,
        vereinId
      });

    if (!bestehendeKategorie) {
      return json(
        { fehler: 'Kategorie nicht gefunden.' },
        { status: 404 }
      );
    }

    // Prüfen, ob Artikel des eigenen Vereins
    // dieser Kategorie zugeordnet sind
    const anzahlArtikel = await db
      .collection('artikel')
      .countDocuments({
        kategorieId: id,
        vereinId
      });

    if (anzahlArtikel > 0) {
      return json(
        {
          fehler:
            `Diese Kategorie kann nicht gelöscht werden, da ${anzahlArtikel} Artikel zugeordnet sind.`
        },
        { status: 409 }
      );
    }

    // Nur Kategorie des eigenen Vereins löschen
    const ergebnis = await db
      .collection('kategorien')
      .deleteOne({
        _id: objektId,
        vereinId
      });

    if (ergebnis.deletedCount === 0) {
      return json(
        { fehler: 'Kategorie nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({
      erfolg: true,
      meldung: 'Kategorie wurde erfolgreich gelöscht.'
    });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);

    return json(
      {
        fehler: 'Kategorie konnte nicht gelöscht werden.'
      },
      { status: 500 }
    );
  }
};
