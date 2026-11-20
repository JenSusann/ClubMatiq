import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ObjectId} from 'mongodb';
const m=vi.hoisted(()=>({c:{} as Record<string,any>,permission:vi.fn(()=>null as Response|null),session:{withTransaction:vi.fn(async(fn:()=>Promise<unknown>)=>fn()),endSession:vi.fn(async()=>{})}}));
vi.mock('../../../../src/lib/server/mongodb',()=>({db:{collection:(n:string)=>m.c[n]},client:{startSession:()=>m.session}}));
vi.mock('../../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
const ID='507f1f77bcf86cd799439011', A='507f1f77bcf86cd799439012', B='507f1f77bcf86cd799439013', S='507f1f77bcf86cd799439014', V='507f1f77bcf86cd799439015';
const user={id:'integration-user',vereinId:V,rolle:'admin'};
const req=(x:unknown)=>new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)});
const unpack=async(p:Promise<Response>|Response)=>{const r=await p;const t=await r.text();return {status:r.status,body:t?JSON.parse(t):null}};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockReturnValue(null);m.session.withTransaction.mockImplementation(async(fn:()=>Promise<unknown>)=>fn());for(const k of Object.keys(m.c))delete m.c[k]});


const input={vorgangId:ID,positionsIndex:0,menge:2};
const post=(x:unknown=input)=>unpack(route0.POST({locals:{benutzer:user},request:req(x)} as never));
function setup(p:any={artikelId:A,groesseId:null,menge:5,verkaufsart:'bestellung',uebergebenMenge:0,reserviertMenge:0},stock:any={menge:10,hatGroessen:false},reservations:any[]=[]){
 m.c.vereinskleider_verkaeufe={findOne:vi.fn(async()=>({positionen:[p]})),find:vi.fn(()=>({toArray:async()=>reservations})),updateOne:vi.fn(async()=>({modifiedCount:1}))};
 m.c.lagerbewegungen={insertOne:vi.fn(async()=>({insertedId:new ObjectId()}))};
 m.c.artikel={findOne:vi.fn(async()=>stock),updateOne:vi.fn(async()=>({modifiedCount:1}))};
 m.c.artikelvarianten={findOne:vi.fn(async()=>({menge:10})),updateOne:vi.fn(async()=>({modifiedCount:1}))};
}
import * as route0 from '../../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

// Ursprüngliche Datei: 41-bestellungsuebergabe.integration.test.ts
describe('Paket 41 – Bestellungsübergabe',()=>{
 it('Berechtigung',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await post()).status).toBe(403)});
 it.each([null,[],3,'x',{}, {...input,vorgangId:'bad'},{...input,positionsIndex:-1},{...input,positionsIndex:1.5},{...input,menge:0},{...input,menge:10001},{...input,menge:'2'}])('Validierung %j',async x=>{expect((await post(x)).status).toBe(400)});
 it('Vorgang fehlt',async()=>{setup();m.c.vereinskleider_verkaeufe.findOne.mockResolvedValue(null);expect((await post()).status).toBe(404)});
 it('Position fehlt',async()=>{setup();expect((await post({...input,positionsIndex:2})).status).toBe(400)});
 it('keine Bestellung',async()=>{setup({artikelId:A,groesseId:null,menge:5,verkaufsart:'direkt'});expect((await post()).status).toBe(400)});
 it('ungültige Artikel-ID',async()=>{setup({artikelId:'bad',groesseId:null,menge:5,verkaufsart:'bestellung'});expect((await post()).status).toBe(400)});
 it.each([{menge:0},{menge:1.5},{uebergebenMenge:-1},{uebergebenMenge:6},{reserviertMenge:-1},{reserviertMenge:6}])('inkonsistente Mengen %j',async patch=>{setup({artikelId:A,groesseId:null,menge:5,verkaufsart:'bestellung',uebergebenMenge:0,reserviertMenge:0,...patch});expect((await post()).status).toBe(409)});
 it('zu viele Stücke',async()=>{setup({artikelId:A,groesseId:null,menge:2,verkaufsart:'bestellung'});expect((await post({...input,menge:3})).status).toBe(409)});
 it('Artikel fehlt',async()=>{setup(undefined,null);expect((await post()).status).toBe(404)});
 it('Grössenzuordnung geändert',async()=>{setup(undefined,{menge:10,hatGroessen:true});expect((await post()).status).toBe(409)});
 it('ungültige Fremdreservierung',async()=>{setup(undefined,undefined,[{positionen:[{artikelId:A,groesseId:null,menge:2,verkaufsart:'bestellung',reserviertMenge:3}]}]);expect((await post()).status).toBe(409)});
 it('fremde Reservierung blockiert',async()=>{setup(undefined,{menge:3,hatGroessen:false},[{positionen:[{artikelId:A,groesseId:null,menge:4,verkaufsart:'bestellung',reserviertMenge:2}]}]);expect((await post()).status).toBe(409)});
 it('ungültiger Bestand',async()=>{setup(undefined,{menge:-1,hatGroessen:false});expect((await post()).status).toBe(409)});
 it('Artikelupdate Konflikt',async()=>{setup();m.c.artikel.updateOne.mockResolvedValue({modifiedCount:0});expect((await post()).status).toBe(409)});
 it('Vorgangsupdate Konflikt',async()=>{setup();m.c.vereinskleider_verkaeufe.updateOne.mockResolvedValue({modifiedCount:0});expect((await post()).status).toBe(409)});
 it('erfolgreiche Übergabe',async()=>{setup();const r=await post();expect(r.status).toBe(200);expect(r.body.uebergabe).toMatchObject({uebergeben:2,offen:3,status:'offen'});expect(m.session.endSession).toHaveBeenCalledOnce()});
 it('vollständige Übergabe',async()=>{setup({artikelId:A,groesseId:null,menge:2,verkaufsart:'bestellung'});expect((await post()).body.uebergabe.status).toBe('abgeschlossen')});
 it('Variante und Artikel werden aktualisiert',async()=>{setup({artikelId:A,groesseId:B,menge:5,verkaufsart:'bestellung'},{menge:10,hatGroessen:true});expect((await post()).status).toBe(200);expect(m.c.artikelvarianten.updateOne).toHaveBeenCalledOnce()});
 it('Variantenupdate Konflikt',async()=>{setup({artikelId:A,groesseId:B,menge:5,verkaufsart:'bestellung'},{menge:10,hatGroessen:true});m.c.artikelvarianten.updateOne.mockResolvedValue({modifiedCount:0});expect((await post()).status).toBe(409)});
 it('Datenbankfehler',async()=>{setup();m.c.artikel.findOne.mockRejectedValue(Error('db'));expect((await post()).status).toBe(500)});
});

