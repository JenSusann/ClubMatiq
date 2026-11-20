import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
vi.mock('../../../src/lib/server/mongodb', async () => { const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../src/lib/server/mongodb';

const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
let id = '';
const daten = { name: 'Integrationstest Lieferant', kontaktperson: 'Test', email: 'test@example.invalid', telefon: '', bemerkung: '' };
function ev(user: unknown, body: unknown = {}) { return { locals: { benutzer: user }, request: new Request('http://localhost/api/lieferanten', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }; }
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank'); await client.connect(); });
afterAll(async () => { await db.collection('artikel').deleteMany({ vereinId }); await db.collection('lieferanten').deleteMany({ vereinId }); await client.close(); });
import * as route0 from '../../../src/routes/api/lieferanten/+server';

// Ursprüngliche Datei: lieferanten.integration.test.ts
describe('Lieferanten', () => {
  it('verweigert anonymen Zugriff', async () => { expect((await route0.GET(ev(null) as never)).status).toBe(401); });
  it('verweigert Mitgliedern die Verwaltung', async () => { expect((await route0.POST(ev(mitglied, daten) as never)).status).toBe(403); });
  it('validiert E-Mail-Adressen', async () => { expect((await route0.POST(ev(admin, { ...daten, email: 'ungueltig' }) as never)).status).toBe(400); });
  it('legt Lieferanten an', async () => { const r = await route0.POST(ev(admin, daten) as never); expect(r.status).toBe(201); id = (await r.json()).id; expect(ObjectId.isValid(id)).toBe(true); });
  it('verhindert doppelte Lieferanten', async () => { expect((await route0.POST(ev(admin, daten) as never)).status).toBe(409); });
  it('zeigt nur Lieferanten des eigenen Vereins', async () => { await db.collection('lieferanten').insertOne({ vereinId: fremdId, name: 'Fremdlieferant' }); const r = await route0.GET(ev(admin) as never); const arr = await r.json(); expect(arr.some((x: { name: string }) => x.name === 'Fremdlieferant')).toBe(false); await db.collection('lieferanten').deleteMany({ vereinId: fremdId, name: 'Fremdlieferant' }); });
  it('bearbeitet Lieferanten', async () => { const r = await route0.PATCH(ev(admin, { ...daten, id, name: 'Geänderter Lieferant' }) as never); expect(r.status).toBe(200); expect((await db.collection('lieferanten').findOne({ _id: new ObjectId(id) }))?.name).toBe('Geänderter Lieferant'); });
  it('verhindert Löschen referenzierter Lieferanten', async () => { const a = await db.collection('artikel').insertOne({ vereinId, name: 'Testartikel', lieferantId: id }); expect((await route0.DELETE(ev(admin, { id }) as never)).status).toBe(409); await db.collection('artikel').deleteOne({ _id: a.insertedId }); });
  it('löscht unreferenzierte Lieferanten', async () => { expect((await route0.DELETE(ev(admin, { id }) as never)).status).toBe(200); expect(await db.collection('lieferanten').findOne({ _id: new ObjectId(id) })).toBeNull(); });
});

