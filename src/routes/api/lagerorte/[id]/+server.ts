
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// Lagerort bearbeiten
export const PATCH: RequestHandler = async ({ params, request }) => {
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json({ fehler: 'Ungültige Lagerort-ID.' }, { status: 400 });
  }

  const daten = await request.json().catch(() => null);
  const name = daten?.name;

  if (typeof name !== 'string' || !name.trim()) {
    return json(
      { fehler: 'Bitte einen Lagerortnamen eingeben.' },
      { status: 400 }
    );
  }

  try {
    const ergebnis = await db.collection('lagerorte').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name: name.trim() } }
    );

    if (ergebnis.matchedCount === 0) {
      return json({ fehler: 'Lagerort nicht gefunden.' }, { status: 404 });
    }

    return json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Bearbeiten:', error);
    return json({ fehler: 'Bearbeiten fehlgeschlagen.' }, { status: 500 });
  }
};

// Lagerort löschen
export const DELETE: RequestHandler = async ({ params }) => {
  const { id } = params;

  if (!ObjectId.isValid(id)) {
    return json({ fehler: 'Ungültige Lagerort-ID.' }, { status: 400 });
  }

  try {
    const anzahlArtikel = await db.collection('artikel').countDocuments({
      lagerortId: id
    });

    if (anzahlArtikel > 0) {
      return json(
        {
          fehler: `Dieser Lagerort kann nicht gelöscht werden, da ${anzahlArtikel} Artikel zugeordnet sind.`
        },
        { status: 409 }
      );
    }

    const ergebnis = await db.collection('lagerorte').deleteOne({
      _id: new ObjectId(id)
    });

    if (ergebnis.deletedCount === 0) {
      return json({ fehler: 'Lagerort nicht gefunden.' }, { status: 404 });
    }

    return json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    return json({ fehler: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
};
