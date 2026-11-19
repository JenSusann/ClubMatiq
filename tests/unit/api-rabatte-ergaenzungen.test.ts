import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ collections: {} as Record<string, any>, permission: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => m.collections[name] } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET, POST, PUT } from '../../src/routes/api/rabatte/+server';
const id = '507f1f77bcf86cd799439011';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const valid = { name: ' Aktion ', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb' };
function req(method: string, body: unknown): Request { return new Request('http://localhost/api/rabatte', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
async function call(method: 'POST' | 'PUT', body: unknown): Promise<Response> { return (method === 'POST' ? POST : PUT)({ request: req(method, body), locals } as any) as Promise<Response>; }
let rules: any;
beforeEach(() => {
 vi.clearAllMocks(); m.permission.mockReturnValue(null);
 rules = { find: vi.fn().mockReturnValue({ sort: () => ({ toArray: async () => [{ _id: { toString: () => id }, ...valid }] }) }), insertOne: vi.fn().mockResolvedValue({ insertedId: { toString: () => id } }), findOneAndUpdate: vi.fn().mockResolvedValue({ _id: { toString: () => id }, ...valid }) };
 m.collections = { rabattregeln: rules, artikel: { countDocuments: vi.fn().mockResolvedValue(1) }, kategorien: { countDocuments: vi.fn().mockResolvedValue(1) } };
});
describe('Rabatte lesen', () => {
 it('liefert vereinsbezogene Regeln', async () => { const r = await GET({ locals } as any) as Response; expect(r.status).toBe(200); expect((await r.json())[0]).toMatchObject({ _id: id, name: valid.name, aktiv: true, kombinierbar: false }); expect(rules.find).toHaveBeenCalledWith({ vereinId: 'verein-1' }); });
 it('blockiert unberechtigte Zugriffe', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await GET({ locals } as any) as Response).status).toBe(403); });
 it('liefert 500 bei Datenbankfehler', async () => { rules.find.mockImplementation(() => { throw Error('db'); }); expect((await GET({ locals } as any) as Response).status).toBe(500); });
});
describe('Rabatte validieren und speichern', () => {
 it('speichert eine gültige Warenkorbregel', async () => { const r = await call('POST', valid); expect(r.status).toBe(201); expect((await r.json()).name).toBe('Aktion'); expect(rules.insertOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-1', name: 'Aktion', aktiv: true })); });
 it.each([null, [], 'text', 3, {}, { ...valid, name: '' }, { ...valid, name: 'x'.repeat(121) }, { ...valid, rabattart: 'falsch' }, { ...valid, geltungsbereich: 'falsch' }, { ...valid, wert: -1 }, { ...valid, wert: 101 }, { ...valid, wert: 1.123 }, { ...valid, wert: '10' }, { ...valid, wert: null }, { ...valid, wert: 'NaN' }, { ...valid, artikelIds: ['falsch'] }, { ...valid, artikelIds: 'falsch' }, { ...valid, kategorieIds: [123] }, { ...valid, riegen: 'aktiv' }, { ...valid, riegen: [''] }, { ...valid, riegen: ['x'.repeat(101)] }, { ...valid, maximaleMenge: 0 }, { ...valid, maximaleMenge: 1.5 }, { ...valid, gueltigAb: '2026-02-30' }, { ...valid, gueltigBis: 'morgen' }, { ...valid, gueltigAb: '2026-12-31', gueltigBis: '2026-01-01' }, { ...valid, kombinierbar: 'ja' }, { ...valid, aktiv: 1 }, { ...valid, geltungsbereich: 'artikel', artikelIds: [] }, { ...valid, geltungsbereich: 'kategorie', kategorieIds: [] }])('verweigert ungültige POST-Eingabe %#', async (body) => { expect((await call('POST', body)).status).toBe(400); });
 it.each(['betrag', 'fixpreis', 'prozent'])('akzeptiert Rabattart %s', async (rabattart) => { expect((await call('POST', { ...valid, rabattart })).status).toBe(201); });
 it('entfernt doppelte IDs und Riegen', async () => { const r = await call('POST', { ...valid, geltungsbereich: 'artikel', artikelIds: [id, id], riegen: [' Aktiv ', 'Aktiv'] }); expect(r.status).toBe(201); expect(rules.insertOne.mock.calls[0][0]).toMatchObject({ artikelIds: [id], riegen: ['Aktiv'] }); });
 it('prüft Artikelzuordnung zum Verein', async () => { m.collections.artikel.countDocuments.mockResolvedValue(0); expect((await call('POST', { ...valid, geltungsbereich: 'artikel', artikelIds: [id] })).status).toBe(400); });
 it('prüft Kategoriezuordnung zum Verein', async () => { m.collections.kategorien.countDocuments.mockResolvedValue(0); expect((await call('POST', { ...valid, geltungsbereich: 'kategorie', kategorieIds: [id] })).status).toBe(400); });
 it('akzeptiert Kategoriezuordnung zum Verein', async () => { expect((await call('POST', { ...valid, geltungsbereich: 'kategorie', kategorieIds: [id] })).status).toBe(201); });
 it('akzeptiert Datumsbereich und optionale Felder', async () => { const r = await call('POST', { ...valid, gueltigAb: '2026-01-01', gueltigBis: '2026-12-31', maximaleMenge: 3, kombinierbar: true, aktiv: false }); expect(r.status).toBe(201); expect(await r.json()).toMatchObject({ gueltigAb: '2026-01-01', maximaleMenge: 3, kombinierbar: true, aktiv: false }); });
 it('liefert 500 bei DB-Fehler', async () => { rules.insertOne.mockRejectedValue(Error('db')); expect((await call('POST', valid)).status).toBe(500); });
 it('blockiert unberechtigte Schreibzugriffe', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await call('POST', valid)).status).toBe(403); expect((await call('PUT', { ...valid, _id: id })).status).toBe(403); });
});
describe('Rabatte bearbeiten', () => {
 it('aktualisiert nur Regeln des Vereins', async () => { const r = await call('PUT', { ...valid, _id: id }); expect(r.status).toBe(200); expect(rules.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-1' }), expect.anything(), { returnDocument: 'after' }); });
 it.each([null, [], {}, { ...valid, _id: 'falsch' }, { ...valid, _id: id, name: '' }])('verweigert ungültige PUT-Daten %#', async (body) => { expect((await call('PUT', body)).status).toBe(400); });
 it('liefert 404 für unbekannte Regel', async () => { rules.findOneAndUpdate.mockResolvedValue(null); expect((await call('PUT', { ...valid, _id: id })).status).toBe(404); });
 it('verweigert fremde Artikel', async () => { m.collections.artikel.countDocuments.mockResolvedValue(0); expect((await call('PUT', { ...valid, _id: id, geltungsbereich: 'artikel', artikelIds: [id] })).status).toBe(400); });
 it('liefert 500 bei DB-Fehler', async () => { rules.findOneAndUpdate.mockRejectedValue(Error('db')); expect((await call('PUT', { ...valid, _id: id })).status).toBe(500); });
});
