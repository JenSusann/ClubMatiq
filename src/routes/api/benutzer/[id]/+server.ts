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


/**
 * Prüft sämtliche vereinsbezogenen Dokumente auf Referenzen auf eine Benutzer-ID.
 * Unbekannte Collections werden nicht stillschweigend übergangen. Bei zu grossen
 * Datenbeständen wird sicherheitshalber keine physische Löschung erlaubt.
 */
async function hatFachlicheReferenzen(vereinId: string, benutzerId: string): Promise<boolean> {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const id = new ObjectId(benutzerId);
  let gepruefteDokumente = 0;
  const enthaeltReferenz = (wert: unknown): boolean => {
    if (typeof wert === 'string') return wert === benutzerId;
    if (wert instanceof ObjectId) return wert.equals(id);
    if (Array.isArray(wert)) return wert.some(enthaeltReferenz);
    if (wert && typeof wert === 'object' && !(wert instanceof Date)) {
      return Object.values(wert).some(enthaeltReferenz);
    }
    return false;
  };

  for (const { name } of collections) {
    if (['benutzer', 'sessions', 'einladungen'].includes(name) || name.startsWith('system.')) continue;
    const cursor = db.collection(name).find({ vereinId });
    for await (const dokument of cursor) {
      if (++gepruefteDokumente > 10000) throw new Error('Referenzprüfung zu umfangreich.');
      if (enthaeltReferenz(dokument)) return true;
    }
  }
  return false;
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  if (!ObjectId.isValid(params.id)) return json({ fehler: 'Ungültige Benutzer-ID.' }, { status: 400 });
  if (params.id === locals.benutzer!.id) {
    return json({ fehler: 'Du kannst dein eigenes Benutzerkonto nicht löschen.' }, { status: 409 });
  }

  const vereinId = locals.benutzer!.vereinId;
  const _id = new ObjectId(params.id);
  try {
    const collection = db.collection('benutzer');
    const ziel = await collection.findOne({ _id, vereinId });
    if (!ziel) return json({ fehler: 'Benutzer nicht gefunden.' }, { status: 404 });
    if (ziel.rolle === 'admin' && ziel.aktiv !== false) {
      const andereAdmins = await collection.countDocuments({
        vereinId, rolle: 'admin', aktiv: true, _id: { $ne: _id }
      });
      if (andereAdmins === 0) {
        return json({ fehler: 'Der letzte aktive Administrator kann nicht gelöscht werden.' }, { status: 409 });
      }
    }

    if (await hatFachlicheReferenzen(vereinId, params.id)) {
      return json({
        fehler: 'Dieser Benutzer ist bereits in Vereinsdaten hinterlegt und kann nicht gelöscht werden. Bitte stattdessen deaktivieren.'
      }, { status: 409 });
    }

    const ergebnis = await collection.deleteOne({ _id, vereinId });
    if (!ergebnis.deletedCount) return json({ fehler: 'Benutzer wurde zwischenzeitlich geändert.' }, { status: 409 });
    await db.collection('sessions').deleteMany({ vereinId, benutzerId: params.id });
    return json({ erfolg: true, nachricht: 'Benutzer endgültig gelöscht.' });
  } catch (error) {
    console.error('Benutzer löschen fehlgeschlagen:', error instanceof Error ? error.name : 'Unbekannter Fehler');
    return json({
      fehler: 'Benutzer konnte nicht sicher gelöscht werden. Bitte stattdessen deaktivieren.'
    }, { status: 500 });
  }
};
