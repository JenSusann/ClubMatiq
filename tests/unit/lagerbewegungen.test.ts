import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ insertOne: vi.fn(), findOne: vi.fn(), find: vi.fn(), collection: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: mocks.collection }
}));
import { protokolliereLagerbewegung } from '../../src/lib/server/lagerbewegungen';
import { GET } from '../../src/routes/api/artikel/[id]/lagerbewegungen/+server';

const vereinId = '507f1f77bcf86cd799439011';
const artikelId = '507f1f77bcf86cd799439012';
const session = { id: 'transaction-session' } as never;
const bewegung = { vereinId, artikelId, groesseId: null, art: 'ausleihe' as const, mengeDelta: -3, benutzerId: 'user-1', referenzId: 'ausleihe-1', referenzTyp: 'ausleihe' };
const kontext = (rolle = 'admin', club = vereinId, query = '') => ({
  locals: { benutzer: { rolle, vereinId: club, id: 'user-1' } },
  params: { id: artikelId },
  url: new URL('http://localhost/artikel/' + artikelId + '/lagerbewegungen' + query)
}) as never;

describe('Lagerbewegungsjournal: Unit und API-Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.insertOne.mockResolvedValue({ insertedId: 'journal-1' });
    mocks.findOne.mockResolvedValue({ _id: artikelId });
    mocks.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [{ _id: { toString: () => 'entry-1' }, ...bewegung }] }) }) });
    mocks.collection.mockImplementation((name: string) => ({
      insertOne: mocks.insertOne, findOne: mocks.findOne, find: mocks.find
    }));
  });

  it('schreibt eine Bewegung mit derselben MongoDB-Session', async () => {
    await protokolliereLagerbewegung(bewegung, session);
    expect(mocks.collection).toHaveBeenCalledWith('lagerbewegungen');
    expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({ ...bewegung, zeitpunkt: expect.any(Date) }), { session });
  });

  it.each([0, 1.5, Number.NaN])('verhindert ungültige Mengenänderung %s', async (mengeDelta) => {
    await expect(protokolliereLagerbewegung({ ...bewegung, mengeDelta }, session)).rejects.toThrow();
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Journaleinträge ohne Transaktion', async () => {
    await expect(protokolliereLagerbewegung(bewegung, null as never)).rejects.toThrow();
  });

  it('propagiert Datenbankfehler, damit die übergeordnete Transaktion zurückrollt', async () => {
    mocks.insertOne.mockRejectedValue(new Error('DB write failed'));
    await expect(protokolliereLagerbewegung(bewegung, session)).rejects.toThrow('DB write failed');
  });

  it('liefert nur Bewegungen des Vereins und Artikels', async () => {
    const antwort = await GET(kontext('admin', vereinId, '?art=ausleihe&von=2026-11-01&bis=2026-11-30'));
    expect(antwort.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ vereinId, artikelId, art: 'ausleihe', zeitpunkt: expect.any(Object) }));
    const daten = await antwort.json();
    expect(daten.bewegungen).toHaveLength(1);
    expect(daten.hinweis).toContain('nicht rückwirkend');
  });

  it('filtert Bewegungen serverseitig nach einer Grössenvariante', async () => {
    const groesseId = '507f1f77bcf86cd799439099';
    const antwort = await GET(kontext('admin', vereinId, '?groesseId=' + groesseId));
    expect(antwort.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ vereinId, artikelId, groesseId }));
  });

  it('verwirft ungültige Grössenfilter ohne Datenbankzugriff', async () => {
    const antwort = await GET(kontext('admin', vereinId, '?groesseId=ungueltig'));
    expect(antwort.status).toBe(400);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('gibt fremde Artikel nicht preis', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await GET(kontext('admin', 'anderer-verein'))).status).toBe(404);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('verweigert unberechtigten Rollen den Zugriff', async () => {
    expect((await GET(kontext('gast'))).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('weist unbekannte Bewegungstypen und fehlerhafte Zeiträume ab', async () => {
    expect((await GET(kontext('admin', vereinId, '?art=unbekannt'))).status).toBe(400);
    expect((await GET(kontext('admin', vereinId, '?von=2026-12-01&bis=2026-11-01'))).status).toBe(400);
  });
});
