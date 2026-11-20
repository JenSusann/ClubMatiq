import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ObjectId} from 'mongodb';
const m=vi.hoisted(()=>({c:{} as Record<string,any>,permission:vi.fn(()=>null as Response|null),session:{withTransaction:vi.fn(async(fn:()=>Promise<unknown>)=>fn()),endSession:vi.fn(async()=>{})}}));
vi.mock('../../../../src/lib/server/mongodb',()=>({db:{collection:(n:string)=>m.c[n]},client:{startSession:()=>m.session}}));
vi.mock('../../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
const ID='507f1f77bcf86cd799439011', A='507f1f77bcf86cd799439012', B='507f1f77bcf86cd799439013', S='507f1f77bcf86cd799439014', V='507f1f77bcf86cd799439015';
const user={id:'u1',vereinId:V,rolle:'admin'};
const req=(x:unknown)=>new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)});
const unpack=async(p:Promise<Response>|Response)=>{const r=await p;const t=await r.text();return {status:r.status,body:t?JSON.parse(t):null}};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockReturnValue(null);m.session.withTransaction.mockImplementation(async(fn:()=>Promise<unknown>)=>fn());for(const k of Object.keys(m.c))delete m.c[k]});


const post=(x:unknown)=>unpack(route0.POST({locals:{benutzer:user},request:req(x)} as never));
const get=()=>unpack(route0.GET({locals:{benutzer:user}} as never));
const pos={artikelId:A,groesseId:null,menge:3};
function setup(opts:{artikel?:any[],varianten?:any[],verkaeufe?:any[],sammel?:any[],lieferanten?:any[]}={}){
 const find=(items:any[])=>vi.fn(()=>({project:()=>({toArray:async()=>items}),sort:()=>({toArray:async()=>items})}));
 m.c.vereinskleider_verkaeufe={find:find(opts.verkaeufe??[])};
 m.c.artikel={find:find(opts.artikel??[{_id:new ObjectId(A),name:'Trikot',menge:2,hatGroessen:false,lieferantId:S}])};
 m.c.artikelvarianten={find:find(opts.varianten??[])};
 m.c.vereinskleider_sammelbestellungen={find:find(opts.sammel??[]),insertOne:vi.fn(async()=>({insertedId:new ObjectId(ID)}))};
 m.c.lieferanten={find:find(opts.lieferanten??[{_id:new ObjectId(S),name:'Lieferant'}])};
}
import * as route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 39-sammelbestellungen.integration.test.ts
describe('Paket 39 – Sammelbestellungen Übersicht und Erstellung',()=>{
 it('Berechtigung GET',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await get()).status).toBe(403)});
 it('Berechtigung POST',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await post({positionen:[pos]})).status).toBe(403)});
 it.each([null,[],1,'x',{} ,{positionen:[]},{positionen:Array(101).fill(pos)},{positionen:[pos],bemerkung:3},{positionen:[pos],bemerkung:'x'.repeat(2001)}])('ungültige Eingabe %j',async x=>{expect((await post(x)).status).toBe(400)});
 it.each([null,[],3,{}, {artikelId:'bad',groesseId:null,menge:1},{artikelId:A,groesseId:'bad',menge:1},{artikelId:A,groesseId:null,menge:0},{artikelId:A,groesseId:null,menge:10001},{artikelId:A,groesseId:null,menge:1.5}])('ungültige Position %j',async p=>{expect((await post({positionen:[p]})).status).toBe(400)});
 it('doppelte Positionen',async()=>{expect((await post({positionen:[pos,pos]})).status).toBe(400)});
 it('leere Übersicht',async()=>{setup({artikel:[]});const r=await get();expect(r.status).toBe(200);expect(r.body.bedarf).toEqual([])});
 it('Bestand und Lieferant',async()=>{setup();const r=await get();expect(r.status).toBe(200);expect(r.body.bedarf[0]).toMatchObject({bestand:2,verfuegbar:1,lieferantId:S})});
 it('offene Bestellungen und unterwegs',async()=>{setup({verkaeufe:[{positionen:[{...pos,artikelname:'Trikot',verkaufsart:'bestellung',menge:7,uebergebenMenge:2}]}],sammel:[{_id:new ObjectId(ID),status:'bestellt',positionen:[{...pos,geliefertMenge:1}],erstelltAm:new Date(),aktualisiertAm:new Date(),bemerkung:''}]});const r=await get();expect(r.status).toBe(200);expect(r.body.bedarf[0]).toMatchObject({offen:5,bereitsInSammelbestellungen:2,nachbestellen:2});expect(r.body.sammelbestellungen[0].positionen[0].offenMenge).toBe(2)});
 it('ungültiger Bestand',async()=>{setup({artikel:[{_id:new ObjectId(A),name:'X',menge:-1,hatGroessen:false,lieferantId:S}]});expect((await get()).body.bedarf[0].bestand).toBeNull()});
 it('Grössenvariante',async()=>{setup({artikel:[{_id:new ObjectId(A),name:'X',hatGroessen:true,lieferantId:S}],varianten:[{artikelId:A,groesseId:B,menge:4}]});const r=await get();expect(r.body.bedarf[0]).toMatchObject({groesseId:B,bestand:4})});
 it('nicht bestellbar',async()=>{setup({artikel:[]});expect((await post({positionen:[pos]})).status).toBe(409)});
 it('ohne Standardlieferant',async()=>{setup({lieferanten:[]});expect((await post({positionen:[pos]})).status).toBe(409)});
 it('verschiedene Lieferanten',async()=>{setup({artikel:[{_id:new ObjectId(A),name:'A',menge:5,hatGroessen:false,lieferantId:S},{_id:new ObjectId(B),name:'B',menge:5,hatGroessen:false,lieferantId:ID}],lieferanten:[{_id:new ObjectId(S),name:'S'},{_id:new ObjectId(ID),name:'T'}]});expect((await post({positionen:[pos,{artikelId:B,groesseId:null,menge:1}]})).status).toBe(400)});
 it('erfolgreicher Entwurf',async()=>{setup();const r=await post({positionen:[pos],bemerkung:'  Hallo  '});expect(r.status).toBe(201);expect(r.body).toMatchObject({erfolg:true,id:ID,status:'entwurf',lieferantId:S});expect(m.c.vereinskleider_sammelbestellungen.insertOne).toHaveBeenCalledOnce()});
 it('Datenbankfehler GET',async()=>{setup();m.c.artikel.find.mockImplementation(()=>{throw Error('db')});expect((await get()).status).toBe(500)});
 it('Datenbankfehler POST',async()=>{setup();m.c.vereinskleider_sammelbestellungen.insertOne.mockRejectedValue(Error('db'));expect((await post({positionen:[pos]})).status).toBe(500)});
});

