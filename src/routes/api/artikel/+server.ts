import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Variante = {
  groesseId: string;
  menge: number;
  einzelwert: number;
  mindestbestand: number;
};

// ========================================
// GET: Inventarartikel des Vereins laden
// ========================================
export const GET: RequestHandler = async ({ locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'inventar:lesen');
  if (berechtigungsfehler) return berechtigungsfehler;

  const vereinId = locals.benutzer!.vereinId;
  try {
    const artikel = await db.collection('artikel')
      .find({ vereinId })
      .sort({ name: 1 })
      .toArray();

    return json(artikel.map((eintrag) => ({
      ...eintrag,
      _id: eintrag._id.toString(),
      // Alte Artikel ohne Lieferanten bleiben kompatibel.
      lieferantId: typeof eintrag.lieferantId === 'string' ? eintrag.lieferantId : null
    })));
  } catch (error) {
    console.error('Fehler beim Laden:', error);
    return json({ fehler: 'Inventarartikel konnten nicht geladen werden.' }, { status: 500 });
  }
};

// ========================================
// POST: Neuen Inventarartikel speichern
// ========================================
export const POST: RequestHandler = async ({ request, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'inventar:bearbeiten');
  if (berechtigungsfehler) return berechtigungsfehler;

  const vereinId = locals.benutzer!.vereinId;
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Artikeldaten.' }, { status: 400 });
  }

  const eingabe = daten as Record<string, unknown>;
  const {
    name, kategorieId, lagerortId, menge, einzelwert,
    beschreibung, hatGroessen, varianten, lieferantId, mindestbestand, istVereinskleidung
  } = eingabe;

  // ========================================
  // Allgemeine Angaben prüfen
  // ========================================
  if (typeof name !== 'string' || !name.trim()) {
    return json({ fehler: 'Bitte eine Artikelbezeichnung eingeben.' }, { status: 400 });
  }

  if (typeof kategorieId !== 'string' || typeof lagerortId !== 'string' ||
      !ObjectId.isValid(kategorieId) || !ObjectId.isValid(lagerortId)) {
    return json({ fehler: 'Bitte eine gültige Kategorie und einen Lagerort wählen.' }, { status: 400 });
  }

  if (typeof einzelwert !== 'number' || !Number.isFinite(einzelwert) || einzelwert < 0) {
    return json({ fehler: 'Bitte einen gültigen Einzelwert eingeben.' }, { status: 400 });
  }

  if (istVereinskleidung !== undefined && typeof istVereinskleidung !== 'boolean') {
    return json({ fehler: 'Ungültige Vereinskleider-Kennzeichnung.' }, { status: 400 });
  }
  if (typeof hatGroessen !== 'boolean') {
    return json({ fehler: 'Ungültige Angabe zu Grössenvarianten.' }, { status: 400 });
  }

  if (beschreibung !== undefined && typeof beschreibung !== 'string') {
    return json({ fehler: 'Ungültige Beschreibung.' }, { status: 400 });
  }

  // Lieferant ist optional, da auch Nicht-Kleidungsartikel erfasst werden.
  // Für neue Vereinskleider wird die Zuordnung später im Frontend verlangt.
  const normalisierteLieferantId = lieferantId === undefined || lieferantId === null || lieferantId === ''
    ? null : lieferantId;
  if (normalisierteLieferantId !== null &&
      (typeof normalisierteLieferantId !== 'string' || !ObjectId.isValid(normalisierteLieferantId))) {
    return json({ fehler: 'Bitte einen gültigen Lieferanten wählen.' }, { status: 400 });
  }

  if (typeof mindestbestand !== 'number' || !Number.isSafeInteger(mindestbestand) || mindestbestand < 0) {
    return json({ fehler: 'Ungültiger Mindestbestand.' }, { status: 400 });
  }

  // ========================================
  // Bestand und Grössen prüfen
  // ========================================
  let gesamtmenge = 0;
  let gepruefteVarianten: Variante[] = [];

  if (hatGroessen) {
    if (!Array.isArray(varianten) || varianten.length === 0) {
      return json({ fehler: 'Bitte Grössenvarianten angeben.' }, { status: 400 });
    }

    for (const variante of varianten) {
      if (!variante || typeof variante !== 'object' || Array.isArray(variante) ||
          typeof variante.groesseId !== 'string' || !ObjectId.isValid(variante.groesseId) ||
          typeof variante.menge !== 'number' || !Number.isInteger(variante.menge) || variante.menge < 0 ||
          typeof variante.einzelwert !== 'number' || !Number.isFinite(variante.einzelwert) ||
          variante.einzelwert < 0 ||
          typeof variante.mindestbestand !== 'number' || !Number.isSafeInteger(variante.mindestbestand) || variante.mindestbestand < 0) {
        return json({ fehler: 'Ungültige Grössenbestände oder Einzelwerte.' }, { status: 400 });
      }
    }

    gepruefteVarianten = varianten as Variante[];
    const groessenIds = gepruefteVarianten.map((variante) => variante.groesseId);
    if (new Set(groessenIds).size !== groessenIds.length) {
      return json({ fehler: 'Eine Grösse wurde mehrfach angegeben.' }, { status: 400 });
    }
    gesamtmenge = gepruefteVarianten.reduce((summe, variante) => summe + variante.menge, 0);
  } else {
    if (typeof menge !== 'number' || !Number.isInteger(menge) || menge < 0) {
      return json({ fehler: 'Bitte eine gültige Menge eingeben.' }, { status: 400 });
    }
    gesamtmenge = menge;
  }

  // ========================================
  // Datenbank
  // ========================================
  try {
    const [kategorie, lagerort, lieferant] = await Promise.all([
      db.collection('kategorien').findOne({ _id: new ObjectId(kategorieId), vereinId }),
      db.collection('lagerorte').findOne({ _id: new ObjectId(lagerortId), vereinId }),
      normalisierteLieferantId === null
        ? Promise.resolve(null)
        : db.collection('lieferanten').findOne({ _id: new ObjectId(normalisierteLieferantId as string), vereinId })
    ]);

    if (!kategorie || !lagerort) {
      return json({ fehler: 'Kategorie oder Lagerort existiert nicht in deinem Verein.' }, { status: 400 });
    }
    if (normalisierteLieferantId !== null && !lieferant) {
      return json({ fehler: 'Der ausgewählte Lieferant existiert nicht in deinem Verein.' }, { status: 400 });
    }

    if (hatGroessen) {
      const groessenIds = gepruefteVarianten.map((variante) => new ObjectId(variante.groesseId));
      const anzahlGroessen = await db.collection('groessen').countDocuments({
        _id: { $in: groessenIds }, vereinId
      });
      if (anzahlGroessen !== groessenIds.length) {
        return json({ fehler: 'Mindestens eine Grösse existiert nicht in deinem Verein.' }, { status: 400 });
      }
    }

    // ========================================
    // Hauptartikel speichern
    // ========================================
    const ergebnis = await db.collection('artikel').insertOne({
      vereinId,
      name: name.trim(),
      kategorieId,
      lagerortId,
      lieferantId: normalisierteLieferantId,
      menge: gesamtmenge,
      mindestbestand: hatGroessen ? 0 : mindestbestand,
      einzelwert: hatGroessen ? 0 : einzelwert,
      beschreibung: (beschreibung ?? '').toString().trim(),
      hatGroessen,
      istVereinskleidung: istVereinskleidung === true,
      erstelltAm: new Date()
    });

    // ========================================
    // Grössenvarianten speichern
    // ========================================
    if (hatGroessen) {
      try {
        await db.collection('artikelvarianten').insertMany(
          gepruefteVarianten.map((variante) => ({
            vereinId,
            artikelId: ergebnis.insertedId.toString(),
            groesseId: variante.groesseId,
            menge: variante.menge,
            mindestbestand: variante.mindestbestand,
            einzelwert: variante.einzelwert
          }))
        );
      } catch (error) {
        await db.collection('artikelvarianten').deleteMany({
          artikelId: ergebnis.insertedId.toString(), vereinId
        });
        await db.collection('artikel').deleteOne({ _id: ergebnis.insertedId, vereinId });
        throw error;
      }
    }

    return json({ erfolg: true, artikelId: ergebnis.insertedId.toString(), gesamtmenge }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    return json({ fehler: 'Inventarartikel konnte nicht gespeichert werden.' }, { status: 500 });
  }
};
