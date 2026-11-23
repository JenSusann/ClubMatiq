import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { leseJournalFilter } from '../../../../lib/server/lagerjournal-export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'inventar:lesen');
  if (fehler) return fehler;
  try {
    const { filter, suche } = leseJournalFilter(url);
    const vereinId = locals.benutzer!.vereinId;
    if (typeof filter.artikelId === 'string') {
      const artikel = await db.collection('artikel').findOne({ vereinId, _id: new ObjectId(filter.artikelId) });
      if (!artikel) return json({ fehler: 'Artikel nicht gefunden.' }, { status: 404 });
    }
    const [artikel, groessen, benutzer] = await Promise.all([
      db.collection('artikel').find({ vereinId }).project({ name: 1 }).toArray(),
      db.collection('groessen').find({ vereinId }).project({ bezeichnung: 1 }).toArray(),
      db.collection('benutzer').find({ vereinId }).project({ vorname: 1, nachname: 1 }).toArray()
    ]);
    const artikelNamen = new Map(artikel.map((a) => [a._id.toString(), String(a.name ?? '')]));
    const groessenNamen = new Map(groessen.map((g) => [g._id.toString(), String(g.bezeichnung ?? '')]));
    const benutzerNamen = new Map(benutzer.map((b) => [b._id.toString(), [b.vorname, b.nachname].filter(Boolean).join(' ')]));
    // Suche vor der 200er-Vorschaugrenze auswerten: ältere Treffer dürfen nicht verschwinden.
    // Cursor statt vollständigem toArray(), damit grosse Journale nicht komplett im RAM landen.
    const cursor = db.collection('lagerbewegungen')
      .find({ vereinId, ...filter })
      .sort({ zeitpunkt: -1, _id: -1 });
    if (!suche) cursor.limit(200);
    const zeilen = [];
    for await (const b of cursor) {
      const zeile = {
      id: b._id.toString(), zeitpunkt: b.zeitpunkt, artikelId: String(b.artikelId),
      artikel: artikelNamen.get(String(b.artikelId)) ?? 'Artikel nicht mehr vorhanden',
      groesse: b.groesseId ? groessenNamen.get(String(b.groesseId)) ?? 'Unbekannte Grösse' : '–',
      art: String(b.art), mengeDelta: b.mengeDelta,
      benutzer: benutzerNamen.get(String(b.benutzerId)) ?? 'Benutzer nicht mehr vorhanden',
      referenzTyp: String(b.referenzTyp ?? ''), referenzId: String(b.referenzId ?? '')
      };
      if (!suche || [zeile.artikel, zeile.groesse, zeile.art, zeile.benutzer, zeile.referenzTyp, zeile.referenzId]
        .some((wert) => wert.toLocaleLowerCase('de-CH').includes(suche))) {
        zeilen.push(zeile);
        if (zeilen.length >= 200) break;
      }
    }
    return json({ bewegungen: zeilen, hinweis: 'Vorschau: maximal 200 passende Einträge. Der Excel-Export enthält alle passenden Bewegungen.' });
  } catch (error) {
    if (error instanceof Error && /^(Ungültig|Suchbegriff)/.test(error.message)) return json({ fehler: error.message }, { status: 400 });
    console.error('Gesamtjournal:', error instanceof Error ? error.name : 'Unbekannter Fehler');
    return json({ fehler: 'Lagerbewegungen konnten nicht geladen werden.' }, { status: 500 });
  }
};
