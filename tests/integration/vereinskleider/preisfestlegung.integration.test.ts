import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), startSession: vi.fn(), endSession: vi.fn()
}));
const mode = vi.hoisted(() => ({ real: false }));
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  const realClient = new MongoClient(process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:1');
  const realDb = realClient.db('clubmatiq_test');
  return {
    db: new Proxy(realDb, { get(target, key) {
      if (!mode.real && key === 'collection') return () => ({ findOne: m.findOne, updateOne: m.updateOne });
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } }),
    client: new Proxy(realClient, { get(target, key) {
      if (!mode.real && key === 'startSession') return m.startSession;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } })
  };
});
import { POST } from '../../../src/routes/api/vereinskleider/preisfestlegung/+server';

const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const bestellung = () => ({
  _id: new ObjectId(id), vereinId, status: 'offen', rabattTotal: 0,
  zahlungen: [{ betrag: 55, datum: new Date(), zahlungsart: 'twint' }],
  positionen: [
    { artikelId: id, groesseId: null, menge: 1, einzelpreis: 25, preisOffen: false, positionsbetrag: 25, verkaufsart: 'bestellung' },
    { artikelId: id, groesseId: null, menge: 1, einzelpreis: 30, preisOffen: false, positionsbetrag: 30, verkaufsart: 'bestellung' },
    { artikelId: id, groesseId: null, menge: 1, einzelpreis: null, preisOffen: true, positionsbetrag: 0, verkaufsart: 'bestellung' }
  ]
});
const event = (body: unknown) => ({
  locals: { benutzer: { id, vereinId, rolle: 'admin' } },
  request: new Request('http://localhost/api/vereinskleider/preisfestlegung', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
});
beforeEach(() => {
  vi.clearAllMocks();
  m.findOne.mockResolvedValue(bestellung());
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.startSession.mockReturnValue({ withTransaction: async (cb: () => Promise<unknown>) => cb(), endSession: m.endSession });
});
describe('Issue #68 – spätere Preisfestlegung im selben Vorgang', () => {
  it('belässt CHF 55 bezahlt und fordert nach Festlegung CHF 48', async () => {
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48 }) as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ergebnis).toMatchObject({ faellig: 103, bezahlt: 55, restbetrag: 48 });
    expect(m.updateOne.mock.calls[0][1].$set.positionen[2].einzelpreis).toBe(48);
  });
  it('erfasst zweite Zahlung ohne neue Bestellung', async () => {
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48,
      zahlung: { betrag: 48, zahlungsart: 'bar' } }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ergebnis).toMatchObject({ faellig: 103, bezahlt: 103, restbetrag: 0, zahlungsstatus: 'bezahlt' });
    expect(m.updateOne.mock.calls[0][1].$set.zahlungen).toHaveLength(2);
  });
  it('verhindert eine Überzahlung', async () => {
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48,
      zahlung: { betrag: 49, zahlungsart: 'bar' } }) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert doppelte Preisfestlegung', async () => {
    const b = bestellung(); b.positionen[2].preisOffen = false; b.positionen[2].einzelpreis = 48;
    m.findOne.mockResolvedValue(b);
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48 }) as never);
    expect(response.status).toBe(409);
  });
  it('erlaubt die spätere Preisfestlegung nach einer ersten Teilrechnung', async () => {
    m.findOne.mockResolvedValue({ ...bestellung(), trancheRechnungIds: [id] });
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48 }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ergebnis).toMatchObject({ faellig: 103, bezahlt: 55, restbetrag: 48 });
    expect(m.updateOne).toHaveBeenCalledTimes(1);
  });
  it('verhindert unzugeordnete Zahlung bei Preisfestlegung nach Teilrechnung', async () => {
    m.findOne.mockResolvedValue({ ...bestellung(), trancheRechnungIds: [id] });
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48,
      zahlung: { betrag: 48, zahlungsart: 'twint' } }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('schützt bereits verrechnete Bestellungen', async () => {
    m.findOne.mockResolvedValue({ ...bestellung(), rechnungId: id });
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48 }) as never);
    expect(response.status).toBe(409);
  });
});

import { client, db } from '../../../src/lib/server/mongodb';
import { POST as teilzahlung } from '../../../src/routes/api/vereinskleider/teilzahlung/+server';
import { POST as verrechnung } from '../../../src/routes/api/vereinskleider/verrechnung/+server';

describe('Issue #68 – parallele Finanzvorgänge mit echter MongoDB', () => {
  const testVerein = new ObjectId().toString();
  const user = new ObjectId().toString();
  const req = (body: unknown) => ({
    locals: { benutzer: { id: user, vereinId: testVerein, rolle: 'admin' } },
    request: new Request('http://localhost/api/test', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }) as never;
  beforeAll(async () => {
    if (!process.env.MONGODB_TEST_URI || db.databaseName !== 'clubmatiq_test') throw new Error('Testdatenbank fehlt');
    mode.real = true;
    await client.connect();
  });
  afterAll(async () => {
    try {
      if (mode.real) for (const name of ['vereinskleider_verkaeufe','vereinskleider_rechnungen','vereinskleider_rechnungsnummern']) {
        await db.collection(name).deleteMany({ vereinId: testVerein });
      }
    } finally { await client.close(); mode.real = false; }
  });
  async function anlegen() {
    const _id = new ObjectId();
    await db.collection('vereinskleider_verkaeufe').insertOne({
      ...bestellung(), _id, vereinId: testVerein, kaeufer: 'Integration #68',
      zahlungsart: 'twint', bezahltBetrag: 55, zahlungsstatus: 'teilweise_bezahlt',
      preisOffen: true, endbetrag: 55, zwischentotal: 55,
      erstelltAm: new Date(), aktualisiertAm: new Date()
    });
    return _id;
  }
  const laden = (_id: ObjectId) => db.collection('vereinskleider_verkaeufe').findOne({ _id, vereinId: testVerein });
  const fixieren = (_id: ObjectId, einzelpreis = 48) => POST(req({ verkaufId: _id.toString(), positionsIndex: 2, einzelpreis }));
  it('fixiert einen offenen Preis bei zwei parallelen Anfragen genau einmal', async () => {
    const _id = await anlegen();
    const responses = await Promise.all([fixieren(_id,48),fixieren(_id,49)]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    const v = await laden(_id);
    expect([48,49]).toContain(v?.positionen[2].einzelpreis);
    expect(v?.positionen[2].preisOffen).toBe(false);
    expect(v?.bezahltBetrag).toBe(55);
  });
  it('verhindert parallele Überzahlung vor Verrechnung', async () => {
    const _id = await anlegen();
    expect((await fixieren(_id)).status).toBe(200);
    const zahlen = () => teilzahlung(req({ verkaufId: _id.toString(), betrag: 48, zahlungsart: 'bar' }));
    const responses = await Promise.all([zahlen(),zahlen()]);
    expect(responses.filter(r=>r.status===200)).toHaveLength(1);
    expect(responses.every(r=>[200,400,409].includes(r.status))).toBe(true);
    const v = await laden(_id);
    expect(v?.bezahltBetrag).toBe(103);
    expect(v?.zahlungen).toHaveLength(2);
  });
  it('erstellt bei paralleler Vollverrechnung nur eine Rechnung', async () => {
    const _id = await anlegen();
    expect((await fixieren(_id)).status).toBe(200);
    const rechnen = () => verrechnung(req({ verkaufId: _id.toString() }));
    const responses = await Promise.all([rechnen(),rechnen()]);
    expect(responses.map(r=>r.status).sort()).toEqual([201,409]);
    const rechnungen = await db.collection('vereinskleider_rechnungen').find({ vereinId: testVerein, verkaufId: _id.toString() }).toArray();
    expect(rechnungen).toHaveLength(1);
    expect(rechnungen[0]).toMatchObject({ gesamtbetrag: 103, bezahltBetrag: 55 });
    expect((await laden(_id))?.rechnungId).toBe(rechnungen[0]._id.toString());
  });
});
