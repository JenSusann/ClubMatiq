import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(),
  movement: vi.fn(), permission: vi.fn(() => null), endSession: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => ({
    findOne: mock.findOne, find: mock.find, updateOne: mock.updateOne,
    insertOne: mock.insertOne
  }) },
  client: { startSession: () => ({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: mock.endSession
  }) }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: mock.permission
}));
vi.mock('../../../src/lib/server/lagerbewegungen', () => ({
  protokolliereLagerbewegung: mock.movement
}));
import { GET, POST } from '../../../src/routes/api/vereinskleider/retouren/+server';
const id = '507f1f77bcf86cd799439011';
const request = (body: Record<string, unknown>) => ({
  locals: { benutzer: { vereinId: 'verein-1', id: 'user-1' } },
  request: new Request('http://localhost/api/vereinskleider/retouren', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verkaufId: id, positionsIndex: 0, menge: 1,
      grund: 'falsche_groesse', wiederverkaufbar: true,
      bemerkung: '', datum: '2026-11-21', ...body })
  })
}) as never;
beforeEach(() => {
  vi.clearAllMocks();
  mock.permission.mockReturnValue(null);
});
describe('Issue #69 – Retouren API', () => {
  it('verweigert ungültige Mengen und Daten vor Datenbankzugriff', async () => {
    for (const body of [
      { menge: 0 }, { menge: 1.5 }, { grund: 'unbekannt' },
      { datum: '2026-02-30' }, { wiederverkaufbar: 'ja' },
      { positionsIndex: -1 }
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(mock.findOne).not.toHaveBeenCalled();
  });
  it('verweigert fehlende Verkäufe mandantengetrennt', async () => {
    mock.findOne.mockResolvedValue(null);
    const response = await POST(request({}));
    expect(response.status).toBe(404);
    expect(mock.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-1' }), expect.any(Object)
    );
  });
  it('verweigert nicht nachweisbare Übergaben', async () => {
    mock.findOne.mockResolvedValue({
      positionen: [{ artikelId: id, groesseId: null, menge: 1, einzelpreis: 28 }],
      uebergaben: []
    });
    expect((await POST(request({}))).status).toBe(409);
    expect(mock.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert mehrdeutige Rechnungszuordnung ohne Lagerbewegung', async () => {
    mock.findOne.mockResolvedValue({
      positionen: [{ artikelId: id, groesseId: null, menge: 1, einzelpreis: 28, uebergebenMenge: 1 }],
      uebergaben: [{ positionsIndex: 0, menge: 1 }], retouren: []
    });
    mock.find.mockReturnValue({ toArray: async () => [] });
    expect((await POST(request({}))).status).toBe(409);
    expect(mock.movement).not.toHaveBeenCalled();
  });
  it('prüft Berechtigungen vor Datenbankzugriff', async () => {
    mock.permission.mockReturnValue(new Response('Forbidden', { status: 403 }) as never);
    expect((await POST(request({}))).status).toBe(403);
    expect(mock.findOne).not.toHaveBeenCalled();
  });
  it('GET validiert Verkaufs-ID', async () => {
    const response = await GET({
      locals: { benutzer: { vereinId: 'verein-1' } },
      url: new URL('http://localhost/api/vereinskleider/retouren?verkaufId=invalid')
    } as never);
    expect(response.status).toBe(400);
  });
});
