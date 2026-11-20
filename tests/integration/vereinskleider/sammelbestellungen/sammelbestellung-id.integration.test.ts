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
import { PATCH } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';
beforeEach(reset);
const call=(body:unknown,key=id)=>PATCH({locals,params:{id:key},request:patch(body)} as any);
const bestellung=(status='entwurf')=>({_id:new ObjectId(id),vereinId:'verein-1',status,positionen:[{artikelId:id2,groesseId:null,artikelname:'Shirt',menge:4,geliefertMenge:0}]});
describe('Sammelbestellungen PATCH',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await call({aktion:'bestellen'})).status).toBe(403);});
 it('validiert ID und Aktion',async()=>{expect((await call({aktion:'bestellen'},'abc')).status).toBe(400);expect((await call(null)).status).toBe(400);expect((await call({aktion:'falsch'})).status).toBe(400);});
 it.each([[],Array(101).fill({artikelId:id2,groesseId:null,menge:1}),[null],[{artikelId:'x',groesseId:null,menge:1}],[{artikelId:id2,groesseId:null,menge:0}],[{artikelId:id2,groesseId:null,menge:1},{artikelId:id2,groesseId:null,menge:1}]])('validiert Wareneingangspositionen %#',async(positionen)=>{expect((await call({aktion:'wareneingang',positionen})).status).toBe(400);});
 it('liefert 404 bei fehlender Bestellung',async()=>{expect((await call({aktion:'bestellen'})).status).toBe(404);});
 it('markiert Entwurf als bestellt',async()=>{h.one.vereinskleider_sammelbestellungen=bestellung();expect((await call({aktion:'bestellen'})).status).toBe(200);});
 it('verweigert doppelte Bestellung',async()=>{h.one.vereinskleider_sammelbestellungen=bestellung('bestellt');expect((await call({aktion:'bestellen'})).status).toBe(409);});
 it('verweigert Wareneingang bei Entwurf',async()=>{h.one.vereinskleider_sammelbestellungen=bestellung();expect((await call({aktion:'wareneingang',positionen:[{artikelId:id2,groesseId:null,menge:1}]})).status).toBe(409);});
 it('verweigert nicht vorhandene Position',async()=>{h.one.vereinskleider_sammelbestellungen=bestellung('bestellt');expect((await call({aktion:'wareneingang',positionen:[{artikelId:id3,groesseId:null,menge:1}]})).status).toBe(409);});
 it('verweigert Überlieferung',async()=>{h.one.vereinskleider_sammelbestellungen=bestellung('bestellt');expect((await call({aktion:'wareneingang',positionen:[{artikelId:id2,groesseId:null,menge:5}]})).status).toBe(409);});
 it('meldet Transaktionsfehler',async()=>{h.fail='vereinskleider_sammelbestellungen';h.one.vereinskleider_sammelbestellungen=bestellung();expect((await call({aktion:'bestellen'})).status).toBe(500);});
});