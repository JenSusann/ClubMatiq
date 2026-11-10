
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// GET: Eigenen Verein laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  // Anmeldung überprüfen
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const vereinId = locals.benutzer.vereinId;

  if (!ObjectId.isValid(vereinId)) {
    return json(
      { fehler: 'Ungültige Vereins-ID.' },
      { status: 400 }
    );
  }

  try {
    // Nur den eigenen Verein aus MongoDB laden
    const verein = await db
      .collection('vereine')
      .findOne({
        _id: new ObjectId(vereinId)
      });

    if (!verein) {
      return json(
        { fehler: 'Verein nicht gefunden.' },
        { status: 404 }
      );
    }

    // Array beibehalten, damit bestehende
    // Frontend-Aufrufe kompatibel bleiben
    return json([
      {
        _id: verein._id.toString(),
        name: verein.name,
        kuerzel: verein.kuerzel ?? '',
        erstelltAm: verein.erstelltAm
      }
    ]);
  } catch (error) {
    console.error('Verein laden:', error);

    return json(
      { fehler: 'Verein konnte nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Vereinserstellung deaktiviert
// ========================================

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // Neue Vereine werden ausschliesslich
  // über die Registrierung angelegt.
  return json(
    {
      fehler:
        'Neue Vereine können nur über die Registrierung erstellt werden.'
    },
    { status: 403 }
  );
};
