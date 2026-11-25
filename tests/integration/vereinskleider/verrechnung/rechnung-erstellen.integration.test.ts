import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, benutzer, event, fremderVerein, oid, vereinId } from '../../helper';
vi.mock('../../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../../src/lib/server/mongodb';


import * as rechnungRoute from '../../../../src/routes/api/vereinskleider/verrechnung/+server';
import * as zahlungRoute from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';
afterAll(async () => { await client.close(); });

describe('rechnung-erstellen', () => {
const route0 = rechnungRoute;
const ids: ObjectId[] = [];
async function sale(extra: Record<string, unknown> = {}, club = vereinId) { const _id = oid(); ids.push(_id); await db.collection('vereinskleider_verkaeufe').insertOne({ _id, vereinId: club, kaeufer: 'Paket8 Test', zahlungsart: 'rechnung', positionen: [{ artikelId: oid().toString(), groesseId: null, artikelname: 'Testshirt', menge: 2, einzelpreis: 15, positionsbetrag: 30, verkaufsart: 'bestellung' }], zwischentotal: 30, rabattTotal: 0, endbetrag: 30, erstelltAm: new Date(), ...extra }); return _id; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('vereinskleider_rechnungen').deleteMany({ vereinId, verkaufId: { $in: ids.map(x => x.toString()) } }); await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: ids } }); await db.collection<{ _id: string }>('vereinskleider_rechnungsnummern').deleteMany({ _id: { $regex: `^${vereinId}:` } });  });

// Ursprüngliche Datei: rechnung-erstellen.integration.test.ts
describe('Paket 8 – Rechnung erstellen', () => {
 it('erstellt Rechnung und verknüpft Verkauf atomar', async () => { const id = await sale(); const res = await route0.POST(event({ verkaufId: id.toString() })); expect(res.status).toBe(201); const body = await res.json(); expect(body.rechnung.gesamtbetrag).toBe(30); const rechnung = await db.collection('vereinskleider_rechnungen').findOne({ _id: new ObjectId(body.rechnung._id), vereinId }); expect(rechnung?.status).toBe('offen'); expect((await db.collection('vereinskleider_verkaeufe').findOne({ _id: id }))?.rechnungId).toBe(body.rechnung._id); });
 it('verhindert doppelte Rechnung', async () => { const id = await sale(); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(201); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(409); });
 it('übernimmt Teilzahlungen', async () => { const id = await sale({ bezahltBetrag: 10, zahlungen: [{ betrag: 10, datum: new Date(), zahlungsart: 'twint' }] }); const res = await route0.POST(event({ verkaufId: id.toString() })); expect(res.status).toBe(201); const r = await db.collection('vereinskleider_rechnungen').findOne({ verkaufId: id.toString(), vereinId }); expect(r?.status).toBe('teilweise_bezahlt'); expect(r?.bezahltBetrag).toBe(10); });
 it('verhindert Zugriff auf fremden Verein', async () => { const id = await sale({}, fremderVerein); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(404); });
 it('lehnt widersprüchliche Zahlungsbeträge ab', async () => { const id = await sale({ bezahltBetrag: 12, zahlungen: [{ betrag: 10, datum: new Date(), zahlungsart: 'bar' }] }); expect((await route0.POST(event({ verkaufId: id.toString() }))).status).toBe(409); });
});


});

describe('rechnung-liste', () => {
const route0 = rechnungRoute;
const ids: ObjectId[] = []; const marker = `paket8-${oid().toString()}`;
beforeAll(async () => { assertTestDb(db); await client.connect(); for (const club of [vereinId, fremderVerein]) { const r = oid(), v = oid(); ids.push(r, v); await db.collection('vereinskleider_rechnungen').insertOne({ _id: r, vereinId: club, rechnungsnummer: marker, erstelltAm: new Date() }); await db.collection('vereinskleider_verkaeufe').insertOne({ _id: v, vereinId: club, kaeufer: marker, endbetrag: 25, erstelltAm: new Date() }); } });
afterAll(async () => { await db.collection('vereinskleider_rechnungen').deleteMany({ _id: { $in: ids } }); await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: ids } });  });

// Ursprüngliche Datei: rechnung-liste.integration.test.ts
describe('Paket 8 – Verrechnungsübersicht', () => {
 it('listet eigene Rechnung und unverrechneten Verkauf', async () => { const res = await route0.GET({ locals: { benutzer } } as any); expect(res.status).toBe(200); const data = await res.json(); expect(data.rechnungen.some((r: any) => r.rechnungsnummer === marker)).toBe(true); expect(data.unverrechneteVerkaeufe.some((v: any) => v.kaeufer === marker)).toBe(true); });
 it('liefert keine fremden Vereinsdaten', async () => { const res = await route0.GET({ locals: { benutzer } } as any); const data = await res.json(); expect(data.rechnungen.filter((r: any) => r.rechnungsnummer === marker).every((r: any) => r.vereinId === vereinId)).toBe(true); expect(data.unverrechneteVerkaeufe.filter((v: any) => v.kaeufer === marker).map((v: any) => v._id)).toEqual([ids[1].toHexString()]); });
});


});

describe('vereinskleider-rechnungen', () => {
const route0 = rechnungRoute;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/verrechnung', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/vereinskleider/verrechnung')
  } as never;
}

// Ursprüngliche Datei: vereinskleider-rechnungen.integration.test.ts
describe('vereinskleider/verrechnung', () => {
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
  it('fehlende Verkaufs-ID', async () => {
    const res = await route0.POST(event({}, id));
    expect(res.status).toBe(400);
  });
  it('ungueltige Verkaufs-ID', async () => {
    const res = await route0.POST(event({"verkaufId": "x"}, id));
    expect(res.status).toBe(400);
  });
});


});

describe('vereinskleider-zahlungen', () => {
const route0 = zahlungRoute;
const vereinId = new ObjectId().toString();
const fremdVerein = new ObjectId().toString();
const rechnungId = new ObjectId();
const fremdeRechnungId = new ObjectId();
const benutzer = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const zahlungId = 'e04c9230-14b7-47b1-997b-8dfd5d934c19';
const basis = { betrag: 25, datum: '2026-11-18', zahlungsart: 'twint', zahlungId };
function event(id: string, body: unknown, user: unknown = benutzer) {
  return { params: { id }, locals: { benutzer: user }, request: new Request('http://localhost/api/vereinskleider/verrechnung/'+id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) } as never;
}
beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank!');
  await client.connect();
  await db.collection('vereinskleider_rechnungen').insertMany([
    { _id: rechnungId, vereinId, verkaufId: new ObjectId().toString(), status: 'offen', gesamtbetrag: 50, bezahltBetrag: 0, zahlungen: [] },
    { _id: fremdeRechnungId, vereinId: fremdVerein, verkaufId: new ObjectId().toString(), status: 'offen', gesamtbetrag: 50, bezahltBetrag: 0, zahlungen: [] }
  ]);
});
afterAll(async () => {
  await db.collection('vereinskleider_rechnungen').deleteMany({ _id: { $in: [rechnungId, fremdeRechnungId] } });
  
});

// Ursprüngliche Datei: vereinskleider-zahlungen.integration.test.ts
describe('Vereinskleider-Zahlungseingänge', () => {
  it('401 ohne Anmeldung', async () => expect((await route0.PATCH(event(rechnungId.toString(), basis, null))).status).toBe(401));
  it('403 für Mitglied', async () => expect((await route0.PATCH(event(rechnungId.toString(), basis, { ...benutzer, rolle: 'mitglied' }))).status).toBe(403));
  it('400 für ungültige Rechnungs-ID', async () => expect((await route0.PATCH(event('ungueltig', basis))).status).toBe(400));
  it('400 für Betrag 0', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 0 }))).status).toBe(400));
  it('400 für mehr als zwei Dezimalstellen', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 1.234 }))).status).toBe(400));
  it('400 für ungültiges Datum', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, datum: '2026-02-30' }))).status).toBe(400));
  it('400 für ungültige Zahlungsart', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, zahlungsart: 'karte' }))).status).toBe(400));
  it('400 für fehlende Zahlungs-ID', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, zahlungId: '' }))).status).toBe(400));
  it('404 für fremden Verein', async () => expect((await route0.PATCH(event(fremdeRechnungId.toString(), basis))).status).toBe(404));
  it('verbucht 25 CHF und setzt teilweise bezahlt', async () => {
    const res = await route0.PATCH(event(rechnungId.toString(), basis));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, bereitsErfasst: false, bezahltBetrag: 25, status: 'teilweise_bezahlt' });
    const doc = await db.collection('vereinskleider_rechnungen').findOne({ _id: rechnungId });
    expect(doc?.zahlungen).toHaveLength(1);
  });
  it('ist idempotent bei wiederholter Zahlungs-ID', async () => {
    const res = await route0.PATCH(event(rechnungId.toString(), basis));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ bereitsErfasst: true, bezahltBetrag: 25 });
  });
  it('409 bei wiederverwendeter Zahlungs-ID mit anderen Daten', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 20 }))).status).toBe(409));
  it('409 bei Überzahlung', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 30, zahlungId: '8cc16ac2-0930-499e-94cf-87dff96093a8' }))).status).toBe(409));
  it('begleicht die Restforderung', async () => {
    const res = await route0.PATCH(event(rechnungId.toString(), { ...basis, zahlungId: '8cc16ac2-0930-499e-94cf-87dff96093a8' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ bezahltBetrag: 50, status: 'bezahlt' });
  });
});


});
