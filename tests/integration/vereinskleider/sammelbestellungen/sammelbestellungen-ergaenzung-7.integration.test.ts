import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), find: vi.fn(), project: vi.fn(), sort: vi.fn(), toArray: vi.fn(), insertOne: vi.fn() }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
import { GET, POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';
const aid = new ObjectId().toHexString(), bid = new ObjectId().toHexString(), sid = new ObjectId().toHexString(), vid = new ObjectId().toHexString();
const benutzer = { id: aid, vereinId: vid, rolle: 'admin' };
const ctx = (method: string, body?: unknown) => ({locals:{benutzer}, request:new Request('http://localhost/api/vereinskleider/sammelbestellungen',{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})})}) as never;
const position = (artikelId=aid, groesseId:string|null=null, menge=3) => ({artikelId,groesseId,menge});
const base = () => ({
 'vereinskleider_verkaeufe': [],
 'artikel': [{_id:new ObjectId(aid),name:'Ball',menge:1,hatGroessen:false,lieferantId:sid}],
 'artikelvarianten': [],
 'vereinskleider_sammelbestellungen': [],
 'lieferanten': [{_id:new ObjectId(sid),name:'Lieferant A'}]
});
let data:Record<string,unknown[]>;
beforeEach(() => {vi.resetAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{});data=base();m.collection.mockImplementation((name:string)=>({find:()=>({project:()=>({toArray:()=>Promise.resolve(data[name]??[])}),sort:()=>({toArray:()=>Promise.resolve(data[name]??[])})}) ,insertOne:m.insertOne}));m.insertOne.mockResolvedValue({insertedId:new ObjectId(bid)});});
const post=(p:unknown)=>POST(ctx('POST',p));
describe('Paket 7 – Sammelbestellungen Verzweigungen',()=>{
 it('GET leerer Bedarf',async()=>{data.artikel=[];const r=await GET(ctx('GET'));expect(r.status).toBe(200);expect((await r.json()).bedarf).toEqual([]);});
 it('GET Kundenbedarf, offene und bereits gelieferte Bestellungen',async()=>{data.vereinskleider_verkaeufe=[{positionen:[{...position(),artikelname:'Ball',verkaufsart:'bestellung',uebergebenMenge:1}]}];data.vereinskleider_sammelbestellungen=[{_id:new ObjectId(bid),status:'bestellt',positionen:[{...position(),geliefertMenge:1}],erstelltAm:new Date(),aktualisiertAm:new Date(),bemerkung:''}];const r=await GET(ctx('GET'));const b=(await r.json()).bedarf[0];expect(b.offen).toBe(2);expect(b.bereitsInSammelbestellungen).toBe(2);expect(b.nachbestellen).toBe(0);});
 it('GET ignoriert ungültige Verkaufspositionen',async()=>{data.vereinskleider_verkaeufe=[{positionen:[{...position(),artikelname:'Ball',verkaufsart:'direkt'}, {...position('falsch'),artikelname:'X',verkaufsart:'bestellung'}, {...position(),artikelname:'Ball',verkaufsart:'bestellung',uebergebenMenge:99}]}];const r=await GET(ctx('GET'));expect((await r.json()).bedarf[0].offen).toBe(0);});
 it('GET zeigt aktive Grössenvariante',async()=>{data.artikel=[{_id:new ObjectId(aid),name:'Trikot',hatGroessen:true,lieferantId:sid}];data.artikelvarianten=[{artikelId:aid,groesseId:bid,menge:4}];const r=await GET(ctx('GET'));expect((await r.json()).bedarf[0].groesseId).toBe(bid);});
 it('GET Datenbankfehler',async()=>{m.collection.mockImplementation(()=>{throw new Error('DB')});expect((await GET(ctx('GET'))).status).toBe(500);});
 it.each([null,[],3])('POST ungültiger Body %j',async body=>{expect((await post(body)).status).toBe(400);});
 it.each([[],Array(101).fill(position())])('POST Anzahl Positionen %j',async positionen=>{expect((await post({positionen})).status).toBe(400);});
 it('POST ungültige Bemerkung',async()=>{expect((await post({positionen:[position()],bemerkung:4})).status).toBe(400);});
 it.each([null,[],42])('POST ungültige Position %j',async p=>{expect((await post({positionen:[p]})).status).toBe(400);});
 it.each([0,-1,10001,1.5])('POST ungültige Menge %j',async menge=>{expect((await post({positionen:[position(aid,null,menge)]})).status).toBe(400);});
 it('POST doppelte Position',async()=>{expect((await post({positionen:[position(),position()]})).status).toBe(400);});
 it('POST unbekannter Artikel',async()=>{expect((await post({positionen:[position(bid)]})).status).toBe(409);});
 it('POST ohne Standardlieferant',async()=>{data.artikel=[{_id:new ObjectId(aid),name:'Ball',menge:1,hatGroessen:false}];expect((await post({positionen:[position()]})).status).toBe(409);});
 it('POST unterschiedliche Lieferanten',async()=>{data.artikel.push({_id:new ObjectId(bid),name:'Shirt',menge:2,hatGroessen:false,lieferantId:vid});data.lieferanten.push({_id:new ObjectId(vid),name:'Lieferant B'});expect((await post({positionen:[position(),position(bid)]})).status).toBe(400);});
 it('POST erstellt Reservebestellung',async()=>{const r=await post({positionen:[position()],bemerkung:'  Test  '});expect(r.status).toBe(201);expect(m.insertOne).toHaveBeenCalled();const doc=m.insertOne.mock.calls[0][0];expect(doc.positionen[0].lagerreserveMenge).toBe(3);expect(doc.bemerkung).toBe('Test');});
 it('POST berechnet ungedeckten Kundenbedarf',async()=>{data.vereinskleider_verkaeufe=[{positionen:[{...position(),artikelname:'Ball',verkaufsart:'bestellung'}]}];const r=await post({positionen:[position()]});expect(r.status).toBe(201);expect(m.insertOne.mock.calls[0][0].positionen[0].kundenbedarfMenge).toBe(3);});
 it('POST Datenbankfehler',async()=>{m.insertOne.mockRejectedValueOnce(new Error('DB'));expect((await post({positionen:[position()]})).status).toBe(500);});
});
