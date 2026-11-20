import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn(),
  countDocuments: vi.fn(), deleteMany: vi.fn(), listCollections: vi.fn(),
  find: vi.fn()
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: name === 'einladungen' ? mock.findOne : mock.findOne,
      updateOne: mock.updateOne, deleteOne: mock.deleteOne,
      countDocuments: mock.countDocuments, deleteMany: mock.deleteMany,
      find: mock.find
    })),
    listCollections: mock.listCollections
  }
}));
import { DELETE as widerrufen } from '../../src/routes/api/benutzer/einladen/[id]/+server';
import { DELETE as benutzerLoeschen } from '../../src/routes/api/benutzer/[id]/+server';

const id = '507f1f77bcf86cd799439011';
const vereinId = '507f1f77bcf86cd799439012';
const admin = { id: '507f1f77bcf86cd799439013', vereinId, rolle: 'admin' };
const kontext = (benutzer: unknown = admin, ziel = id) =>
  ({ locals: { benutzer }, params: { id: ziel } }) as never;

describe('Einladungen widerrufen und Benutzer sicher löschen', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.findOne.mockResolvedValue({ status: 'offen', rolle: 'mitglied', aktiv: true });
    mock.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mock.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mock.deleteMany.mockResolvedValue({ deletedCount: 0 });
    mock.countDocuments.mockResolvedValue(1);
    mock.listCollections.mockReturnValue({ toArray: async () => [{ name: 'artikel' }] });
    mock.find.mockReturnValue({ [Symbol.asyncIterator]: async function* () {} });
  });

  it('widerruft eine offene Einladung', async () => {
    const antwort = await widerrufen(kontext());
    expect(antwort.status).toBe(200);
    expect(mock.updateOne.mock.calls[0][0]).toEqual(expect.objectContaining({ vereinId, status: 'offen' }));
    expect(mock.updateOne.mock.calls[0][1].$set.status).toBe('widerrufen');
  });

  it('blockiert angenommene Einladungen', async () => {
    mock.findOne.mockResolvedValue({ status: 'angenommen' });
    expect((await widerrufen(kontext())).status).toBe(409);
    expect(mock.updateOne).not.toHaveBeenCalled();
  });

  it('blockiert nicht angemeldete und unberechtigte Benutzer', async () => {
    expect((await widerrufen(kontext(null))).status).toBe(401);
    expect((await benutzerLoeschen(kontext({ ...admin, rolle: 'mitglied' }))).status).toBe(403);
  });

  it('verhindert Selbstlöschung', async () => {
    expect((await benutzerLoeschen(kontext(admin, admin.id))).status).toBe(409);
  });

  it('blockiert Benutzer mit Referenzen in Vereinsdaten', async () => {
    mock.find.mockReturnValue({ [Symbol.asyncIterator]: async function* () {
      yield { vereinId, erstelltVon: id };
    } });
    expect((await benutzerLoeschen(kontext())).status).toBe(409);
    expect(mock.deleteOne).not.toHaveBeenCalled();
  });

  it('löscht unreferenzierte Benutzer und ihre Sessions', async () => {
    expect((await benutzerLoeschen(kontext())).status).toBe(200);
    expect(mock.deleteOne).toHaveBeenCalled();
    expect(mock.deleteMany).toHaveBeenCalledWith({ vereinId, benutzerId: id });
  });

  it('verweigert bei fehlgeschlagener Referenzprüfung sicherheitshalber das Löschen', async () => {
    mock.listCollections.mockImplementation(() => { throw new Error('DB unavailable'); });
    expect((await benutzerLoeschen(kontext())).status).toBe(500);
    expect(mock.deleteOne).not.toHaveBeenCalled();
  });
});
