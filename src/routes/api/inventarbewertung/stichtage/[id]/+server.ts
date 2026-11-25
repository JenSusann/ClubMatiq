import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

function zelle(wert: string | number | null): string {
  const roh = wert === null ? '' : String(wert);
  const sicher = typeof wert === 'string' && /^[\s\u0000-\u001f]*[=+@\-\t\r]/.test(roh) ? "'" + roh : roh;
  return '"' + sicher.replace(/"/g, '""') + '"';
}
const geld = (wert: number | null) => wert === null ? '' : wert.toFixed(2).replace('.', ',');

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.benutzer) return json({ fehler: 'Nicht angemeldet.' }, { status: 401 });
  if (!['admin', 'materialverantwortlich'].includes(locals.benutzer.rolle))
    return json({ fehler: 'Keine Berechtigung für die Inventarbewertung.' }, { status: 403 });
  if (!/^[a-f0-9]{24}$/i.test(params.id)) return json({ fehler: 'Ungültige Aufnahme-ID.' }, { status: 400 });
  try {
    const aufnahme = await db.collection('inventarbewertung_aufnahmen').findOne({
      _id: new ObjectId(params.id), vereinId: locals.benutzer.vereinId
    });
    if (!aufnahme) return json({ fehler: 'Bewertungsaufnahme nicht gefunden.' }, { status: 404 });
    if (url.searchParams.get('format') !== 'csv') return json(aufnahme, { headers: { 'Cache-Control': 'no-store' } });
    const zeit = new Date(aufnahme.aufgenommenAm);
    const stichtag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(zeit);
    const kopf = ['Artikel', 'Kategorie', 'Lagerort', 'Grösse', 'Bestand', 'Einzelwert CHF', 'Gesamtwert CHF', 'Preis fehlt', 'Bewertungsdatum', 'Aufnahmezeitpunkt (UTC)'];
    const daten = aufnahme.zeilen.map((z: { artikel: string; kategorie: string; lagerort: string; groesse: string; menge: number; einzelwert: number | null; gesamtwert: number | null }) =>
      [z.artikel, z.kategorie, z.lagerort, z.groesse, z.menge, geld(z.einzelwert), geld(z.gesamtwert), z.menge > 0 && z.einzelwert === null ? 'Ja' : 'Nein', stichtag, zeit.toISOString()]);
    const csv = '\uFEFF' + [kopf, ...daten].map(zeile => zeile.map(zelle).join(';')).join('\r\n') + '\r\n';
    return new Response(csv, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clubmatiq_bewertung_' + stichtag + '_' + params.id + '.csv"',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
    } });
  } catch (error) {
    console.error('Historische Inventarbewertung:', error);
    return json({ fehler: 'Bewertungsaufnahme konnte nicht geladen werden.' }, { status: 500 });
  }
};
