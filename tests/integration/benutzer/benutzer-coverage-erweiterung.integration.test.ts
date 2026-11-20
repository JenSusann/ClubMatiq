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
import { GET } from '../../../src/routes/api/benutzer/+server';
describe('Benutzerliste: zusätzliche Integrationstests', () => {
  it('GET liefert leere Liste', async () => { const r = await GET({ locals: { benutzer } } as never); expect(r.status).toBe(200); expect(await r.json()).toEqual([]); });
  it('GET gibt nur sichere Benutzerfelder zurück', async () => { const id = new ObjectId(); mocks.toArray.mockResolvedValueOnce([{ _id: id, vorname: 'Lena', nachname: 'Muster', email: 'lena@example.org', rolle: 'admin', aktiv: true, passwortHash: 'geheim' }]); const r = await GET({ locals: { benutzer } } as never); expect(await r.json()).toEqual([{ id: id.toString(), vorname: 'Lena', nachname: 'Muster', email: 'lena@example.org', rolle: 'admin', aktiv: true }]); expect(mocks.project).toHaveBeenCalledWith({ passwortHash: 0 }); expect(mocks.find).toHaveBeenCalledWith({ vereinId }); });
  it('GET sortiert nach Nachname und Vorname', async () => { await GET({ locals: { benutzer } } as never); expect(mocks.sort).toHaveBeenCalledWith({ nachname: 1, vorname: 1 }); });
  it('GET behandelt Datenbankfehler', async () => { mocks.toArray.mockRejectedValueOnce(new Error('DB')); const r = await GET({ locals: { benutzer } } as never); expect(r.status).toBe(500); expect(await r.json()).toEqual({ fehler: 'Benutzer konnten nicht geladen werden.' }); });
});
