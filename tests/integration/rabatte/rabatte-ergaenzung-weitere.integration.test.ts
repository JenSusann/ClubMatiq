import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
vi.mock('../../../src/lib/server/mongodb', async () => { const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../src/lib/server/mongodb';

const vereinId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const basis = { name: 'Test-Rabatt', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb', artikelIds: [], kategorieIds: [], riegen: [], maximaleMenge: null, gueltigAb: null, gueltigBis: null, kombinierbar: false, aktiv: true };
function ev(user: unknown, body: unknown = {}) { return { locals: { benutzer: user }, request: new Request('http://localhost/api/rabatte', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }; }
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank'); await client.connect(); });
afterAll(async () => { await db.collection('rabattregeln').deleteMany({ vereinId }); await client.close(); });
import * as route0 from '../../../src/routes/api/rabatte/+server';

// Ursprüngliche Datei: rabatte.integration.test.ts
describe('Rabattregeln', () => {
  it('verweigert anonymen Zugriff', async () => { expect((await route0.GET(ev(null) as never)).status).toBe(401); });
  it('verweigert Mitgliedern Rabattverwaltung', async () => { expect((await route0.POST(ev(mitglied, basis) as never)).status).toBe(403); });
  it('verweigert Prozentwerte über 100', async () => { expect((await route0.POST(ev(admin, { ...basis, wert: 101 }) as never)).status).toBe(400); });
  it('verweigert negative Rabatte', async () => { expect((await route0.POST(ev(admin, { ...basis, wert: -1 }) as never)).status).toBe(400); });
  it('verweigert ungültige Zeiträume', async () => { expect((await route0.POST(ev(admin, { ...basis, gueltigAb: '2026-12-31', gueltigBis: '2026-01-01' }) as never)).status).toBe(400); });
  it('verweigert fremde Artikelzuordnung', async () => { expect((await route0.POST(ev(admin, { ...basis, geltungsbereich: 'artikel', artikelIds: [new ObjectId().toString()] }) as never)).status).toBe(400); });
  it('erstellt Rabatt und listet ihn', async () => { const r = await route0.POST(ev(admin, basis) as never); expect(r.status).toBe(201); const list = await (await route0.GET(ev(admin) as never)).json(); expect(list.some((x: { name: string }) => x.name === basis.name)).toBe(true); });
  it('aktualisiert Rabatt', async () => { const x = await db.collection('rabattregeln').findOne({ vereinId }); expect(x).not.toBeNull(); const r = await route0.PUT(ev(admin, { ...basis, _id: x!._id.toString(), wert: 15 }) as never); expect(r.status).toBe(200); expect((await db.collection('rabattregeln').findOne({ _id: x!._id }))?.wert).toBe(15); });
});

