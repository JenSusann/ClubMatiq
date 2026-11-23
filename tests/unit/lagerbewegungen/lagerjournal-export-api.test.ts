import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  find: vi.fn(), findOne: vi.fn(), collection: vi.fn(), workbook: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
vi.mock('exceljs', () => ({
  default: { Workbook: class {
    creator = '';
    addWorksheet = () => ({
      mergeCells: vi.fn(), getCell: () => ({ value: '', font: {} }),
      getRow: () => ({ values: [], font: {}, fill: {}, height: 0 }),
      addRow: () => ({ getCell: () => ({ numFmt: '', font: {} }) })
    });
    xlsx = { writeBuffer: async () => Buffer.from('xlsx-test') };
  } }
}));
import { leseJournalFilter, erstelleLagerjournalExcel } from '../../../src/lib/server/lagerjournal-export';
import { GET as exportGET } from '../../../src/routes/api/export/lagerbewegungen/+server';
import { GET as gesamtGET } from '../../../src/routes/api/lagerbewegungen/gesamt/+server';

const vereinId = '507f1f77bcf86cd799439011';
const artikelId = '507f1f77bcf86cd799439012';
const id = (wert: string) => ({ toString: () => wert });
const kontext = (query = '', rolle = 'admin') => ({
  locals: { benutzer: { id: artikelId, rolle, vereinId } },
  url: new URL('http://localhost/api/export/lagerbewegungen' + query)
}) as never;

describe('Lagerjournal Excel Export – Unit und API-Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findOne.mockResolvedValue({ _id: artikelId });
    const journal = [{ _id: id('journal1'), artikelId, groesseId: null, benutzerId: artikelId, art: 'wareneingang', mengeDelta: 4, zeitpunkt: new Date('2026-11-20'), referenzTyp: 'sammelbestellung', referenzId: 'ref' }];
    mocks.find.mockImplementation(() => {
      const cursor = {
        toArray: async () => journal,
        limit: vi.fn().mockReturnThis(),
        async *[Symbol.asyncIterator]() {
          yield* journal;
        }
      };
      return {
        sort: () => cursor,
        project: () => ({ toArray: async () => [] })
      };
    });
    mocks.collection.mockImplementation(() => ({ find: mocks.find, findOne: mocks.findOne }));
  });

  it('validiert Typ, IDs und Datumsbereich', () => {
    expect(() => leseJournalFilter(new URL('http://localhost/?art=falsch'))).toThrow();
    expect(() => leseJournalFilter(new URL('http://localhost/?artikelId=kein-id'))).toThrow();
    expect(() => leseJournalFilter(new URL('http://localhost/?von=2026-12-01&bis=2026-11-01'))).toThrow();
  });

  it('übernimmt Filter einschliesslich Artikel und Grösse', () => {
    const filter = leseJournalFilter(new URL('http://localhost/?artikelId=' + artikelId + '&groesseId=' + artikelId + '&art=wareneingang&von=2026-11-01')).filter;
    expect(filter).toMatchObject({ artikelId, groesseId: artikelId, art: 'wareneingang', zeitpunkt: expect.any(Object) });
  });

  it('exportiert ohne 200-Zeilen-Limit und mit Vereinsfilter', async () => {
    const datei = await erstelleLagerjournalExcel(vereinId, new URL('http://localhost/?art=wareneingang'));
    expect(datei).toBeInstanceOf(Buffer);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ vereinId, art: 'wareneingang' }));
  });

  it('liefert XLSX mit sicherem Content-Type', async () => {
    const antwort = await exportGET(kontext('?artikelId=' + artikelId));
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get('Content-Type')).toContain('spreadsheetml');
    expect(antwort.headers.get('Content-Disposition')).toContain('.xlsx');
  });

  it('blockiert unberechtigte Rollen vor Datenbankzugriff', async () => {
    expect((await exportGET(kontext('', 'gast'))).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('verweigert fremde Artikel', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await exportGET(kontext('?artikelId=' + artikelId))).status).toBe(404);
  });

  it('gibt bei fehlerhaftem Filter HTTP 400 zurück', async () => {
    expect((await exportGET(kontext('?art=ungueltig'))).status).toBe(400);
  });

  it('isoliert die globale Vorschau auf den angemeldeten Verein', async () => {
    const antwort = await gesamtGET(kontext());
    expect(antwort.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ vereinId }));
  });
});
