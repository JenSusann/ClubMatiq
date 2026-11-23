import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const h = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>, one: {} as Record<string, any>,
  fail: '' as string, count: 1,
  auth: vi.fn(() => null as Response | null),
  insert: vi.fn(async (_document: any) => ({ insertedId: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa') })),
  update: vi.fn(async (_filter: any, _update: any) => ({ matchedCount: 1, modifiedCount: 1, deletedCount: 1 })),
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
import { GET, POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';
beforeEach(reset);
const pos = {artikelId:id,groesseId:null,menge:2};
const call = (v:unknown) => POST({locals,request:post(v)} as any);
const get = () => GET({locals} as any);
describe('Sammelbestellungen GET/POST',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await get()).status).toBe(403);expect((await call({positionen:[pos]})).status).toBe(403);});
 it('liefert leere Übersicht und DB-Fehler',async()=>{expect((await get()).status).toBe(200);h.fail='artikel';expect((await get()).status).toBe(500);});
 it.each([null,[],{}, {positionen:[]},{positionen:Array(101).fill(pos)},{positionen:[null]},{positionen:[{}]},{positionen:[{...pos,menge:0}]},{positionen:[{...pos,groesseId:'abc'}]},{positionen:[pos,pos]},{positionen:[pos],bemerkung:12}])('validiert POST-Daten %#',async(v)=>{expect((await call(v)).status).toBe(400);});
 it('verweigert nicht bestellbare Position',async()=>{expect((await call({positionen:[pos]})).status).toBe(409);});
 it('verarbeitet gültige Bestellung mit Lieferant und Lagerreserve',async()=>{
  h.rows.artikel=[{_id:new ObjectId(id),name:'Shirt',menge:0,hatGroessen:false,lieferantId:id2}];
  h.rows.lieferanten=[{_id:new ObjectId(id2),name:'Lieferant'}];
  const result=await call({positionen:[pos],bemerkung:' Test '});expect(result.status).toBe(201);expect(h.insert).toHaveBeenCalledOnce();
 });
 it('liefert 500 bei Fehler im POST',async()=>{h.fail='artikel';expect((await call({positionen:[pos]})).status).toBe(500);});
});

describe('Paket 16: Sammelbestellungen – Randfälle', () => {
  it('ignoriert ungültige Verkaufspositionen und berücksichtigt offene Mengen, Varianten und Lieferungen', async () => {
    h.rows.artikel=[
      {_id:new ObjectId(id),name:'Shirt',menge:5,hatGroessen:false,lieferantId:id2},
      {_id:new ObjectId(id3),name:'Trainer',hatGroessen:true,lieferantId:id2}
    ];
    h.rows.lieferanten=[{_id:new ObjectId(id2),name:'Lieferant'}];
    h.rows.artikelvarianten=[{artikelId:id3,groesseId:id2,menge:3}];
    h.rows.vereinskleider_verkaeufe=[{positionen:[
      {artikelId:id,groesseId:null,artikelname:'Shirt',menge:8,uebergebenMenge:1,verkaufsart:'bestellung'},
      {artikelId:id,groesseId:null,artikelname:'Shirt',menge:2,verkaufsart:'bestellung'},
      {artikelId:id,groesseId:null,artikelname:'Shirt',menge:0,verkaufsart:'bestellung'},
      {artikelId:id,groesseId:null,artikelname:'Shirt',menge:1,verkaufsart:'direkt'},
      {artikelId:'invalid',groesseId:null,artikelname:'Ungültig',menge:2,verkaufsart:'bestellung'},
      {artikelId:id3,groesseId:id2,artikelname:'Trainer',menge:5,verkaufsart:'bestellung'}
    ]}];
    h.rows.vereinskleider_sammelbestellungen=[{_id:new ObjectId(id2),status:'bestellt',positionen:[
      {artikelId:id,groesseId:null,menge:4,geliefertMenge:2},
      {artikelId:id3,groesseId:id2,menge:2,geliefertMenge:1}
    ]}];
    const response=await get();expect(response.status).toBe(200);
    const body=await response.json();
    expect(body.bedarf).toHaveLength(2);
    expect(body.bedarf.find((x:any)=>x.artikelId===id).nachbestellen).toBe(3);
    expect(body.bedarf.find((x:any)=>x.artikelId===id3).nachbestellen).toBe(2);
    expect(body.sammelbestellungen[0].positionen[0].offenMenge).toBe(2);
  });
  it('weist Bestellung ohne gültigen Standardlieferanten zurück',async()=>{
    h.rows.artikel=[{_id:new ObjectId(id),name:'Shirt',menge:1,hatGroessen:false}];
    expect((await call({positionen:[pos]})).status).toBe(409);
  });
  it('weist gemischte Lieferanten zurück',async()=>{
    h.rows.artikel=[{_id:new ObjectId(id),name:'Shirt',menge:1,hatGroessen:false,lieferantId:id2},
      {_id:new ObjectId(id3),name:'Hose',menge:1,hatGroessen:false,lieferantId:id3}];
    h.rows.lieferanten=[{_id:new ObjectId(id2),name:'A'},{_id:new ObjectId(id3),name:'B'}];
    expect((await call({positionen:[pos,{artikelId:id3,groesseId:null,menge:1}]})).status).toBe(400);
  });
  it('erfasst die Aufteilung zwischen Kundenbedarf und Lagerreserve',async()=>{
    h.rows.artikel=[{_id:new ObjectId(id),name:'Shirt',menge:1,hatGroessen:false,lieferantId:id2}];
    h.rows.lieferanten=[{_id:new ObjectId(id2),name:'A'}];
    h.rows.vereinskleider_verkaeufe=[{positionen:[{artikelId:id,groesseId:null,artikelname:'Shirt',menge:2,verkaufsart:'bestellung'}]}];
    expect((await call({positionen:[{...pos,menge:4}]})).status).toBe(201);
    const doc=h.insert.mock.calls[0][0];
    expect(doc.positionen[0].kundenbedarfMenge).toBe(2);
    expect(doc.positionen[0].lagerreserveMenge).toBe(2);
  });
});


const edgeA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const edgeB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const edgeC = 'cccccccccccccccccccccccc';
const edgelocals = { benutzer: { vereinId: 'verein-1' } } as any;
const edgeget = async () => (await GET({ edgelocals } as any)).json();
const edgepost = (body: unknown) => POST({ edgelocals, request: new Request('http://localhost/api', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}) } as any);
const edgeartikel = (extra: Record<string, unknown> = {}) => ({ _id: new ObjectId(edgeA), name: 'Shirt',
  menge: 0, hatGroessen: false, lieferantId: edgeB, ...extra });
const edgelieferant = { _id: new ObjectId(edgeB), name: 'Lieferant' };
const edgeposition = (extra: Record<string, unknown> = {}) => ({ artikelId: edgeA, groesseId: null,
  artikelname: 'Shirt', menge: 5, verkaufsart: 'bestellung', ...extra });
const edgesammel = (extra: Record<string, unknown> = {}) => ({ _id: new ObjectId(edgeC),
  status: 'bestellt', positionen: [{ artikelId: edgeA, groesseId: null, menge: 3 }],
  bemerkung: '', erstelltAm: new Date('2026-11-01'), aktualisiertAm: new Date('2026-11-02'), ...extra });

describe('Sammelbestellungen – Paket 20 Randfälle', () => {
 beforeEach(() => {
  h.rows = {}; h.auth.mockReset().mockReturnValue(null);
  h.insert.mockReset().mockResolvedValue({ insertedId: { toString: () => edgeA } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Paket 20 – gezielte offene GET-Branches der Sammelbestellungen', () => {
  it('summiert mehrere Kundenpositionen und berücksichtigt bereits übergebene Stücke', async () => {
    h.rows.edgeartikel = [edgeartikel()];
    h.rows.vereinskleider_verkaeufe = [
      { positionen: [edgeposition({ menge: 4, uebergebenMenge: 1 }), edgeposition({ menge: 3, uebergebenMenge: 2 })] },
    ];
    const result = await edgeget();
    expect(result.bedarf[0]).toMatchObject({ offen: 4, nachbestellen: 4 });
  });
  it('ignoriert nicht bestellbare Positionen und ungültige Übergabewerte', async () => {
    h.rows.edgeartikel = [edgeartikel()];
    h.rows.vereinskleider_verkaeufe = [
      { positionen: [edgeposition({ verkaufsart: 'direkt' }), edgeposition({ artikelId: 'ungueltig' }),
        edgeposition({ groesseId: 'ungueltig' }), edgeposition({ menge: 0 }),
        edgeposition({ uebergebenMenge: -1 }), edgeposition({ uebergebenMenge: 6 }),
        edgeposition({ uebergebenMenge: 1.5 }), edgeposition({ menge: 2, uebergebenMenge: 1 })] },
      { positionen: null },
    ];
    expect((await edgeget()).bedarf[0].offen).toBe(1);
  });
  it('berechnet nur noch nicht gelieferte Sammelbestellmengen', async () => {
    h.rows.edgeartikel = [edgeartikel()];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [edgeposition()] }];
    h.rows.vereinskleider_sammelbestellungen = [edgesammel({ positionen: [
      { artikelId: edgeA, groesseId: null, menge: 4, geliefertMenge: 2 },
      { artikelId: edgeA, groesseId: null, menge: 2, geliefertMenge: 1 },
    ] })];
    expect((await edgeget()).bedarf[0]).toMatchObject({ offen: 5, bereitsInSammelbestellungen: 3, nachbestellen: 2 });
  });
  it('ignoriert gelieferte Bestellungen und inkonsistente Liefermengen', async () => {
    h.rows.edgeartikel = [edgeartikel()];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [edgeposition()] }];
    h.rows.vereinskleider_sammelbestellungen = [
      edgesammel({ status: 'geliefert' }),
      edgesammel({ status: 'bestellt', positionen: [
        { artikelId: edgeA, groesseId: null, menge: -1 },
        { artikelId: edgeA, groesseId: null, menge: 2, geliefertMenge: 3 },
        { artikelId: edgeA, groesseId: null, menge: 2, geliefertMenge: -1 },
        { artikelId: edgeA, groesseId: null, menge: 2, geliefertMenge: 0.5 },
      ] }),
    ];
    expect((await edgeget()).bedarf[0]).toMatchObject({ bereitsInSammelbestellungen: 0, nachbestellen: 5 });
  });
  it('nutzt Ersatzbezeichnung und verwirft unplausiblen Lagerbestand', async () => {
    h.rows.edgeartikel = [edgeartikel({ name: null, menge: -5, lieferantId: null })];
    const result = await edgeget();
    expect(result.bedarf[0]).toMatchObject({ artikelname: 'Unbenannter Artikel', bestand: null, verfuegbar: 0, lieferantId: null });
  });
  it('bildet Grössenvarianten ab und berücksichtigt deren eigenen Bestand', async () => {
    h.rows.edgeartikel = [edgeartikel({ hatGroessen: true, menge: 100 })];
    h.rows.artikelvarianten = [{ artikelId: edgeA, groesseId: edgeC, menge: 3 }];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [edgeposition({ groesseId: edgeC, menge: 5 })] }];
    const result = await edgeget();
    expect(result.bedarf[0]).toMatchObject({ groesseId: edgeC, bestand: 3, verfuegbar: 2, nachbestellen: 3 });
  });
  it('ignoriert verwaiste oder ungültige Varianten', async () => {
    h.rows.edgeartikel = [edgeartikel({ hatGroessen: true })];
    h.rows.artikelvarianten = [
      { artikelId: edgeB, groesseId: edgeC, menge: 3 },
      { artikelId: edgeA, groesseId: 'falsch', menge: 3 },
    ];
    expect((await edgeget()).bedarf).toHaveLength(0);
  });
  it('bildet alte Sammelbestellungen ohne Liefer- und Aufteilungsfelder ab', async () => {
    h.rows.vereinskleider_sammelbestellungen = [edgesammel({ status: 'entwurf', lieferantId: edgeB,
      positionen: [{ artikelId: edgeA, groesseId: null, menge: 3 }] })];
    h.rows.lieferanten = [edgelieferant];
    const result = await edgeget();
    expect(result.sammelbestellungen[0]).toMatchObject({ lieferantName: 'Lieferant',
      positionen: [{ geliefertMenge: 0, kundenbedarfMenge: null, lagerreserveMenge: null, offenMenge: 3 }] });
  });
  it('verwendet vorhandenen Lieferantennamen und gespeicherte Aufteilung', async () => {
    h.rows.vereinskleider_sammelbestellungen = [edgesammel({ lieferantName: 'Historischer Lieferant',
      positionen: [{ artikelId: edgeA, groesseId: null, menge: 4, geliefertMenge: 2,
        kundenbedarfMenge: 3, lagerreserveMenge: 1 }] })];
    const result = await edgeget();
    expect(result.sammelbestellungen[0]).toMatchObject({ lieferantName: 'Historischer Lieferant',
      positionen: [{ offenMenge: 2, kundenbedarfMenge: 3, lagerreserveMenge: 1 }] });
  });
});

describe('Paket 20 – zusätzliche POST-Branches', () => {
  it('verweigert eine Bestellung ohne Standardlieferanten', async () => {
    h.rows.edgeartikel = [edgeartikel({ lieferantId: null })];
    expect((await edgepost({ positionen: [{ artikelId: edgeA, groesseId: null, menge: 2 }] })).status).toBe(409);
  });
  it('verweigert eine Sammelbestellung mit zwei verschiedenen Lieferanten', async () => {
    h.rows.edgeartikel = [edgeartikel(), { _id: new ObjectId(edgeC), name: 'Jacke', menge: 1, hatGroessen: false, lieferantId: edgeA }];
    h.rows.lieferanten = [edgelieferant, { _id: new ObjectId(edgeA), name: 'Anderer Lieferant' }];
    expect((await edgepost({ positionen: [
      { artikelId: edgeA, groesseId: null, menge: 2 }, { artikelId: edgeC, groesseId: null, menge: 2 },
    ] })).status).toBe(400);
  });
  it('speichert Lieferanten-Snapshot und trennt Kundenbedarf von Lagerreserve', async () => {
    h.rows.edgeartikel = [edgeartikel()]; h.rows.lieferanten = [edgelieferant];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [edgeposition({ menge: 2 })] }];
    const response = await edgepost({ positionen: [{ artikelId: edgeA, groesseId: null, menge: 5 }] });
    expect(response.status).toBe(201);
    expect(h.insert.mock.calls[0][0]).toMatchObject({ lieferantName: 'Lieferant',
      positionen: [{ kundenbedarfMenge: 2, lagerreserveMenge: 3 }] });
  });
});

});
