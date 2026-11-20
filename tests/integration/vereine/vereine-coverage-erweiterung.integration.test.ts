import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({ collection: vi.fn(), find: vi.fn(), project: vi.fn(), sort: vi.fn(), toArray: vi.fn(), findOne: vi.fn(), insertOne: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
const vereinId = new ObjectId().toHexString();
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.collection.mockReturnValue(mocks);
  mocks.find.mockReturnValue(mocks);
  mocks.project.mockReturnValue(mocks);
  mocks.sort.mockReturnValue(mocks);
  mocks.toArray.mockResolvedValue([]);
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
});
import { GET, POST } from '../../../src/routes/api/vereine/+server';
const event = (user: unknown) => ({ locals: { benutzer: user } }) as never;
describe('Vereine: zusätzliche Integrationstests', () => {
  it('GET ohne Anmeldung liefert 401', async () => { expect((await GET(event(null))).status).toBe(401); });
  it('GET mit ungültiger Vereins-ID liefert 400', async () => { expect((await GET(event({ ...benutzer, vereinId: 'ungültig' }))).status).toBe(400); });
  it('GET bei nicht gefundenem Verein liefert 404', async () => { expect((await GET(event(benutzer))).status).toBe(404); });
  it('GET liefert eigenen Verein als Array', async () => { const id = new ObjectId(vereinId); const erstelltAm = new Date('2026-01-01'); mocks.findOne.mockResolvedValueOnce({ _id: id, name: 'Turnverein', kuerzel: 'TV', erstelltAm }); const r = await GET(event(benutzer)); expect(r.status).toBe(200); expect(await r.json()).toEqual([{ _id: vereinId, name: 'Turnverein', kuerzel: 'TV', erstelltAm: erstelltAm.toISOString() }]); expect(mocks.findOne).toHaveBeenCalledWith({ _id: id }); });
  it('GET ersetzt fehlendes Kürzel durch leeren String', async () => { mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(vereinId), name: 'Turnverein' }); const r = await GET(event(benutzer)); expect((await r.json())[0].kuerzel).toBe(''); });
  it('GET behandelt Datenbankfehler', async () => { mocks.findOne.mockRejectedValueOnce(new Error('DB')); expect((await GET(event(benutzer))).status).toBe(500); });
  it('POST ohne Anmeldung liefert 401', async () => { expect((await POST(event(null))).status).toBe(401); });
  it('POST mit Anmeldung liefert 403', async () => { const r = await POST(event(benutzer)); expect(r.status).toBe(403); expect((await r.json()).fehler).toContain('Registrierung'); });
});
