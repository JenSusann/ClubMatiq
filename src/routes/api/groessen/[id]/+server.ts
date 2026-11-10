
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// PATCH: Grösse des Vereins bearbeiten
// ========================================

export const PATCH: RequestHandler = async ({
  params,
  request,
  locals
}) => {
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const vereinId = locals.benutzer.vereinId;
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Grössen-ID.' },
      { status: 400 }
    );
  }

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

  const bereinigteBezeichnung = bezeichnung.trim();

  const sichereBezeichnung =
    bereinigteBezeichnung.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

  try {
    const objektId = new ObjectId(id);

    // Prüfen, ob die Grösse zum Verein gehört
    const bestehendeGroesse = await db
      .collection('groessen')
      .findOne({
        _id: objektId,
        vereinId
      });

    if (!bestehendeGroesse) {
      return json(
        { fehler: 'Grösse nicht gefunden.' },
        { status: 404 }
      );
    }

    // Doppelte Bezeichnungen nur
    // innerhalb desselben Vereins prüfen
    const gleicherName = await db
      .collection('groessen')
      .findOne({
        vereinId,
        _id: { $ne: objektId },
        bezeichnung: {
          $regex: `^${sichereBezeichnung}$`,
          $options: 'i'
        }
      });

    if (gleicherName) {
      return json(
        {
          fehler:
            'Diese Grösse existiert in deinem Verein bereits.'
        },
        { status: 409 }
      );
    }

    // Nur Grösse des eigenen Vereins bearbeiten
    const ergebnis = await db
      .collection('groessen')
      .updateOne(
        {
          _id: objektId,
          vereinId
        },
        {
          $set: {
            bezeichnung: bereinigteBezeichnung,
            sortierung
          }
        }
      );

    if (ergebnis.matchedCount === 0) {
      return json(
        { fehler: 'Grösse nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Bearbeiten:', error);

    return json(
      {
        fehler: 'Grösse konnte nicht bearbeitet werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// DELETE: Grösse des Vereins löschen
// ========================================

export const DELETE: RequestHandler = async ({
  params,
  locals
}) => {
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const vereinId = locals.benutzer.vereinId;
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Grössen-ID.' },
      { status: 400 }
    );
  }

  try {
    const objektId = new ObjectId(id);

    // Prüfen, ob die Grösse zum Verein gehört
    const bestehendeGroesse = await db
      .collection('groessen')
      .findOne({
        _id: objektId,
        vereinId
      });

    if (!bestehendeGroesse) {
      return json(
        { fehler: 'Grösse nicht gefunden.' },
        { status: 404 }
      );
    }

    // Prüfen, ob die Grösse bei Varianten
    // des eigenen Vereins verwendet wird
    const anzahlVarianten = await db
      .collection('artikelvarianten')
      .countDocuments({
        groesseId: id,
        vereinId
      });

    if (anzahlVarianten > 0) {
      return json(
        {
          fehler:
            `Diese Grösse kann nicht gelöscht werden, da sie bei ${anzahlVarianten} Artikelvarianten verwendet wird.`
        },
        { status: 409 }
      );
    }

    // Nur Grösse des eigenen Vereins löschen
    const ergebnis = await db
      .collection('groessen')
      .deleteOne({
        _id: objektId,
        vereinId
      });

    if (ergebnis.deletedCount === 0) {
      return json(
        { fehler: 'Grösse nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);

    return json(
      {
        fehler: 'Grösse konnte nicht gelöscht werden.'
      },
      { status: 500 }
    );
  }
};
