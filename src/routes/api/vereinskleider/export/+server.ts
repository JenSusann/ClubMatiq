import { json } from '@sveltejs/kit';
import ExcelJS from 'exceljs';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Position = {
  artikelname?: string;
  artikelId?: string;
  groesseId?: string | null;
  menge?: number;
  storniertMenge?: number;
  einzelpreis?: number;
  positionsbetrag?: number;
  verkaufsart?: string;
};
type Rechnung = {
  rechnungsnummer?: string;
  status?: string;
  gesamtbetrag?: number;
  bezahltBetrag?: number;
  gutgeschriebenBetrag?: number;
  rueckerstattungOffen?: number;
};
type Verkauf = {
  _id: string;
  erstelltAm?: string;
  kaeufer?: string;
  riegen?: string[];
  verkaufsart?: string;
  status?: string;
  zahlungsart?: string;
  zahlungsstatus?: string;
  endbetrag?: number;
  bezahltBetrag?: number;
  zwischentotal?: number;
  rabattTotal?: number;
  bemerkung?: string;
  positionen?: Position[];
  rechnung?: Rechnung | null;
  rechnungen?: Rechnung[];
};
type HistorieAntwort = {
  verkaeufe?: Verkauf[];
  gesamt?: number;
  seiten?: number;
  fehler?: string;
};
type Groesse = { _id: string; bezeichnung: string };

const CHF = '#,##0.00 "CHF"';
const ZAHL = '#,##0';
const MAX_VERKAEUFE = 10000;
const FILTER = ['suche', 'art', 'zahlung', 'riege', 'von', 'bis'] as const;

function zahl(wert: unknown): number {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : 0;
}
function datum(wert: string | undefined): Date | null {
  if (!wert) return null;
  const ergebnis = new Date(wert);
  return Number.isNaN(ergebnis.getTime()) ? null : ergebnis;
}
function kopfzeile(blatt: ExcelJS.Worksheet, titel: string[]) {
  blatt.addRow(titel);
  const zeile = blatt.getRow(1);
  zeile.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  zeile.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF183153' } };
  zeile.height = 25;
  zeile.alignment = { vertical: 'middle' };
  blatt.views = [{ state: 'frozen', ySplit: 1 }];
}

export const GET: RequestHandler = async ({ locals, url, fetch }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (berechtigungsfehler) return berechtigungsfehler;

  // Die bestehende Historien-API prüft und verarbeitet sämtliche Filter.
  // Dadurch entsprechen die Exportdaten exakt der serverseitigen Suche.
  const parameter = new URLSearchParams();
  for (const name of FILTER) {
    const wert = url.searchParams.get(name);
    if (wert !== null) parameter.set(name, wert);
  }

  try {
    parameter.set('seite', '1');
    const ersteAntwort = await fetch(`/api/vereinskleider?${parameter.toString()}`);
    const ersteDaten = (await ersteAntwort.json()) as HistorieAntwort;
    if (!ersteAntwort.ok) {
      return json({ fehler: ersteDaten.fehler || 'Verkäufe konnten nicht geladen werden.' }, { status: ersteAntwort.status });
    }
    const gesamt = ersteDaten.gesamt ?? 0;
    if (gesamt > MAX_VERKAEUFE) {
      return json({ fehler: `Der Export ist auf ${MAX_VERKAEUFE} Verkäufe begrenzt. Bitte den Zeitraum oder die Filter einschränken.` }, { status: 400 });
    }
    const verkaeufe = [...(ersteDaten.verkaeufe ?? [])];
    const seiten = ersteDaten.seiten ?? 0;
    for (let seite = 2; seite <= seiten; seite++) {
      parameter.set('seite', String(seite));
      const antwort = await fetch(`/api/vereinskleider?${parameter.toString()}`);
      const daten = (await antwort.json()) as HistorieAntwort;
      if (!antwort.ok) {
        return json({ fehler: daten.fehler || `Seite ${seite} konnte nicht geladen werden.` }, { status: antwort.status });
      }
      verkaeufe.push(...(daten.verkaeufe ?? []));
    }
    // Bei parallelen Änderungen keine unvollständige Excel-Datei ausgeben.
    if (verkaeufe.length !== gesamt) {
      return json({ fehler: 'Die Verkäufe haben sich während des Exports geändert. Bitte erneut versuchen.' }, { status: 409 });
    }

    const groessenAntwort = await fetch('/api/groessen');
    const groessenDaten: unknown = groessenAntwort.ok ? await groessenAntwort.json() : [];
    const groessen = new Map<string, string>(
      (Array.isArray(groessenDaten) ? groessenDaten : [])
        .filter((g): g is Groesse => g !== null && typeof g === 'object' &&
          typeof g._id === 'string' && typeof g.bezeichnung === 'string')
        .map((g) => [g._id, g.bezeichnung])
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ClubMatiq';
    workbook.created = new Date();
    const uebersicht = workbook.addWorksheet('Verkäufe');
    const positionen = workbook.addWorksheet('Positionen');

    kopfzeile(uebersicht, [
      'Verkaufs-ID', 'Datum', 'Käufer', 'Riegen', 'Verkaufsart', 'Bestellstatus',
      'Zahlungsart', 'Rechnungsnummer', 'Rechnungsstatus', 'Zwischentotal CHF',
      'Rabatte CHF', 'Ursprünglicher Betrag CHF', 'Gutschriften CHF',
      'Aktueller Betrag CHF', 'Bezahlt CHF', 'Offen CHF', 'Rückerstattung offen CHF', 'Bemerkung'
    ]);
    kopfzeile(positionen, [
      'Verkaufs-ID', 'Datum', 'Käufer', 'Riegen', 'Rechnungsnummer', 'Artikel',
      'Grösse', 'Verkaufsart', 'Menge', 'Stornierte Menge', 'Einzelpreis CHF',
      'Positionsbetrag CHF'
    ]);

    for (const v of verkaeufe) {
      const rechnungen = v.rechnungen?.length ? v.rechnungen : v.rechnung ? [v.rechnung] : [];
      const summe = (feld: 'gesamtbetrag' | 'gutgeschriebenBetrag' | 'bezahltBetrag' | 'rueckerstattungOffen') =>
        rechnungen.reduce((sum, r) => sum + Math.round(zahl(r[feld]) * 100), 0) / 100;
      const urspruenglich = rechnungen.length ? summe('gesamtbetrag') : zahl(v.endbetrag);
      const gutschriften = summe('gutgeschriebenBetrag');
      const aktuell = Math.max(0, Math.round((urspruenglich - gutschriften) * 100) / 100);
      const bezahlt = rechnungen.length ? summe('bezahltBetrag') : zahl(v.bezahltBetrag);
      const offen = rechnungen.length ? rechnungen.reduce((sum, r) => sum + Math.max(0,
        Math.round(zahl(r.gesamtbetrag)*100) - Math.round(zahl(r.gutgeschriebenBetrag)*100) - Math.round(zahl(r.bezahltBetrag)*100)), 0) / 100 : Math.max(0, aktuell - bezahlt);
      const nummern = rechnungen.map(r => r.rechnungsnummer).filter(Boolean).join(', ');
      const rechnungsstatus = rechnungen.map(r => r.status).filter(Boolean).join(', ');
      const verkaufsdatum = datum(v.erstelltAm);
      const riegen = (v.riegen ?? []).join(', ');
      uebersicht.addRow([
        v._id, verkaufsdatum, v.kaeufer ?? '', riegen, v.verkaufsart ?? '', v.status ?? '',
        v.zahlungsart ?? '', nummern, rechnungsstatus,
        zahl(v.zwischentotal), zahl(v.rabattTotal), urspruenglich, gutschriften,
        aktuell, bezahlt, offen, summe('rueckerstattungOffen'), v.bemerkung ?? ''
      ]);
      for (const p of v.positionen ?? []) {
        positionen.addRow([
          v._id, verkaufsdatum, v.kaeufer ?? '', riegen, nummern,
          p.artikelname ?? p.artikelId ?? '', p.groesseId ? (groessen.get(p.groesseId) ?? 'Unbekannte Grösse') : '–',
          p.verkaufsart ?? '', zahl(p.menge), zahl(p.storniertMenge),
          zahl(p.einzelpreis), zahl(p.positionsbetrag)
        ]);
      }
    }

    const breiteVerkaeufe = [28, 20, 27, 24, 16, 17, 16, 20, 19, 20, 16, 23, 20, 20, 16, 16, 26, 40];
    const breitePositionen = [28, 20, 27, 24, 20, 35, 18, 17, 12, 18, 20, 23];
    uebersicht.columns.forEach((spalte, index) => { spalte.width = breiteVerkaeufe[index]; });
    positionen.columns.forEach((spalte, index) => { spalte.width = breitePositionen[index]; });
    uebersicht.autoFilter = { from: 'A1', to: 'R1' };
    positionen.autoFilter = { from: 'A1', to: 'L1' };
    for (let zeile = 2; zeile <= uebersicht.rowCount; zeile++) {
      uebersicht.getCell(`B${zeile}`).numFmt = 'dd.mm.yyyy hh:mm';
      for (let spalte = 10; spalte <= 17; spalte++) uebersicht.getRow(zeile).getCell(spalte).numFmt = CHF;
    }
    for (let zeile = 2; zeile <= positionen.rowCount; zeile++) {
      positionen.getCell(`B${zeile}`).numFmt = 'dd.mm.yyyy hh:mm';
      positionen.getCell(`I${zeile}`).numFmt = ZAHL;
      positionen.getCell(`J${zeile}`).numFmt = ZAHL;
      positionen.getCell(`K${zeile}`).numFmt = CHF;
      positionen.getCell(`L${zeile}`).numFmt = CHF;
    }

    const datei = await workbook.xlsx.writeBuffer();
    const name = `ClubMatiq_Verkaufshistorie_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(new Uint8Array(datei), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (fehler) {
    console.error('Excel-Export Verkaufshistorie:', fehler);
    return json({ fehler: 'Excel-Export konnte nicht erstellt werden.' }, { status: 500 });
  }
};
