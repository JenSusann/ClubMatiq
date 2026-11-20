/** Gemeinsame Testhilfen: Ereignisse, Testdaten und optionale In-Memory-Mocks.
 * WICHTIG: Mock-Registrierung erfolgt ausschliesslich in den betroffenen Testdateien,
 * damit Integrationstests mit echter Testdatenbank nicht beeinflusst werden.
 */
import { vi } from 'vitest';
import { ObjectId } from 'mongodb';
export const ID='507f1f77bcf86cd799439011';
export const ART='507f191e810c19729de860ea';
export const SIZE='507f1f77bcf86cd799439012';
const hoistedMocks=vi.hoisted(()=>({
 findOne:vi.fn(), find:vi.fn(), updateOne:vi.fn(), insertOne:vi.fn(),
 toArray:vi.fn(), sort:vi.fn(), withTransaction:vi.fn(), endSession:vi.fn(),
 collection:vi.fn(), permission:vi.fn(()=>null)
}));
export const m = hoistedMocks;
export const docs={inventuren:[] as any[],inventurpositionen:[] as any[],inventurprotokoll:[] as any[],artikel:[] as any[],artikelvarianten:[] as any[],vereinskleider_sammelbestellungen:[] as any[],vereinskleider_verkaeufe:[] as any[]};
let updates:Record<string,any>={};
export function reset(){
 vi.clearAllMocks();updates={};
 for(const k of Object.keys(docs)) (docs as any)[k]=[];
 m.withTransaction.mockImplementation(async(fn:any)=>fn());
 m.endSession.mockResolvedValue(undefined);
 m.collection.mockImplementation((name:string)=>({
 findOne:vi.fn(async()=> (docs as any)[name]?.[0]??null),
 find:vi.fn(()=>({sort:()=>({toArray:async()=> (docs as any)[name]??[]}),toArray:async()=> (docs as any)[name]??[]})),
 updateOne:vi.fn(async(...args:any[])=>{(updates[name]??=[]).push(args);return {modifiedCount:1,matchedCount:1}}),
 insertOne:vi.fn(async()=>({insertedId:new ObjectId()}))
 }));
}
export function ev(body:any,id=ID){return {params:{id},locals:{benutzer:{id:ID,vereinId:ID,rolle:'admin'}},request:new Request('http://localhost/api/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})};}
export function inventory(status='abgeschlossen',extra:any={}){docs.inventuren=[{_id:new ObjectId(ID),status,version:1,...extra}];}
export function position(extra:any={}){return {_id:new ObjectId(SIZE),artikelId:ART,groesseId:null,sollBestand:10,istBestand:8,...extra};}
export function order(status='bestellt',extra:any={}){docs.vereinskleider_sammelbestellungen=[{_id:new ObjectId(ID),status,positionen:[{artikelId:ART,groesseId:null,artikelname:'Ball',menge:5,geliefertMenge:0}],...extra}];}

// Hilfen für Tests mit clubmatiq_test
export const vereinId = new ObjectId().toString();
export const fremderVerein = new ObjectId().toString();
export const benutzer = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
export const oid = () => new ObjectId();
export const jsonRequest = (data: unknown) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
export function event(data: unknown, id?: string) { return { request: jsonRequest(data), params: { id: id ?? oid().toString() }, locals: { benutzer } } as any; }
export function assertTestDb(db: { databaseName: string }) { if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: Datenbank ist nicht clubmatiq_test'); }
export const suffix = () => new ObjectId().toString();
