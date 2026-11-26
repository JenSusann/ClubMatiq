import { json } from '@sveltejs/kit';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

import { bewertungSpeichern, type Aufnahme } from '../../../../lib/server/inventarbewertung';

const zugriff = (benutzer: App.Locals['benutzer']) =>
  !benutzer ? json({ fehler: 'Nicht angemeldet.' }, { status: 401 }) :
  !['admin', 'materialverantwortlich'].includes(benutzer.rolle)
    ? json({ fehler: 'Keine Berechtigung für die Inventarbewertung.' }, { status: 403 }) : null;

export const GET: RequestHandler = async ({ locals }) => {
  const fehler = zugriff(locals.benutzer);
  if (fehler) return fehler;
  const daten = await db.collection<Aufnahme>('inventarbewertung_aufnahmen')
    .find({ vereinId: locals.benutzer!.vereinId })
    .project({ zeilen: 0 }).sort({ aufgenommenAm: -1 }).toArray();
  return json(daten);
};

export const POST: RequestHandler = async ({ locals }) => {
  const fehler = zugriff(locals.benutzer);
  if (fehler) return fehler;
  try {
    const ergebnis = await bewertungSpeichern(locals.benutzer!.vereinId, locals.benutzer!.id);
    return json(ergebnis, { status: 201 });
  } catch (error) {
    console.error('Bewertungsaufnahme:', error);
    return json({ fehler: 'Bewertungsaufnahme konnte nicht gespeichert werden.' }, { status: 500 });
  }
};
