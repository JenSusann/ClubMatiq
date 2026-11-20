import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), insertOne: vi.fn(),
  insertMany: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn(), countDocuments: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
import { GET, POST } from '../../../src/routes/api/artikel/+server';

const vereinId = new ObjectId().toString();
const kategorieId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const base = () => ({ name: '  Testartikel  ', kategorieId, lagerortId, menge: 2,
  einzelwert: 10, mindestbestand: 1, hatGroessen: false, beschreibung: 'Test' });
const event = (body: unknown) => ({
  locals: { benutzer: { id: new ObjectId().toString(), vereinId, rolle: 'admin' } },
  request: new Request('http://localhost/api/artikel', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue(mocks);
  mocks.findOne.mockResolvedValue({ _id: new ObjectId() });
  mocks.countDocuments.mockResolvedValue(1);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
  mocks.insertMany.mockResolvedValue({ acknowledged: true });
  mocks.deleteMany.mockResolvedValue({ deletedCount: 0 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.find.mockReturnValue({ sort: () => ({ toArray: async () => [] }) });
});

describe('Artikel-API: zusätzliche Validierungszweige', () => {
  it('Null als Payload', async () => {
    const response = await POST(event(null) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Array statt Objekt', async () => {
    const response = await POST(event([]) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Leerer Name', async () => {
    const response = await POST(event({ ...base(), name: '  ' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Name ist Zahl', async () => {
    const response = await POST(event({ ...base(), name: 123 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Kategorie ungültig', async () => {
    const response = await POST(event({ ...base(), kategorieId: 'abc' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Lagerort ungültig', async () => {
    const response = await POST(event({ ...base(), lagerortId: 'abc' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Einzelwert fehlt', async () => {
    const response = await POST(event({ ...base(), einzelwert: null }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Einzelwert negativ', async () => {
    const response = await POST(event({ ...base(), einzelwert: -1 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Vereinskleidung kein Boolean', async () => {
    const response = await POST(event({ ...base(), istVereinskleidung: 'ja' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('hatGroessen kein Boolean', async () => {
    const response = await POST(event({ ...base(), hatGroessen: 'nein' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Beschreibung kein String', async () => {
    const response = await POST(event({ ...base(), beschreibung: 3 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Lieferant ungültig', async () => {
    const response = await POST(event({ ...base(), lieferantId: 'falsch' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Mindestbestand negativ', async () => {
    const response = await POST(event({ ...base(), mindestbestand: -1 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Mindestbestand Dezimalzahl', async () => {
    const response = await POST(event({ ...base(), mindestbestand: 1.5 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Menge negativ', async () => {
    const response = await POST(event({ ...base(), menge: -1 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Menge Dezimalzahl', async () => {
    const response = await POST(event({ ...base(), menge: 1.5 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenliste fehlt', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenliste leer', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante null', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [null] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante falsche ID', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId: 'ungültig', menge: 1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante negative Menge', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: -1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante negativer Wert', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: 1, einzelwert: -10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante negativer Mindestbestand', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: -1 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Doppelte Grössenvariante', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: 0 }, { groesseId, menge: 2, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('Kategorie aus anderem Verein verhindert das Anlegen', async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    const response = await POST(event(base()) as never);
    expect(response.status).toBe(400);
  });
  it('Lagerort aus anderem Verein verhindert das Anlegen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId() }).mockResolvedValueOnce(null);
    const response = await POST(event(base()) as never);
    expect(response.status).toBe(400);
  });
  it('Unbekannter Lieferant verhindert das Anlegen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId() })
      .mockResolvedValueOnce({ _id: new ObjectId() }).mockResolvedValueOnce(null);
    const response = await POST(event({ ...base(), lieferantId: new ObjectId().toString() }) as never);
    expect(response.status).toBe(400);
  });
  it('Nicht vorhandene Grösse verhindert das Anlegen', async () => {
    mocks.countDocuments.mockResolvedValueOnce(0);
    const response = await POST(event({ ...base(), hatGroessen: true,
      varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
  });
  it('Fehler beim Anlegen wird als 500 zurückgegeben', async () => {
    mocks.insertOne.mockRejectedValueOnce(new Error('Datenbankfehler'));
    const response = await POST(event(base()) as never);
    expect(response.status).toBe(500);
  });
  it('Fehler beim Anlegen von Varianten löst Rollback aus', async () => {
    mocks.insertMany.mockRejectedValueOnce(new Error('Variantenfehler'));
    const response = await POST(event({ ...base(), hatGroessen: true,
      varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(500);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
    expect(mocks.deleteOne).toHaveBeenCalledOnce();
  });
  it('GET meldet Datenbankfehler mit Status 500', async () => {
    mocks.find.mockImplementationOnce(() => { throw new Error('Datenbankfehler'); });
    const response = await GET({ locals: event(base()).locals } as never);
    expect(response.status).toBe(500);
  });
});
