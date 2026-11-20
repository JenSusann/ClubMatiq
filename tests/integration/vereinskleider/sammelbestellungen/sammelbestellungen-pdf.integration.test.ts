import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ find: vi.fn(), findOne: vi.fn(), toArray: vi.fn(), project: vi.fn() }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => ({
  find: (...args: any[]) => m.find(name, ...args),
  findOne: (...args: any[]) => m.findOne(name, ...args)
}) } }));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: vi.fn(() => null) }));
import { POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
const id = (n: number) => n.toString(16).padStart(24, '0');
const pos = (overrides: Record<string, unknown> = {}) => ({ artikelId: id(4), groesseId: null, artikelname: 'Trainerjacke', menge: 2, ...overrides });
const best = (overrides: Record<string, unknown> = {}) => ({ _id: new ObjectId(id(1)), vereinId: id(9), lieferantId: id(2), status: 'entwurf', positionen: [pos()], erstelltAm: new Date(), ...overrides });
function daten(bestellungen: any[] = [best()], groessen: any[] = []) {
  m.find.mockImplementation((name: string) => ({ toArray: () => Promise.resolve(name === 'vereinskleider_sammelbestellungen' ? bestellungen : groessen), project: () => ({ toArray: () => Promise.resolve(groessen) }) }));
  m.findOne.mockImplementation((name: string) => Promise.resolve(name === 'lieferanten' ? { name: 'Sport AG' } : { name: 'TV Weiningen' }));
}
function ctx(ids: unknown = [id(1)]) { return { locals: { benutzer: { vereinId: id(9), rolle: 'admin' } }, request: new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bestellungIds: ids }) }) } as any; }
async function status(ids: unknown) { try { return (await POST(ctx(ids))).status; } catch (e: any) { return e.status; } }
beforeEach(() => { vi.resetAllMocks(); daten(); });
describe('Coverage P8 – Gesamt-PDF Sammelbestellungen', () => {
  it.each([[], ['falsch'], [id(1), id(1)], Array(51).fill(id(1)), 'ungültig'])('weist ungültige Auswahl zurück', async ids => { expect(await status(ids)).toBe(400); });
  it('meldet fehlende Bestellungen', async () => { daten([]); expect(await status([id(1)])).toBe(404); });
  it('verhindert verschiedene Lieferanten', async () => { daten([best(), best({ lieferantId: id(3) })]); expect(await status([id(1), id(3)])).toBe(409); });
  it('verhindert fehlenden Lieferanten', async () => { m.findOne.mockResolvedValue(null); expect(await status([id(1)])).toBe(409); });
  it('verhindert leere Bestellpositionen', async () => { daten([best({ positionen: [] })]); expect(await status([id(1)])).toBe(409); });
  it.each([pos({ artikelId: 'x' }), pos({ groesseId: 'x' }), pos({ menge: 0 }), pos({ menge: 1.5 })])('verhindert ungültige Positionen', async p => { daten([best({ positionen: [p] })]); expect(await status([id(1)])).toBe(409); });
  it('erzeugt eine PDF mit Standardpositionen', async () => { const r = await POST(ctx()); expect(r.status).toBe(200); expect(r.headers.get('Content-Type')).toBe('application/pdf'); expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100); });
  it('fasst gleiche Positionen zusammen und berücksichtigt Grössen', async () => {
    daten([best({ positionen: [pos({ groesseId: id(5) }), pos({ groesseId: id(5), menge: 3 })] })], [{ _id: new ObjectId(id(5)), bezeichnung: 'M' }]);
    expect((await POST(ctx())).status).toBe(200);
  });
  it('verhindert Ganzzahlüberlauf bei Zusammenfassung', async () => {
    daten([best({ positionen: [pos({ menge: Number.MAX_SAFE_INTEGER }), pos({ menge: 1 })] })]);
    expect(await status([id(1)])).toBe(409);
  });
  it('erzeugt mehrere Seiten bei vielen Positionen', async () => {
    daten([best({ positionen: Array.from({ length: 55 }, (_, i) => pos({ artikelId: id(100 + i), artikelname: 'Turnshirt ' + i })) })]);
    expect((await POST(ctx())).status).toBe(200);
  });
});
