import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  updateOne: vi.fn(), startSession: vi.fn(), endSession: vi.fn(),
  permission: vi.fn(() => null)
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { PATCH } from '../../src/routes/api/vereinskleider/gutschriften/status/+server';

const gid = new ObjectId();
const rid = new ObjectId();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin' };
const gutschrift = () => ({
  _id: gid, vereinId: 'verein-a', rechnungId: rid.toHexString(), betrag: 30,
  rueckerstattetBetrag: 0
});
const rechnung = () => ({
  _id: rid, vereinId: 'verein-a', gesamtbetrag: 100,
  bezahltBetrag: 100, gutgeschriebenBetrag: 30
});
const ctx = (data: Record<string, unknown>) => ({
  locals: { benutzer },
  request: new Request('http://localhost/api/vereinskleider/gutschriften/status', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gutschriftId: gid.toHexString(), ...data })
  })
}) as never;
const rueckzahlung = (betrag: number) => ({
  aktion: 'rueckerstattet', betrag, datum: '2026-11-22',
  zahlungsart: 'twint', bemerkung: 'Erstattung bestätigt'
});

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  m.collection.mockImplementation((name: string) => name === 'vereinskleider_gutschriften'
    ? { findOne: m.findOne, find: m.find, updateOne: m.updateOne }
    : { findOne: m.findOne, updateOne: m.updateOne });
  m.findOne.mockImplementation(async (filter: { _id: ObjectId }) =>
    filter._id.toHexString() === gid.toHexString() ? gutschrift() : rechnung());
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockResolvedValue([gutschrift()]);
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #70 – Rückerstattungen sicher abschliessen', () => {
  it('verweigert unberechtigte Zugriffe', async () => {
    m.permission.mockReturnValue(new Response('Verboten', { status: 403 }) as never);
    expect((await PATCH(ctx(rueckzahlung(30)))).status).toBe(403);
    expect(m.startSession).not.toHaveBeenCalled();
  });

  it('verweigert ungültige Gutschrift-IDs', async () => {
    expect((await PATCH(ctx({ ...rueckzahlung(30), gutschriftId: 'falsch' }))).status).toBe(400);
  });

  it('schützt vor Zugriff auf fremde Gutschriften', async () => {
    m.findOne.mockResolvedValueOnce(null);
    expect((await PATCH(ctx(rueckzahlung(30)))).status).toBe(404);
    expect(m.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-a' }), expect.anything()
    );
  });

  it('verhindert Abschluss ohne dokumentierte Auszahlung', async () => {
    expect((await PATCH(ctx({ aktion: 'erledigt' }))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Rückerstattung über den offenen Anspruch', async () => {
    expect((await PATCH(ctx(rueckzahlung(31)))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });

  it('protokolliert eine Teilrückerstattung mit ausführender Person', async () => {
    expect((await PATCH(ctx(rueckzahlung(10)))).status).toBe(200);
    const update = m.updateOne.mock.calls[0][1].$set;
    expect(update.bearbeitungsstatus).toBe('teilweise_rueckerstattet');
    expect(update.rueckerstattetBetrag).toBe(10);
    expect(update.rueckerstattungen[0]).toEqual(expect.objectContaining({
      betrag: 10, zahlungsart: 'twint', erfasstVon: 'user-a'
    }));
    expect(m.updateOne.mock.calls[1][1].$set.rueckerstattungOffen).toBe(20);
  });

  it('markiert eine vollständig dokumentierte Auszahlung als rückerstattet', async () => {
    expect((await PATCH(ctx(rueckzahlung(30)))).status).toBe(200);
    expect(m.updateOne.mock.calls[0][1].$set.bearbeitungsstatus).toBe('rueckerstattet');
    expect(m.updateOne.mock.calls[1][1].$set.rueckerstattungOffen).toBe(0);
  });

  it('blockiert bereits abgeschlossene Gutschriften', async () => {
    m.findOne.mockResolvedValueOnce({ ...gutschrift(), bearbeitungsstatus: 'rueckerstattet' });
    expect((await PATCH(ctx(rueckzahlung(30)))).status).toBe(409);
  });

  it('erkennt parallele Änderungen anhand des atomaren Updates', async () => {
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await PATCH(ctx(rueckzahlung(10)))).status).toBe(409);
  });
});
