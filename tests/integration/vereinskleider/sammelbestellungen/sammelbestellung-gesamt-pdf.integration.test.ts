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
describe('Gesamtbestellungen PDF',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await call({bestellungIds:[id]})).status).toBe(403);});
 it.each([null,{},[],{bestellungIds:[]},{bestellungIds:['abc']},{bestellungIds:[id,id]},{bestellungIds:Array(51).fill(id)}])('validiert Auswahl %#',async(v)=>{await expect(call(v)).rejects.toMatchObject({status:400});});
 it('weist fehlende Bestellung zurück',async()=>{await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:404});});
 it('weist verschiedene Lieferanten zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id),order(id3,id3)];await expect(call({bestellungIds:[id,id3]})).rejects.toMatchObject({status:409});});
 it('weist fehlenden Lieferanten zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order()];await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});});
 it('weist leere Positionen zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[])];h.one.lieferanten={name:'Lieferant'};await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});});
 it('weist ungültige Bestellmenge zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,menge:0}])];h.one.lieferanten={name:'Lieferant'};await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});});
 it('erstellt Gesamt-PDF mit aggregierten Positionen',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id),order(id3)];h.one.lieferanten={name:'Lieferant'};h.one.vereine={name:'TV Weiningen'};expect((await call({bestellungIds:[id,id3]})).headers.get('content-type')).toBe('application/pdf');});
 it('meldet Datenbankfehler',async()=>{h.fail='vereinskleider_sammelbestellungen';await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:500});});
});