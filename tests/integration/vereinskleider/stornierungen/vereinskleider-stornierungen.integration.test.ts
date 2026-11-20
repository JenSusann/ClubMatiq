import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

// Der Mock verhindert jede Verbindung zur produktiven Datenbank.
vi.mock('../../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config();
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});



const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/stornierungen', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/vereinskleider/stornierungen')
  } as never;
}
import * as route0 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: vereinskleider-stornierungen.integration.test.ts
describe('vereinskleider/stornierungen', () => {
  it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => {
    const res = await route0.POST(event({}, id, null));
    expect(res.status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verwaltungsberechtigung den Zugriff', async () => {
    const res = await route0.POST(event({}, id, { ...admin, rolle: 'mitglied' }));
    expect(res.status).toBe(403);
  });
  it('weist ungültige JSON-Eingaben zurück', async () => {
    const ev = event({});
    (ev as any).request = new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{kaputt' });
    const res = await route0.POST(ev);
    expect(res.status).toBe(400);
  });
  it('ungueltige Verkaufs-ID', async () => {
    const res = await route0.POST(event({"verkaufId": "x", "positionsIndex": 0, "menge": 1, "grund": "Test"}, id));
    expect(res.status).toBe(400);
  });
  it('Menge Null', async () => {
    const res = await route0.POST(event({"verkaufId": id, "positionsIndex": 0, "menge": 0, "grund": "Test"}, id));
    expect(res.status).toBe(400);
  });
  it('fehlender Grund', async () => {
    const res = await route0.POST(event({"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": ""}, id));
    expect(res.status).toBe(400);
  });
  it('negativer Positionsindex', async () => {
    const res = await route0.POST(event({"verkaufId": id, "positionsIndex": -1, "menge": 1, "grund": "Test"}, id));
    expect(res.status).toBe(400);
  });
});

