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


const pos={artikelId:A,groesseId:null,menge:3};
const patch=(x:unknown,id=ID)=>unpack(route0.PATCH({params:{id},locals:{benutzer:user},request:req(x)} as never));
function setup(status='entwurf',position:any={...pos,artikelname:'Trikot',geliefertMenge:0},kunden:any[]=[]){
 m.c.vereinskleider_sammelbestellungen={findOne:vi.fn(async()=>({status,positionen:[position]})),updateOne:vi.fn(async()=>({modifiedCount:1}))};
 m.c.vereinskleider_verkaeufe={find:vi.fn(()=>({sort:()=>({toArray:async()=>kunden})})),updateOne:vi.fn(async()=>({modifiedCount:1}))};
 m.c.lagerbewegungen={insertOne:vi.fn(async()=>({insertedId:new ObjectId()}))};
 m.c.artikel={updateOne:vi.fn(async()=>({matchedCount:1})),findOne:vi.fn(async()=>({menge:8}))};
 m.c.artikelvarianten={updateOne:vi.fn(async()=>({matchedCount:1})),findOne:vi.fn(async()=>({menge:8}))};
}
import * as route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

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

