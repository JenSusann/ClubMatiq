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


const vereinId = `integration-kategorien-${new ObjectId()}`;
const fremdVereinId = `integration-fremd-${new ObjectId()}`;
const verwendet = new ObjectId();
const frei = new ObjectId();
const fremd = new ObjectId();
const artikelId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const event = (id: string, benutzer: unknown = admin, name?: string) => ({ params: { id }, locals: { benutzer }, ...(name !== undefined ? { request: new Request(`http://localhost/api/kategorien/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }) } : {}) }) as Parameters<typeof route0.DELETE>[0] & Parameters<typeof route0.PATCH>[0];

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank');
  await client.connect();
  await db.collection('kategorien').insertMany([
    { _id: verwendet, vereinId, name: 'Verwendet' },
    { _id: frei, vereinId, name: 'Frei' },
    { _id: fremd, vereinId: fremdVereinId, name: 'Fremd' }
  ]);
  await db.collection('artikel').insertOne({ _id: artikelId, vereinId, kategorieId: verwendet.toString(), name: 'Testartikel', menge: 1 });
});
afterAll(async () => {
  await db.collection('artikel').deleteOne({ _id: artikelId });
  await db.collection('kategorien').deleteMany({ _id: { $in: [verwendet, frei, fremd] } });
  await client.close();
});
import * as route0 from '../../../src/routes/api/kategorien/[id]/+server';

// Ursprüngliche Datei: stammdaten-loeschsperren.integration.test.ts
describe('Kategorie-Bearbeitung und Löschsperren', () => {
  it('verweigert anonymes Löschen', async () => expect((await route0.DELETE(event(frei.toString(), null))).status).toBe(401));
  it('verweigert Mitgliedern das Löschen', async () => expect((await route0.DELETE(event(frei.toString(), mitglied))).status).toBe(403));
  it('weist ungültige IDs zurück', async () => expect((await route0.DELETE(event('ungueltig'))).status).toBe(400));
  it('schützt Kategorien anderer Vereine', async () => {
    expect((await route0.DELETE(event(fremd.toString()))).status).toBe(404);
    expect(await db.collection('kategorien').countDocuments({ _id: fremd })).toBe(1);
  });
  it('verhindert das Löschen einer verwendeten Kategorie', async () => {
    expect((await route0.DELETE(event(verwendet.toString()))).status).toBe(409);
    expect(await db.collection('kategorien').countDocuments({ _id: verwendet })).toBe(1);
  });
  it('bearbeitet eine Kategorie des eigenen Vereins', async () => {
    expect((await route0.PATCH(event(frei.toString(), admin, 'Umbenannt'))).status).toBe(200);
    expect((await db.collection('kategorien').findOne({ _id: frei }))?.name).toBe('Umbenannt');
  });
  it('verhindert Änderungen an fremden Kategorien', async () => expect((await route0.PATCH(event(fremd.toString(), admin, 'Unerlaubt'))).status).toBe(404));
  it('löscht eine nicht verwendete Kategorie', async () => {
    expect((await route0.DELETE(event(frei.toString()))).status).toBe(200);
    expect(await db.collection('kategorien').countDocuments({ _id: frei })).toBe(0);
  });
});

