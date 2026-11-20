import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';


const vereinId = `integration-benutzer-${new ObjectId()}`;
const fremdVereinId = `integration-fremd-${new ObjectId()}`;
const id = new ObjectId();
const fremdId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const event = (benutzer: unknown) => ({ locals: { benutzer } }) as Parameters<typeof GET>[0];

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank');
  await client.connect();
  await db.collection('benutzer').insertMany([
    { _id: id, vereinId, vorname: 'Anna', nachname: 'Test', email: 'anna@example.test', rolle: 'mitglied', aktiv: true, passwortHash: 'GEHEIM' },
    { _id: fremdId, vereinId: fremdVereinId, vorname: 'Fremd', nachname: 'Person', email: 'fremd@example.test', rolle: 'admin', aktiv: true, passwortHash: 'GEHEIM' }
  ]);
});
afterAll(async () => {
  await db.collection('benutzer').deleteMany({ _id: { $in: [id, fremdId] } });
  await client.close();
});
import * as route0 from '../../../src/routes/api/benutzer/+server';

// Ursprüngliche Datei: benutzer-verwaltung.integration.test.ts
describe('Benutzerverwaltung', () => {
  it('verweigert anonymen Zugriff', async () => expect((await route0.GET(event(null))).status).toBe(401));
  it('verweigert Mitgliedern die Benutzerverwaltung', async () => expect((await route0.GET(event(mitglied))).status).toBe(403));
  it('zeigt dem Admin nur Benutzer des eigenen Vereins', async () => {
    const res = await route0.GET(event(admin));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((x: { id: string }) => x.id === id.toString())).toBe(true);
    expect(data.some((x: { id: string }) => x.id === fremdId.toString())).toBe(false);
  });
  it('gibt keine Passwort-Hashes zurück', async () => {
    const res = await route0.GET(event(admin));
    const data = await res.json();
    expect(JSON.stringify(data)).not.toContain('GEHEIM');
    expect(JSON.stringify(data)).not.toContain('passwortHash');
  });
});

