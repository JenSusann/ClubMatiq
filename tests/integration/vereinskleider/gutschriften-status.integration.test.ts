import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  credit: null as Record<string, unknown> | null,
  invoice: null as Record<string, unknown> | null,
  credits: [] as Record<string, unknown>[],
  updates: [] as { name: string; value: Record<string, unknown> }[],
  changed: false
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
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
}));
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
  it('verweigert falschen oder nur teilweise ausgezahlten Betrag', async () => {
    expect((await send('rueckerstattet', {
      betrag: 10, datum: '2026-11-21', zahlungsart: 'bar', bemerkung: ''
    })).status).toBe(409);
  });
  it('verweigert mehrere Gutschriften derselben Rechnung', async () => {
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
