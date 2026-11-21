import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  verkauf: null as Record<string, unknown> | null,
  belege: [] as Record<string, unknown>[],
  updates: [] as { collection: string; update: unknown }[],
  gutschriften: [] as unknown[],
  fehlerUpdate: false
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    findOne: async () => m.verkauf,
    find: () => ({ toArray: async () => m.belege }),
    updateOne: async (_filter: unknown, update: unknown) => {
      m.updates.push({ collection: name, update });
      return { modifiedCount: m.fehlerUpdate ? 0 : 1 };
    },
    insertOne: async (dokument: unknown) => { m.gutschriften.push(dokument); return { acknowledged: true }; }
  }) },
  client: { startSession: () => ({
    withTransaction: async (callback: () => Promise<unknown>) => callback(),
    endSession: async () => undefined
  }) }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: () => null
}));
import { POST } from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

const id = () => new ObjectId().toString();
const vereinId = id();
const verkaufId = id();
const artikelId = id();
const rechnungId = id();
const pos = () => ({
  artikelId, groesseId: null, artikelname: 'Tasche',
  verkaufsart: 'bestellung', menge: 2, einzelpreis: 50, positionsbetrag: 100,
  uebergebenMenge: 0, reserviertMenge: 1, storniertMenge: 0
});
const sale = () => ({
  _id: new ObjectId(verkaufId), vereinId, status: 'offen',
  positionen: [pos()], rabattTotal: 0, endbetrag: 100, zwischentotal: 100,
  trancheRechnungIds: [rechnungId]
});
const invoice = () => ({
  _id: new ObjectId(rechnungId), vereinId, verkaufId,
  rechnungstranche: true, rechnungsnummer: '2026-00002',
  gesamtbetrag: 100, bezahltBetrag: 70, status: 'teilweise_bezahlt',
  positionen: [{ ...pos(), positionsIndex: 0 }]
});
const send = (menge = 1) => POST({
  locals: { benutzer: { id: id(), vereinId, rolle: 'admin' } },
  request: new Request('http://localhost/api/vereinskleider/stornierungen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verkaufId, positionsIndex: 0, menge, grund: 'Nicht benötigt' })
  })
} as never);

beforeEach(() => {
  m.verkauf = sale();
  m.belege = [invoice()];
  m.updates = [];
  m.gutschriften = [];
  m.fehlerUpdate = false;
});
describe('Issue #68 – positionsgenaue Teilrechnungs-Gutschriften', () => {
  it('korrigiert nur die passende Teilrechnung und merkt Überzahlung vor', async () => {
    const response = await send();
    expect(response.status).toBe(200);
    expect((await response.json()).stornierung).toMatchObject({
      gutschriftBetrag: 50, rueckerstattungOffen: 20, freigegebeneReserve: 1
    });
    expect(m.updates).toHaveLength(2);
    expect(m.updates[0].collection).toBe('vereinskleider_rechnungen');
    expect(m.updates[0].update).toMatchObject({
      $set: { gutgeschriebenBetrag: 50, rueckerstattungOffen: 20 }
    });
    expect(m.gutschriften).toHaveLength(1);
    expect(m.gutschriften[0]).toMatchObject({
      rechnungId, positionsIndex: 0, menge: 1, betrag: 50
    });
  });
  it('blockiert übergebene Mengen', async () => {
    m.verkauf = { ...sale(), positionen: [{ ...pos(), uebergebenMenge: 2 }] };
    expect((await send()).status).toBe(409);
    expect(m.gutschriften).toHaveLength(0);
  });
  it('blockiert Positionen auf mehreren Teilrechnungen', async () => {
    const weitereId = id();
    m.verkauf = { ...sale(), trancheRechnungIds: [rechnungId, weitereId] };
    m.belege = [invoice(), { ...invoice(), _id: new ObjectId(weitereId) }];
    expect((await send()).status).toBe(409);
    expect(m.gutschriften).toHaveLength(0);
  });
  it('blockiert Stornierung über die verbleibende Rechnungsmenge', async () => {
    m.verkauf = { ...sale(), stornierungen: [{ positionsIndex: 0, menge: 1 }] };
    expect((await send(2)).status).toBe(409);
  });
  it('blockiert konkurrierende Rechnungsänderungen', async () => {
    m.fehlerUpdate = true;
    expect((await send()).status).toBe(409);
    expect(m.gutschriften).toHaveLength(0);
  });
});
