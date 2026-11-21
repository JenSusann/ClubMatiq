import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(),
  zaehler: vi.fn(), startSession: vi.fn(), endSession: vi.fn(), pruefeBerechtigung: vi.fn()
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    findOne: (...args: unknown[]) => m.findOne(name, ...args),
    find: (...args: unknown[]) => m.find(name, ...args),
    updateOne: (...args: unknown[]) => m.updateOne(name, ...args),
    insertOne: (...args: unknown[]) => m.insertOne(name, ...args),
    findOneAndUpdate: (...args: unknown[]) => m.zaehler(name, ...args)
  }) },
  client: { startSession: m.startSession }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: m.pruefeBerechtigung
}));
import { POST } from '../../../../src/routes/api/vereinskleider/verrechnung/tranche/+server';

const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const verkauf = () => ({
  _id: new ObjectId(id), vereinId, kaeufer: 'Jen', riegen: ['Aktive'],
  aktualisiertAm: new Date('2026-11-21T08:00:00Z'), rabattTotal: 0,
  rabatte: [], zusaetzlicherRabatt: 0, endbetrag: 55,
  bezahltBetrag: 55, zahlungen: [{ betrag: 55, zahlungsart: 'twint', datum: new Date() }],
  positionen: [
    { artikelId: id, groesseId: null, artikelname: 'Shirt', menge: 1, einzelpreis: 25, preisOffen: false },
    { artikelId: id, groesseId: null, artikelname: 'Shorts', menge: 1, einzelpreis: 30, preisOffen: false },
    { artikelId: id, groesseId: null, artikelname: 'Jacke', menge: 1, einzelpreis: null, preisOffen: true }
  ]
});
const event = () => ({
  locals: { benutzer: { id, vereinId, rolle: 'admin' } },
  request: new Request('http://localhost/api/vereinskleider/verrechnung/tranche', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verkaufId: id })
  })
});
let bestellung: ReturnType<typeof verkauf>;
let rechnungen: Record<string, any>[];
beforeEach(() => {
  vi.clearAllMocks();
  bestellung = verkauf();
  rechnungen = [];
  m.pruefeBerechtigung.mockReturnValue(null);
  m.startSession.mockReturnValue({ withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: m.endSession });
  m.findOne.mockImplementation(async (name: string) => name === 'vereinskleider_verkaeufe' ? bestellung : null);
  m.find.mockImplementation(() => ({ toArray: async () => rechnungen }));
  m.zaehler.mockResolvedValue({ nummer: rechnungen.length + 1 });
  m.updateOne.mockImplementation(async (_name: string, _filter: unknown, update: any) => {
    bestellung = { ...bestellung, aktualisiertAm: update.$set.aktualisiertAm };
    return { modifiedCount: 1 };
  });
  m.insertOne.mockImplementation(async (_name: string, doc: any) => {
    rechnungen.push(doc);
    return { acknowledged: true };
  });
});
describe('Issue #68 – mehrere Teilrechnungen zur selben Bestellung', () => {
  it('stellt zuerst nur CHF 55 aus und übernimmt keine offenen Preispositionen', async () => {
    const res = await POST(event() as never);
    expect(res.status).toBe(201);
    expect((await res.json()).rechnung).toMatchObject({ gesamtbetrag: 55, offenePreispositionen: 1 });
    expect(rechnungen).toHaveLength(1);
    expect(rechnungen[0].positionen.map((p: any) => p.positionsIndex)).toEqual([0, 1]);
    expect(rechnungen[0].bezahltBetrag).toBe(55);\n    expect(rechnungen[0].zahlungen).toMatchObject([{ betrag: 55, zahlungsart: 'twint', quelle: 'verkauf' }]);
    expect(rechnungen[0].verkaufId).toBe(id);
  });
  it('stellt nach Preisfestlegung nur CHF 48 aus – ohne die ersten CHF 55 nochmals zu berechnen', async () => {
    expect((await POST(event() as never)).status).toBe(201);
    bestellung.positionen[2].einzelpreis = 48;
    bestellung.positionen[2].preisOffen = false;
    bestellung.endbetrag = 103;
    const res = await POST(event() as never);
    expect(res.status).toBe(201);
    expect((await res.json()).rechnung.gesamtbetrag).toBe(48);
    expect(rechnungen).toHaveLength(2);
    expect(rechnungen[1].positionen.map((p: any) => p.positionsIndex)).toEqual([2]);
    expect(rechnungen[1].bezahltBetrag).toBe(0);\n    expect(rechnungen[1].zahlungen).toEqual([]);
    expect(rechnungen[0].verkaufId).toBe(rechnungen[1].verkaufId);
  });
  it('zieht spätere Rechnungseingänge nicht erneut vom Verkaufsguthaben ab', async () => {
    expect((await POST(event() as never)).status).toBe(201);
    rechnungen[0].zahlungen.push({ betrag: 5, zahlungsart: 'bank', datum: new Date(), zahlungId: '12345678-1234-1234-1234-123456789012' });
    rechnungen[0].bezahltBetrag = 55;
    bestellung.positionen[2].einzelpreis = 48;
    bestellung.positionen[2].preisOffen = false;
    bestellung.endbetrag = 103;
    const res = await POST(event() as never);
    expect(res.status).toBe(201);
    expect(rechnungen[1].bezahltBetrag).toBe(0);
  });
  it('verhindert eine dritte Rechnung mit denselben Positionen', async () => {
    expect((await POST(event() as never)).status).toBe(201);
    bestellung.positionen[2].einzelpreis = 48;
    bestellung.positionen[2].preisOffen = false;
    bestellung.endbetrag = 103;
    expect((await POST(event() as never)).status).toBe(201);
    const res = await POST(event() as never);
    expect(res.status).toBe(409);
    expect(rechnungen).toHaveLength(2);
  });
  it('verhindert Rechnungen, wenn der Verkauf zwischenzeitlich geändert wurde', async () => {
    m.updateOne.mockResolvedValue({ modifiedCount: 0 });
    const res = await POST(event() as never);
    expect(res.status).toBe(409);
    expect(m.insertOne).not.toHaveBeenCalled();
  });
  it('verhindert eine weitere Rechnung bei widersprüchlichen Zahlungen', async () => {
    bestellung.bezahltBetrag = 56;
    const res = await POST(event() as never);
    expect(res.status).toBe(409);
    expect(m.insertOne).not.toHaveBeenCalled();
  });
  it('prüft die Berechtigung', async () => {
    m.pruefeBerechtigung.mockReturnValue(new Response('Verboten', { status: 403 }));
    expect((await POST(event() as never)).status).toBe(403);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});
