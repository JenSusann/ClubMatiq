import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(), insertOne: vi.fn(), startSession: vi.fn(),
  endSession: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST } from '../../../src/routes/api/vereinskleider/verrechnung/+server';

const id = new ObjectId().toHexString();
const benutzer = { id: 'test-user', vereinId: 'verein-a', rolle: 'admin' };
const request = (verkaufId: unknown = id) => ({
  locals: { benutzer },
  request: new Request('http://localhost/api/vereinskleider/verrechnung', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verkaufId })
  })
}) as never;
const position = { artikelId: id, groesseId: null, artikelname: 'T-Shirt',
  menge: 1, einzelpreis: 25, positionsbetrag: 25, verkaufsart: 'direkt' };
const verkauf = () => ({
  _id: new ObjectId(id), vereinId: 'verein-a', kaeufer: 'Test',
  zahlungsart: 'rechnung', positionen: [position], zwischentotal: 25,
  rabattTotal: 0, endbetrag: 25, bezahltBetrag: 0, zahlungen: []
});

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  m.collection.mockReturnValue({
    findOne: m.findOne, findOneAndUpdate: m.findOneAndUpdate,
    updateOne: m.updateOne, insertOne: m.insertOne
  });
  m.findOne.mockResolvedValue(verkauf());
  m.findOneAndUpdate.mockResolvedValue({ nummer: 1 });
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.insertOne.mockResolvedValue({ acknowledged: true });
  m.startSession.mockReturnValue({
    withTransaction: async (callback: () => Promise<unknown>) => callback(),
    endSession: m.endSession
  });
});

describe('Issue #68 – Rechnungsstellung schützt bestehende Zahlungen und Teilrechnungen', () => {
  it('verweigert die Rechnungsstellung ohne Berechtigung', async () => {
    m.permission.mockReturnValue(new Response('Verboten', { status: 403 }) as never);
    expect((await POST(request())).status).toBe(403);
    expect(m.startSession).not.toHaveBeenCalled();
  });

  it('verweigert ungültige Verkaufs-IDs', async () => {
    expect((await POST(request('ungueltig'))).status).toBe(400);
    expect(m.startSession).not.toHaveBeenCalled();
  });

  it('sucht Verkäufe nur im eigenen Verein', async () => {
    m.findOne.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(m.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-a' }), expect.anything()
    );
  });

  it('blockiert eine zweite Vollrechnung nach bereits vorhandener Teilrechnung', async () => {
    m.findOne.mockResolvedValue({ ...verkauf(), trancheRechnungIds: ['bereits-verrechnet'] });
    expect((await POST(request())).status).toBe(409);
    expect(m.insertOne).not.toHaveBeenCalled();
  });

  it('blockiert eine Vollrechnung bei offenem Verkaufspreis', async () => {
    m.findOne.mockResolvedValue({ ...verkauf(), preisOffen: true });
    expect((await POST(request())).status).toBe(409);
    expect(m.insertOne).not.toHaveBeenCalled();
  });

  it('verweigert inkonsistente oder doppelt erfasste Zahlungen', async () => {
    m.findOne.mockResolvedValue({
      ...verkauf(), bezahltBetrag: 25,
      zahlungen: [{ betrag: 25, datum: new Date(), zahlungsart: 'twint' },
        { betrag: 25, datum: new Date(), zahlungsart: 'twint' }]
    });
    expect((await POST(request())).status).toBe(409);
    expect(m.insertOne).not.toHaveBeenCalled();
  });

  it('übernimmt eine bestehende Teilzahlung, ohne sie erneut zu buchen', async () => {
    m.findOne.mockResolvedValue({
      ...verkauf(), bezahltBetrag: 10,
      zahlungen: [{ betrag: 10, datum: new Date(), zahlungsart: 'twint' }]
    });
    expect((await POST(request())).status).toBe(201);
    const rechnung = m.insertOne.mock.calls[0][0];
    expect(rechnung.bezahltBetrag).toBe(10);
    expect(rechnung.gesamtbetrag).toBe(25);
    expect(rechnung.status).toBe('teilweise_bezahlt');
    expect(rechnung.zahlungen).toHaveLength(1);
  });

  it('verhindert parallele Rechnungsstellung bei verlorener atomarer Beanspruchung', async () => {
    m.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await POST(request())).status).toBe(409);
    expect(m.insertOne).not.toHaveBeenCalled();
  });
});
