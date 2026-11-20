import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m=vi.hoisted(()=>({collection:vi.fn(),find:vi.fn(),project:vi.fn(),toArray:vi.fn(),findOne:vi.fn()}));
vi.mock('../../../../src/lib/server/mongodb',()=>({db:{collection:m.collection}}));
import { POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
const id=new ObjectId().toHexString(), id2=new ObjectId().toHexString(), aid=new ObjectId().toHexString(), sid=new ObjectId().toHexString(), vid=new ObjectId().toHexString();
const benutzer={id:aid,vereinId:vid,rolle:'admin'};
const post=(body:unknown)=>POST({locals:{benutzer},request:new Request('http://localhost/api/vereinskleider/sammelbestellungen/pdf',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})} as never);
const doc=(idValue=id)=>({_id:new ObjectId(idValue),lieferantId:sid,positionen:[{artikelId:aid,groesseId:null,artikelname:'Ball',menge:2}],erstelltAm:new Date()});
let docs:ReturnType<typeof doc>[];
beforeEach(()=>{vi.resetAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{});docs=[doc()];m.collection.mockImplementation((name:string)=>({find:()=>({toArray:()=>Promise.resolve(name==='vereinskleider_sammelbestellungen'?docs:[]),project:()=>({toArray:()=>Promise.resolve([])})}),findOne:()=>Promise.resolve(name==='lieferanten'?{name:'Lieferant'}:name==='vereine'?{name:'Turnverein'}:null)}));});
async function status(body:unknown){try{return (await post(body)).status}catch(e){return (e as {status?:number}).status}}
describe('Paket 7 – Sammelbestellungen Gesamt-PDF',()=>{
 it.each([null,[],3])('ungültiger Body %j',async body=>{expect(await status(body)).toBe(400);});
 it.each([[],['ungültig'],Array(51).fill(id),[id,id]])('ungültige Auswahl %j',async bestellungIds=>{expect(await status({bestellungIds})).toBe(400);});
 it('fehlende Bestellung',async()=>{docs=[];expect(await status({bestellungIds:[id]})).toBe(404);});
 it('unterschiedliche Lieferanten',async()=>{docs=[doc(),{...doc(id2),lieferantId:id2}];expect(await status({bestellungIds:[id,id2]})).toBe(409);});
 it('fehlender Lieferant',async()=>{m.collection.mockImplementation((name:string)=>({find:()=>({toArray:()=>Promise.resolve(name==='vereinskleider_sammelbestellungen'?docs:[])}),findOne:()=>Promise.resolve(null)}));expect(await status({bestellungIds:[id]})).toBe(409);});
 it('leere Positionen',async()=>{docs=[{...doc(),positionen:[]}];expect(await status({bestellungIds:[id]})).toBe(409);});
 it('ungültige Positionsmenge',async()=>{docs=[{...doc(),positionen:[{artikelId:aid,groesseId:null,artikelname:'Ball',menge:0}]}];expect(await status({bestellungIds:[id]})).toBe(409);});
 it('erstellt PDF für eine Bestellung',async()=>{const r=await post({bestellungIds:[id]});expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('application/pdf');expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100);});
 it('gruppiert Positionen aus zwei Bestellungen',async()=>{docs=[doc(),doc(id2)];const r=await post({bestellungIds:[id,id2]});expect(r.status).toBe(200);});
 it('Datenbankfehler wird 500',async()=>{m.collection.mockImplementation(()=>{throw new Error('DB')});expect(await status({bestellungIds:[id]})).toBe(500);});
});
