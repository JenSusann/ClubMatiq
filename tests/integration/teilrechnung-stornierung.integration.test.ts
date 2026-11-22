import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  updateOne: vi.fn(), insertOne: vi.fn(), startSession: vi.fn(),
  endSession: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST } from '../../src/routes/api/vereinskleider/stornierungen/+server';

const verkaufId = new ObjectId();
const ersteId = new ObjectId();
const zweiteId = new ObjectId();
const artikelId = new ObjectId().toHexString();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const position = (preis: number, name: string) => ({
  artikelId, groesseId: null, artikelname: name, verkaufsart: 'bestellung',
  menge: 1, einzelpreis: preis, positionsbetrag: preis,
  reserviertMenge: 1, uebergebenMenge: 0, storniertMenge: 0, preisOffen: false
});
const ctx = (positionsIndex = 1, menge = 1) => ({
  locals: { benutzer },
  request: new Request('http://localhost/api/vereinskleider/stornierungen', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verkaufId: verkaufId.toHexString(), positionsIndex, menge, grund: 'Bestellung storniert' })
  })
}) as never;

let verkauf: Record<string, unknown>;
let rechnungen: Record<string, unknown>[];
let gutschriften: Record<string, unknown>[];

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  verkauf = {
    _id: verkaufId, vereinId: 'verein-a', status: 'offen',
    positionen: [position(55, 'Bekannte Artikel'), position(48, 'Trainerjacke')],
    trancheRechnungIds: [ersteId.toHexString(), zweiteId.toHexString()],
    zwischentotal: 103, endbetrag: 103, rabattTotal: 0,
    bezahltBetrag: 55, zahlungen: [{ betrag: 55 }],
    aktualisiertAm: new Date('2026-11-22'), stornierungen: []
  };
  rechnungen = [
    { _id: ersteId, vereinId: 'verein-a', verkaufId: verkaufId.toHexString(),
      rechnungstranche: true, rechnungsnummer: '2026-00001',
      positionen: [{ ...position(55, 'Bekannte Artikel'), positionsIndex: 0 }],
      gesamtbetrag: 55, bezahltBetrag: 55, status: 'bezahlt' },
    { _id: zweiteId, vereinId: 'verein-a', verkaufId: verkaufId.toHexString(),
      rechnungstranche: true, rechnungsnummer: '2026-00002',
      positionen: [{ ...position(48, 'Trainerjacke'), positionsIndex: 1 }],
      gesamtbetrag: 48, bezahltBetrag: 0, status: 'offen' }
  ];
  gutschriften = [];
  m.collection.mockImplementation((name: string) => {
    if (name === 'vereinskleider_verkaeufe') return { findOne: m.findOne, updateOne: m.updateOne };
    if (name === 'vereinskleider_rechnungen') return { find: m.find, updateOne: m.updateOne };
    return { insertOne: m.insertOne };
  });
  m.findOne.mockImplementation(async (filter: { vereinId: string }) =>
    filter.vereinId === 'verein-a' ? structuredClone(verkauf) : null);
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockImplementation(async () => structuredClone(rechnungen));
  m.updateOne.mockImplementation(async (filter: { _id: ObjectId }, update: { $set: Record<string, unknown> }) => {
    if (filter._id.toHexString() === verkaufId.toHexString()) Object.assign(verkauf, update.$set);
    else {
      const rechnung = rechnungen.find((r) => (r._id as ObjectId).toHexString() === filter._id.toHexString());
      if (rechnung) Object.assign(rechnung, update.$set);
    }
    return { modifiedCount: 1 };
  });
  m.insertOne.mockImplementation(async (doc: Record<string, unknown>) => {
    gutschriften.push(structuredClone(doc));
    return { acknowledged: true };
  });
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #68/#70 – Stornierung bei mehreren Teilrechnungen', () => {
  it('ordnet die CHF-48-Gutschrift ausschliesslich der zweiten Rechnung zu', async () => {
    const response = await POST(ctx());
    expect(response.status).toBe(200);
    expect(gutschriften).toHaveLength(1);
    expect(gutschriften[0]).toEqual(expect.objectContaining({
      rechnungId: zweiteId.toHexString(), betrag: 48, positionsIndex: 1
    }));
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);
    expect(rechnungen[0].gutgeschriebenBetrag).toBeUndefined();
    expect(rechnungen[1].gutgeschriebenBetrag).toBe(48);
    expect(verkauf.endbetrag).toBe(55);
    expect((verkauf.positionen as { menge: number }[])[1].menge).toBe(0);
  });

  it('verhindert eine zweite Stornierung derselben Menge', async () => {
    expect((await POST(ctx())).status).toBe(200);
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(1);
  });

  it('verhindert Stornierung einer bereits übergebenen Position', async () => {
    (verkauf.positionen as { uebergebenMenge: number }[])[1].uebergebenMenge = 1;
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(0);
  });

  it('verhindert Stornierung bei mehrdeutiger Rechnungszuordnung', async () => {
    (rechnungen[0].positionen as { positionsIndex: number }[])[0].positionsIndex = 1;
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(0);
  });

  it('verhindert Stornierung bei paralleler Änderung der Teilrechnung', async () => {
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(0);
  });

  it('verweigert Zugriff auf einen fremden Verein', async () => {
    m.findOne.mockResolvedValueOnce(null);
    expect((await POST(ctx())).status).toBe(404);
    expect(gutschriften).toHaveLength(0);
  });
});
