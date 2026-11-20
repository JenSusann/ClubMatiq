import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import type { RequestHandler } from './$types';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { Einladung } from '../../../../../lib/server/einladungen';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  if (!ObjectId.isValid(params.id)) return json({ fehler: 'Ungültige Einladung.' }, { status: 400 });

  const vereinId = locals.benutzer!.vereinId;
  const _id = new ObjectId(params.id);
  try {
    const einladungen = db.collection<Einladung>('einladungen');
    const einladung = await einladungen.findOne({ _id, vereinId });
    if (!einladung) return json({ fehler: 'Einladung nicht gefunden.' }, { status: 404 });
    if (einladung.status === 'angenommen') {
      return json({ fehler: 'Angenommene Einladungen können nicht widerrufen werden.' }, { status: 409 });
    }
    if (einladung.status === 'widerrufen') {
      return json({ fehler: 'Diese Einladung wurde bereits widerrufen.' }, { status: 409 });
    }
    // Atomare Statusänderung verhindert Widerruf einer zwischenzeitlich angenommenen Einladung.
    const ergebnis = await einladungen.updateOne(
      { _id, vereinId, status: 'offen' },
      { $set: { status: 'widerrufen', widerrufenAm: new Date() } }
    );
    if (!ergebnis.modifiedCount) {
      return json({ fehler: 'Einladung wurde zwischenzeitlich angenommen oder geändert.' }, { status: 409 });
    }
    return json({ erfolg: true, nachricht: 'Einladung widerrufen. Der Einladungslink ist nicht mehr gültig.' });
  } catch (error) {
    console.error('Einladung widerrufen fehlgeschlagen:', error instanceof Error ? error.name : 'Unbekannter Fehler');
    return json({ fehler: 'Einladung konnte nicht widerrufen werden.' }, { status: 500 });
  }
};
