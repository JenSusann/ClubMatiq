
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// PATCH: Kategorie des Vereins bearbeiten
// ========================================

export const PATCH: RequestHandler = async ({
  params,
  request,
  locals
}) => {
  // Anmeldung überprüfen
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
      { fehler: 'Ungültige Kategorie-ID.' },
      { status: 400 }
    );
  }

  const daten = await request.json().catch(() => null);
  const name = daten?.name;

  if (typeof name !== 'string' || !name.trim()) {
    return json(
      { fehler: 'Bitte einen Kategorienamen eingeben.' },
      { status: 400 }
    );
  }

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
            name: name.trim()
          }
        }
      );

    if (ergebnis.matchedCount === 0) {
      return json(
        { fehler: 'Kategorie nicht gefunden.' },
        { status: 404 }
      );
    }

    return json({ erfolg: true });
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
  // Anmeldung überprüfen
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

    return json({ erfolg: true });
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
