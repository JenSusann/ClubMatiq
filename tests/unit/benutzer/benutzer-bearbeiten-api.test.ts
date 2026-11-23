import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  permission: vi.fn(), collection: vi.fn(), findOne: vi.fn(),
  updateOne: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (...args: unknown[]) => m.collection(...args) }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: (...args: unknown[]) => m.permission(...args)
}));
import { PATCH } from '../../../src/routes/api/benutzer/[id]/+server';

const id = new ObjectId().toString();
const adminId = new ObjectId().toString();
const ziel = { _id: new ObjectId(id), vereinId: 'verein-1', rolle: 'mitglied', aktiv: true };
function event(body: unknown, personId = id, rolle = 'admin') {
  return {
    params: { id: personId },
    locals: { benutzer: { id: adminId, vereinId: 'verein-1', rolle } },
    request: new Request('http://localhost/api/benutzer/' + personId, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  } as never;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  m.permission.mockReturnValue(null);
  m.collection.mockReturnValue({ findOne: m.findOne, updateOne: m.updateOne, countDocuments: m.countDocuments, deleteMany: m.deleteMany });
  m.findOne.mockResolvedValue(ziel);
  m.updateOne.mockResolvedValue({ matchedCount: 1 });
  m.countDocuments.mockResolvedValue(1);
  m.deleteMany.mockResolvedValue({ deletedCount: 1 });
});

describe('Issue #15 – Benutzer bearbeiten', () => {
  it('speichert Vor- und Nachnamen', async () => {
    const response = await PATCH(event({ vorname: ' Eva ', nachname: 'Muster' }));
    expect(response.status).toBe(200);
    expect(m.updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(id), vereinId: 'verein-1' },
      { $set: { vorname: 'Eva', nachname: 'Muster' } }
    );
  });
  it('normalisiert E-Mail-Adressen', async () => {
    expect((await PATCH(event({ email: ' EVA@EXAMPLE.CH ' }))).status).toBe(200);
    expect(m.updateOne.mock.calls[0][1].$set.email).toBe('eva@example.ch');
  });
  it('weist ungültige Rollen und unbekannte Felder zurück', async () => {
    expect((await PATCH(event({ rolle: 'superadmin' }))).status).toBe(400);
    expect((await PATCH(event({ passwortHash: 'hack' }))).status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert Zugriff ohne Berechtigung', async () => {
    m.permission.mockReturnValue(new Response(null, { status: 403 }));
    expect((await PATCH(event({ vorname: 'Eva' }))).status).toBe(403);
    expect(m.findOne).not.toHaveBeenCalled();
  });
  it('verhindert Änderungen an fremden Vereinsbenutzern', async () => {
    m.findOne.mockResolvedValue(null);
    expect((await PATCH(event({ vorname: 'Eva' }))).status).toBe(404);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert das Entfernen der eigenen Administratorrolle', async () => {
    m.findOne.mockResolvedValue({ ...ziel, rolle: 'admin' });
    expect((await PATCH(event({ rolle: 'mitglied' }, adminId))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('schützt den letzten aktiven Administrator', async () => {
    m.findOne.mockResolvedValue({ ...ziel, rolle: 'admin' });
    m.countDocuments.mockResolvedValue(0);
    expect((await PATCH(event({ rolle: 'mitglied' }))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('löscht Sessions bei Rollenwechsel', async () => {
    expect((await PATCH(event({ rolle: 'leiter' }))).status).toBe(200);
    expect(m.deleteMany).toHaveBeenCalledWith({ benutzerId: id, vereinId: 'verein-1' });
  });
  it('behandelt doppelte E-Mail-Adressen als Konflikt', async () => {
    m.updateOne.mockRejectedValue({ code: 11000 });
    expect((await PATCH(event({ email: 'eva@example.ch' }))).status).toBe(409);
  });
  it('verweigert ungültigen Aktivstatus', async () => {
    expect((await PATCH(event({ aktiv: 'nein' }))).status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});
