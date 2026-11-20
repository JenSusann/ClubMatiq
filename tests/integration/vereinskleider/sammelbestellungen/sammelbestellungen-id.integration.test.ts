import { beforeEach, describe, expect, it, vi } from 'vitest';
const A='aaaaaaaaaaaaaaaaaaaaaaaa', B='bbbbbbbbbbbbbbbbbbbbbbbb';
const mock=vi.hoisted(()=>({doc:null as any,updates:[] as any[],fail:false}));
vi.mock('../../../../src/lib/server/mongodb',()=>({
  client:{startSession:()=>({withTransaction:async(fn:()=>Promise<void>)=>{await fn();},endSession:async()=>{}})},
  db:{collection:(name:string)=>({findOne:async()=>mock.fail?Promise.reject(Error('DB down')):mock.doc,updateOne:async(...args:any[])=>{mock.updates.push([name,...args]);return {matchedCount:1,modifiedCount:1};},find:()=>{const chain:any={sort:()=>chain,toArray:async()=>[]};return chain;}})}
}));
vi.mock('../../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:()=>null}));
import {PATCH} from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';
const locals={benutzer:{vereinId:A}} as any;
const call=(aktion:string,positionen?:any,id=B)=>PATCH({locals,params:{id},request:new Request('http://localhost',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({aktion,...(positionen===undefined?{}:{positionen})})})} as any);
const pos=(override={})=>({artikelId:B,groesseId:null,menge:1,...override});
beforeEach(()=>{mock.doc={status:'entwurf',positionen:[pos({menge:3})]};mock.updates=[];mock.fail=false;vi.spyOn(console,'error').mockImplementation(()=>{});});
describe('P15 Sammelbestellung nach ID: Status und Wareneingang',()=>{
  it('400 bei ungueltiger ID',async()=>{expect((await call('bestellen',undefined,'x')).status).toBe(400);});
  it('400 bei unbekannter Aktion',async()=>{expect((await call('loeschen')).status).toBe(400);});
  it.each([[],Array.from({length:101},()=>pos())])('400 bei ungueltiger Wareneingangsanzahl',async positionen=>{expect((await call('wareneingang',positionen)).status).toBe(400);});
  it.each([[pos({artikelId:'bad'})],[pos({menge:0})],[pos({menge:10001})],[pos(),pos()]])('400 bei ungueltiger Wareneingangsposition',async positionen=>{expect((await call('wareneingang',positionen)).status).toBe(400);});
  it('404 bei fehlender Bestellung',async()=>{mock.doc=null;expect((await call('bestellen')).status).toBe(404);});
  it('409 wenn bereits bestellt',async()=>{mock.doc.status='bestellt';expect((await call('bestellen')).status).toBe(409);});
  it('markiert Entwurf erfolgreich als bestellt',async()=>{const r=await call('bestellen');expect(r.status).toBe(200);expect((await r.json()).status).toBe('bestellt');expect(mock.updates.length).toBe(1);});
  it('409 bei Wareneingang im Entwurf',async()=>{expect((await call('wareneingang',[pos()])).status).toBe(409);});
  it('409 bei unbekannter Lieferposition',async()=>{mock.doc.status='bestellt';expect((await call('wareneingang',[pos({artikelId:A})])).status).toBe(409);});
  it('409 bei zu hoher Lieferung',async()=>{mock.doc.status='bestellt';expect((await call('wareneingang',[pos({menge:4})])).status).toBe(409);});
  it('500 bei Datenbankfehler',async()=>{mock.fail=true;expect((await call('bestellen')).status).toBe(500);});
});
