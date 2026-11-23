import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const h = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>, one: {} as Record<string, any>,
  fail: '' as string, count: 1,
  auth: vi.fn(() => null as Response | null),
  insert: vi.fn(async () => ({ insertedId: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa') })),
  update: vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1, deletedCount: 1 })),
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    find: () => ({ project() { return this; }, sort() { return this; }, toArray: async () => { if (h.fail === name) throw new Error('DB-Ausfall'); return h.rows[name] ?? []; } }),
    findOne: async () => { if (h.fail === name) throw new Error('DB-Ausfall'); return h.one[name] ?? null; },
    insertOne: h.insert, updateOne: h.update, updateMany: h.update, deleteOne: h.update,
    countDocuments: async () => h.count
  }) },
  client: { startSession: () => ({ withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }) }
}));
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };
import { GET } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
beforeEach(reset);
const call=(key=id)=>GET({locals,params:{id:key}} as any);
const order=(positionen:any[])=>({_id:new ObjectId(id),vereinId:'verein-1',lieferantId:id2,lieferantName:'Lieferant',status:'bestellt',erstelltAm:new Date('2026-11-01'),bemerkung:'Test',positionen});
const position={artikelId:id3,groesseId:null,artikelname:'Shirt',menge:2};
describe('Einzelbestellung PDF',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await call()).status).toBe(403);});
 it('weist ungültige ID zurück',async()=>{await expect(call('abc')).rejects.toMatchObject({status:400});});
 it('weist fehlende Bestellung zurück',async()=>{await expect(call()).rejects.toMatchObject({status:404});});
 it('weist leere Positionen zurück',async()=>{h.one.vereinskleider_sammelbestellungen=order([]);await expect(call()).rejects.toMatchObject({status:409});});
 it('weist ungültige Menge zurück',async()=>{h.one.vereinskleider_sammelbestellungen=order([{...position,menge:0}]);await expect(call()).rejects.toMatchObject({status:409});});
 it('erstellt PDF mit Fallback-Namen und Bemerkung',async()=>{h.one.vereinskleider_sammelbestellungen=order([position]);const r=await call();expect(r.headers.get('content-type')).toBe('application/pdf');});
 it('erstellt PDF mit Grössenbezeichnung',async()=>{h.one.vereinskleider_sammelbestellungen=order([{...position,groesseId:id3}]);h.rows.groessen=[{_id:new ObjectId(id3),bezeichnung:'M'}];h.one.lieferanten={name:'Lieferant'};h.one.vereine={name:'TV Weiningen'};expect((await call()).status).toBe(200);});
 it('meldet Datenbankfehler',async()=>{h.fail='vereinskleider_sammelbestellungen';await expect(call()).rejects.toMatchObject({status:500});});
});

describe('Paket 16: Einzel-PDF – Randfälle',()=>{
  it('erstellt mehrseitige Bestellung mit langen Namen und ohne Bemerkung',async()=>{
    const viele=Array.from({length:70},(_,i)=>({...position,artikelname:'Langer Artikelname '.repeat(15)+i,groesseId:id2,menge:1}));
    h.one.vereinskleider_sammelbestellungen={...order(viele),bemerkung:''};
    h.rows.groessen=[{_id:new ObjectId(id2),bezeichnung:'Sehr lange Groesse '.repeat(6)}];
    const r=await call();expect(r.status).toBe(200);
    const {PDFDocument}=await import('pdf-lib');
    expect((await PDFDocument.load(await r.arrayBuffer())).getPageCount()).toBeGreaterThan(1);
  });
  it('erstellt PDF mit unbekannter Groesse und ohne Lieferantenstammsatz',async()=>{
    h.one.vereinskleider_sammelbestellungen={...order([{...position,groesseId:id2}]),bemerkung:''};
    expect((await call()).status).toBe(200);
  });
});
