import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, event, oid, vereinId } from '../helper';
vi.mock('../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../src/lib/server/mongodb';

const inventoryIds: ObjectId[] = []; const articleIds: ObjectId[] = [];
async function fixture(status = 'abgeschlossen', amount = 10) { const inventur = oid(), position = oid(), artikel = oid(); inventoryIds.push(inventur); articleIds.push(artikel); await db.collection('inventuren').insertOne({ _id: inventur, vereinId, status, version: 0 }); await db.collection('inventurpositionen').insertOne({ _id: position, inventurId: inventur.toString(), vereinId, artikelId: artikel.toString(), groesseId: null, istBestand: amount, sollBestand: amount }); await db.collection('artikel').insertOne({ _id: artikel, vereinId, menge: amount, hatGroessen: false }); return { inventur, position, artikel }; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('inventurprotokoll').deleteMany({ vereinId, inventurId: { $in: inventoryIds.map(x => x.toString()) } }); await db.collection('inventurpositionen').deleteMany({ vereinId, inventurId: { $in: inventoryIds.map(x => x.toString()) } }); await db.collection('inventuren').deleteMany({ _id: { $in: inventoryIds } }); await db.collection('artikel').deleteMany({ _id: { $in: articleIds } }); await client.close(); });
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrigieren/+server';

// Ursprüngliche Datei: inventur-korrektur-erfolg.integration.test.ts
describe('Paket 8 – Inventurkorrektur', () => {
 it('erhöht Bestand, Version und schreibt Protokoll', async () => { const f = await fixture(); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 13, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(200); expect((await db.collection('artikel').findOne({ _id: f.artikel }))?.menge).toBe(13); expect((await db.collection('inventuren').findOne({ _id: f.inventur }))?.version).toBe(1); expect(await db.collection('inventurprotokoll').countDocuments({ inventurId: f.inventur.toString(), aktion: 'nachtraeglich_korrigiert' })).toBe(1); });
 it('verhindert veraltete Version ohne Bestandsänderung', async () => { const f = await fixture(); await db.collection('inventuren').updateOne({ _id: f.inventur }, { $set: { version: 2 } }); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 12, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(409); expect((await db.collection('artikel').findOne({ _id: f.artikel }))?.menge).toBe(10); });
 it('lehnt Korrektur offener Inventur ab', async () => { const f = await fixture('offen'); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 12, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(409); });
 it('verhindert negativen Bestand', async () => { const f = await fixture('abgeschlossen', 10); await db.collection('artikel').updateOne({ _id: f.artikel }, { $set: { menge: 1 } }); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 5, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(409); expect((await db.collection('artikel').findOne({ _id: f.artikel }))?.menge).toBe(1); });
});

