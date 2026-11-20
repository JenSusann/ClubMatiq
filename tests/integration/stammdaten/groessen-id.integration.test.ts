import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  countDocuments: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => mocks) }
}));
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const locals = (rolle = 'admin') => ({
  benutzer: { id: new ObjectId().toHexString(), vereinId, rolle }
});
const event = (method: string, body?: unknown, rolle = 'admin', targetId = id) => ({
  params: { id: targetId },
  locals: locals(rolle),
  request: new Request('http://localhost/api/test', {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  })
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockResolvedValue(null);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.countDocuments.mockResolvedValue(0);
});
import * as route0 from '../../../src/routes/api/groessen/[id]/+server';

// Ursprüngliche Datei: paket18-groessen-id.integration.test.ts
describe('Integration: Grössen ändern und löschen', () => {
  it('verbietet Änderungen ohne Stammdatenrecht', async () => {
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: 2 }, 'mitglied') as never)).status).toBe(403);
  });
  it('weist ungültige IDs zurück', async () => {
    expect((await route0.DELETE(event('DELETE', undefined, 'admin', 'ungueltig') as never)).status).toBe(400);
  });
  it('validiert Sortierung', async () => {
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: -1 }) as never)).status).toBe(400);
  });
  it('meldet fremde oder fehlende Grösse', async () => {
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: 2 }) as never)).status).toBe(404);
  });
  it('verhindert doppelte Grössen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce({ _id: new ObjectId(), vereinId });
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: 2 }) as never)).status).toBe(409);
  });
  it('ändert die Grösse erfolgreich', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce(null);
    const response = await route0.PATCH(event('PATCH', { bezeichnung: '  M  ', sortierung: 2 }) as never);
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalled();
  });
  it('verhindert Löschen referenzierter Grössen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    mocks.countDocuments.mockResolvedValueOnce(2);
    expect((await route0.DELETE(event('DELETE') as never)).status).toBe(409);
  });
  it('löscht unbenutzte Grösse', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    expect((await route0.DELETE(event('DELETE') as never)).status).toBe(200);
    expect(mocks.deleteOne).toHaveBeenCalled();
  });
});

import * as route1 from '../../../src/routes/api/lagerorte/[id]/+server';

// Ursprüngliche Datei: paket18-lagerorte-id.integration.test.ts
describe('Integration: Lagerorte ändern und löschen', () => {
  it('verweigert Mitgliedern die Bearbeitung', async () => {
    expect((await route1.PATCH(event('PATCH', { name: 'Halle' }, 'mitglied') as never)).status).toBe(403);
  });
  it('weist ungültige ID zurück', async () => {
    expect((await route1.DELETE(event('DELETE', undefined, 'admin', 'falsch') as never)).status).toBe(400);
  });
  it('verlangt einen Namen', async () => {
    expect((await route1.PATCH(event('PATCH', { name: ' ' }) as never)).status).toBe(400);
  });
  it('meldet fehlenden Lagerort', async () => {
    expect((await route1.DELETE(event('DELETE') as never)).status).toBe(404);
  });
  it('verhindert doppelte Lagerortnamen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce({ _id: new ObjectId(), vereinId });
    expect((await route1.PATCH(event('PATCH', { name: 'Halle' }) as never)).status).toBe(409);
  });
  it('ändert Lagerort erfolgreich', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce(null);
    const response = await route1.PATCH(event('PATCH', { name: '  Halle  ' }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe('Halle');
  });
  it('verhindert Löschen zugeordneter Artikel', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    mocks.countDocuments.mockResolvedValueOnce(3);
    expect((await route1.DELETE(event('DELETE') as never)).status).toBe(409);
  });
  it('löscht leeren Lagerort', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    expect((await route1.DELETE(event('DELETE') as never)).status).toBe(200);
    expect(mocks.deleteOne).toHaveBeenCalled();
  });
});

