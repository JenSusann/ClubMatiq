import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), startSession: vi.fn(), endSession: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => ({ findOne: m.findOne, updateOne: m.updateOne }) },
  client: { startSession: m.startSession }
}));
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
  it('schützt bereits verrechnete Bestellungen', async () => {
    m.findOne.mockResolvedValue({ ...bestellung(), rechnungId: id });
    const response = await POST(event({ verkaufId: id, positionsIndex: 2, einzelpreis: 48 }) as never);
    expect(response.status).toBe(409);
  });
});
