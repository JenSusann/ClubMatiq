
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// PATCH: Lagerort des Vereins bearbeiten
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

  // Lagerort-ID überprüfen
  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Lagerort-ID.' },
      { status: 400 }
    );
  }

  // JSON-Daten sicher einlesen
  const daten = await request.json().catch(() => null);
  const name = daten?.name;

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
    const objektId = new ObjectId(id);

    // Prüfen, ob Lagerort zum Verein gehört
    const bestehenderLagerort = await db
      .collection('lagerorte')
      .findOne({
        _id: objektId,
        vereinId
      });

    if (!bestehenderLagerort) {
      return json(
        { fehler: 'Lagerort nicht gefunden.' },
        { status: 404 }
      );
    }

    // Doppelte Namen innerhalb des Vereins verhindern
    const gleicherName = await db
      .collection('lagerorte')
      .findOne({
        vereinId,
        _id: { $ne: objektId },
        name: {
          $regex: `^${sichererName}$`,
          $options: 'i'
        }
      });

    if (gleicherName) {
      return json(
        {
          fehler:
            'Dieser Lagerort existiert in deinem Verein bereits.'
        },
        { status: 409 }
      );
    }

    // Nur Lagerort des eigenen Vereins bearbeiten
    const ergebnis = await db
      .collection('lagerorte')
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
        { fehler: 'Lagerort nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({
      erfolg: true,
      name: bereinigterName
    });
  } catch (error) {
    console.error(
      'Fehler beim Bearbeiten des Lagerorts:',
      error
    );

    return json(
      {
        fehler: 'Lagerort konnte nicht bearbeitet werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// DELETE: Lagerort des Vereins löschen
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

  // Lagerort-ID überprüfen
  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Lagerort-ID.' },
      { status: 400 }
    );
  }

  try {
    const objektId = new ObjectId(id);

    // Prüfen, ob Lagerort zum Verein gehört
    const bestehenderLagerort = await db
      .collection('lagerorte')
      .findOne({
        _id: objektId,
        vereinId
      });

    if (!bestehenderLagerort) {
      return json(
        { fehler: 'Lagerort nicht gefunden.' },
        { status: 404 }
      );
    }

    // Prüfen, ob Artikel zugeordnet sind
    const anzahlArtikel = await db
      .collection('artikel')
      .countDocuments({
        lagerortId: id,
        vereinId
      });

    if (anzahlArtikel > 0) {
      return json(
        {
          fehler:
            `Dieser Lagerort kann nicht gelöscht werden, da ${anzahlArtikel} Artikel zugeordnet sind.`
        },
        { status: 409 }
      );
    }

    // Nur Lagerort des eigenen Vereins löschen
    const ergebnis = await db
      .collection('lagerorte')
      .deleteOne({
        _id: objektId,
        vereinId
      });

    if (ergebnis.deletedCount === 0) {
      return json(
        { fehler: 'Lagerort nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({
      erfolg: true,
      meldung: 'Lagerort wurde erfolgreich gelöscht.'
    });
  } catch (error) {
    console.error(
      'Fehler beim Löschen des Lagerorts:',
      error
    );

    return json(
      {
        fehler: 'Lagerort konnte nicht gelöscht werden.'
      },
      { status: 500 }
    );
  }
};
