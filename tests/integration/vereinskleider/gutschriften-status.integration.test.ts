import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  credit: null as Record<string, unknown> | null,
  invoice: null as Record<string, unknown> | null,
  credits: [] as Record<string, unknown>[],
  updates: [] as { name: string; value: Record<string, unknown> }[],
  changed: false
}));
const mode = vi.hoisted(() => ({ real: false }));
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  const realClient = new MongoClient(process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:1');
  const realDb = realClient.db('clubmatiq_test');
  const mocked = {
  db: { collection: (name: string) => ({
    findOne: async () => name === 'vereinskleider_gutschriften' ? m.credit : m.invoice,
    find: () => ({ toArray: async () => m.credits }),
    updateOne: async (_filter: unknown, update: Record<string, unknown>) => {
      m.updates.push({ name, value: update });
      return { modifiedCount: m.changed ? 0 : 1 };
    }
  }) },
  client: { startSession: () => ({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: async () => undefined
  }) }
};

  return {
    db: new Proxy(realDb, { get(target, key) {
      if (!mode.real && key === 'collection') return mocked.db.collection;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } }),
    client: new Proxy(realClient, { get(target, key) {
      if (!mode.real && key === 'startSession') return mocked.client.startSession;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } })
  };
});
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: () => null }));
import { PATCH } from '../../../src/routes/api/vereinskleider/gutschriften/status/+server';

const vereinId = new ObjectId().toString();
const rechnungId = new ObjectId().toString();
const gutschriftId = new ObjectId().toString();
const credit = () => ({ _id: new ObjectId(gutschriftId), vereinId, rechnungId, betrag: 50 });
const invoice = (bezahlt = 70) => ({
  _id: new ObjectId(rechnungId), vereinId, gesamtbetrag: 100,
  gutgeschriebenBetrag: 50, bezahltBetrag: bezahlt
});
const send = (aktion: string, extra: Record<string, unknown> = {}) => PATCH({
  locals: { benutzer: { vereinId, rolle: 'admin', id: 'admin-1' } },
  request: new Request('http://localhost/api/vereinskleider/gutschriften/status', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gutschriftId, aktion, ...extra })
  })
} as never);

beforeEach(() => {
  m.credit = credit();
  m.invoice = invoice();
  m.credits = [credit()];
  m.updates = [];
  m.changed = false;
});
describe('Issue #70 – Gutschriften abschliessen', () => {
  it('dokumentiert eine vollständig erfolgte Rückerstattung ohne erneuten Zahlungseingang', async () => {
    const response = await send('rueckerstattet', {
      betrag: 20, datum: '2026-11-21', zahlungsart: 'twint', bemerkung: 'Bestätigt'
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'rueckerstattet', rueckerstattungOffen: 0 });
    expect(m.updates).toHaveLength(2);
    expect(m.updates[0].value).toMatchObject({
      $set: { bearbeitungsstatus: 'rueckerstattet', rueckerstattetBetrag: 20 }
    });
    expect(m.updates[1].value).toMatchObject({ $set: { rueckerstattungOffen: 0 } });
  });
  it('lässt Gutschrift ohne Auszahlungsbedarf als erledigt markieren', async () => {
    m.invoice = invoice(40);
    const response = await send('erledigt');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'erledigt' });
  });
  it('verweigert erledigt bei offener Rückzahlung', async () => {
    expect((await send('erledigt')).status).toBe(409);
    expect(m.updates).toHaveLength(0);
  });
  it('verweigert zu hohe Rückerstattung', async () => {
    expect((await send('rueckerstattet', {
      betrag: 21, datum: '2026-11-21', zahlungsart: 'bar', bemerkung: ''
    })).status).toBe(409);
  });
  it('unterstützt Teilrückerstattung mit verbleibendem offenen Betrag', async () => {
    const response = await send('rueckerstattet', {
      betrag: 10, datum: '2026-11-21', zahlungsart: 'bar', bemerkung: ''
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'teilweise_rueckerstattet', rueckerstattungOffen: 10
    });
  });
  it('unterstützt mehrere Gutschriften mit eindeutiger Rechnungssumme', async () => {
    m.credits = [{ ...credit(), betrag: 30 }, { ...credit(), _id: new ObjectId(), betrag: 20 }];
    m.credit = { ...credit(), betrag: 30 };
    const response = await send('rueckerstattet', {
      betrag: 20, datum: '2026-11-21', zahlungsart: 'bank', bemerkung: ''
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rueckerstattungOffen: 0, status: 'rueckerstattet' });
  });
  it('verweigert inkonsistente Gutschriftensummen', async () => {
    m.credits = [credit(), { ...credit(), _id: new ObjectId() }];
    expect((await send('erledigt')).status).toBe(409);
  });
  it('verweigert erneuten Abschluss', async () => {
    m.credit = { ...credit(), bearbeitungsstatus: 'rueckerstattet', rueckerstattetBetrag: 20 };
    expect((await send('erledigt')).status).toBe(409);
  });
  it('verweigert konkurrierende Änderungen', async () => {
    m.changed = true;
    expect((await send('rueckerstattet', {
      betrag: 20, datum: '2026-11-21', zahlungsart: 'bank', bemerkung: ''
    })).status).toBe(409);
  });
});

import { client, db } from '../../../src/lib/server/mongodb';

describe('Issue #70 – echte MongoDB: parallele Rückerstattungen', () => {
  const tenant = new ObjectId().toString();
  const foreign = new ObjectId().toString();
  const credits = () => db.collection('vereinskleider_gutschriften');
  const invoices = () => db.collection('vereinskleider_rechnungen');
  beforeAll(async () => {
    if (!process.env.MONGODB_TEST_URI || db.databaseName !== 'clubmatiq_test') throw new Error('Testdatenbank fehlt');
    mode.real = true;
    await client.connect();
  });
  afterAll(async () => {
    try {
      if (mode.real) {
        await credits().deleteMany({ vereinId: tenant });
        await invoices().deleteMany({ vereinId: tenant });
      }
    } finally { await client.close(); mode.real = false; }
  });
  async function anlegen(betraege: number[]) {
    const _id = new ObjectId();
    await invoices().insertOne({ _id, vereinId: tenant, gesamtbetrag: 100,
      bezahltBetrag: 70, gutgeschriebenBetrag: 50, rueckerstattungOffen: 20 });
    const gs = betraege.map(betrag => ({ _id: new ObjectId(), vereinId: tenant,
      rechnungId: _id.toString(), betrag, bearbeitungsstatus: 'offen' }));
    await credits().insertMany(gs);
    return { _id, gs };
  }
  const auszahlen = (_id: ObjectId, verein = tenant) => PATCH({
    locals: { benutzer: { vereinId: verein, rolle: 'admin', id: 'test-admin' } },
    request: new Request('http://localhost/api/test', { method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gutschriftId: _id.toString(), aktion: 'rueckerstattet',
        betrag: 20, datum: '2026-11-26', zahlungsart: 'bank', bemerkung: 'Integration' }) })
  } as never);
  async function pruefen(_id: ObjectId, erwartet: number) {
    const gs = await credits().find({ vereinId: tenant, rechnungId: _id.toString() }).toArray();
    expect(gs.reduce((s,g) => s + (g.rueckerstattetBetrag ?? 0),0)).toBe(erwartet);
    expect(gs.flatMap(g => g.rueckerstattungen ?? [])).toHaveLength(erwartet ? 1 : 0);
    expect(await invoices().findOne({ _id, vereinId: tenant })).toMatchObject({
      gesamtbetrag: 100, bezahltBetrag: 70, gutgeschriebenBetrag: 50, rueckerstattungOffen: 20-erwartet
    });
  }
  it('dokumentiert dieselbe Gutschrift bei parallelen Anfragen nur einmal', async () => {
    const { _id, gs } = await anlegen([50]);
    const rs = await Promise.all([auszahlen(gs[0]._id),auszahlen(gs[0]._id)]);
    expect(rs.map(r=>r.status).sort()).toEqual([200,409]);
    await pruefen(_id,20);
  });
  it('verhindert doppelte Auszahlung über zwei Gutschriften derselben Rechnung', async () => {
    const { _id, gs } = await anlegen([25,25]);
    const rs = await Promise.all(gs.map(g=>auszahlen(g._id)));
    expect(rs.map(r=>r.status).sort()).toEqual([200,409]);
    await pruefen(_id,20);
  });
  it('verweigert fremden Verein ohne Änderung der Finanzdaten', async () => {
    const { _id, gs } = await anlegen([50]);
    expect((await auszahlen(gs[0]._id,foreign)).status).toBe(404);
    await pruefen(_id,0);
  });
});
