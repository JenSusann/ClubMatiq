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
import { POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
beforeEach(reset);
const call=(v:unknown)=>POST({locals,request:post(v)} as any);
const position={artikelId:id3,groesseId:null,artikelname:'Shirt',menge:2};
const order=(key=id,lieferantId=id2,positionen:any[]=[position])=>({_id:new ObjectId(key),vereinId:'verein-1',lieferantId,positionen,erstelltAm:new Date('2026-11-01')});

describe('Paket 16: Gesamt-PDF – Randfälle',()=>{
  it('verweigert ungültige Lieferanten-ID',async()=>{
    h.rows.vereinskleider_sammelbestellungen=[order(id,'ungueltig')];
    await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});
  });
  it('verweigert ungültige Artikel-ID und Grössen-ID',async()=>{
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,artikelId:'falsch'}])];
    h.one.lieferanten={name:'A'};
    await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,groesseId:'falsch'}])];
    await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});
  });
  it('verweigert Überlauf beim Zusammenführen',async()=>{
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,menge:Number.MAX_SAFE_INTEGER}]),order(id3,id2,[position])];
    h.one.lieferanten={name:'A'};
    await expect(call({bestellungIds:[id,id3]})).rejects.toMatchObject({status:409});
  });
  it('erstellt mehrseitiges PDF mit langen Artikeln und Grössen',async()=>{
    const viele=Array.from({length:65},(_,i)=>({...position,artikelId:(i+1).toString(16).padStart(24,'0'),groesseId:id2,artikelname:'Sehr langer Artikelname '.repeat(12)+i,menge:i+1}));
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,viele)];
    h.one.lieferanten={name:'Lieferant'};
    h.rows.groessen=[{_id:new ObjectId(id2),bezeichnung:'Extra lange Groessenbezeichnung '.repeat(4)}];
    const r=await call({bestellungIds:[id]});
    expect(r.status).toBe(200);
    const {PDFDocument}=await import('pdf-lib');
    expect((await PDFDocument.load(await r.arrayBuffer())).getPageCount()).toBeGreaterThan(1);
  });
});
