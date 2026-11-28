import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn(() => ({ findOne: m.findOne })) } }));
import { GET, POST } from '../../../src/routes/api/vereine/+server';

const id = new ObjectId().toHexString();
const ctx = (benutzer: unknown = { vereinId: id }) => ({ locals: { benutzer } } as any);

beforeEach(() => vi.clearAllMocks());
describe('GET /api/vereine', () => {
  it('verweigert Zugriff ohne Anmeldung', async () => { const r = await GET(ctx(null)); expect(r.status).toBe(401); expect(m.findOne).not.toHaveBeenCalled(); });
  it.each(['ungültig', '', '123', 'x'.repeat(25)])('verweigert ungültige Vereins-ID %s', async vereinId => { const r = await GET(ctx({ vereinId })); expect(r.status).toBe(400); expect(m.findOne).not.toHaveBeenCalled(); });
  it('meldet nicht gefunden', async () => { m.findOne.mockResolvedValue(null); const r = await GET(ctx()); expect(r.status).toBe(404); });
  it('liefert eigenen Verein als Array mit Kürzel', async () => { const erstelltAm = new Date('2026-01-01'); m.findOne.mockResolvedValue({ _id: new ObjectId(id), name: 'Turnverein', kuerzel: 'TV', erstelltAm }); const r = await GET(ctx()); expect(r.status).toBe(200); expect(await r.json()).toEqual([{ _id: id, name: 'Turnverein', kuerzel: 'TV', erstelltAm: erstelltAm.toISOString(), adresse: { strasse: '', plz: '', ort: '' }, kontakt: { email: '', telefon: '', website: '' }, logo: null }]); expect(m.findOne).toHaveBeenCalledWith({ _id: new ObjectId(id) }); });
  it('setzt fehlendes Kürzel auf Leerstring', async () => { m.findOne.mockResolvedValue({ _id: new ObjectId(id), name: 'Verein' }); const r = await GET(ctx()); expect((await r.json())[0].kuerzel).toBe(''); });
  it('behandelt Datenbankfehler', async () => { m.findOne.mockRejectedValue(new Error('DB')); const r = await GET(ctx()); expect(r.status).toBe(500); });
});
describe('POST /api/vereine', () => {
  it('verlangt Anmeldung', async () => { expect((await POST(ctx(null))).status).toBe(401); });
  it('verhindert direkte Vereinserstellung', async () => { const r = await POST(ctx()); expect(r.status).toBe(403); expect((await r.json()).fehler).toMatch(/Registrierung/); });
});
