import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permission: vi.fn(), collection: vi.fn(), find: vi.fn(), project: vi.fn(), sort: vi.fn(), toArray: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args) } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET } from '../../src/routes/api/benutzer/+server';
const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const event = () => ({ locals: { benutzer } } as any);
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockReturnValue({ find: mocks.find });
  mocks.find.mockReturnValue({ project: mocks.project });
  mocks.project.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockResolvedValue([]);
});
describe('GET /api/benutzer', () => {
  it('verweigert Zugriff ohne Verwaltungsrecht', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await GET(event());
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'benutzer:verwalten');
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('lädt nur Benutzer des Vereins und entfernt Passwort-Hashes', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => 'id-1' }, vorname: 'Anna', nachname: 'Muster', email: 'anna@example.org', rolle: 'admin', aktiv: true, passwortHash: 'geheim' }]);
    const response = await GET(event());
    expect(response.status).toBe(200);
    expect(mocks.collection).toHaveBeenCalledWith('benutzer');
    expect(mocks.find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
    expect(mocks.project).toHaveBeenCalledWith({ passwortHash: 0 });
    expect(mocks.sort).toHaveBeenCalledWith({ nachname: 1, vorname: 1 });
    expect(await response.json()).toEqual([{ id: 'id-1', vorname: 'Anna', nachname: 'Muster', email: 'anna@example.org', rolle: 'admin', aktiv: true }]);
  });
  it('liefert eine leere Liste bei keinen Benutzern', async () => {
    const response = await GET(event());
    expect(await response.json()).toEqual([]);
  });
  it('behandelt Datenbankfehler mit 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB'));
    const response = await GET(event());
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Benutzer konnten nicht geladen werden.');
  });
});
