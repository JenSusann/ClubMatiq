import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(),
  startSession: vi.fn(), endSession: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { PATCH } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

const id = new ObjectId();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin' };
const zahlungId = '123e4567-e89b-42d3-a456-426614174000';
const ctx = (betrag: number, kennung = zahlungId) => ({
  params: { id: id.toHexString() }, locals: { benutzer },
  request: new Request('http://localhost/api/vereinskleider/verrechnung/' + id, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ betrag, datum: '2026-11-22', zahlungsart: 'twint', zahlungId: kennung })
  })
}) as never;
let rechnung: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  rechnung = {
    _id: id, vereinId: 'verein-a', verkaufId: new ObjectId().toHexString(),
    gesamtbetrag: 48, bezahltBetrag: 0, gutgeschriebenBetrag: 0,
    status: 'offen', zahlungen: []
  };
  m.collection.mockReturnValue({ findOne: m.findOne, updateOne: m.updateOne });
  m.findOne.mockImplementation(async (filter: { vereinId: string }) =>
    filter.vereinId === 'verein-a' ? structuredClone(rechnung) : null);
  m.updateOne.mockImplementation(async (_filter: unknown, update: { $set: Record<string, unknown> }) => {
    Object.assign(rechnung, update.$set);
    return { modifiedCount: 1 };
  });
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #68/#70 – Restzahlung und Schutz gegen Doppelbuchungen', () => {
  it('verbucht CHF 48 einmal und erkennt wiederholte Zahlungs-ID', async () => {
    const erste = await PATCH(ctx(48));
    expect(erste.status).toBe(200);
    expect(rechnung.bezahltBetrag).toBe(48);
    expect(rechnung.status).toBe('bezahlt');
    expect((rechnung.zahlungen as unknown[])).toHaveLength(1);

    const wiederholung = await PATCH(ctx(48));
    expect(wiederholung.status).toBe(200);
    expect((await wiederholung.json()).bereitsErfasst).toBe(true);
    expect((rechnung.zahlungen as unknown[])).toHaveLength(1);
    expect(rechnung.bezahltBetrag).toBe(48);
  });

  it('verweigert dieselbe Zahlungs-ID mit abweichendem Betrag', async () => {
    expect((await PATCH(ctx(20))).status).toBe(200);
    expect((await PATCH(ctx(25))).status).toBe(409);
    expect(rechnung.bezahltBetrag).toBe(20);
  });

  it('verweigert Überzahlung nach einer Gutschrift', async () => {
    rechnung.gutgeschriebenBetrag = 20;
    expect((await PATCH(ctx(29))).status).toBe(409);
    expect((rechnung.zahlungen as unknown[])).toHaveLength(0);
  });

  it('erfasst nach Gutschrift nur den verbleibenden Nettobetrag', async () => {
    rechnung.gutgeschriebenBetrag = 20;
    expect((await PATCH(ctx(28))).status).toBe(200);
    expect(rechnung.bezahltBetrag).toBe(28);
    expect(rechnung.status).toBe('bezahlt');
  });

  it('blockiert Zahlung bei paralleler Änderung der Rechnung', async () => {
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await PATCH(ctx(48))).status).toBe(409);
  });

  it('schützt Rechnungen anderer Vereine', async () => {
    m.findOne.mockResolvedValueOnce(null);
    expect((await PATCH(ctx(48))).status).toBe(404);
    expect(m.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-a' }), expect.anything()
    );
  });
});
