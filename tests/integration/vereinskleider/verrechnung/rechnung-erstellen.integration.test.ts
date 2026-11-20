import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, benutzer, event, fremderVerein, oid, vereinId } from '../../helper';
vi.mock('../../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../../src/lib/server/mongodb';

const ids: ObjectId[] = [];
async function sale(extra: Record<string, unknown> = {}, club = vereinId) { const _id = oid(); ids.push(_id); await db.collection('vereinskleider_verkaeufe').insertOne({ _id, vereinId: club, kaeufer: 'Paket8 Test', zahlungsart: 'rechnung', positionen: [{ artikelId: oid().toString(), groesseId: null, artikelname: 'Testshirt', menge: 2, einzelpreis: 15, positionsbetrag: 30, verkaufsart: 'bestellung' }], zwischentotal: 30, rabattTotal: 0, endbetrag: 30, erstelltAm: new Date(), ...extra }); return _id; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('vereinskleider_rechnungen').deleteMany({ vereinId, verkaufId: { $in: ids.map(x => x.toString()) } }); await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: ids } }); await db.collection<{ _id: string }>('vereinskleider_rechnungsnummern').deleteMany({ _id: { $regex: `^${vereinId}:` } }); await client.close(); });
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: rechnung-erstellen.integration.test.ts
describe('Paket 8 – Rechnung erstellen', () => {
 it('erstellt Rechnung und verknüpft Verkauf atomar', async () => { const id = await sale(); const res = await route0.POST(event({ verkaufId: id.toString() })); expect(res.status).toBe(201); const body = await res.json(); expect(body.rechnung.gesamtbetrag).toBe(30); const rechnung = await db.collection('vereinskleider_rechnungen').findOne({ _id: new ObjectId(body.rechnung._id), vereinId }); expect(rechnung?.status).toBe('offen'); expect((await db.collection('vereinskleider_verkaeufe').findOne({ _id: id }))?.rechnungId).toBe(body.rechnung._id); });
 it('verhindert doppelte Rechnung', async () => { const id = await sale(); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(201); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(409); });
 it('übernimmt Teilzahlungen', async () => { const id = await sale({ bezahltBetrag: 10, zahlungen: [{ betrag: 10, datum: new Date(), zahlungsart: 'twint' }] }); const res = await route0.POST(event({ verkaufId: id.toString() })); expect(res.status).toBe(201); const r = await db.collection('vereinskleider_rechnungen').findOne({ verkaufId: id.toString(), vereinId }); expect(r?.status).toBe('teilweise_bezahlt'); expect(r?.bezahltBetrag).toBe(10); });
 it('verhindert Zugriff auf fremden Verein', async () => { const id = await sale({}, fremderVerein); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(404); });
 it('lehnt widersprüchliche Zahlungsbeträge ab', async () => { const id = await sale({ bezahltBetrag: 12, zahlungen: [{ betrag: 10, datum: new Date(), zahlungsart: 'bar' }] }); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(409); });
});

