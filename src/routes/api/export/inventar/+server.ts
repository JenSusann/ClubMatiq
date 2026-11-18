import { json } from '@sveltejs/kit';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

type ExportZeile = {
  artikel: string; kategorie: string; lagerort: string; groesse: string;
  lieferant: string; menge: number; einzelwert: number | null;
  gesamtwert: number | null; preisFehlt: boolean;
};

// Gegen CSV-Formelinjektion in Excel schützen.
function zelle(wert: string | number | null): string {
  const roh = wert === null ? '' : String(wert);
  const sicher = /^[\s\u0000-\u001f]*[=+@\-\t\r]/.test(roh) && typeof wert === 'string'
    ? `'${roh}` : roh;
  return `"${sicher.replace(/"/g, '""')}"`;
}

const geld = (wert: number | null) => wert === null ? '' : wert.toFixed(2).replace('.', ',');
const lower = (wert: string) => wert.toLocaleLowerCase('de-CH');

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.benutzer) return json({ fehler: 'Nicht angemeldet.' }, { status: 401 });
  if (!['admin', 'materialverantwortlich'].includes(locals.benutzer.rolle)) {
    return json({ fehler: 'Keine Berechtigung für den Export.' }, { status: 403 });
  }

  const modus = url.searchParams.get('modus') ?? 'inventar';
  if (modus !== 'inventar' && modus !== 'bewertung') {
    return json({ fehler: 'Ungültiger Exporttyp.' }, { status: 400 });
  }
  const suche = lower((url.searchParams.get('suche') ?? '').trim());
  const kategorie = url.searchParams.get('kategorie') ?? '';
  const lagerort = url.searchParams.get('lagerort') ?? '';
  const nurFehlende = url.searchParams.get('nurFehlende') === 'true';
  const vereinId = locals.benutzer.vereinId;

  try {
    const [artikel, kategorien, lagerorte, groessen, varianten, lieferanten] = await Promise.all([
      db.collection('artikel').find({ vereinId }).sort({ name: 1 }).toArray(),
      db.collection('kategorien').find({ vereinId }).toArray(),
      db.collection('lagerorte').find({ vereinId }).toArray(),
      db.collection('groessen').find({ vereinId }).toArray(),
      db.collection('artikelvarianten').find({ vereinId }).toArray(),
      db.collection('lieferanten').find({ vereinId }).toArray()
    ]);
    const kat = new Map(kategorien.map((x) => [String(x._id), String(x.name)]));
    const ort = new Map(lagerorte.map((x) => [String(x._id), String(x.name)]));
    const gro = new Map(groessen.map((x) => [String(x._id), String(x.bezeichnung)]));
    const lief = new Map(lieferanten.map((x) => [String(x._id), String(x.name)]));
    const gueltigerPreis = (wert: unknown): wert is number =>
      typeof wert === 'number' && Number.isFinite(wert) && wert >= 0;

    const zeilen: ExportZeile[] = [];
    for (const a of artikel) {
      const artikelId = String(a._id);
      const artikelName = String(a.name ?? '');
      const kategorieName = kat.get(String(a.kategorieId)) ?? 'Unbekannt';
      const lagerortName = ort.get(String(a.lagerortId)) ?? 'Unbekannt';
      const lieferantenName = lief.get(String(a.lieferantId)) ?? 'Nicht zugeordnet';
      if (kategorie && kategorieName !== kategorie) continue;
      if (lagerort && lagerortName !== lagerort) continue;
      // Inventarsuche durchsucht auch Lieferant; Bewertungssuche zusätzlich Grössen.
      const artikelPasst = [artikelName, kategorieName, lagerortName,
        ...(modus === 'inventar' ? [lieferantenName] : [])].some((x) => lower(x).includes(suche));

      const positionen = a.hatGroessen
        ? varianten.filter((v) => String(v.artikelId) === artikelId).map((v) => ({
            groesse: gro.get(String(v.groesseId)) ?? 'Unbekannt',
            menge: Number(v.menge ?? 0),
            preis: v.einzelwert as unknown
          }))
        : [{ groesse: '', menge: Number(a.menge ?? 0), preis: a.einzelwert as unknown }];

      // Inventarexport: auch Artikel ohne Variantenbestand ausgeben.
      // Bewertungsexport: dieselbe Sicht wie die Bewertungsseite (nur positive Varianten).
      if (positionen.length === 0 && modus === 'inventar') {
        zeilen.push({ artikel: artikelName, kategorie: kategorieName, lagerort: lagerortName,
          groesse: '', lieferant: lieferantenName, menge: 0,
          einzelwert: null, gesamtwert: null, preisFehlt: false });
      }
      for (const p of positionen) {
        if (modus === 'bewertung' && a.hatGroessen && p.menge <= 0) continue;
        if (suche && !artikelPasst && !(modus === 'bewertung' && lower(p.groesse).includes(suche))) continue;
        const fehlt = p.menge > 0 && !gueltigerPreis(p.preis);
        if (modus === 'bewertung' && nurFehlende && !fehlt) continue;
        const preis = gueltigerPreis(p.preis) ? p.preis : null;
        zeilen.push({ artikel: artikelName, kategorie: kategorieName,
          lagerort: lagerortName, groesse: p.groesse, lieferant: lieferantenName,
          menge: p.menge, einzelwert: preis,
          gesamtwert: preis === null ? null : p.menge * preis,
          preisFehlt: fehlt });
      }
    }

    const kopf = ['Artikel', 'Kategorie', 'Lagerort', 'Grösse', 'Lieferant',
      'Bestand', 'Einzelwert CHF', 'Gesamtwert CHF', 'Preis fehlt', 'Bewertungsdatum'];
    const zeit = new Date();
    const bewertungsdatum = zeit.toISOString().slice(0, 10);
    const daten = zeilen.map((x) => [x.artikel, x.kategorie, x.lagerort, x.groesse,
      x.lieferant, x.menge, geld(x.einzelwert), geld(x.gesamtwert),
      x.preisFehlt ? 'Ja' : 'Nein', bewertungsdatum]);
    const csv = '\uFEFF' + [kopf, ...daten].map((zeile) => zeile.map(zelle).join(';')).join('\r\n') + '\r\n';
    const dateiname = `clubmatiq_${modus}_${bewertungsdatum}.csv`;
    return new Response(csv, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    } });
  } catch (error) {
    console.error('CSV-Export:', error);
    return json({ fehler: 'CSV-Export konnte nicht erstellt werden.' }, { status: 500 });
  }
};
