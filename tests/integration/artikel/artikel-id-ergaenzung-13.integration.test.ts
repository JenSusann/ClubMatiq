import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const h = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>, one: {} as Record<string, any>,
  fail: '' as string, count: 1,
  auth: vi.fn(() => null as Response | null),
  insert: vi.fn(async () => ({ insertedId: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa') })),
  update: vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1, deletedCount: 1 })),
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    find: () => ({ project() { return this; }, sort() { return this; }, toArray: async () => { if (h.fail === name) throw new Error('DB-Ausfall'); return h.rows[name] ?? []; } }),
    findOne: async () => { if (h.fail === name) throw new Error('DB-Ausfall'); return h.one[name] ?? null; },
    insertOne: h.insert, updateOne: h.update, updateMany: h.update, deleteMany: h.update, deleteOne: h.update,
    countDocuments: async () => h.count
  }) },
  client: { startSession: () => ({ withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }) }
}));
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { id: 'admin-test', vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };
import { GET, PATCH, DELETE } from '../../../src/routes/api/artikel/[id]/+server';
beforeEach(reset);
const get=(key=id)=>GET({locals,params:{id:key}} as any);
const del=(key=id)=>DELETE({locals,params:{id:key}} as any);
const data=()=>({name:'Shirt',kategorieId:id2,lagerortId:id3,menge:3,einzelwert:20,mindestbestand:1,hatGroessen:false});
const change=(v:unknown,key=id)=>PATCH({locals,params:{id:key},request:patch(v)} as any);
describe('Artikel-ID GET/PATCH/DELETE',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await get()).status).toBe(403);expect((await change(data())).status).toBe(403);expect((await del()).status).toBe(403);});
 it('validiert IDs',async()=>{expect((await get('abc')).status).toBe(400);expect((await del('abc')).status).toBe(400);expect((await change(data(),'abc')).status).toBe(400);});
 it('meldet fehlende Artikel',async()=>{expect((await get()).status).toBe(404);expect((await del()).status).toBe(404);expect((await change(data())).status).toBe(404);});
 it('lädt Artikel mit Grössen-Fallbacks',async()=>{h.one.artikel={_id:new ObjectId(id),hatGroessen:true};h.rows.artikelvarianten=[{_id:new ObjectId(id2),artikelId:id,groesseId:id3,menge:2,aktiv:false}];const r=await get();expect(r.status).toBe(200);expect((await r.json()).varianten[0]).toMatchObject({einzelwert:null,mindestbestand:0,aktiv:false});});
 it.each([null,[],{}, {...data(),mindestbestand:-1},{...data(),name:''},{...data(),kategorieId:'x'},{...data(),einzelwert:-1},{...data(),istVereinskleidung:'ja'},{...data(),hatGroessen:'ja'},{...data(),lieferantId:'x'},{...data(),menge:-1},{...data(),hatGroessen:true,varianten:[]},{...data(),hatGroessen:true,varianten:[{groesseId:id3,menge:-1,einzelwert:1,mindestbestand:0}]},{...data(),hatGroessen:true,varianten:[{groesseId:id3,menge:1,einzelwert:1,mindestbestand:0},{groesseId:id3,menge:1,einzelwert:1,mindestbestand:0}]}])('validiert PATCH-Daten %#',async(v)=>{expect((await change(v)).status).toBe(400);});
 it('verweigert Wechsel des Grössentyps',async()=>{h.one.artikel={_id:new ObjectId(id),hatGroessen:true};expect((await change(data())).status).toBe(400);});
 it('verweigert fehlende Kategorie',async()=>{h.one.artikel={_id:new ObjectId(id),hatGroessen:false};expect((await change(data())).status).toBe(400);});
 it('speichert Artikel ohne Grössen',async()=>{h.one.artikel={_id:new ObjectId(id),hatGroessen:false};h.one.kategorien={_id:new ObjectId(id2)};h.one.lagerorte={_id:new ObjectId(id3)};expect((await change(data())).status).toBe(200);});
 it('verweigert Löschen mit Ausleihe',async()=>{h.one.artikel={_id:new ObjectId(id)};h.one.ausleihen={_id:new ObjectId(id2)};expect((await del()).status).toBe(409);});
 it('löscht Artikel ohne Verweise',async()=>{h.one.artikel={_id:new ObjectId(id)};expect((await del()).status).toBe(200);});
 it('meldet DB-Ausfall',async()=>{h.fail='artikel';expect((await get()).status).toBe(500);expect((await del()).status).toBe(500);});
});