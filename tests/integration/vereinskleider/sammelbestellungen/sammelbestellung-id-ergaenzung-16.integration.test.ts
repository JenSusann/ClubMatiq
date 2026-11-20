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
const locals = { benutzer: { id: 'integration-user', vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };
import { PATCH } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';
beforeEach(reset);
const call=(body:unknown,key=id)=>PATCH({locals,params:{id:key},request:patch(body)} as any);
const bestellung=(status='entwurf')=>({_id:new ObjectId(id),vereinId:'verein-1',status,positionen:[{artikelId:id2,groesseId:null,artikelname:'Shirt',menge:4,geliefertMenge:0}]});

describe('Paket 16: Sammelbestellung Status und Wareneingang',()=>{
  it('meldet fehlgeschlagene Statusaktualisierung als Konflikt',async()=>{
    h.one.vereinskleider_sammelbestellungen=bestellung();
    h.update.mockResolvedValue({matchedCount:1,modifiedCount:0,deletedCount:0});
    expect((await call({aktion:'bestellen'})).status).toBe(409);
  });
  it('bucht vollständigen Wareneingang ohne Kundenreservierungen',async()=>{
    h.one.vereinskleider_sammelbestellungen=bestellung('bestellt');
    h.one.artikel={menge:8};
    const r=await call({aktion:'wareneingang',positionen:[{artikelId:id2,groesseId:null,menge:4}]});
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('geliefert');
  });
  it('verweigert ungültigen Lagerbestand bei Wareneingang',async()=>{
    h.one.vereinskleider_sammelbestellungen=bestellung('bestellt');
    h.one.artikel={menge:-1};
    expect((await call({aktion:'wareneingang',positionen:[{artikelId:id2,groesseId:null,menge:1}]})).status).toBe(409);
  });
  it('verweigert inkonsistente Kundenreservierungen',async()=>{
    h.one.vereinskleider_sammelbestellungen=bestellung('bestellt');
    h.one.artikel={menge:8};
    h.rows.vereinskleider_verkaeufe=[{_id:new ObjectId(id3),positionen:[
      {artikelId:id2,groesseId:null,verkaufsart:'bestellung',menge:2,uebergebenMenge:0,reserviertMenge:3}
    ]}];
    expect((await call({aktion:'wareneingang',positionen:[{artikelId:id2,groesseId:null,menge:1}]})).status).toBe(409);
  });
});
