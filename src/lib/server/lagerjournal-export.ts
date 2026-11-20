import ExcelJS from 'exceljs';
import { ObjectId } from 'mongodb';
import { db } from './mongodb';

export const bewegungsarten = ['anlage', 'ausleihe', 'rueckgabe', 'inventur', 'verkauf', 'wareneingang', 'korrektur', 'storno'] as const;
const bezeichnungen: Record<string, string> = { anlage: 'Anlage', ausleihe: 'Ausleihe', rueckgabe: 'Rückgabe', inventur: 'Inventurkorrektur', verkauf: 'Verkauf', wareneingang: 'Wareneingang', korrektur: 'Korrektur', storno: 'Storno' };
const datumGueltig = (wert: string) => /^\d{4}-\d{2}-\d{2}$/.test(wert) && !Number.isNaN(Date.parse(wert)) && new Date(wert).toISOString().slice(0, 10) === wert;
const sichereZelle = (wert: unknown) => {
  const text = String(wert ?? '');
  return /^[\s]*[=+@\-]/.test(text) ? "'" + text : text;
};

export function leseJournalFilter(url: URL): { filter: Record<string, unknown>; suche: string } {
  const art = url.searchParams.get('art') ?? '';
  const artikelId = url.searchParams.get('artikelId') ?? '';
  const groesseId = url.searchParams.get('groesseId') ?? '';
  const von = url.searchParams.get('von') ?? '';
  const bis = url.searchParams.get('bis') ?? '';
  const suche = (url.searchParams.get('suche') ?? '').trim().toLocaleLowerCase('de-CH');
  if (art && !bewegungsarten.includes(art as typeof bewegungsarten[number])) throw new Error('Ungültiger Bewegungstyp.');
  if (artikelId && !ObjectId.isValid(artikelId)) throw new Error('Ungültige Artikel-ID.');
  if (groesseId && !ObjectId.isValid(groesseId)) throw new Error('Ungültige Grössen-ID.');
  if ((von && !datumGueltig(von)) || (bis && !datumGueltig(bis)) || (von && bis && von > bis)) throw new Error('Ungültiger Zeitraum.');
  if (suche.length > 200) throw new Error('Suchbegriff ist zu lang.');
  const filter: Record<string, unknown> = {};
  if (art) filter.art = art;
  if (artikelId) filter.artikelId = artikelId;
  if (groesseId) filter.groesseId = groesseId;
  if (von || bis) filter.zeitpunkt = { ...(von ? { $gte: new Date(von + 'T00:00:00.000Z') } : {}), ...(bis ? { $lt: new Date(new Date(bis + 'T00:00:00.000Z').getTime() + 86400000) } : {}) };
  return { filter, suche };
}

export async function erstelleLagerjournalExcel(vereinId: string, url: URL): Promise<Buffer> {
  const { filter, suche } = leseJournalFilter(url);
  const [bewegungen, artikel, groessen, benutzer] = await Promise.all([
    db.collection('lagerbewegungen').find({ ...filter, vereinId }).sort({ zeitpunkt: -1, _id: -1 }).toArray(),
    db.collection('artikel').find({ vereinId }).project({ name: 1, kategorieId: 1 }).toArray(),
    db.collection('groessen').find({ vereinId }).project({ bezeichnung: 1 }).toArray(),
    db.collection('benutzer').find({ vereinId }).project({ vorname: 1, nachname: 1 }).toArray()
  ]);
  const artikelNamen = new Map(artikel.map((a) => [a._id.toString(), String(a.name ?? '')]));
  const groessenNamen = new Map(groessen.map((g) => [g._id.toString(), String(g.bezeichnung ?? '')]));
  const benutzerNamen = new Map(benutzer.map((b) => [b._id.toString(), [b.vorname, b.nachname].filter(Boolean).join(' ')]));
  const zeilen = bewegungen.map((b) => ({
    zeitpunkt: b.zeitpunkt instanceof Date ? b.zeitpunkt : new Date(b.zeitpunkt),
    artikel: artikelNamen.get(String(b.artikelId)) ?? 'Artikel nicht mehr vorhanden',
    artikelId: String(b.artikelId),
    groesse: b.groesseId ? groessenNamen.get(String(b.groesseId)) ?? 'Unbekannte Grösse' : '–',
    vorgang: bezeichnungen[String(b.art)] ?? String(b.art),
    menge: Number(b.mengeDelta),
    benutzer: benutzerNamen.get(String(b.benutzerId)) ?? 'Benutzer nicht mehr vorhanden',
    referenzTyp: String(b.referenzTyp ?? ''),
    referenzId: String(b.referenzId ?? '')
  })).filter((b) => !suche || [b.artikel, b.artikelId, b.groesse, b.vorgang, b.benutzer, b.referenzTyp, b.referenzId].some((wert) => wert.toLocaleLowerCase('de-CH').includes(suche)));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClubMatiq';
  const sheet = workbook.addWorksheet('Lagerbewegungen', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = 'ClubMatiq – Lagerbewegungsjournal';
  sheet.getCell('A1').font = { bold: true, size: 17, color: { argb: 'FF172B4D' } };
  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = 'Exportiert: ' + new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' }) + ' | ' + zeilen.length + ' Bewegungen | Nicht rückwirkend erfasste Altbewegungen fehlen.';
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  sheet.columns = [
    { key: 'zeitpunkt', width: 22 }, { key: 'artikel', width: 34 }, { key: 'artikelId', width: 27 },
    { key: 'groesse', width: 15 }, { key: 'vorgang', width: 24 }, { key: 'menge', width: 19 },
    { key: 'benutzer', width: 30 }, { key: 'referenzTyp', width: 25 }, { key: 'referenzId', width: 38 }
  ];
  const kopf = sheet.getRow(4);
  kopf.values = ['Datum / Uhrzeit', 'Artikel', 'Artikel-ID', 'Grösse', 'Vorgang', 'Mengenänderung', 'Durchgeführt von', 'Referenztyp', 'Referenz-ID'];
  kopf.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  kopf.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172B4D' } };
  kopf.height = 24;
  for (const b of zeilen) {
    const row = sheet.addRow([b.zeitpunkt, sichereZelle(b.artikel), sichereZelle(b.artikelId), sichereZelle(b.groesse), sichereZelle(b.vorgang), b.menge, sichereZelle(b.benutzer), sichereZelle(b.referenzTyp), sichereZelle(b.referenzId)]);
    row.getCell(1).numFmt = 'dd.mm.yyyy hh:mm:ss';
    row.getCell(6).font = { bold: true, color: { argb: b.menge >= 0 ? 'FF166534' : 'FFB91C1C' } };
  }
  if (zeilen.length) sheet.autoFilter = { from: 'A4', to: 'I' + (4 + zeilen.length) };
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
