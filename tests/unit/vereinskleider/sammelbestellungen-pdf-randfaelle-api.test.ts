import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';

const m = vi.hoisted(() => ({
  find: vi.fn(), findOne: vi.fn(), groessen: vi.fn(), lieferant: vi.fn(), verein: vi.fn(),
  auth: vi.fn(), pdfCreate: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => {
  if (name === 'vereinskleider_sammelbestellungen') return { find: m.find, findOne: m.findOne };
  if (name === 'groessen') return { find: m.groessen };
  if (name === 'lieferanten') return { findOne: m.lieferant };
  if (name === 'vereine') return { findOne: m.verein };
  throw Error('unexpected collection ' + name);
} } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => m.auth(...args) }));

import { GET } from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import { POST } from '../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

const id = '507f1f77bcf86cd799439011';
const id2 = '507f1f77bcf86cd799439012';
const artikel = '507f1f77bcf86cd799439013';
const groesse = '507f1f77bcf86cd799439014';
const lieferantId = '507f1f77bcf86cd799439015';
const vereinId = '507f1f77bcf86cd799439016';
const position = (overrides: Record<string, unknown> = {}) => ({ artikelId: artikel, groesseId: groesse, artikelname: 'Turnshirt', menge: 2, ...overrides });
const bestellung = (overrides: Record<string, unknown> = {}) => ({ _id: new ObjectId(id), vereinId, lieferantId, lieferantName: 'Lieferant', status: 'bestellt', erstelltAm: new Date('2026-11-01'), positionen: [position()], ...overrides });
const ctxGet = (bestellId = id) => ({ params: { id: bestellId }, locals: { benutzer: { vereinId } } } as any);
const ctxPost = (ids: unknown = [id], broken = false) => ({ request: { json: broken ? vi.fn().mockRejectedValue(new Error('bad json')) : vi.fn().mockResolvedValue({ bestellungIds: ids }) }, locals: { benutzer: { vereinId } } } as any);
const post = (ids: unknown = [id]) => POST(ctxPost(ids));

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockReturnValue(null);
  m.findOne.mockResolvedValue(bestellung());
  m.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([bestellung()]) });
  m.groessen.mockReturnValue({ project: () => ({ toArray: async () => [{ _id: new ObjectId(groesse), bezeichnung: 'M' }] }) });
  m.lieferant.mockResolvedValue({ name: 'Sportlieferant' });
  m.verein.mockResolvedValue({ name: 'Turnverein' });
});

describe('Einzelbestellung PDF – zusätzliche Branches', () => {
  it('erstellt ein gültiges PDF', async () => { const r = await GET(ctxGet()); expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('application/pdf'); expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100); }, 15000);
  it('verweigert unberechtigte Zugriffe', async () => { m.auth.mockReturnValue(new Response('Nein', { status: 403 })); expect((await GET(ctxGet())).status).toBe(403); });
  it.each(['', 'x', '0000'])('verwirft ungültige ID %s', async (bad) => { await expect(GET(ctxGet(bad))).rejects.toMatchObject({ status: 400 }); });
  it('meldet fehlende Bestellung', async () => { m.findOne.mockResolvedValue(null); await expect(GET(ctxGet())).rejects.toMatchObject({ status: 404 }); });
  it.each([[], null])('meldet leere Positionen %s', async (positions) => { m.findOne.mockResolvedValue(bestellung({ positionen: positions })); await expect(GET(ctxGet())).rejects.toMatchObject({ status: 409 }); });
  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('verwirft Menge %s', async (menge) => { m.findOne.mockResolvedValue(bestellung({ positionen: [position({ menge })] })); await expect(GET(ctxGet())).rejects.toMatchObject({ status: 409 }); });
  it('nutzt Fallbacks für Verein, Lieferant und Grösse', async () => { m.findOne.mockResolvedValue(bestellung({ lieferantId: null, lieferantName: null, positionen: [position({ groesseId: 'invalid' })] })); m.verein.mockResolvedValue(null); const r = await GET(ctxGet()); expect(r.status).toBe(200); });
  it('nutzt Namen aus Bestelldaten ohne Lieferanten-ID', async () => { m.findOne.mockResolvedValue(bestellung({ lieferantId: 'invalid', lieferantName: 'Fallback', positionen: [position({ groesseId: null })] })); expect((await GET(ctxGet())).status).toBe(200); });
  it('unterstützt Vereins-IDs als Strings', async () => { m.findOne.mockResolvedValue(bestellung({ vereinId: 'verein-1' })); expect((await GET({ ...ctxGet(), locals: { benutzer: { vereinId: 'verein-1' } } } as any)).status).toBe(200); });
  it('bricht bei Datenbankfehler mit 500 ab', async () => { m.findOne.mockRejectedValue(new Error('database')); await expect(GET(ctxGet())).rejects.toMatchObject({ status: 500 }); });
  it('erzeugt Seitenumbrüche und bricht lange Wörter um', async () => { m.findOne.mockResolvedValue(bestellung({ bemerkung: 'L'.repeat(1400), positionen: Array.from({ length: 65 }, (_, i) => position({ artikelname: `Turnshirt ${i} ${'W'.repeat(140)}`, groesseId: i % 2 ? null : groesse })) })); expect((await GET(ctxGet())).status).toBe(200); });
  it('nutzt alternative Stammdaten und bestelltAm', async () => { m.verein.mockResolvedValue({ bezeichnung: 'TV' }); m.lieferant.mockResolvedValue({}); m.findOne.mockResolvedValue(bestellung({ bestelltAm: new Date('2026-11-02'), lieferantName: 'Alt', bemerkung: 'Test\nBemerkung' })); expect((await GET(ctxGet())).status).toBe(200); });
});

describe('Gesamtbestellung PDF – zusätzliche Branches', () => {
  it('erstellt ein gültiges PDF', async () => { const r = await post(); expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('application/pdf'); });
  it('verweigert unberechtigte Zugriffe', async () => { m.auth.mockReturnValue(new Response('Nein', { status: 401 })); expect((await post()).status).toBe(401); });
  it('verwirft fehlerhaftes JSON', async () => { await expect(POST(ctxPost([], true))).rejects.toMatchObject({ status: 400 }); });
  it.each([null, [], 'bad', {}, [id, id], ['bad'], Array(51).fill(id)])('verwirft ungültige Auswahl', async (ids) => { await expect(post(ids)).rejects.toMatchObject({ status: 400 }); });
  it('meldet fehlende Bestellung', async () => { m.find.mockReturnValue({ toArray: async () => [] }); await expect(post()).rejects.toMatchObject({ status: 404 }); });
  it('verwirft verschiedene Lieferanten', async () => { m.find.mockReturnValue({ toArray: async () => [bestellung(), bestellung({ _id: new ObjectId(id2), lieferantId: id2 })] }); await expect(post([id, id2])).rejects.toMatchObject({ status: 409 }); });
  it.each([null, 'bad'])('verwirft ungültigen Lieferanten %s', async (lieferantId) => { m.find.mockReturnValue({ toArray: async () => [bestellung({ lieferantId })] }); await expect(post()).rejects.toMatchObject({ status: 409 }); });
  it('meldet gelöschten Lieferanten', async () => { m.lieferant.mockResolvedValue(null); await expect(post()).rejects.toMatchObject({ status: 409 }); });
  it.each([[], null])('verwirft leere Positionen', async (positionen) => { m.find.mockReturnValue({ toArray: async () => [bestellung({ positionen })] }); await expect(post()).rejects.toMatchObject({ status: 409 }); });
  it.each([ { artikelId: 'bad' }, { groesseId: 'bad' }, { menge: 0 }, { menge: 1.2 }, { menge: -2 } ])('verwirft fehlerhafte Position %j', async (change) => { m.find.mockReturnValue({ toArray: async () => [bestellung({ positionen: [position(change)] })] }); await expect(post()).rejects.toMatchObject({ status: 409 }); });
  it('gruppiert gleiche Positionen aus mehreren Bestellungen', async () => { m.find.mockReturnValue({ toArray: async () => [bestellung(), bestellung({ _id: new ObjectId(id2) })] }); expect((await post([id, id2])).status).toBe(200); });
  it('verwirft überlaufende Gesamtmenge', async () => { m.find.mockReturnValue({ toArray: async () => [bestellung({ positionen: [position({ menge: Number.MAX_SAFE_INTEGER }), position({ menge: 1 })] })] }); await expect(post()).rejects.toMatchObject({ status: 409 }); });
  it('nutzt Fallback-Namen und fehlende Grössen', async () => { m.lieferant.mockResolvedValue({}); m.verein.mockResolvedValue(null); m.groessen.mockReturnValue({ project: () => ({ toArray: async () => [] }) }); expect((await post()).status).toBe(200); });
  it('funktioniert ohne Grössen-IDs und mit String-Vereins-ID', async () => { m.find.mockReturnValue({ toArray: async () => [bestellung({ positionen: [position({ groesseId: null })] })] }); expect((await POST({ ...ctxPost(), locals: { benutzer: { vereinId: 'verein-1' } } } as any)).status).toBe(200); });
  it('erstellt mehrere PDF-Seiten und bricht Wörter um', async () => { m.find.mockReturnValue({ toArray: async () => [bestellung({ positionen: Array.from({ length: 70 }, (_, i) => position({ artikelId: new ObjectId().toString(), artikelname: `Artikel ${i} ${'X'.repeat(140)}` })) })] }); expect((await post()).status).toBe(200); });
  it('meldet DB-Fehler mit 500', async () => { m.find.mockImplementation(() => { throw Error('DB'); }); await expect(post()).rejects.toMatchObject({ status: 500 }); });
});


const singlePdfId = 'aaaaaaaaaaaaaaaaaaaaaaaa', singlePdfVereinId = 'club', singlePdfLieferantId = 'bbbbbbbbbbbbbbbbbbbbbbbb', singlePdfGroesseId = 'cccccccccccccccccccccccc';
const singlePdfBasis = () => ({ _id: new ObjectId(singlePdfId), vereinId: singlePdfVereinId, lieferantId: singlePdfLieferantId, lieferantName: 'Fallback', status: 'bestellt', erstelltAm: new Date('2026-11-01'), positionen: [{ artikelId: singlePdfId, groesseId: singlePdfGroesseId, artikelname: 'Trainerjacke', menge: 3 }] });
const singlePdfProject = vi.fn();
const singlePdfToArray = vi.fn();
function singlePdfSetup(order: any = singlePdfBasis()) {
  m.findOne.mockResolvedValue(order);
  m.lieferant.mockResolvedValue({ name: 'Lieferant AG' });
  m.verein.mockResolvedValue({ name: 'Turnverein' });
  m.groessen.mockReturnValue({ project: singlePdfProject });
  singlePdfProject.mockReturnValue({ toArray: singlePdfToArray });
  singlePdfToArray.mockResolvedValue([{ _id: new ObjectId(singlePdfGroesseId), bezeichnung: 'M' }]);
}
const singlePdfCall = (customId = singlePdfId) => GET({ params: { id: customId }, locals: { benutzer: { vereinId: singlePdfVereinId } } } as any);
describe('Einzel-PDF – Metadaten und Langtexte', () => {
 beforeEach(() => { vi.resetAllMocks(); m.auth.mockReturnValue(null); singlePdfSetup(); });
describe('Sammelbestellung Einzel-PDF', () => {
  it('verweigert fehlende Berechtigung', async () => { m.auth.mockReturnValue(new Response('Nein', { status: 403 })); expect((await singlePdfCall() as Response).status).toBe(403); });
  it.each(['falsch', '', 'z'.repeat(24)])('verweigert ungültige ID %s', async (value) => { await expect(singlePdfCall(value)).rejects.toMatchObject({ status: 400 }); });
  it('meldet fehlende Bestellung', async () => { singlePdfSetup(null); await expect(singlePdfCall()).rejects.toMatchObject({ status: 404 }); });
  it.each([[], null])('verweigert leere Positionen %s', async (positionen) => { singlePdfSetup({ ...singlePdfBasis(), positionen }); await expect(singlePdfCall()).rejects.toMatchObject({ status: 409 }); });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('verweigert Menge %s', async (menge) => { singlePdfSetup({ ...singlePdfBasis(), positionen: [{ ...singlePdfBasis().positionen[0], menge }] }); await expect(singlePdfCall()).rejects.toMatchObject({ status: 409 }); }, 15000);
  it('erstellt ein gültiges PDF mit Metadaten', async () => { const r = await singlePdfCall() as Response; expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('application/pdf'); expect(r.headers.get('content-disposition')).toContain(singlePdfId.slice(-8)); const pdf = await PDFDocument.load(await r.arrayBuffer()); expect(pdf.getPageCount()).toBe(1); expect(pdf.getTitle()).toContain('Lieferant AG'); });
  it('erstellt mehrere Seiten und verarbeitet lange Texte', async () => { singlePdfSetup({ ...singlePdfBasis(), bemerkung: 'Sehr lang '.repeat(400), positionen: Array.from({ length: 65 }, (_, i) => ({ artikelId: singlePdfId, singlePdfGroesseId: i % 2 ? null : singlePdfGroesseId, artikelname: `Artikel ${i} ${'ExtraLang'.repeat(25)}`, menge: 1 })) }); const pdf = await PDFDocument.load(await (await singlePdfCall() as Response).arrayBuffer()); expect(pdf.getPageCount()).toBeGreaterThan(1); });
  it('funktioniert ohne Lieferant, Grösse und Vereinsname', async () => { singlePdfSetup({ ...singlePdfBasis(), lieferantId: null, lieferantName: null, positionen: [{ ...singlePdfBasis().positionen[0], groesseId: null }] }); m.findOne.mockResolvedValue({ ...singlePdfBasis(), lieferantId: null, lieferantName: null, positionen: [{ ...singlePdfBasis().positionen[0], groesseId: null }] }); expect((await singlePdfCall() as Response).status).toBe(200); });
  it('behandelt Datenbankfehler', async () => { m.findOne.mockRejectedValue(new Error('DB offline')); await expect(singlePdfCall()).rejects.toMatchObject({ status: 500 }); });
});

});
