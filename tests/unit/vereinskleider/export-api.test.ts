import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
const m = vi.hoisted(() => ({ permission: vi.fn(), fetch: vi.fn() }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET } from '../../../src/routes/api/vereinskleider/export/+server';
const url = 'http://localhost/api/vereinskleider/export?suche=ball&art=direkt&zahlung=bar&riege=Aktive&von=2026-01-01&bis=2026-12-31&ignorieren=ja';
const sale = (extra = {}) => ({ _id: 'v1', erstelltAm: '2026-11-10T12:00:00Z', kaeufer: 'Max', riegen: ['Aktive'], endbetrag: 40, zwischentotal: 50, rabattTotal: 10, bezahltBetrag: 20, positionen: [{ artikelname: 'Shirt', groesseId: 'g1', menge: 2, storniertMenge: 0, einzelpreis: 20, positionsbetrag: 40 }], rechnung: { rechnungsnummer: 'R1', status: 'teilweise_bezahlt', gesamtbetrag: 40, bezahltBetrag: 20, gutgeschriebenBetrag: 5, rueckerstattungOffen: 0 }, ...extra });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const event = () => ({ locals: { benutzer: { vereinId: 'v1' } }, url: new URL(url), fetch: m.fetch }) as never;
async function get() { return GET(event()); }
beforeEach(() => { vi.resetAllMocks(); m.fetch.mockImplementation(async (path: string) => path === '/api/groessen' ? response([{ _id: 'g1', bezeichnung: 'M' }]) : response({ gesamt: 1, seiten: 1, verkaeufe: [sale()] })); });
async function workbook(r: Response) { const w = new ExcelJS.Workbook(); await w.xlsx.load(new Uint8Array(await r.arrayBuffer()) as unknown as Parameters<typeof w.xlsx.load>[0]); return w; }

describe('Vereinskleider Excel-Export', () => {
  it('verweigert fehlende Berechtigung', async () => { m.permission.mockReturnValue(new Response('Nein', { status: 403 })); expect((await get()).status).toBe(403); expect(m.fetch).not.toHaveBeenCalled(); });
  it('erstellt zwei Excel-Blätter mit Verkäufen und Positionen', async () => { const r = await get(); expect(r.status).toBe(200); expect(r.headers.get('Content-Type')).toContain('spreadsheetml'); const w = await workbook(r); expect(w.getWorksheet('Verkäufe')?.rowCount).toBe(2); expect(w.getWorksheet('Positionen')?.rowCount).toBe(2); expect(w.getWorksheet('Positionen')?.getCell('G2').value).toBe('M'); expect(w.getWorksheet('Verkäufe')?.getCell('P2').value).toBe(15); }, 15000);
  it('übergibt nur zugelassene Filter', async () => { await get(); const path = String(m.fetch.mock.calls[0][0]); expect(path).toContain('suche=ball'); expect(path).toContain('seite=1'); expect(path).not.toContain('ignorieren'); });
  it('behandelt Fehler der Historien-API', async () => { m.fetch.mockResolvedValue(response({ fehler: 'Keine Berechtigung' }, 403)); const r = await get(); expect(r.status).toBe(403); expect((await r.json()).fehler).toBe('Keine Berechtigung'); });
  it('verwendet Standardfehler bei leerer Historien-Fehlermeldung', async () => { m.fetch.mockResolvedValue(response({}, 500)); expect((await get()).status).toBe(500); });
  it('verweigert mehr als 10000 Verkäufe', async () => { m.fetch.mockResolvedValue(response({ gesamt: 10001, verkaeufe: [] })); expect((await get()).status).toBe(400); });
  it('holt alle Seiten der Historie', async () => { m.fetch.mockImplementation(async (path: string) => path === '/api/groessen' ? response([]) : path.includes('seite=2') ? response({ verkaeufe: [sale({ _id: 'v2' })] }) : response({ gesamt: 2, seiten: 2, verkaeufe: [sale()] })); const r = await get(); expect(r.status).toBe(200); expect((await workbook(r)).getWorksheet('Verkäufe')?.rowCount).toBe(3); });
  it('meldet Fehler auf Folgeseiten', async () => { m.fetch.mockImplementation(async (path: string) => path.includes('seite=2') ? response({ fehler: 'Seite defekt' }, 503) : response({ gesamt: 2, seiten: 2, verkaeufe: [sale()] })); expect((await get()).status).toBe(503); });
  it('erkennt zwischenzeitlich geänderte Verkaufszahlen', async () => { m.fetch.mockResolvedValue(response({ gesamt: 2, seiten: 1, verkaeufe: [sale()] })); expect((await get()).status).toBe(409); });
  it('erzeugt eine leere Excel-Datei ohne Verkäufe', async () => { m.fetch.mockImplementation(async (path: string) => path === '/api/groessen' ? response([]) : response({ gesamt: 0, seiten: 0, verkaeufe: [] })); const r = await get(); expect(r.status).toBe(200); expect((await workbook(r)).getWorksheet('Verkäufe')?.rowCount).toBe(1); });
  it('funktioniert bei fehlender Grössen-API und unbekannter Grösse', async () => { m.fetch.mockImplementation(async (path: string) => path === '/api/groessen' ? response({}, 500) : response({ gesamt: 1, seiten: 1, verkaeufe: [sale()] })); const r = await get(); expect((await workbook(r)).getWorksheet('Positionen')?.getCell('G2').value).toBe('Unbekannte Grösse'); });
  it('ignoriert fehlerhafte Grössen-Datensätze', async () => { m.fetch.mockImplementation(async (path: string) => path === '/api/groessen' ? response([null, 1, {}, { _id: 1, bezeichnung: 'S' }, { _id: 'g1', bezeichnung: 'L' }]) : response({ gesamt: 1, seiten: 1, verkaeufe: [sale()] })); const r = await get(); expect((await workbook(r)).getWorksheet('Positionen')?.getCell('G2').value).toBe('L'); });
  it('verarbeitet ungültige Datumswerte und fehlende optionale Felder', async () => { m.fetch.mockImplementation(async (path: string) => path === '/api/groessen' ? response([]) : response({ gesamt: 1, seiten: 1, verkaeufe: [{ _id: 'v3', erstelltAm: 'ungültig', positionen: [{ artikelId: 'a', menge: NaN }] }] })); const r = await get(); expect(r.status).toBe(200); const w = await workbook(r); expect(w.getWorksheet('Verkäufe')?.getCell('B2').value).toBeNull(); expect(w.getWorksheet('Positionen')?.getCell('F2').value).toBe('a'); });
  it('meldet Netzwerkfehler als 500', async () => { m.fetch.mockRejectedValue(new Error('network')); expect((await get()).status).toBe(500); });
});

// Weitere Randfaelle des gleichen Excel-Export-Endpunkts; gemeinsame Mocks wie oben.
{
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const sale = (extra: Record<string, unknown> = {}) => ({ _id: 'v1', erstelltAm: '2026-11-19', positionen: [], ...extra });
const run = () => GET({ locals: { benutzer: { vereinId: 'v1' } }, url: new URL('http://localhost/api/vereinskleider/export'), fetch: m.fetch } as never);
const excel = async (r: Response) => { expect(r.status).toBe(200); const w = new ExcelJS.Workbook(); await w.xlsx.load(new Uint8Array(await r.arrayBuffer()) as unknown as Parameters<typeof w.xlsx.load>[0]); return w; };
const set = (data: unknown, sizes: unknown = []) => m.fetch.mockImplementation(async (url: string) => url === '/api/groessen' ? reply(sizes) : reply(data));
const one = (v: Record<string, unknown>, sizes: unknown = []) => set({ gesamt: 1, seiten: 1, verkaeufe: [sale(v)] }, sizes);

beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); vi.spyOn(console, 'error').mockImplementation(() => {}); set({ gesamt: 0, seiten: 0, verkaeufe: [] }); });

describe('Paket 20 – fehlende Export-Verzweigungen', () => {
  it('nutzt fehlende gesamt-, seiten- und verkaeufe-Felder als leere Werte', async () => { set({}); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.rowCount).toBe(1); }, 15000);
  it('nutzt bei fehlender verkaeufe-Liste einen leeren Array', async () => { set({ gesamt: 0, seiten: 1 }); const w = await excel(await run()); expect(w.getWorksheet('Positionen')?.rowCount).toBe(1); });
  it('akzeptiert exakt 10000 Verkäufe als Grenze und prüft danach Konsistenz', async () => { set({ gesamt: 10000, seiten: 0, verkaeufe: [] }); expect((await run()).status).toBe(409); });
  it('nutzt Standardmeldung, wenn zweite Seite keine Fehlermeldung enthält', async () => { m.fetch.mockImplementation(async (u: string) => u.includes('seite=2') ? reply({}, 502) : reply({ gesamt: 2, seiten: 2, verkaeufe: [sale()] })); const r = await run(); expect(r.status).toBe(502); expect((await r.json()).fehler).toContain('Seite 2'); });
  it('akzeptiert fehlende verkaeufe auf der zweiten Seite bei Gesamtzahl null', async () => { m.fetch.mockImplementation(async (u: string) => u === '/api/groessen' ? reply([]) : u.includes('seite=2') ? reply({}) : reply({ gesamt: 0, seiten: 2, verkaeufe: [] })); expect((await run()).status).toBe(200); });
  it('ignoriert Nicht-Array der Grössen-API', async () => { one({ positionen: [{ groesseId: 'g1' }] }, { _id: 'g1', bezeichnung: 'M' }); const w = await excel(await run()); expect(w.getWorksheet('Positionen')?.getCell('G2').value).toBe('Unbekannte Grösse'); });
  it('stellt Position ohne groesseId als Strich dar', async () => { one({ positionen: [{ artikelname: 'Shirt', groesseId: null }] }); const w = await excel(await run()); expect(w.getWorksheet('Positionen')?.getCell('G2').value).toBe('–'); });
  it('verwendet artikelId wenn artikelname fehlt', async () => { one({ positionen: [{ artikelId: 'abc' }] }); const w = await excel(await run()); expect(w.getWorksheet('Positionen')?.getCell('F2').value).toBe('abc'); });
  it('verwendet leeren Artikelnamen ohne artikelname und artikelId', async () => { one({ positionen: [{}] }); const w = await excel(await run()); expect(w.getWorksheet('Positionen')?.getCell('F2').value).toBe(''); });
  it('verwendet bei fehlender rechnung den endbetrag und bezahltBetrag', async () => { one({ endbetrag: 80, bezahltBetrag: 30, rechnung: null }); const w = await excel(await run()); const sheet = w.getWorksheet('Verkäufe')!; expect(sheet.getCell('L2').value).toBe(80); expect(sheet.getCell('O2').value).toBe(30); expect(sheet.getCell('P2').value).toBe(50); });
  it('bevorzugt die Rechnungsbeträge gegenüber Verkaufsbeträgen', async () => { one({ endbetrag: 80, bezahltBetrag: 30, rechnung: { gesamtbetrag: 50, bezahltBetrag: 15, gutgeschriebenBetrag: 5 } }); const w = await excel(await run()); const s = w.getWorksheet('Verkäufe')!; expect(s.getCell('L2').value).toBe(50); expect(s.getCell('O2').value).toBe(15); expect(s.getCell('P2').value).toBe(30); });
  it('begrenzt offenen Betrag auf null bei Überzahlung', async () => { one({ endbetrag: 20, bezahltBetrag: 40 }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('P2').value).toBe(0); });
  it('begrenzt aktuellen Betrag auf null bei höherer Gutschrift', async () => { one({ rechnung: { gesamtbetrag: 20, gutgeschriebenBetrag: 40 } }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('N2').value).toBe(0); });
  it('verarbeitet nicht-numerische Beträge als null', async () => { one({ endbetrag: 'falsch', zwischentotal: 'falsch', rabattTotal: null, positionen: [{ menge: 'falsch', einzelpreis: null }] }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('L2').value).toBe(0); expect(w.getWorksheet('Positionen')?.getCell('I2').value).toBe(0); });
  it('verarbeitet fehlendes Datum als leere Zelle', async () => { one({ erstelltAm: undefined }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('B2').value).toBeNull(); });
  it('verbindet mehrere Riegen mit Komma', async () => { one({ riegen: ['Aktive', 'JUKO'] }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('D2').value).toBe('Aktive, JUKO'); });
  it('setzt fehlende Riegen als leeren Text ein', async () => { one({ riegen: undefined }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('D2').value).toBe(''); });
  it('akzeptiert leere Positionsliste ohne Positionszeilen', async () => { one({ positionen: undefined }); const w = await excel(await run()); expect(w.getWorksheet('Positionen')?.rowCount).toBe(1); });
  it('verwendet Standardwerte für fehlende Rechnungsfelder', async () => { one({ rechnung: {} }); const w = await excel(await run()); expect(w.getWorksheet('Verkäufe')?.getCell('H2').value).toBe(''); expect(w.getWorksheet('Verkäufe')?.getCell('Q2').value).toBe(0); });
});
}
