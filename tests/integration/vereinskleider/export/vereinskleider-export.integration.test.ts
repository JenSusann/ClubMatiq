import { describe, expect, it, vi } from 'vitest';

import ExcelJS from 'exceljs';
import * as suite0_route0 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite0_route1 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite0_route2 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite0_route3 from '../../../../src/routes/api/vereinskleider/export/+server';

describe('vereinskleider-export', () => {
const route0 = suite0_route0;
const route1 = suite0_route1;
const route2 = suite0_route2;
const route3 = suite0_route3;
const locals = { benutzer: { id: 'test', vereinId: 'verein', rolle: 'admin' } };
const event = (fetchMock: ReturnType<typeof vi.fn>) => ({
  locals, url: new URL('http://localhost/api/vereinskleider/export?suche=jacke'),
  fetch: fetchMock
});


// Ursprüngliche Datei: 21-export-api-fehler.integration.test.ts
describe('21-export-api-fehler', () => {
  it('prüft den Exportablauf', async () => {
    const responses: Array<[number, unknown]> = [[500, {"fehler": "Historie nicht verf\u00fcgbar"}]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route0.GET(event(fetchMock) as never);
    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});



// Ursprüngliche Datei: 21-export-datenkonflikt.integration.test.ts
describe('21-export-datenkonflikt', () => {
  it('prüft den Exportablauf', async () => {
    const responses: Array<[number, unknown]> = [[200, {"gesamt": 2, "verkaeufe": [], "seiten": 1}]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route1.GET(event(fetchMock) as never);
    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});



// Ursprüngliche Datei: 21-export-leere-excel.integration.test.ts
describe('21-export-leere-excel', () => {
  it('prüft den Exportablauf', async () => {
    const responses: Array<[number, unknown]> = [[200, {"gesamt": 0, "verkaeufe": [], "seiten": 0}], [200, []]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route2.GET(event(fetchMock) as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheet');
  });
});



// Ursprüngliche Datei: 21-export-zu-viele-verkaeufe.integration.test.ts
describe('21-export-zu-viele-verkaeufe', () => {
  it('prüft den Exportablauf', async () => {
    const responses: Array<[number, unknown]> = [[200, {"gesamt": 10001, "verkaeufe": [], "seiten": 1}]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route3.GET(event(fetchMock) as never);
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});


});
import * as suite1_route0 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route1 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route2 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route3 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route4 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route5 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route6 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route7 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route8 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route9 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route10 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route11 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route12 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route13 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route14 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route15 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route16 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route17 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route18 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route19 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route20 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route21 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route22 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route23 from '../../../../src/routes/api/vereinskleider/export/+server';
import * as suite1_route24 from '../../../../src/routes/api/vereinskleider/export/+server';

describe('vereinskleider-export-2', () => {
const route0 = suite1_route0;
const route1 = suite1_route1;
const route2 = suite1_route2;
const route3 = suite1_route3;
const route4 = suite1_route4;
const route5 = suite1_route5;
const route6 = suite1_route6;
const route7 = suite1_route7;
const route8 = suite1_route8;
const route9 = suite1_route9;
const route10 = suite1_route10;
const route11 = suite1_route11;
const route12 = suite1_route12;
const route13 = suite1_route13;
const route14 = suite1_route14;
const route15 = suite1_route15;
const route16 = suite1_route16;
const route17 = suite1_route17;
const route18 = suite1_route18;
const route19 = suite1_route19;
const route20 = suite1_route20;
const route21 = suite1_route21;
const route22 = suite1_route22;
const route23 = suite1_route23;
const route24 = suite1_route24;
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


});
