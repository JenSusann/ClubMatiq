import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, benutzer, oid, vereinId, fremderVerein } from '../../helper';
vi.mock('../../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../../src/lib/server/mongodb';

const ids: ObjectId[] = []; const marker = `paket8-${oid().toString()}`;
beforeAll(async () => { assertTestDb(db); await client.connect(); for (const club of [vereinId, fremderVerein]) { const r = oid(), v = oid(); ids.push(r, v); await db.collection('vereinskleider_rechnungen').insertOne({ _id: r, vereinId: club, rechnungsnummer: marker, erstelltAm: new Date() }); await db.collection('vereinskleider_verkaeufe').insertOne({ _id: v, vereinId: club, kaeufer: marker, endbetrag: 25, erstelltAm: new Date() }); } });
afterAll(async () => { await db.collection('vereinskleider_rechnungen').deleteMany({ _id: { $in: ids } }); await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: ids } }); await client.close(); });
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: rechnung-liste.integration.test.ts
describe('Paket 8 – Verrechnungsübersicht', () => {
 it('listet eigene Rechnung und unverrechneten Verkauf', async () => { const res = await route0.GET({ locals: { benutzer } } as any); expect(res.status).toBe(200); const data = await res.json(); expect(data.rechnungen.some((r: any) => r.rechnungsnummer === marker)).toBe(true); expect(data.unverrechneteVerkaeufe.some((v: any) => v.kaeufer === marker)).toBe(true); });
 it('liefert keine fremden Vereinsdaten', async () => { const res = await route0.GET({ locals: { benutzer } } as any); const data = await res.json(); expect(data.rechnungen.filter((r: any) => r.rechnungsnummer === marker).every((r: any) => r.vereinId === vereinId)).toBe(true); expect(data.unverrechneteVerkaeufe.filter((v: any) => v.kaeufer === marker).map((v: any) => v._id)).toEqual([ids[1].toHexString()]); });
});

