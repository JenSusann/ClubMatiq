
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// Grösse bearbeiten
export const PATCH: RequestHandler = async ({ params, request }) => {
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json({ fehler: 'Ungültige Grössen-ID.' }, { status: 400 });
  }

  const daten = await request.json().catch(() => null);
  const bezeichnung = daten?.bezeichnung;
  const sortierung = daten?.sortierung;

  if (typeof bezeichnung !== 'string' || !bezeichnung.trim()) {
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

  try {
    // Prüfen, ob eine andere Grösse bereits so heisst
    const gleicherName = await db.collection('groessen').findOne({
      _id: { $ne: new ObjectId(id) },
      bezeichnung: {
        $regex: `^${bezeichnung.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i'
      }
    });

    if (gleicherName) {
      return json(
        { fehler: 'Diese Grösse existiert bereits.' },
        { status: 409 }
      );
    }

    const ergebnis = await db.collection('groessen').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          bezeichnung: bezeichnung.trim(),
          sortierung
        }
      }
    );

    if (ergebnis.matchedCount === 0) {
      return json({ fehler: 'Grösse nicht gefunden.' }, { status: 404 });
    }

    return json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Bearbeiten:', error);

    return json(
      { fehler: 'Grösse konnte nicht bearbeitet werden.' },
      { status: 500 }
    );
  }
};

// Grösse löschen
export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json({ fehler: 'Ungültige Grössen-ID.' }, { status: 400 });
  }

  try {
    // Prüfen, ob die Grösse bei Artikelvarianten verwendet wird
    const anzahlVarianten = await db
      .collection('artikelvarianten')
      .countDocuments({ groesseId: id });

    if (anzahlVarianten > 0) {
      return json(
        {
          fehler: `Diese Grösse kann nicht gelöscht werden, da sie bei ${anzahlVarianten} Artikelvarianten verwendet wird.`
        },
        { status: 409 }
      );
    }

    const ergebnis = await db.collection('groessen').deleteOne({
      _id: new ObjectId(id)
    });

    if (ergebnis.deletedCount === 0) {
      return json({ fehler: 'Grösse nicht gefunden.' }, { status: 404 });
    }

    return json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);

    return json(
      { fehler: 'Grösse konnte nicht gelöscht werden.' },
      { status: 500 }
    );
  }
};
