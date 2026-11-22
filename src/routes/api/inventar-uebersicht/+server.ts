import { json } from '@sveltejs/kit';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// Gemeinsame Inventardaten für Inventarverwaltung und Inventarbewertung.
// Fehlende Preise bleiben in den bisherigen numerischen Feldern 0,
// werden aber zusätzlich explizit gekennzeichnet.
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.benutzer) {
    return json({ fehler: 'Nicht angemeldet.' }, { status: 401 });
  }

  const vereinId = locals.benutzer.vereinId;

  try {
    const [artikel, kategorien, lagerorte, groessen, varianten] = await Promise.all([
      db.collection('artikel').find({ vereinId }).sort({ name: 1 }).toArray(),
      db.collection('kategorien').find({ vereinId }).toArray(),
      db.collection('lagerorte').find({ vereinId }).toArray(),
      db.collection('groessen').find({ vereinId }).toArray(),
      db.collection('artikelvarianten').find({ vereinId }).toArray()
    ]);

    const kategorieNamen = new Map(kategorien.map((k) => [k._id.toString(), k.name]));
    const lagerortNamen = new Map(lagerorte.map((l) => [l._id.toString(), l.name]));
    const groessenNamen = new Map(
      groessen.map((g) => [g._id.toString(), {
        bezeichnung: g.bezeichnung,
        sortierung: g.sortierung
      }])
    );

    const preisVorhanden = (wert: unknown): wert is number =>
      typeof wert === 'number' && Number.isFinite(wert) && wert >= 0;

    const daten = artikel.map((eintrag) => {
      const artikelId = eintrag._id.toString();

      const artikelVarianten = varianten
        .filter((v) => v.artikelId === artikelId)
        .map((v) => ({
          groesseId: v.groesseId,
          groesse: groessenNamen.get(v.groesseId)?.bezeichnung ?? 'Unbekannt',
          sortierung: groessenNamen.get(v.groesseId)?.sortierung ?? 9999,
          menge: v.menge ?? 0,
          einzelwert: preisVorhanden(v.einzelwert) ? v.einzelwert : 0,
          preisFehlt: !preisVorhanden(v.einzelwert),
          mindestbestand: Number.isSafeInteger(v.mindestbestand) && v.mindestbestand > 0 ? v.mindestbestand : 0,
          unterMindestbestand: v.aktiv !== false && Number.isSafeInteger(v.mindestbestand) && v.mindestbestand > 0 && v.menge < v.mindestbestand
        }))
        .sort((a, b) => a.sortierung - b.sortierung);

      const gesamtmenge = eintrag.hatGroessen
        ? artikelVarianten.reduce((summe, v) => summe + v.menge, 0)
        : (eintrag.menge ?? 0);

      const einzelwert = preisVorhanden(eintrag.einzelwert) ? eintrag.einzelwert : 0;
      const preisFehlt = eintrag.hatGroessen
        ? artikelVarianten.some((v) => v.menge > 0 && v.preisFehlt)
        : gesamtmenge > 0 && !preisVorhanden(eintrag.einzelwert);

      const inventarwert = eintrag.hatGroessen
        ? artikelVarianten.reduce((summe, v) => summe + v.menge * v.einzelwert, 0)
        : gesamtmenge * einzelwert;

      return {
        _id: artikelId,
        name: eintrag.name,
        archiviert: eintrag.archiviert === true,
        archiviertAm: eintrag.archiviertAm ?? null,
        archiviertVonName: eintrag.archiviertVonName ?? null,
        kategorieId: eintrag.kategorieId,
        kategorie: kategorieNamen.get(eintrag.kategorieId) ?? 'Unbekannt',
        lagerortId: eintrag.lagerortId,
        lagerort: lagerortNamen.get(eintrag.lagerortId) ?? 'Unbekannt',
        beschreibung: eintrag.beschreibung ?? '',
        hatGroessen: eintrag.hatGroessen,
        gesamtmenge,
        mindestbestand: Number.isSafeInteger(eintrag.mindestbestand) && eintrag.mindestbestand > 0 ? eintrag.mindestbestand : 0,
        unterMindestbestand: eintrag.hatGroessen
          ? artikelVarianten.some((v) => v.unterMindestbestand)
          : Number.isSafeInteger(eintrag.mindestbestand) && eintrag.mindestbestand > 0 && gesamtmenge < eintrag.mindestbestand,
        inventarwert,
        einzelwert,
        preisFehlt,
        varianten: artikelVarianten
      };
    });

    return json(daten);
  } catch (error) {
    console.error('Inventarübersicht:', error);
    return json({ fehler: 'Inventarübersicht konnte nicht geladen werden.' }, { status: 500 });
  }
};
