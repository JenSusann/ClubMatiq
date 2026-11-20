import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  permission: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(),
  withTransaction: vi.fn(), endSession: vi.fn(), insertOne: vi.fn()
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: m.permission
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn((name: string) => ({
    findOne: (...args: unknown[]) => m.findOne(name, ...args),
    updateOne: (...args: unknown[]) => m.updateOne(name, ...args),
    insertOne: (...args: unknown[]) => m.insertOne(name, ...args)
  })) },
  client: { startSession: () => ({
    withTransaction: (callback: () => Promise<void>) => m.withTransaction(callback),
    endSession: m.endSession
  }) }
}));
import { POST } from '../../../src/routes/api/ausleihen/[id]/rueckgabe/+server';

const id = (n: number) => n.toString(16).padStart(24, '0');
const locals = { benutzer: { id: 'integration-user', vereinId: 'verein-1', rolle: 'admin' } };
const loan = (patch: Record<string, unknown> = {}) => ({
  _id: id(1), vereinId: 'verein-1', artikelId: id(2), groesseId: null,
  person: 'Anna', menge: 5, status: 'offen', zurueckgegeben: 0, ...patch
});
function request(menge: unknown, loanId = id(1)) {
  return POST({
    locals, params: { id: loanId },
    request: new Request('http://localhost/api/ausleihen/' + loanId + '/rueckgabe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ menge })
    })
  } as any);
}
beforeEach(() => {
  vi.resetAllMocks();
  m.permission.mockReturnValue(null);
  m.findOne.mockImplementation(async () => loan());
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.withTransaction.mockImplementation(async (callback) => callback());
  m.endSession.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('Ausleihen – zusätzliche Rückgabezweige', () => {
  it.each([null, undefined, 0, -1, 1.5, '2', true, {}, []])(
    'weist ungültige Rückgabemenge %s zurück', async (menge) => {
      const response = await request(menge);
      expect(response.status).toBe(400);
      expect(m.withTransaction).not.toHaveBeenCalled();
    }
  );
  it.each(['', 'abc', '123', 'zzzzzzzzzzzzzzzzzzzzzzzz'])(
    'weist ungültige Ausleihe-ID %s zurück', async (loanId) => {
      expect((await request(1, loanId)).status).toBe(400);
    }
  );
  it('behandelt ungültiges JSON', async () => {
    const response = await POST({
      locals, params: { id: id(1) },
      request: new Request('http://localhost/api/rueckgabe', {
        method: 'POST', body: '{', headers: { 'content-type': 'application/json' }
      })
    } as any);
    expect(response.status).toBe(400);
  });
  it('verhindert Rückgabe einer nicht gefundenen Ausleihe', async () => {
    m.findOne.mockResolvedValue(null);
    const response = await request(1);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('nicht gefunden');
    expect(m.endSession).toHaveBeenCalledOnce();
  });
  it.each([
    ['abgeschlossen', loan({ status: 'abgeschlossen' }), 'bereits abgeschlossen'],
    ['kein offener Bestand', loan({ zurueckgegeben: 5 }), 'bereits abgeschlossen'],
    ['überhöhte Menge', loan({ zurueckgegeben: 4 }), 'maximal 1']
  ])('verhindert %s', async (_, doc, message) => {
    m.findOne.mockResolvedValue(doc);
    const response = await request(2);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain(message);
  });
  it('führt eine Teilrückgabe ohne Grösse durch', async () => {
    const response = await request(2);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erfolg: true, status: 'teilweise', zurueckgegeben: 2, offen: 3
    });
    expect(m.updateOne).toHaveBeenCalledTimes(2);
    expect(m.insertOne).toHaveBeenCalledWith('lagerbewegungen', expect.objectContaining({ art: 'rueckgabe', mengeDelta: 2 }), expect.objectContaining({ session: expect.anything() }));
    expect(m.endSession).toHaveBeenCalledOnce();
  });
  it('führt vollständige Rückgabe mit Abschlussdatum durch', async () => {
    const response = await request(5);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erfolg: true, status: 'abgeschlossen', zurueckgegeben: 5, offen: 0
    });
    expect(m.updateOne.mock.calls[0][2].$set.abgeschlossenAm).toBeInstanceOf(Date);
  });
  it('behandelt fehlendes Feld zurueckgegeben als 0', async () => {
    m.findOne.mockResolvedValue(loan({ zurueckgegeben: undefined }));
    expect((await request(1)).status).toBe(200);
  });
  it('bucht Rückgabe mit Grösse in Variante und Artikel zurück', async () => {
    m.findOne.mockResolvedValue(loan({ groesseId: id(3) }));
    expect((await request(1)).status).toBe(200);
    expect(m.updateOne.mock.calls.map((call) => call[0])).toEqual([
      'ausleihen', 'artikelvarianten', 'artikel'
    ]);
  });
  it.each([
    ['Ausleihe konkurrierend verändert', 0, 'zwischenzeitlich verändert'],
    ['Artikel ohne Grösse fehlt', 1, 'Artikel wurde nicht gefunden']
  ])('behandelt %s', async (_, failureIndex, message) => {
    m.updateOne.mockImplementation(async (_collection, ...args) => ({
      modifiedCount: m.updateOne.mock.calls.length - 1 === failureIndex ? 0 : 1
    }));
    const response = await request(1);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain(message);
    expect(m.endSession).toHaveBeenCalledOnce();
  });
  it.each([
    ['Variante fehlt', 1, 'Artikelgrösse wurde nicht gefunden'],
    ['Artikel fehlt', 2, 'Artikel wurde nicht gefunden']
  ])('behandelt %s bei Grössenartikel', async (_, failureIndex, message) => {
    m.findOne.mockResolvedValue(loan({ groesseId: id(3) }));
    m.updateOne.mockImplementation(async () => ({
      modifiedCount: m.updateOne.mock.calls.length - 1 === failureIndex ? 0 : 1
    }));
    const response = await request(1);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain(message);
  });
  it('behandelt unbekannten Transaktionsfehler', async () => {
    m.withTransaction.mockRejectedValue('unerwartet');
    const response = await request(1);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('konnte nicht gespeichert werden');
    expect(m.endSession).toHaveBeenCalledOnce();
  });
  it('gibt einen Berechtigungsfehler unverändert zurück', async () => {
    m.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    expect((await request(1)).status).toBe(403);
    expect(m.withTransaction).not.toHaveBeenCalled();
  });
});
