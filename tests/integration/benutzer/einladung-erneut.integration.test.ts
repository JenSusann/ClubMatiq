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

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../../src/lib/server/email', () => ({
  versendeEinladung: mail.send
}));
vi.mock('../../../src/lib/server/einladungen', () => ({
  erstelleEinladungstoken: () => ({ token: 'test-token', tokenHash: 'test-hash' }),
  berechneAblaufdatum: () => new Date('2030-01-01')
}));
import * as route0 from '../../../src/routes/api/benutzer/einladen/[id]/erneut/+server';

// Ursprüngliche Datei: paket18-einladung-erneut.integration.test.ts
describe('Integration: Einladung erneut versenden', () => {
  it('verweigert unberechtigten Zugriff', async () => {
    expect((await route0.POST(event('POST', undefined, 'mitglied') as never)).status).toBe(403);
  });
  it('prüft die Einladungs-ID', async () => {
    expect((await route0.POST(event('POST', undefined, 'admin', 'ungueltig') as never)).status).toBe(400);
  });
  it('meldet unbekannte Einladung', async () => {
    expect((await route0.POST(event('POST') as never)).status).toBe(404);
  });
  it('begrenzt erneutes Versenden auf eine Minute', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId, status: 'offen', versendetAm: new Date() });
    expect((await route0.POST(event('POST') as never)).status).toBe(429);
  });
  it('versendet eine offene Einladung erneut', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId, status: 'offen', email: 'test@example.org', vorname: 'Test' }).mockResolvedValueOnce({ name: 'Testverein' });
    mail.send.mockResolvedValueOnce({ id: 'mail-test' });
    const response = await route0.POST(event('POST') as never);
    expect(response.status).toBe(200);
    expect(mail.send).toHaveBeenCalledOnce();
    expect(mocks.updateOne).toHaveBeenCalledOnce();
  });
  it('meldet Mailversandfehler', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId, status: 'offen', email: 'test@example.org', vorname: 'Test' }).mockResolvedValueOnce({ name: 'Testverein' });
    mail.send.mockRejectedValueOnce(new Error('Mail nicht erreichbar'));
    expect((await route0.POST(event('POST') as never)).status).toBe(502);
  });
});

