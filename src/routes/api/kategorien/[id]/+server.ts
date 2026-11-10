
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// Kategorie bearbeiten
export const PATCH: RequestHandler = async ({ params, request }) => {
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
    const ergebnis = await db.collection('kategorien').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name: name.trim() } }
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
      { fehler: 'Kategorie konnte nicht bearbeitet werden.' },
      { status: 500 }
    );
  }
};

// Kategorie löschen
export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json(
      { fehler: 'Ungültige Kategorie-ID.' },
      { status: 400 }
    );
  }

  try {
    // Prüfen, ob Artikel zugeordnet sind
    const anzahlArtikel = await db.collection('artikel').countDocuments({
      kategorieId: id
    });

    if (anzahlArtikel > 0) {
      return json(
        {
          fehler: `Diese Kategorie kann nicht gelöscht werden, da ${anzahlArtikel} Artikel zugeordnet sind.`
        },
        { status: 409 }
      );
    }

    const ergebnis = await db.collection('kategorien').deleteOne({
      _id: new ObjectId(id)
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
      { fehler: 'Kategorie konnte nicht gelöscht werden.' },
      { status: 500 }
    );
  }
};
