import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import type { RequestHandler } from './$types';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;

  if (!ObjectId.isValid(params.id)) {
    return json({ fehler: 'Ungültige Benutzer-ID.' }, { status: 400 });
  }

  let eingabe: unknown;
  try {
    eingabe = await request.json();
  } catch {
    return json({ fehler: 'Ungültige JSON-Daten.' }, { status: 400 });
  }
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe) ||
      !('aktiv' in eingabe) || typeof eingabe.aktiv !== 'boolean') {
    return json({ fehler: 'Der Status muss aktiv oder inaktiv sein.' }, { status: 400 });
  }

  const aktiv = eingabe.aktiv;
  const vereinId = locals.benutzer!.vereinId;
  const benutzerId = new ObjectId(params.id);
  try {
    const collection = db.collection('benutzer');
    const ziel = await collection.findOne({ _id: benutzerId, vereinId });
    if (!ziel) return json({ fehler: 'Benutzer nicht gefunden.' }, { status: 404 });

    if (!aktiv && params.id === locals.benutzer!.id) {
      return json({ fehler: 'Du kannst dich nicht selbst deaktivieren.' }, { status: 409 });
    }
    if (!aktiv && ziel.rolle === 'admin' && ziel.aktiv !== false) {
      const andereAdmins = await collection.countDocuments({
        vereinId, rolle: 'admin', aktiv: true, _id: { $ne: benutzerId }
      });
      if (andereAdmins === 0) {
        return json({ fehler: 'Der letzte aktive Administrator kann nicht deaktiviert werden.' }, { status: 409 });
      }
    }

    await collection.updateOne({ _id: benutzerId, vereinId }, { $set: { aktiv } });
    if (!aktiv) {
      await db.collection('sessions').deleteMany({ benutzerId: params.id, vereinId });
    }
    return json({ erfolg: true, aktiv });
  } catch (error) {
    console.error('Fehler beim Ändern des Benutzerstatus:', error);
    return json({ fehler: 'Benutzerstatus konnte nicht geändert werden.' }, { status: 500 });
  }
};
