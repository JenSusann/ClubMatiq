import { json } from '@sveltejs/kit';
import { hash, argon2id } from 'argon2';
import type { RequestHandler } from './$types';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';

const rollen: App.Benutzerrolle[] = ['admin', 'materialverantwortlich', 'leiter', 'mitglied'];

export const POST: RequestHandler = async ({ request, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Eingabedaten.' }, { status: 400 });
  }
  const eingabe = daten as Record<string, unknown>;
  const vorname = typeof eingabe.vorname === 'string' ? eingabe.vorname.trim() : '';
  const nachname = typeof eingabe.nachname === 'string' ? eingabe.nachname.trim() : '';
  const email = typeof eingabe.email === 'string' ? eingabe.email.trim().toLowerCase() : '';
  const passwort = typeof eingabe.passwort === 'string' ? eingabe.passwort : '';
  const rolle = eingabe.rolle;
  if (!vorname || !nachname || vorname.length > 100 || nachname.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      passwort.length < 12 || passwort.length > 1024 ||
      typeof rolle !== 'string' || !rollen.includes(rolle as App.Benutzerrolle)) {
    return json({ fehler: 'Bitte gültige Angaben und ein Startpasswort mit mindestens 12 Zeichen eingeben.' }, { status: 400 });
  }
  try {
    const benutzer = db.collection('benutzer');
    // Das bestehende Login identifiziert Konten global anhand ihrer E-Mail-Adresse.
    if (await benutzer.findOne({ email })) {
      return json({ fehler: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }
    const passwortHash = await hash(passwort, { type: argon2id });
    const ergebnis = await benutzer.insertOne({
      vereinId: locals.benutzer!.vereinId,
      vorname, nachname, email, rolle, passwortHash,
      passwortwechselErforderlich: true,
      aktiv: true, erstelltAm: new Date()
    });
    return json({ erfolg: true, id: ergebnis.insertedId.toString(),
      nachricht: 'Benutzer erstellt. Beim ersten Login ist ein Passwortwechsel erforderlich.' }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return json({ fehler: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }
    console.error('Manuelle Benutzeranlage fehlgeschlagen:', error);
    return json({ fehler: 'Benutzer konnte nicht erstellt werden.' }, { status: 500 });
  }
};
