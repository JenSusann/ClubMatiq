import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Lieferant = {
  vereinId: string;
  name: string;
  kontaktperson: string;
  email: string;
  telefon: string;
  bemerkung: string;
  erstelltAm: Date;
  aktualisiertAm: Date;
};

type Eingabe = Record<string, unknown>;

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && ObjectId.isValid(wert) && new ObjectId(wert).toString() === wert.toLowerCase();
}

function leseDaten(eingabe: unknown): { daten: Pick<Lieferant, 'name' | 'kontaktperson' | 'email' | 'telefon' | 'bemerkung'> } | { fehler: string } {
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) {
    return { fehler: 'Ungültige Eingabe.' };
  }
  const roh = eingabe as Eingabe;
  const felder = ['name', 'kontaktperson', 'email', 'telefon', 'bemerkung'] as const;
  for (const feld of felder) {
    if (roh[feld] !== undefined && typeof roh[feld] !== 'string') {
      return { fehler: `Das Feld «${feld}» muss Text enthalten.` };
    }
  }
  const name = (roh.name as string | undefined ?? '').trim();
  const kontaktperson = (roh.kontaktperson as string | undefined ?? '').trim();
  const email = (roh.email as string | undefined ?? '').trim();
  const telefon = (roh.telefon as string | undefined ?? '').trim();
  const bemerkung = (roh.bemerkung as string | undefined ?? '').trim();
  if (!name || name.length > 150) return { fehler: 'Lieferantenname muss 1 bis 150 Zeichen lang sein.' };
  if (kontaktperson.length > 150 || email.length > 254 || telefon.length > 60 || bemerkung.length > 2000) {
    return { fehler: 'Ein Feld überschreitet die zulässige Länge.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { fehler: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
  }
  return { daten: { name, kontaktperson, email, telefon, bemerkung } };
}

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  try {
    const lieferanten = await db.collection<Lieferant>('lieferanten')
      .find({ vereinId: locals.benutzer!.vereinId })
      .sort({ name: 1 })
      .toArray();
    return json(lieferanten.map((l) => ({ ...l, _id: l._id.toString() })));
  } catch (fehler) {
    console.error('Lieferanten laden:', fehler);
    return json({ fehler: 'Lieferanten konnten nicht geladen werden.' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const eingabe: unknown = await request.json().catch(() => null);
  const validiert = leseDaten(eingabe);
  if ('fehler' in validiert) return json({ fehler: validiert.fehler }, { status: 400 });
  try {
    const vereinId = locals.benutzer!.vereinId;
    const vorhanden = await db.collection<Lieferant>('lieferanten').findOne({
      vereinId, name: { $regex: `^${validiert.daten.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    if (vorhanden) return json({ fehler: 'Ein Lieferant mit diesem Namen existiert bereits.' }, { status: 409 });
    const jetzt = new Date();
    const ergebnis = await db.collection<Lieferant>('lieferanten').insertOne({
      vereinId, ...validiert.daten, erstelltAm: jetzt, aktualisiertAm: jetzt
    });
    return json({ erfolg: true, id: ergebnis.insertedId.toString() }, { status: 201 });
  } catch (fehler) {
    console.error('Lieferant erstellen:', fehler);
    return json({ fehler: 'Lieferant konnte nicht erstellt werden.' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) {
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  }
  const roh = eingabe as Eingabe;
  if (!gueltigeId(roh.id)) return json({ fehler: 'Ungültige Lieferanten-ID.' }, { status: 400 });
  const validiert = leseDaten(roh);
  if ('fehler' in validiert) return json({ fehler: validiert.fehler }, { status: 400 });
  try {
    const ergebnis = await db.collection<Lieferant>('lieferanten').updateOne(
      { _id: new ObjectId(roh.id), vereinId: locals.benutzer!.vereinId },
      { $set: { ...validiert.daten, aktualisiertAm: new Date() } }
    );
    if (!ergebnis.matchedCount) return json({ fehler: 'Lieferant nicht gefunden.' }, { status: 404 });
    return json({ erfolg: true });
  } catch (fehler) {
    console.error('Lieferant ändern:', fehler);
    return json({ fehler: 'Lieferant konnte nicht geändert werden.' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) {
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  }
  const { id } = eingabe as Eingabe;
  if (!gueltigeId(id)) return json({ fehler: 'Ungültige Lieferanten-ID.' }, { status: 400 });
  try {
    const vereinId = locals.benutzer!.vereinId;
    const referenziert = await db.collection('artikel').findOne({
      vereinId, $or: [{ lieferantId: id }, { lieferantId: new ObjectId(id) }]
    });
    if (referenziert) return json({ fehler: 'Lieferant ist einem Artikel zugeordnet und kann nicht gelöscht werden.' }, { status: 409 });
    const sammel = await db.collection('vereinskleider_sammelbestellungen').findOne({
      vereinId, $or: [{ lieferantId: id }, { lieferantId: new ObjectId(id) }]
    });
    if (sammel) return json({ fehler: 'Lieferant wird in einer Sammelbestellung verwendet und kann nicht gelöscht werden.' }, { status: 409 });
    const ergebnis = await db.collection<Lieferant>('lieferanten').deleteOne({
      _id: new ObjectId(id), vereinId
    });
    if (!ergebnis.deletedCount) return json({ fehler: 'Lieferant nicht gefunden.' }, { status: 404 });
    return json({ erfolg: true });
  } catch (fehler) {
    console.error('Lieferant löschen:', fehler);
    return json({ fehler: 'Lieferant konnte nicht gelöscht werden.' }, { status: 500 });
  }
};
