import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
const m = vi.hoisted(() => ({ permission: vi.fn() }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET } from '../../../src/routes/api/vereinskleider/export/+server';

const locals = { benutzer: { vereinId: 'verein-1', rolle: 'admin' } };
const sale = (patch: Record<string, unknown> = {}) => ({
  _id: 'v1', erstelltAm: '2026-01-01', kaeufer: 'Anna',
  riegen: ['Aktive'], endbetrag: 50, positionen: [{
    artikelId: 'a1', artikelname: 'Shirt', groesseId: 'g1',
    menge: 2, einzelpreis: 25, positionsbetrag: 50
  }], ...patch
});
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const run = (fetchMock: ReturnType<typeof vi.fn>, query = '') =>
  GET({ locals, url: new URL('http://localhost/api/vereinskleider/export' + query), fetch: fetchMock } as any);
beforeEach(() => {
  vi.resetAllMocks();
  m.permission.mockReturnValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('Verkaufshistorie-Excel – Branches', () => {
  it('exportiert leere Historie als Excel mit zwei Blättern', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 0, seiten: 0, verkaeufe: [] }))
      .mockResolvedValueOnce(response([]));
    const result = await run(fetchMock);
    expect(result.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await result.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Verkäufe', 'Positionen']);
    expect(workbook.getWorksheet('Verkäufe')!.rowCount).toBe(1);
  });
  it('exportiert Verkauf und Position mit Grösse und Rechnung', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 1, seiten: 1, verkaeufe: [
        sale({ rechnung: { rechnungsnummer: 'R1', gesamtbetrag: 60, bezahltBetrag: 20,
          gutgeschriebenBetrag: 10, rueckerstattungOffen: 5, status: 'offen' } })
      ] }))
      .mockResolvedValueOnce(response([{ _id: 'g1', bezeichnung: 'M' }]));
    const result = await run(fetchMock);
    expect(result.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await result.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const summary = workbook.getWorksheet('Verkäufe')!.getRow(2);
    expect(summary.getCell(14).value).toBe(50);
    expect(summary.getCell(16).value).toBe(30);
    expect(workbook.getWorksheet('Positionen')!.getRow(2).getCell(7).value).toBe('M');
  });
  it('exportiert mehrere Seiten und übernimmt nur erlaubte Filter', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 2, seiten: 2, verkaeufe: [sale()] }))
      .mockResolvedValueOnce(response({ verkaeufe: [sale({ _id: 'v2' })] }))
      .mockResolvedValueOnce(response([]));
    const result = await run(fetchMock, '?suche=anna&riege=Aktive&unbekannt=ignorieren');
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('suche=anna');
    expect(fetchMock.mock.calls[1][0]).toContain('seite=2');
    expect(fetchMock.mock.calls[0][0]).not.toContain('unbekannt');
  });
  it('liefert 400 bei über 10 000 Verkäufen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ gesamt: 10001 }));
    expect((await run(fetchMock)).status).toBe(400);
  });
  it('leitet Fehler der ersten Historienseite weiter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ fehler: 'Zugriff verweigert' }, 403));
    const result = await run(fetchMock);
    expect(result.status).toBe(403);
    expect((await result.json()).fehler).toBe('Zugriff verweigert');
  });
  it('verwendet Standardfehler für erste Historienseite', async () => {
    const result = await run(vi.fn().mockResolvedValue(response({}, 502)));
    expect((await result.json()).fehler).toContain('nicht geladen');
  });
  it('leitet Fehler der zweiten Historienseite weiter', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 2, seiten: 2, verkaeufe: [sale()] }))
      .mockResolvedValueOnce(response({ fehler: 'Fehler Seite 2' }, 503));
    const result = await run(fetchMock);
    expect(result.status).toBe(503);
    expect((await result.json()).fehler).toBe('Fehler Seite 2');
  });
  it('verwendet Standardfehler für zweite Historienseite', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 2, seiten: 2, verkaeufe: [sale()] }))
      .mockResolvedValueOnce(response({}, 502));
    const result = await run(fetchMock);
    expect((await result.json()).fehler).toContain('Seite 2');
  });
  it('liefert 409 bei inkonsistenter Seitenanzahl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ gesamt: 2, seiten: 1, verkaeufe: [sale()] }));
    expect((await run(fetchMock)).status).toBe(409);
  });
  it('exportiert auch bei nicht verfügbarer Grössen-API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 1, seiten: 1, verkaeufe: [sale()] }))
      .mockResolvedValueOnce(response({}, 503));
    const result = await run(fetchMock);
    expect(result.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await result.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet('Positionen')!.getRow(2).getCell(7).value).toBe('Unbekannte Grösse');
  });
  it('filtert ungültige Grösseneinträge', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 1, seiten: 1, verkaeufe: [sale()] }))
      .mockResolvedValueOnce(response([null, {}, { _id: 1, bezeichnung: 'M' }, { _id: 'g1', bezeichnung: 4 }]));
    expect((await run(fetchMock)).status).toBe(200);
  });
  it('behandelt ungültige Verkaufsdaten und fehlende Positionen', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ gesamt: 1, seiten: 1, verkaeufe: [sale({
        erstelltAm: 'ungueltig', endbetrag: Number.NaN, positionen: undefined, riegen: undefined
      })] }))
      .mockResolvedValueOnce(response({ not: 'an array' }));
    expect((await run(fetchMock)).status).toBe(200);
  });
  it('liefert 500 bei Netzwerkfehler', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    expect((await run(fetchMock)).status).toBe(500);
  });
  it('gibt Berechtigungsfehler unverändert zurück', async () => {
    m.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const fetchMock = vi.fn();
    expect((await run(fetchMock)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
