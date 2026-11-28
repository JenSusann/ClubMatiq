import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m=vi.hoisted(()=>({permission:vi.fn(),startSession:vi.fn(),withTransaction:vi.fn(),endSession:vi.fn(),collection:vi.fn(),findOne:vi.fn(),updateOne:vi.fn(),insertOne:vi.fn(),journal:vi.fn()}));
vi.mock('../../../src/lib/server/mongodb',()=>({db:{collection:m.collection},client:{startSession:m.startSession}}));
vi.mock('../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
vi.mock('../../../src/lib/server/lagerbewegungen',()=>({protokolliereLagerbewegung:m.journal}));
import { POST } from '../../../src/routes/api/vereinskleider/+server';
const artikelId=new ObjectId().toString();
const groesseId=new ObjectId().toString();
const position={artikelId,groesseId:null,menge:1};
const basis={verkaufsart:'bestellung',kaeufer:'Test',zahlungsart:'rechnung',riegen:['TV'],positionen:[position]};
const call=(body:unknown)=>POST({locals:{benutzer:{id:'test',vereinId:'verein-a'}},request:new Request('http://localhost',{method:'POST',body:JSON.stringify(body)})} as never);
beforeEach(()=>{
 vi.resetAllMocks();
 m.permission.mockReturnValue(null);
 m.collection.mockReturnValue(m);
 m.startSession.mockReturnValue({withTransaction:m.withTransaction,endSession:m.endSession});
 m.withTransaction.mockImplementation(async(fn)=>fn());
});
describe('Verkauf – Validierungsgrenzen',()=>{
 it.each([{kaeufer:' '.repeat(3)},{kaeufer:'x'.repeat(201)},{zahlungErhalten:'ja'},{zahlungErhalten:true},{bemerkung:42},{bemerkung:'x'.repeat(2001)},{riegen:[' ']},{riegen:['x'.repeat(101)]},{riegen:Array(31).fill('TV')},{positionen:Array(101).fill(position)},{mitgliedId:42},{rabattIds:[artikelId,artikelId]},{rabattIds:Array(31).fill(artikelId)},{zusaetzlicherRabatt:0.001},{zusaetzlicherRabatt:-1}])('verweigert ungültige Verkaufsdaten %#',async patch=>{
  expect((await call({...basis,...patch})).status).toBe(400);
  expect(m.startSession).not.toHaveBeenCalled();
 });
 it.each([{groesseId:undefined},{groesseId:42},{menge:10001},{menge:0.5},{einzelpreis:0.001},{einzelpreis:-1},{preisOffen:'ja'}])('verweigert ungültige Position %#',async patch=>{
  expect((await call({...basis,positionen:[{...position,...patch}]})).status).toBe(400);
  expect(m.startSession).not.toHaveBeenCalled();
 });
});
describe('Verkauf – Artikel- und Preisprüfung',()=>{
 const artikel={name:'Shirt',istVereinskleidung:true,hatGroessen:false};
 it.each([{doc:null,status:404},{doc:{...artikel,archiviert:true},status:409},{doc:{...artikel,istVereinskleidung:false},status:400},{doc:{...artikel,hatGroessen:true},status:400}])('verweigert nicht verkaufbaren Artikel %#',async({doc,status})=>{
  m.findOne.mockResolvedValueOnce(doc);
  expect((await call(basis)).status).toBe(status);
  expect(m.findOne).toHaveBeenCalledWith({_id:new ObjectId(artikelId),vereinId:'verein-a'},expect.anything());
  expect(m.updateOne).not.toHaveBeenCalled();
  expect(m.endSession).toHaveBeenCalledOnce();
 });
 it('verweigert fehlende Variante',async()=>{
  m.findOne.mockResolvedValueOnce({...artikel,hatGroessen:true}).mockResolvedValueOnce(null);
  expect((await call({...basis,positionen:[{...position,groesseId}]})).status).toBe(400);
  expect(m.insertOne).not.toHaveBeenCalled();
 });
 it('verweigert fehlenden Verkaufspreis',async()=>{
  m.findOne.mockResolvedValueOnce(artikel).mockResolvedValueOnce(null);
  expect((await call(basis)).status).toBe(400);
 });
 it('verweigert manuellen Ersatzpreis bei offenem Preis',async()=>{
  m.findOne.mockResolvedValueOnce(artikel).mockResolvedValueOnce({preisOffen:true});
  expect((await call({...basis,positionen:[{...position,einzelpreis:10}]})).status).toBe(409);
 });
 it('verweigert Direktverkauf bei offenem Preis',async()=>{
  m.findOne.mockResolvedValueOnce(artikel).mockResolvedValueOnce({preisOffen:true});
  expect((await call({...basis,verkaufsart:'direkt'})).status).toBe(409);
 });
 it('verweigert fehlendes Mitglied vor Artikelprüfung',async()=>{
  m.findOne.mockResolvedValueOnce(null);
  expect((await call({...basis,mitgliedId:artikelId})).status).toBe(409);
  expect(m.findOne).toHaveBeenCalledTimes(1);
 });
});
