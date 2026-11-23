import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
const m = vi.hoisted(() => ({ permission: vi.fn(), findOne: vi.fn(), find: vi.fn(), project: vi.fn(), toArray: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn((name: string) => ({ findOne: (...args: unknown[]) => m.findOne(name, ...args), find: (...args: unknown[]) => m.find(name, ...args) })) } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET } from '../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa', vereinId = 'club', lieferantId = 'bbbbbbbbbbbbbbbbbbbbbbbb', groesseId = 'cccccccccccccccccccccccc';
const basis = () => ({ _id: new ObjectId(id), vereinId, lieferantId, lieferantName: 'Fallback', status: 'bestellt', erstelltAm: new Date('2026-11-01'), positionen: [{ artikelId: id, groesseId, artikelname: 'Trainerjacke', menge: 3 }] });
function setup(bestellung: any = basis()) {
  m.findOne.mockImplementation(async (name: string) => name === 'vereinskleider_sammelbestellungen' ? bestellung : name === 'lieferanten' ? { name: 'Lieferant AG' } : { name: 'Turnverein' });
  m.find.mockReturnValue({ project: m.project }); m.project.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockResolvedValue([{ _id: new ObjectId(groesseId), bezeichnung: 'M' }]);
}
const call = (customId = id) => GET({ params: { id: customId }, locals: { benutzer: { vereinId } } } as any);
beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); setup(); });
describe('Sammelbestellung Einzel-PDF', () => {
  it('verweigert fehlende Berechtigung', async () => { m.permission.mockReturnValue(new Response('Nein', { status: 403 })); expect((await call() as Response).status).toBe(403); });
  it.each(['falsch', '', 'z'.repeat(24)])('verweigert ungültige ID %s', async (value) => { await expect(call(value)).rejects.toMatchObject({ status: 400 }); });
  it('meldet fehlende Bestellung', async () => { setup(null); await expect(call()).rejects.toMatchObject({ status: 404 }); });
  it.each([[], null])('verweigert leere Positionen %s', async (positionen) => { setup({ ...basis(), positionen }); await expect(call()).rejects.toMatchObject({ status: 409 }); });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('verweigert Menge %s', async (menge) => { setup({ ...basis(), positionen: [{ ...basis().positionen[0], menge }] }); await expect(call()).rejects.toMatchObject({ status: 409 }); }, 15000);
  it('erstellt ein gültiges PDF mit Metadaten', async () => { const r = await call() as Response; expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('application/pdf'); expect(r.headers.get('content-disposition')).toContain(id.slice(-8)); const pdf = await PDFDocument.load(await r.arrayBuffer()); expect(pdf.getPageCount()).toBe(1); expect(pdf.getTitle()).toContain('Lieferant AG'); });
  it('erstellt mehrere Seiten und verarbeitet lange Texte', async () => { setup({ ...basis(), bemerkung: 'Sehr lang '.repeat(400), positionen: Array.from({ length: 65 }, (_, i) => ({ artikelId: id, groesseId: i % 2 ? null : groesseId, artikelname: `Artikel ${i} ${'ExtraLang'.repeat(25)}`, menge: 1 })) }); const pdf = await PDFDocument.load(await (await call() as Response).arrayBuffer()); expect(pdf.getPageCount()).toBeGreaterThan(1); });
  it('funktioniert ohne Lieferant, Grösse und Vereinsname', async () => { setup({ ...basis(), lieferantId: null, lieferantName: null, positionen: [{ ...basis().positionen[0], groesseId: null }] }); m.findOne.mockImplementation(async (name: string) => name === 'vereinskleider_sammelbestellungen' ? { ...basis(), lieferantId: null, lieferantName: null, positionen: [{ ...basis().positionen[0], groesseId: null }] } : null); expect((await call() as Response).status).toBe(200); });
  it('behandelt Datenbankfehler', async () => { m.findOne.mockRejectedValue(new Error('DB offline')); await expect(call()).rejects.toMatchObject({ status: 500 }); });
});
