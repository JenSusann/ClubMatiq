import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, event, oid, vereinId } from '../helper';
vi.mock('../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../src/lib/server/mongodb';

const inventories: ObjectId[] = []; const articles: ObjectId[] = [];
async function fixture(status: string, current: number, soll: number, ist: number) { const inv = oid(), article = oid(), pos = oid(); inventories.push(inv); articles.push(article); await db.collection('inventuren').insertOne({ _id: inv, vereinId, status, version: 0, anzahlPositionen: 1, anzahlNachtraeglicheKorrekturen: 0 }); await db.collection('inventurpositionen').insertOne({ _id: pos, inventurId: inv.toString(), vereinId, artikelId: article.toString(), groesseId: null, sollBestand: soll, istBestand: ist }); await db.collection('artikel').insertOne({ _id: article, vereinId, menge: current, hatGroessen: false }); return { inv, article }; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('inventurprotokoll').deleteMany({ vereinId, inventurId: { $in: inventories.map(x => x.toString()) } }); await db.collection('inventurpositionen').deleteMany({ vereinId, inventurId: { $in: inventories.map(x => x.toString()) } }); await db.collection('inventuren').deleteMany({ _id: { $in: inventories } }); await db.collection('artikel').deleteMany({ _id: { $in: articles } }); await client.close(); });
import * as route0 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: inventur-stornierung-erfolg.integration.test.ts
describe('Paket 8 – Inventurstornierung', () => {
 it('storniert offene Inventur ohne Lageränderung', async () => { const f = await fixture('offen', 10, 10, 10); const res = await route0.POST(event({ begruendung: 'Fehlerhafte Zählung' }, f.inv.toString())); expect(res.status).toBe(200); expect((await db.collection('inventuren').findOne({ _id: f.inv }))?.status).toBe('storniert'); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(10); });
 it('bucht abgeschlossene Inventur zurück', async () => { const f = await fixture('abgeschlossen', 8, 10, 8); const res = await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString())); expect(res.status).toBe(200); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(10); expect((await res.json()).anzahlRueckbuchungen).toBe(1); });
 it('rollt zurück wenn Bestand für Rückbuchung nicht reicht', async () => { const f = await fixture('abgeschlossen', 1, 2, 5); const res = await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString())); expect(res.status).toBe(409); expect((await db.collection('inventuren').findOne({ _id: f.inv }))?.status).toBe('abgeschlossen'); });
 it('verhindert wiederholte Stornierung', async () => { const f = await fixture('offen', 10, 10, 10); expect((await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString()))).status).toBe(200); expect((await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString()))).status).toBe(409); });
});

