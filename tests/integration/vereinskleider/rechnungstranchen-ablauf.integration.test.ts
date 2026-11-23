import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  updateOne: vi.fn(), insertOne: vi.fn(), findOneAndUpdate: vi.fn(),
  startSession: vi.fn(), endSession: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST as TRANCHE } from '../../../src/routes/api/vereinskleider/verrechnung/tranche/+server';
import { POST as PREIS } from '../../../src/routes/api/vereinskleider/preisfestlegung/+server';

const id = new ObjectId();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin' };
const ctx = (url: string, data: Record<string, unknown>) => ({
  locals: { benutzer },
  request: new Request('http://localhost' + url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verkaufId: id.toHexString(), ...data })
  })
}) as never;
const pos = (preis: number | null, offen: boolean) => ({
  artikelId: id.toHexString(), groesseId: null, artikelname: 'Artikel',
  menge: 1, einzelpreis: preis, preisOffen: offen,
  positionsbetrag: preis ?? 0, verkaufsart: 'bestellung'
});
let verkauf: Record<string, unknown>;
let rechnungen: Record<string, unknown>[];
let nummer: number;

beforeEach(() => {
  vi.clearAllMocks();
  nummer = 0;
  verkauf = {
    _id: id, vereinId: 'verein-a', kaeufer: 'Test', zahlungsart: 'twint',
    positionen: [pos(25, false), pos(30, false), pos(null, true)],
    zwischentotal: 55, endbetrag: 55, rabattTotal: 0,
    bezahltBetrag: 55, zahlungen: [{ betrag: 55, zahlungsart: 'twint', datum: new Date('2026-11-22') }],
    preisOffen: true, aktualisiertAm: new Date('2026-11-22')
  };
  rechnungen = [];
  m.permission.mockReturnValue(null);
  m.collection.mockImplementation((name: string) => {
    if (name === 'vereinskleider_verkaeufe') return {
      findOne: m.findOne, updateOne: m.updateOne
    };
    if (name === 'vereinskleider_rechnungen') return {
      find: m.find, insertOne: m.insertOne
    };
    return { findOneAndUpdate: m.findOneAndUpdate };
  });
  m.findOne.mockImplementation(async (filter: { vereinId: string }) =>
    filter.vereinId === 'verein-a' ? structuredClone(verkauf) : null);
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockImplementation(async () => structuredClone(rechnungen));
  m.updateOne.mockImplementation(async (_filter: unknown, update: Record<string, Record<string, unknown>>) => {
    Object.assign(verkauf, update.$set ?? {});
    if (update.$addToSet?.trancheRechnungIds) {
      verkauf.trancheRechnungIds = [
        ...((verkauf.trancheRechnungIds as string[] | undefined) ?? []),
        update.$addToSet.trancheRechnungIds
      ];
    }
    return { modifiedCount: 1 };
  });
  m.insertOne.mockImplementation(async (doc: Record<string, unknown>) => {
    rechnungen.push(structuredClone(doc));
    return { acknowledged: true };
  });
  m.findOneAndUpdate.mockImplementation(async () => ({ nummer: ++nummer }));
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #68 – gemischte Bestellung und spätere Rechnungstranche', () => {
  it('verrechnet CHF 55, fixiert später CHF 48 und erstellt nur die neue CHF-48-Tranche', async () => {
    const erste = await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}));
    expect(erste.status).toBe(201);
    expect(rechnungen).toHaveLength(1);
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);
    expect((rechnungen[0].positionen as unknown[])).toHaveLength(2);

    const preis = await PREIS(ctx('/api/vereinskleider/preisfestlegung', {
      positionsIndex: 2, einzelpreis: 48
    }));
    expect(preis.status).toBe(200);
    expect((verkauf.positionen as { einzelpreis: number | null }[])[2].einzelpreis).toBe(48);
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);

    const zweite = await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}));
    expect(zweite.status).toBe(201);
    expect(rechnungen).toHaveLength(2);
    expect(rechnungen[1].gesamtbetrag).toBe(48);
    expect(rechnungen[1].bezahltBetrag).toBe(0);
    expect((rechnungen[1].positionen as { positionsIndex: number }[])[0].positionsIndex).toBe(2);
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);

    const nochmal = await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}));
    expect(nochmal.status).toBe(409);
    expect(rechnungen).toHaveLength(2);
  });

  it('verbietet Zahlung direkt bei der Preisfestlegung nach erster Teilrechnung', async () => {
    expect((await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}))).status).toBe(201);
    const response = await PREIS(ctx('/api/vereinskleider/preisfestlegung', {
      positionsIndex: 2, einzelpreis: 48, zahlung: { betrag: 48, zahlungsart: 'twint' }
    }));
    expect(response.status).toBe(409);
    expect((verkauf.positionen as { einzelpreis: number | null }[])[2].einzelpreis).toBeNull();
    expect(rechnungen).toHaveLength(1);
  });
});
