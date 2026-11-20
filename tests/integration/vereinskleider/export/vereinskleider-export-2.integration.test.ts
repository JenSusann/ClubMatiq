import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
const id = '507f1f77bcf86cd799439011';
const sizeId = '507f191e810c19729de860ea';
const sale = (changes: Record<string, unknown> = {}) => ({
 _id: id, erstelltAm: '2026-11-10T12:00:00.000Z',
 kaeufer: 'Test Mitglied', riegen: ['Aktive'],
 verkaufsart: 'direkt', status: 'abgeschlossen', zahlungsart: 'twint',
 endbetrag: 40, bezahltBetrag: 40, zwischentotal: 40, rabattTotal: 0,
 positionen: [{ artikelname: 'Vereinsjacke', groesseId: sizeId,
   verkaufsart: 'direkt', menge: 2, einzelpreis: 20, positionsbetrag: 40 }],
 ...changes
});
type Data = { verkaeufe?: unknown[]; gesamt?: number; seiten?: number; fehler?: string };
function setup(first: Data, next: Data[] = [], sizes: unknown = [{ _id: sizeId, bezeichnung: 'M' }], sizesOk = true) {
 const fetchMock = vi.fn(async (url: string) => {
  if (url.startsWith('/api/groessen')) return new Response(JSON.stringify(sizes), { status: sizesOk ? 200 : 500 });
  const page = Number(new URL('http://localhost' + url).searchParams.get('seite') ?? '1');
  const data = page === 1 ? first : next[page - 2] ?? { verkaeufe: [], gesamt: first.gesamt, seiten: first.seiten };
  return new Response(JSON.stringify(data), { status: 200 });
 });
 return fetchMock;
}
const event = (fetchMock: ReturnType<typeof setup>, query = '') => ({
 locals: { benutzer: { id, vereinId: id, rolle: 'admin' } },
 url: new URL('http://localhost/api/vereinskleider/export' + query),
 fetch: fetchMock
});
async function read(response: Response) {
 const wb = new ExcelJS.Workbook();
 await wb.xlsx.load(await response.arrayBuffer());
 return wb;
}
import * as route0 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-artikelid-fallback.integration.test.ts
describe('26-export-artikelid-fallback', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [{ artikelId: id, menge: 1 }] })], gesamt: 1, seiten: 1 });
  const response = await route0.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('F2').value).toBe(id);
 });
});

import * as route1 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-bemerkung.integration.test.ts
describe('26-export-bemerkung', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ bemerkung: 'Testbeleg' })], gesamt: 1, seiten: 1 });
  const response = await route1.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('R2').value).toBe('Testbeleg');
 });
});

import * as route2 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-filter-weitergabe.integration.test.ts
describe('Filterweitergabe', () => {
 it('leitet erlaubte Filter weiter', async () => {
 const f = setup({ verkaeufe: [sale()], gesamt: 1, seiten: 1 });
 const r = await route2.GET(event(f, '?suche=Jacke&unbekannt=abc') as never);
 expect(r.status).toBe(200);
 expect(f.mock.calls[0][0]).toContain('suche=Jacke');
 expect(f.mock.calls[0][0]).not.toContain('unbekannt=');
 });
});

import * as route3 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-groesse.integration.test.ts
describe('26-export-groesse', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({})], gesamt: 1, seiten: 1 });
  const response = await route3.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('G2').value).toBe('M');
 });
});

import * as route4 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-gutschrift-ueber-betrag.integration.test.ts
describe('26-export-gutschrift-ueber-betrag', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ rechnung: { gesamtbetrag: 20, gutgeschriebenBetrag: 30 } })], gesamt: 1, seiten: 1 });
  const response = await route4.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('N2').value).toBe(0);
 });
});

import * as route5 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-gutschrift.integration.test.ts
describe('26-export-gutschrift', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ rechnung: { gesamtbetrag: 40, bezahltBetrag: 40, gutgeschriebenBetrag: 10, rueckerstattungOffen: 10 } })], gesamt: 1, seiten: 1 });
  const response = await route5.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('M2').value).toBe(10);
  expect(verk.getCell('N2').value).toBe(30);
  expect(verk.getCell('Q2').value).toBe(10);
 });
});

import * as route6 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-kein-negativer-offener-betrag.integration.test.ts
describe('26-export-kein-negativer-offener-betrag', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ rechnung: { gesamtbetrag: 20, bezahltBetrag: 30 } })], gesamt: 1, seiten: 1 });
  const response = await route6.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('P2').value).toBe(0);
 });
});

import * as route7 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-keine-groessenantwort.integration.test.ts
describe('26-export-keine-groessenantwort', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale()], gesamt: 1, seiten: 1 }, [], [], false);
  const response = await route7.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('G2').value).toBe('Unbekannte Grösse');
 });
});

import * as route8 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-keine-riegen.integration.test.ts
describe('26-export-keine-riegen', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ riegen: [] })], gesamt: 1, seiten: 1 });
  const response = await route8.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('D2').value).toBe('');
 });
});

import * as route9 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-leere-liste.integration.test.ts
describe('26-export-leere-liste', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [], gesamt: 0, seiten: 0 });
  const response = await route9.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.rowCount).toBe(1);
  expect(pos.rowCount).toBe(1);
 });
});

import * as route10 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-mehrere-positionen.integration.test.ts
describe('26-export-mehrere-positionen', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [{ artikelname: 'Jacke', menge: 1 }, { artikelname: 'Shirt', menge: 2 }] })], gesamt: 1, seiten: 1 });
  const response = await route10.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.rowCount).toBe(3);
 });
});

import * as route11 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-mehrere-riegen.integration.test.ts
describe('26-export-mehrere-riegen', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ riegen: ['Aktive', 'Jugend'] })], gesamt: 1, seiten: 1 });
  const response = await route11.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('D2').value).toBe('Aktive, Jugend');
 });
});

import * as route12 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-mehrere-seiten.integration.test.ts
describe('26-export-mehrere-seiten', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale()], gesamt: 2, seiten: 2 }, [{ verkaeufe: [sale({ _id: 'second' })] }]);
  const response = await route12.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.rowCount).toBe(3);
  expect(fetchMock).toHaveBeenCalledTimes(3);
 });
});

import * as route13 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-offener-betrag.integration.test.ts
describe('26-export-offener-betrag', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ rechnung: { gesamtbetrag: 40, bezahltBetrag: 10 } })], gesamt: 1, seiten: 1 });
  const response = await route13.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('P2').value).toBe(30);
 });
});

import * as route14 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-ohne-datum.integration.test.ts
describe('26-export-ohne-datum', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ erstelltAm: undefined })], gesamt: 1, seiten: 1 });
  const response = await route14.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('B2').value).toBeNull();
 });
});

import * as route15 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-ohne-groesse.integration.test.ts
describe('26-export-ohne-groesse', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [{ artikelname: 'Ball', groesseId: null, menge: 1 }] })], gesamt: 1, seiten: 1 });
  const response = await route15.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('G2').value).toBe('–');
 });
});

import * as route16 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-ohne-kaeufer.integration.test.ts
describe('26-export-ohne-kaeufer', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ kaeufer: undefined })], gesamt: 1, seiten: 1 });
  const response = await route16.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('C2').value).toBe('');
 });
});

import * as route17 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-ohne-positionen.integration.test.ts
describe('26-export-ohne-positionen', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [] })], gesamt: 1, seiten: 1 });
  const response = await route17.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.rowCount).toBe(1);
 });
});

import * as route18 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-positionen-ohne-preise.integration.test.ts
describe('26-export-positionen-ohne-preise', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [{ artikelname: 'Jacke', menge: 1 }] })], gesamt: 1, seiten: 1 });
  const response = await route18.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('K2').value).toBe(0);
  expect(pos.getCell('L2').value).toBe(0);
 });
});

import * as route19 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-rechnungsnummer.integration.test.ts
describe('26-export-rechnungsnummer', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ rechnung: { rechnungsnummer: 'RE-26-001', status: 'offen', gesamtbetrag: 40, bezahltBetrag: 0 } })], gesamt: 1, seiten: 1 });
  const response = await route19.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('H2').value).toBe('RE-26-001');
 });
});

import * as route20 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-stornierte-menge.integration.test.ts
describe('26-export-stornierte-menge', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [{ artikelname: 'Jacke', menge: 3, storniertMenge: 1, einzelpreis: 20, positionsbetrag: 60 }] })], gesamt: 1, seiten: 1 });
  const response = await route20.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('J2').value).toBe(1);
 });
});

import * as route21 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-unbekannte-groesse.integration.test.ts
describe('26-export-unbekannte-groesse', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ positionen: [{ artikelname: 'Shirt', groesseId: 'abc', menge: 1 }] })], gesamt: 1, seiten: 1 });
  const response = await route21.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(pos.getCell('G2').value).toBe('Unbekannte Grösse');
 });
});

import * as route22 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-ungueltige-betraege.integration.test.ts
describe('26-export-ungueltige-betraege', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ endbetrag: Number.NaN, bezahltBetrag: Infinity, zwischentotal: -Infinity })], gesamt: 1, seiten: 1 });
  const response = await route22.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('L2').value).toBe(0);
  expect(verk.getCell('O2').value).toBe(0);
 });
});

import * as route23 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-ungueltiges-datum.integration.test.ts
describe('26-export-ungueltiges-datum', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({ erstelltAm: 'kein-datum' })], gesamt: 1, seiten: 1 });
  const response = await route23.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.getCell('B2').value).toBeNull();
 });
});

import * as route24 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 26-export-vollstaendiger-verkauf.integration.test.ts
describe('26-export-vollstaendiger-verkauf', () => {
 it('prüft Export und XLSX-Inhalt', async () => {
  const fetchMock = setup({ verkaeufe: [sale({})], gesamt: 1, seiten: 1 });
  const response = await route24.GET(event(fetchMock) as never);
  expect(response.status).toBe(200);
  const wb = await read(response);
  const verk = wb.getWorksheet('Verkäufe')!;
  const pos = wb.getWorksheet('Positionen')!;
  expect(verk.rowCount).toBe(2);
  expect(pos.rowCount).toBe(2);
  expect(verk.getCell('C2').value).toBe('Test Mitglied');
 });
});

