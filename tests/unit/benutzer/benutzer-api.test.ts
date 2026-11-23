import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({ permission: vi.fn(), collection: vi.fn(), find: vi.fn(), project: vi.fn(), sort: vi.fn(), toArray: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args) } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET } from '../../../src/routes/api/benutzer/+server';
import { PATCH } from '../../../src/routes/api/benutzer/[id]/+server';
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

const id = new ObjectId().toString();
const adminId = new ObjectId().toString();
const ziel = { _id: new ObjectId(id), vereinId: 'verein-1', rolle: 'mitglied', aktiv: true };
function eventBearbeiten(body: unknown, personId = id, rolle = 'admin') {
  return {
    params: { id: personId },
    locals: { benutzer: { id: adminId, vereinId: 'verein-1', rolle } },
    request: new Request('http://localhost/api/benutzer/' + personId, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  } as never;
}
describe('Benutzerbearbeitung – Detail-API', () => {
 beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockReturnValue({ findOne: mocks.findOne, updateOne: mocks.updateOne, countDocuments: mocks.countDocuments, deleteMany: mocks.deleteMany });
  mocks.findOne.mockResolvedValue(ziel);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.countDocuments.mockResolvedValue(1);
  mocks.deleteMany.mockResolvedValue({ deletedCount: 1 });
});

describe('Issue #15 – Benutzer bearbeiten', () => {
  it('speichert Vor- und Nachnamen', async () => {
    const response = await PATCH(eventBearbeiten({ vorname: ' Eva ', nachname: 'Muster' }));
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(id), vereinId: 'verein-1' },
      { $set: { vorname: 'Eva', nachname: 'Muster' } }
    );
  });
  it('normalisiert E-Mail-Adressen', async () => {
    expect((await PATCH(eventBearbeiten({ email: ' EVA@EXAMPLE.CH ' }))).status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][1].$set.email).toBe('eva@example.ch');
  });
  it('weist ungültige Rollen und unbekannte Felder zurück', async () => {
    expect((await PATCH(eventBearbeiten({ rolle: 'superadmin' }))).status).toBe(400);
    expect((await PATCH(eventBearbeiten({ passwortHash: 'hack' }))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert Zugriff ohne Berechtigung', async () => {
    mocks.permission.mockReturnValue(new Response(null, { status: 403 }));
    expect((await PATCH(eventBearbeiten({ vorname: 'Eva' }))).status).toBe(403);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
  it('verhindert Änderungen an fremden Vereinsbenutzern', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await PATCH(eventBearbeiten({ vorname: 'Eva' }))).status).toBe(404);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert das Entfernen der eigenen Administratorrolle', async () => {
    mocks.findOne.mockResolvedValue({ ...ziel, rolle: 'admin' });
    expect((await PATCH(eventBearbeiten({ rolle: 'mitglied' }, adminId))).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('schützt den letzten aktiven Administrator', async () => {
    mocks.findOne.mockResolvedValue({ ...ziel, rolle: 'admin' });
    mocks.countDocuments.mockResolvedValue(0);
    expect((await PATCH(eventBearbeiten({ rolle: 'mitglied' }))).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('löscht Sessions bei Rollenwechsel', async () => {
    expect((await PATCH(eventBearbeiten({ rolle: 'leiter' }))).status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ benutzerId: id, vereinId: 'verein-1' });
  });
  it('behandelt doppelte E-Mail-Adressen als Konflikt', async () => {
    mocks.updateOne.mockRejectedValue({ code: 11000 });
    expect((await PATCH(eventBearbeiten({ email: 'eva@example.ch' }))).status).toBe(409);
  });
  it('verweigert ungültigen Aktivstatus', async () => {
    expect((await PATCH(eventBearbeiten({ aktiv: 'nein' }))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});

});
