import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collection: { find: vi.fn(), createIndex: vi.fn(), bulkWrite: vi.fn() },
  permission: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: () => m.collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET, POST } from '../../../src/routes/api/mitglieder/+server';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const url = (suche = '') => new URL('http://localhost/api/mitglieder?suche=' + encodeURIComponent(suche));
const member = (id: number, vorname = 'Anna', nachname = 'Muster') => ({ _id: { toString: () => String(id) }, clubdeskId: String(id), vorname, nachname, anrede: '', adresse: '', ort: '', plz: '', status: '', aktiv: true });
const csv = '[Id];Vorname;Nachname;Anrede;Adresse;Ort;PLZ;Status\n1;Anna;Muster;Frau;Weg 1;Zürich;8000;Aktiv';
function upload(content: string, filename = 'clubdesk.csv') {
  const form = new FormData(); form.set('datei', new File([content], filename, { type: 'text/csv' }));
  return new Request('http://localhost/api/mitglieder', { method: 'POST', body: form });
}
async function post(request: Request) { return POST({ request, locals } as any) as Promise<Response>; }
async function thrown(request: Request, status: number, message?: string) {
  try { await post(request); throw new Error('Erwarteter HTTP-Fehler wurde nicht ausgelöst'); }
  catch (e: any) { expect(e.status).toBe(status); if (message) expect(e.body?.message ?? e.message).toContain(message); }
}
beforeEach(() => {
  vi.clearAllMocks(); m.permission.mockReturnValue(null);
  m.collection.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [member(1), member(2, 'Berta', 'Meier')] }) }) });
  m.collection.createIndex.mockResolvedValue('index');
  m.collection.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });
});
describe('Mitglieder lesen', () => {
  it('prüft die Berechtigung', async () => { const r = await GET({ locals, url: url() } as any) as Response; expect(r.status).toBe(200); expect(m.permission).toHaveBeenCalledWith(locals.benutzer, 'mitglieder:verwalten'); });
  it('bricht bei fehlender Berechtigung ab', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); const r = await GET({ locals, url: url() } as any) as Response; expect(r.status).toBe(403); expect(m.collection.find).not.toHaveBeenCalled(); });
  it('filtert nach Vorname, Nachname und ClubDesk-ID', async () => { for (const s of ['Anna', 'Muster', '1']) { const r = await GET({ locals, url: url(s) } as any) as Response; const data = await r.json(); expect(data).toHaveLength(1); expect(data[0].anzeigename).toBe('Anna Muster'); } });
  it('liefert leere Liste ohne Treffer', async () => { const r = await GET({ locals, url: url('unbekannt') } as any) as Response; expect(await r.json()).toEqual([]); });
  it('begrenzt die Ausgabe auf 50 Treffer', async () => { m.collection.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => Array.from({ length: 70 }, (_, i) => member(i)) }) }) }); const r = await GET({ locals, url: url() } as any) as Response; expect(await r.json()).toHaveLength(50); });
});
describe('ClubDesk CSV Import', () => {
  it('prüft Berechtigung vor Verarbeitung', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await post(upload(csv))).status).toBe(403); });
  it('verlangt multipart', async () => { await thrown(new Request('http://localhost/api/mitglieder', { method: 'POST', body: csv }), 400); });
  it('verlangt Datei im Feld datei', async () => { const f = new FormData(); f.set('anderes', 'wert'); await thrown(new Request('http://localhost/api/mitglieder', { method: 'POST', body: f }), 400); });
  it('verweigert Dateien über 5 MB', async () => { await thrown(upload('x'.repeat(5_000_001)), 413); });
  it('verweigert leere CSV', async () => { await thrown(upload('[Id];Vorname;Nachname\n'), 400); });
  it.each(['[Id];Vorname\n1;Anna', 'Vorname;Nachname\nAnna;Muster', '[Id];Nachname\n1;Muster'])('verlangt alle Pflichtspalten: %s', async (s) => { await thrown(upload(s), 400); });
  it('verweigert fehlende ClubDesk-ID', async () => { await thrown(upload('[Id];Vorname;Nachname\n;Anna;Muster'), 400); });
  it('verweigert Datensatz ohne Vor- und Nachnamen', async () => { await thrown(upload('[Id];Vorname;Nachname\n1;;'), 400); });
  it('verweigert doppelte ClubDesk-ID', async () => { await thrown(upload('[Id];Vorname;Nachname\n1;Anna;Muster\n1;Berta;Meier'), 400); });
  it('verweigert ungeschlossene Anführungszeichen', async () => { await thrown(upload('[Id];Vorname;Nachname\n1;"Anna;Muster'), 400); });
  it('importiert Mitglieder vereinsgebunden mit Upsert', async () => { const r = await post(upload(csv)); expect(r.status).toBe(200); expect((await r.json()).eingelesen).toBe(1); expect(m.collection.createIndex).toHaveBeenCalled(); expect(m.collection.bulkWrite).toHaveBeenCalledWith([expect.objectContaining({ updateOne: expect.objectContaining({ filter: { vereinId: 'verein-1', clubdeskId: '1' }, upsert: true }) })], { ordered: true }); });
  it('verarbeitet BOM, CRLF und gequotete Semikolons', async () => { const r = await post(upload('\uFEFF[Id];Vorname;Nachname;Adresse\r\n1;"Anna;Maria";Muster;"Weg; 2"\r\n')); expect(r.status).toBe(200); expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('Anna;Maria'); });
  it('verarbeitet doppelte Anführungszeichen', async () => { const r = await post(upload('[Id];Vorname;Nachname\n1;"An""na";Muster')); expect(r.status).toBe(200); expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('An"na'); });
  it('importiert Windows-1252 kodierte CSV', async () => { const bytes = new Uint8Array([91,73,100,93,59,86,111,114,110,97,109,101,59,78,97,99,104,110,97,109,101,10,49,59,74,246,114,103,59,77,252,108,108,101,114]); const f = new FormData(); f.set('datei', new File([bytes], 'latin.csv')); const r = await post(new Request('http://localhost/api/mitglieder', { method: 'POST', body: f })); expect(r.status).toBe(200); expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('Jörg'); });
  it('berechnet Neu, Aktualisiert und Unverändert', async () => { m.collection.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 2, matchedCount: 4 }); const r = await post(upload(csv)); expect(await r.json()).toMatchObject({ neu: 1, aktualisiert: 2, unveraendert: 2 }); });
});
