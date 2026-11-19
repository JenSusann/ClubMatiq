import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
const m = vi.hoisted(() => ({ permission: vi.fn(), findOne: vi.fn(), find: vi.fn(), project: vi.fn(), toArray: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn((name: string) => ({ findOne: (...args: unknown[]) => m.findOne(name, ...args), find: (...args: unknown[]) => m.find(name, ...args) })) } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST } from '../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
const a='aaaaaaaaaaaaaaaaaaaaaaaa', b='bbbbbbbbbbbbbbbbbbbbbbbb', lieferantId='cccccccccccccccccccccccc', groesseId='dddddddddddddddddddddddd';
const position = (artikelId=a, menge=2, groesse: string | null=groesseId) => ({ artikelId, groesseId: groesse, artikelname: 'Trainerjacke', menge });
const bestellung = (id=a, positionen: any[]=[position()]) => ({ _id: new ObjectId(id), lieferantId, vereinId: 'club', positionen, erstelltAm: new Date() });
function setup(bestellungen: any[]=[bestellung()]) {
 m.find.mockImplementation((name: string) => ({ toArray: async () => name === 'vereinskleider_sammelbestellungen' ? bestellungen : [{ _id: new ObjectId(groesseId), bezeichnung: 'M' }], project: m.project }));
 m.project.mockReturnValue({ toArray: async () => [{ _id: new ObjectId(groesseId), bezeichnung: 'M' }] });
 m.findOne.mockImplementation(async (name: string) => name === 'lieferanten' ? { name: 'Lieferant AG' } : { name: 'TV Weiningen' });
}
const call = (ids: unknown=[a]) => POST({ request: new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bestellungIds: ids }) }), locals: { benutzer: { vereinId: 'club' } } } as any);
beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); setup(); });
describe('Sammelbestellungen Gesamt-PDF', () => {
 it('prüft Berechtigung', async () => { m.permission.mockReturnValue(new Response('', {status:403})); expect((await call() as Response).status).toBe(403); });
 it.each([null, [], [a,a], ['abc'], Array(51).fill(a)])('verweigert ungültige Auswahl', async (ids) => { await expect(call(ids)).rejects.toMatchObject({status:400}); });
 it('verweigert fehlende Bestellungen', async () => { setup([]); await expect(call()).rejects.toMatchObject({status:404}); });
 it('verweigert unterschiedliche Lieferanten', async () => { setup([bestellung(a), {...bestellung(b), lieferantId:b}]); await expect(call([a,b])).rejects.toMatchObject({status:409}); });
 it('verweigert fehlenden Lieferanten', async () => { m.findOne.mockResolvedValue(null); await expect(call()).rejects.toMatchObject({status:409}); });
 it.each([[], null])('verweigert fehlende Positionen', async (positionen) => { setup([bestellung(a, positionen as any)]); await expect(call()).rejects.toMatchObject({status:409}); });
 it.each([position('x'), position(a,0), position(a,-1), position(a,1.5), position(a,2,'abc')])('verweigert fehlerhafte Position', async (p) => { setup([bestellung(a,[p])]); await expect(call()).rejects.toMatchObject({status:409}); });
 it('erzeugt ein PDF und fasst gleiche Positionen zusammen', async () => { setup([bestellung(a),bestellung(b,[position(a,3)])]); const r=await call([a,b]) as Response; expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('application/pdf'); const pdf=await PDFDocument.load(await r.arrayBuffer()); expect(pdf.getPageCount()).toBe(1); });
 it('erstellt mehrseitiges PDF für viele Positionen', async () => { setup([bestellung(a,Array.from({length:65},(_,i)=>position(i.toString(16).padStart(24,'0'),1,i%2?null:groesseId)).map((p,i)=>({...p,artikelname:'Sehr langer Artikelname '.repeat(10)+i}))) ]); const pdf=await PDFDocument.load(await (await call() as Response).arrayBuffer()); expect(pdf.getPageCount()).toBeGreaterThan(1); });
 it('erkennt überlaufende zusammengefasste Mengen', async () => { setup([bestellung(a,[position(a,Number.MAX_SAFE_INTEGER)]),bestellung(b,[position(a,1)])]); await expect(call([a,b])).rejects.toMatchObject({status:409}); });
 it('behandelt Datenbankfehler', async () => { m.find.mockImplementation(() => { throw new Error('offline'); }); await expect(call()).rejects.toMatchObject({status:500}); });
});
