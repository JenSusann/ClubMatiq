import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ObjectId} from 'mongodb';
const m=vi.hoisted(()=>({c:{} as Record<string,any>,permission:vi.fn(()=>null as Response|null),session:{withTransaction:vi.fn(async(fn:()=>Promise<unknown>)=>fn()),endSession:vi.fn(async()=>{})}}));
vi.mock('../../../../src/lib/server/mongodb',()=>({db:{collection:(n:string)=>m.c[n]},client:{startSession:()=>m.session}}));
vi.mock('../../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));

import {PDFDocument} from 'pdf-lib';
import * as suite0_route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

describe('sammelbestellungen-status', () => {
const route0 = suite0_route0;
const ID='507f1f77bcf86cd799439011', A='507f1f77bcf86cd799439012', B='507f1f77bcf86cd799439013', S='507f1f77bcf86cd799439014', V='507f1f77bcf86cd799439015';
const user={id:'integration-user',vereinId:V,rolle:'admin'};
const req=(x:unknown)=>new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)});
const unpack=async(p:Promise<Response>|Response)=>{const r=await p;const t=await r.text();return {status:r.status,body:t?JSON.parse(t):null}};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockReturnValue(null);m.session.withTransaction.mockImplementation(async(fn:()=>Promise<unknown>)=>fn());for(const k of Object.keys(m.c))delete m.c[k]});


const pos={artikelId:A,groesseId:null,menge:3};
const patch=(x:unknown,id=ID)=>unpack(route0.PATCH({params:{id},locals:{benutzer:user},request:req(x)} as never));
function setup(status='entwurf',position:any={...pos,artikelname:'Trikot',geliefertMenge:0},kunden:any[]=[]){
 m.c.vereinskleider_sammelbestellungen={findOne:vi.fn(async()=>({status,positionen:[position]})),updateOne:vi.fn(async()=>({modifiedCount:1}))};
 m.c.vereinskleider_verkaeufe={find:vi.fn(()=>({sort:()=>({toArray:async()=>kunden})})),updateOne:vi.fn(async()=>({modifiedCount:1}))};
 m.c.lagerbewegungen={insertOne:vi.fn(async()=>({insertedId:new ObjectId()}))};
 m.c.artikel={updateOne:vi.fn(async()=>({matchedCount:1})),findOne:vi.fn(async()=>({menge:8}))};
 m.c.artikelvarianten={updateOne:vi.fn(async()=>({matchedCount:1})),findOne:vi.fn(async()=>({menge:8}))};
}


// Ursprüngliche Datei: 42-sammelbestellungen-status.integration.test.ts
describe('Paket 42 – Sammelbestellung Status und Wareneingang',()=>{
 it('Berechtigung',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await patch({aktion:'bestellen'})).status).toBe(403)});
 it('ungültige ID',async()=>{expect((await patch({aktion:'bestellen'},'bad')).status).toBe(400)});
 it.each([null,[],3,{}, {aktion:'andere'},{aktion:'wareneingang'},{aktion:'wareneingang',positionen:[]},{aktion:'wareneingang',positionen:Array(101).fill(pos)}])('ungültige Eingabe %j',async x=>{expect((await patch(x)).status).toBe(400)});
 it.each([null,[],4,{}, {artikelId:'bad',groesseId:null,menge:1},{artikelId:A,groesseId:'bad',menge:1},{artikelId:A,groesseId:null,menge:0},{artikelId:A,groesseId:null,menge:10001},{artikelId:A,groesseId:null,menge:1.5}])('ungültige Wareneingangsposition %j',async x=>{expect((await patch({aktion:'wareneingang',positionen:[x]})).status).toBe(400)});
 it('doppelte Wareneingangsposition',async()=>{expect((await patch({aktion:'wareneingang',positionen:[pos,pos]})).status).toBe(400)});
 it('Bestellung fehlt',async()=>{setup();m.c.vereinskleider_sammelbestellungen.findOne.mockResolvedValue(null);expect((await patch({aktion:'bestellen'})).status).toBe(404)});
 it('nur Entwurf bestellbar',async()=>{setup('bestellt');expect((await patch({aktion:'bestellen'})).status).toBe(409)});
 it('Bestellung erfolgreich',async()=>{setup();const r=await patch({aktion:'bestellen'});expect(r.status).toBe(200);expect(r.body.status).toBe('bestellt')});
 it('Bestellstatus Konflikt',async()=>{setup();m.c.vereinskleider_sammelbestellungen.updateOne.mockResolvedValue({modifiedCount:0});expect((await patch({aktion:'bestellen'})).status).toBe(409)});
 it('Wareneingang nur für bestellte',async()=>{setup();expect((await patch({aktion:'wareneingang',positionen:[pos]})).status).toBe(409)});
 it('unbekannte Lieferposition',async()=>{setup('bestellt');expect((await patch({aktion:'wareneingang',positionen:[{...pos,artikelId:B}]})).status).toBe(409)});
 it('Überlieferung',async()=>{setup('bestellt');expect((await patch({aktion:'wareneingang',positionen:[{...pos,menge:4}]})).status).toBe(409)});
 it('Artikel fehlt beim Zubuchen',async()=>{setup('bestellt');m.c.artikel.updateOne.mockResolvedValue({matchedCount:0});expect((await patch({aktion:'wareneingang',positionen:[pos]})).status).toBe(409)});
 it('Variantenupdate fehlt',async()=>{setup('bestellt',{...pos,groesseId:B,artikelname:'Trikot'});m.c.artikelvarianten.updateOne.mockResolvedValue({matchedCount:0});expect((await patch({aktion:'wareneingang',positionen:[{...pos,groesseId:B}]})).status).toBe(409)});
 it('Bestand ungültig',async()=>{setup('bestellt');m.c.artikel.findOne.mockResolvedValue({menge:-1});expect((await patch({aktion:'wareneingang',positionen:[pos]})).status).toBe(409)});
 it('inkonsistente Kundenreservierung',async()=>{setup('bestellt',undefined,[{_id:new ObjectId(B),positionen:[{artikelId:A,groesseId:null,verkaufsart:'bestellung',menge:2,reserviertMenge:3}]}]);expect((await patch({aktion:'wareneingang',positionen:[pos]})).status).toBe(409)});
 it('Kundenreservierung Updatekonflikt',async()=>{setup('bestellt',undefined,[{_id:new ObjectId(B),positionen:[{artikelId:A,groesseId:null,verkaufsart:'bestellung',menge:5,reserviertMenge:0}]}]);m.c.vereinskleider_verkaeufe.updateOne.mockResolvedValue({modifiedCount:0});expect((await patch({aktion:'wareneingang',positionen:[pos]})).status).toBe(409)});
 it('vollständiger Wareneingang',async()=>{setup('bestellt');const r=await patch({aktion:'wareneingang',positionen:[pos]});expect(r.status).toBe(200);expect(r.body).toMatchObject({status:'geliefert',vollstaendig:true})});
 it('Teillieferung',async()=>{setup('bestellt');const r=await patch({aktion:'wareneingang',positionen:[{...pos,menge:1}]});expect(r.status).toBe(200);expect(r.body).toMatchObject({status:'bestellt',vollstaendig:false})});
 it('Kundenreservierung erfolgreich',async()=>{setup('bestellt',undefined,[{_id:new ObjectId(B),positionen:[{artikelId:A,groesseId:null,verkaufsart:'bestellung',menge:5,reserviertMenge:0}]}]);const r=await patch({aktion:'wareneingang',positionen:[pos]});expect(r.status).toBe(200);expect(r.body.zuordnungen[0]).toMatchObject({vorgangId:B,menge:3})});
 it('Wareneingang Updatekonflikt',async()=>{setup('bestellt');m.c.vereinskleider_sammelbestellungen.updateOne.mockResolvedValue({modifiedCount:0});expect((await patch({aktion:'wareneingang',positionen:[pos]})).status).toBe(409)});
 it('Datenbankfehler und Sessionende',async()=>{setup();m.c.vereinskleider_sammelbestellungen.findOne.mockRejectedValue(Error('db'));expect((await patch({aktion:'bestellen'})).status).toBe(500);expect(m.session.endSession).toHaveBeenCalledOnce()});
});


});
import * as suite1_route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

describe('sammelbestellungen-ergaenzung-weitere', () => {
const route0 = suite1_route0;
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


});
import * as suite2_route0 from '../../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

describe('bestellungsuebergabe', () => {
const route0 = suite2_route0;
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


});
import * as suite3_route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

describe('verrechnung-pdf', () => {
const route0 = suite3_route0;
const ID='507f1f77bcf86cd799439011', A='507f1f77bcf86cd799439012', B='507f1f77bcf86cd799439013', S='507f1f77bcf86cd799439014', V='507f1f77bcf86cd799439015';
const user={id:'u1',vereinId:V,rolle:'admin'};
const req=(x:unknown)=>new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)});
const unpack=async(p:Promise<Response>|Response)=>{const r=await p;const t=await r.text();return {status:r.status,body:t?JSON.parse(t):null}};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockReturnValue(null);m.session.withTransaction.mockImplementation(async(fn:()=>Promise<unknown>)=>fn());for(const k of Object.keys(m.c))delete m.c[k]});



const invoice=()=>({_id:new ObjectId(ID),vereinId:V,rechnungsnummer:'R-2026-001',empfaenger:'Test Person',riegen:['Aktive'],positionen:[{artikelname:'Shirt',groesseId:null,menge:2,einzelpreis:10,positionsbetrag:20}],zwischentotal:20,rabattTotal:0,gesamtbetrag:20,bezahltBetrag:0,erstelltAm:new Date('2026-11-01'),status:'offen',zahlungsart:'rechnung'});
const credit=()=>({gutschriftnummer:'G-2026-1',rechnungsnummer:'R-2026-001',artikelname:'Shirt',groesseId:null,menge:1,einzelpreis:10,betrag:10,grund:'Rückgabe',erstelltAm:new Date('2026-11-02')});
const get=(query='',id=ID)=>route0.GET({params:{id},locals:{benutzer:user},url:new URL('http://localhost/api?'+query)} as never);
function setup(r:any=invoice(),g:any=credit()){
 m.c.vereinskleider_rechnungen={findOne:vi.fn(async()=>r)};
 m.c.vereinskleider_gutschriften={findOne:vi.fn(async()=>g)};
 m.c.vereine={findOne:vi.fn(async()=>({name:'Turnverein Test'}))};
 m.c.groessen={findOne:vi.fn(async()=>({bezeichnung:'M'})),find:vi.fn(()=>({toArray:async()=>[{_id:new ObjectId(B),bezeichnung:'M'}]}))};
}
async function pdf(p:Response | Promise<Response>){const r=await p;expect(r.status).toBe(200);expect(r.headers.get('Content-Type')).toBe('application/pdf');const bytes=new Uint8Array(await r.arrayBuffer());expect(bytes.length).toBeGreaterThan(300);expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);return r;}


// Ursprüngliche Datei: 40-verrechnung-pdf.integration.test.ts
describe('Paket 40 – Rechnungs- und Gutschriften-PDF',()=>{
 it('Berechtigung',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await get()).status).toBe(403)});
 it('ungültige Rechnungs-ID',async()=>{expect((await get('','bad')).status).toBe(400)});
 it('Rechnung fehlt',async()=>{setup(null);expect((await get()).status).toBe(404)});
 it('ungültige Gutschrift-ID',async()=>{setup();expect((await get('gutschriftId=bad')).status).toBe(400)});
 it('Gutschrift fehlt',async()=>{setup(invoice(),null);expect((await get('gutschriftId='+B)).status).toBe(404)});
 it('offene Rechnung',async()=>{setup();await pdf(get())});
 it('bezahlte TWINT-Quittung',async()=>{setup({...invoice(),bezahltBetrag:20,status:'bezahlt',zahlungsart:'twint'});const r=await pdf(get());expect(r.headers.get('Content-Disposition')).toContain('Quittung')});
 it('bezahlte Bar-Quittung',async()=>{setup({...invoice(),bezahltBetrag:20,status:'bezahlt',zahlungsart:'bar'});await pdf(get())});
 it('bezahlte Überweisung',async()=>{setup({...invoice(),bezahltBetrag:20,status:'bezahlt',zahlungsart:'rechnung'});await pdf(get())});
 it('teilweise bezahlt',async()=>{setup({...invoice(),bezahltBetrag:5,status:'teilweise_bezahlt'});await pdf(get())});
 it('stornierte Rechnung',async()=>{setup({...invoice(),status:'storniert'});await pdf(get())});
 it('Rückerstattung offen',async()=>{setup({...invoice(),bezahltBetrag:20,gutgeschriebenBetrag:10});await pdf(get())});
 it('Rabatte und Zahlungen',async()=>{setup({...invoice(),rabatte:[{name:'Rabatt',betrag:2}],zusaetzlicherRabatt:1,zahlungen:[{betrag:5,datum:'2026-11-02',zahlungsart:'twint'},{betrag:0,datum:'bad',zahlungsart:'bar'}]});await pdf(get())});
 it('Grössenbezeichnung',async()=>{setup({...invoice(),positionen:[{artikelname:'Trikot',groesseId:B,menge:1,einzelpreis:20,positionsbetrag:20}]});await pdf(get())});
 it('mehrseitiges PDF',async()=>{setup({...invoice(),positionen:Array.from({length:70},(_,i)=>({artikelname:'Artikel '+i,groesseId:null,menge:1,einzelpreis:1,positionsbetrag:1}))});const r=await get();expect(r.status).toBe(200);expect((await PDFDocument.load(new Uint8Array(await r.arrayBuffer()))).getPageCount()).toBeGreaterThan(1)});
 it('Gutschrift ohne Grösse',async()=>{setup();const r=await pdf(get('gutschriftId='+B));expect(r.headers.get('Content-Disposition')).toContain('Gutschrift')});
 it('Gutschrift mit Grösse',async()=>{setup(invoice(),{...credit(),groesseId:B});await pdf(get('gutschriftId='+B))});
 it('Gutschrift ohne Vereinsnamen',async()=>{setup();m.c.vereine.findOne.mockResolvedValue(null);await pdf(get('gutschriftId='+B))});
 it('lange Gutschriftbegründung',async()=>{setup(invoice(),{...credit(),grund:'Sehr lange Begründung '.repeat(30)});await pdf(get('gutschriftId='+B))});
 it('Datenbankfehler',async()=>{setup();m.c.vereinskleider_rechnungen.findOne.mockRejectedValue(Error('db'));expect((await get()).status).toBe(500)});
});


});
