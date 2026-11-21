import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), startSession: vi.fn(), endSession: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => ({ findOne: m.findOne, updateOne: m.updateOne }) },
  client: { startSession: m.startSession }
}));
import { POST } from '../../../src/routes/api/vereinskleider/teilzahlung/+server';

const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const bestellung = () => ({
  _id: new ObjectId(id), vereinId, aktualisiertAm: new Date('2026-11-20'),
  rabattTotal: 0, endbetrag: 55, bezahltBetrag: 0,
  zahlungen: [],
  positionen: [
    { artikelId: id, groesseId: null, menge: 1, einzelpreis: 25, preisOffen: false },
    { artikelId: id, groesseId: null, menge: 1, einzelpreis: 30, preisOffen: false },
    { artikelId: id, groesseId: null, menge: 1, einzelpreis: null, preisOffen: true }
  ]
});
const event = (body: unknown) => ({
  locals: { benutzer: { id, vereinId, rolle: 'admin' } },
  request: new Request('http://localhost/api/vereinskleider/teilzahlung', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
});
beforeEach(() => {
  vi.clearAllMocks();
  m.findOne.mockResolvedValue(bestellung());
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.startSession.mockReturnValue({ withTransaction: async (cb: () => Promise<unknown>) => cb(), endSession: m.endSession });
});
describe('Issue #68 – Teilzahlungen für gemischte Bestellungen', () => {
  it('bucht CHF 55 ohne offenen Jackenpreis als bezahlt zu kennzeichnen', async () => {
    const response = await POST(event({ verkaufId: id, betrag: 55, zahlungsart: 'twint' }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ergebnis).toMatchObject({
      faellig: 55, bezahlt: 55, restbetrag: 0, offenePreispositionen: 1, zahlungsstatus: 'teilweise_bezahlt'
    });
    expect(m.updateOne.mock.calls[0][1].$set.zahlungen).toHaveLength(1);
  });
  it('verhindert Überzahlungen', async () => {
    const response = await POST(event({ verkaufId: id, betrag: 56, zahlungsart: 'bar' }) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert Teilzahlungen bei bereits verrechneten Bestellungen', async () => {
    m.findOne.mockResolvedValue({ ...bestellung(), rechnungId: id });
    const response = await POST(event({ verkaufId: id, betrag: 20, zahlungsart: 'twint' }) as never);
    expect(response.status).toBe(409);
  });
  it('verhindert Zahlungen ohne Rechnungszuordnung nach einer Teilrechnung', async () => {
    m.findOne.mockResolvedValue({ ...bestellung(), trancheRechnungIds: [id] });
    const response = await POST(event({ verkaufId: id, betrag: 20, zahlungsart: 'bar' }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('erkennt gleichzeitige Änderungen vor der Verbuchung', async () => {
    m.updateOne.mockResolvedValue({ modifiedCount: 0 });
    const response = await POST(event({ verkaufId: id, betrag: 20, zahlungsart: 'bar' }) as never);
    expect(response.status).toBe(409);
  });
});
