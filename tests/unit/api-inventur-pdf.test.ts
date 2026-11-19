import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';

const m = vi.hoisted(() => ({ permission: vi.fn(), findOne: vi.fn(), find: vi.fn(), sort: vi.fn(), project: vi.fn(), toArray: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn(() => ({ findOne: m.findOne, find: m.find })) } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET } from '../../src/routes/api/inventuren/[id]/pdf/+server';

const id = '507f1f77bcf86cd799439011';
const pid = '507f1f77bcf86cd799439012';
const user = '507f1f77bcf86cd799439013';
const benutzer = { vereinId: 'verein-1' };
const event = (value = id) => ({ params: { id: value }, locals: { benutzer } }) as never;
const position = (extra = {}) => ({ _id: new ObjectId(pid), artikelName: 'Ball', sollBestand: 10, istBestand: 8, groesseId: null, ...extra });
const inventur = (extra = {}) => ({ name: 'Jahresinventur', status: 'abgeschlossen', typ: 'voll', erstelltVon: user, abgeschlossenVon: user, erstelltAm: new Date('2026-01-01'), abgeschlossenAm: new Date('2026-01-02'), ...extra });
let positions: unknown[], logs: unknown[], persons: unknown[];
beforeEach(() => {
  vi.resetAllMocks();
  positions = [position()]; logs = []; persons = [{ _id: new ObjectId(user), vorname: 'Max', nachname: 'Muster' }];
  m.findOne.mockResolvedValue(inventur());
  m.find.mockImplementation(() => ({ sort: m.sort, project: m.project }));
  m.sort.mockImplementation(() => ({ toArray: m.toArray }));
  m.project.mockImplementation(() => ({ toArray: m.toArray }));
  m.toArray.mockImplementation(() => Promise.resolve(positions));
});
const setup = (p: unknown[] = positions, l: unknown[] = logs, people: unknown[] = persons) => {
  m.toArray.mockReset().mockResolvedValueOnce(p).mockResolvedValueOnce(l).mockResolvedValueOnce(people);
};
async function get(value = id) { return GET(event(value)); }
async function pdfTextCount(response: Response) { const pdf = await PDFDocument.load(await response.arrayBuffer()); return pdf.getPageCount(); }

describe('Inventurbericht PDF', () => {
  it('verweigert fehlende Berechtigung', async () => { m.permission.mockReturnValue(new Response('Nein', { status: 403 })); expect((await get()).status).toBe(403); expect(m.findOne).not.toHaveBeenCalled(); });
  it.each(['', 'x', '123'])('verweigert ungültige ID %s', async (bad) => { await expect(get(bad)).rejects.toMatchObject({ status: 400 }); });
  it('meldet fehlende Inventur', async () => { m.findOne.mockResolvedValue(null); await expect(get()).rejects.toMatchObject({ status: 404 }); });
  it('erzeugt einen gültigen PDF-Bericht ohne Protokoll', async () => { setup(); const response = await get(); expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toBe('application/pdf'); expect(response.headers.get('Content-Disposition')).toContain(id); expect(await pdfTextCount(response)).toBeGreaterThan(0); });
  it('erstellt Bericht mit Abschluss, nachträglicher Korrektur und Stornierung', async () => {
    m.findOne.mockResolvedValue(inventur({ status: 'storniert', storniertAm: new Date(), storniertVon: user, stornierungsgrund: 'Test' }));
    setup([position({ bemerkung: 'Geprüft', groesseId: id })], [
      { aktion: 'abgeschlossen', ausgefuehrtAm: new Date(), ausgefuehrtVon: user, anzahlKorrekturen: 1, positionen: [{ positionId: pid, istBestand: 9 }] },
      { aktion: 'nachtraeglich_korrigiert', ausgefuehrtAm: new Date(), ausgefuehrtVon: user, positionId: pid, alterIstBestand: 9, neuerIstBestand: 8, differenz: -1, begruendung: 'Kontrolle' },
      { aktion: 'storniert', ausgefuehrtAm: new Date(), ausgefuehrtVon: user, statusVorher: 'abgeschlossen', anzahlRueckbuchungen: 1 }
    ]);
    expect(await pdfTextCount(await get())).toBeGreaterThan(0);
  });
  it('verarbeitet ungültige Datumswerte und fehlende Namen', async () => { m.findOne.mockResolvedValue(inventur({ erstelltVon: null, erstelltAm: 'ungueltig', abgeschlossenAm: null })); setup([position({ istBestand: null, sollBestand: null, artikelName: null })], [], []); expect((await get()).status).toBe(200); });
  it('bricht sehr lange Wörter und erzeugt mehrere Seiten', async () => { setup(Array.from({ length: 75 }, (_, i) => position({ _id: new ObjectId(), artikelName: 'A'.repeat(200) + i, bemerkung: 'B'.repeat(300) })), [], []); expect(await pdfTextCount(await get())).toBeGreaterThan(1); });
  it('meldet Datenbankfehler als 500', async () => { m.findOne.mockRejectedValue(new Error('db')); await expect(get()).rejects.toMatchObject({ status: 500 }); });
  it('meldet Fehler beim Laden der Positionen', async () => { m.toArray.mockRejectedValue(new Error('db')); await expect(get()).rejects.toMatchObject({ status: 500 }); });
});
