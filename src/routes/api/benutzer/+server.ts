import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';

export const GET: RequestHandler = async ({ locals }) => {
  // Nur Administratoren dürfen Benutzer verwalten
  const fehler = pruefeBerechtigung(
    locals.benutzer,
    'benutzer:verwalten'
  );

  if (fehler) {
    return fehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  try {
    // Ausschliesslich Benutzer des eigenen Vereins laden
    const benutzer = await db
      .collection('benutzer')
      .find({ vereinId })
      .project({
        passwortHash: 0
      })
      .sort({
        nachname: 1,
        vorname: 1
      })
      .toArray();

    // MongoDB-IDs für die API umwandeln
    const ergebnis = benutzer.map((person) => ({
      id: person._id.toString(),
      vorname: person.vorname,
      nachname: person.nachname,
      email: person.email,
      rolle: person.rolle,
      aktiv: person.aktiv
    }));

    return json(ergebnis);
  } catch (error) {
    console.error(
      'Fehler beim Laden der Benutzer:',
      error
    );

    return json(
      {
        fehler: 'Benutzer konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};
