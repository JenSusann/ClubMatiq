import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, event, oid, vereinId, fremderVerein } from '../../helper';
vi.mock('../../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../../src/lib/server/mongodb';

const ids: ObjectId[] = [];
async function fixture(status = 'entwurf', club = vereinId) { const _id = oid(); ids.push(_id); await db.collection('vereinskleider_sammelbestellungen').insertOne({ _id, vereinId: club, status, positionen: [{ artikelId: oid().toString(), groesseId: null, artikelname: 'Test', menge: 2 }], aktualisiertAm: new Date() }); return _id; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('vereinskleider_sammelbestellungen').deleteMany({ _id: { $in: ids } }); await client.close(); });
import * as route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: sammelbestellung-status.integration.test.ts
describe('Paket 8 – Sammelbestellung Statuswechsel', () => {
 it('setzt Entwurf auf bestellt', async () => { const id = await fixture(); const res = await route0.PATCH(event({ aktion: 'bestellen' }, id.toString())); expect(res.status).toBe(200); expect((await db.collection('vereinskleider_sammelbestellungen').findOne({ _id: id }))?.status).toBe('bestellt'); });
 it('verhindert doppelte Bestellung', async () => { const id = await fixture('bestellt'); expect((await route0.PATCH(event({ aktion: 'bestellen' }, id.toString()))).status).toBe(409); });
 it('verhindert Bestellung fremden Vereins', async () => { const id = await fixture('entwurf', fremderVerein); expect((await route0.PATCH(event({ aktion: 'bestellen' }, id.toString()))).status).toBe(404); });
 it('verhindert Wareneingang auf Entwurf', async () => { const id = await fixture(); const res = await route0.PATCH(event({ aktion: 'wareneingang', positionen: [{ artikelId: oid().toString(), groesseId: null, menge: 1 }] }, id.toString())); expect(res.status).toBe(409); });
});

