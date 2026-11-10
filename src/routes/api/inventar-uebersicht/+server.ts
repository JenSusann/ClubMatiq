
import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// GET: Inventarübersicht des Vereins laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  // Anmeldung überprüfen
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // Vereins-ID aus der Session übernehmen
  const vereinId = locals.benutzer.vereinId;

  try {
    // Nur Daten des angemeldeten Vereins laden
    const [artikel, kategorien, lagerorte, groessen, varianten] =
      await Promise.all([
        db.collection('artikel')
          .find({ vereinId })
          .sort({ name: 1 })
          .toArray(),

        db.collection('kategorien')
          .find({ vereinId })
          .toArray(),

        db.collection('lagerorte')
          .find({ vereinId })
          .toArray(),

        db.collection('groessen')
          .find({ vereinId })
          .toArray(),

        db.collection('artikelvarianten')
          .find({ vereinId })
          .toArray()
      ]);

    // ========================================
    // Kategorien zuordnen
    // ========================================

    const kategorieNamen = new Map(
      kategorien.map((k) => [
        k._id.toString(),
        k.name
      ])
    );

    // ========================================
    // Lagerorte zuordnen
    // ========================================

    const lagerortNamen = new Map(
      lagerorte.map((l) => [
        l._id.toString(),
        l.name
      ])
    );

    // ========================================
    // Grössen zuordnen
    // ========================================

    const groessenNamen = new Map(
      groessen.map((g) => [
        g._id.toString(),
        {
          bezeichnung: g.bezeichnung,
          sortierung: g.sortierung
        }
      ])
    );

    // ========================================
    // Inventardaten zusammenstellen
    // ========================================

    const daten = artikel.map((eintrag) => {
      const artikelId = eintrag._id.toString();

      // Varianten des jeweiligen Artikels
      const artikelVarianten = varianten
        .filter((v) => v.artikelId === artikelId)
        .map((v) => ({
          groesseId: v.groesseId,
          groesse:
            groessenNamen.get(v.groesseId)?.bezeichnung ??
            'Unbekannt',
          sortierung:
            groessenNamen.get(v.groesseId)?.sortierung ??
            9999,
          menge: v.menge,
          einzelwert: v.einzelwert ?? 0
        }))
        .sort((a, b) => a.sortierung - b.sortierung);

      // ========================================
      // Gesamtbestand berechnen
      // ========================================

      const gesamtmenge = eintrag.hatGroessen
        ? artikelVarianten.reduce(
            (summe, v) => summe + v.menge,
            0
          )
        : eintrag.menge;

      // ========================================
      // Inventarwert berechnen
      // ========================================

      const inventarwert = eintrag.hatGroessen
        ? artikelVarianten.reduce(
            (summe, v) =>
              summe + v.menge * v.einzelwert,
            0
          )
        : eintrag.menge * eintrag.einzelwert;

      // ========================================
      // Artikel für Übersicht aufbereiten
      // ========================================

      return {
        _id: artikelId,
        name: eintrag.name,
        kategorieId: eintrag.kategorieId,
        kategorie:
          kategorieNamen.get(eintrag.kategorieId) ??
          'Unbekannt',
        lagerortId: eintrag.lagerortId,
        lagerort:
          lagerortNamen.get(eintrag.lagerortId) ??
          'Unbekannt',
        beschreibung: eintrag.beschreibung ?? '',
        hatGroessen: eintrag.hatGroessen,
        gesamtmenge,
        inventarwert,
        einzelwert: eintrag.einzelwert ?? 0,
        varianten: artikelVarianten
      };
    });

    return json(daten);
  } catch (error) {
    console.error('Inventarübersicht:', error);

    return json(
      {
        fehler:
          'Inventarübersicht konnte nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};
