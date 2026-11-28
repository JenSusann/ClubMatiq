import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m=vi.hoisted(()=>({collection:vi.fn(),permission:vi.fn(),countDocuments:vi.fn(),insertOne:vi.fn(),findOneAndUpdate:vi.fn(),find:vi.fn(),sort:vi.fn(),toArray:vi.fn()}));
vi.mock('../../src/lib/server/mongodb',()=>({db:{collection:m.collection}}));
vi.mock('../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
import { GET, POST, PUT } from '../../src/routes/api/rabatte/+server';
const id=new ObjectId().toHexString();
const basis={name:'Rabatt',rabattart:'betrag',wert:5,geltungsbereich:'warenkorb'};
const locals={benutzer:{id:'admin',vereinId:'verein-a'}};
const event=(method:string,body?:unknown)=>({locals,request:new Request('http://localhost',{method,...(body===undefined?{}:{body:JSON.stringify(body)})})} as never);
beforeEach(()=>{vi.resetAllMocks();m.collection.mockReturnValue(m);m.permission.mockReturnValue(null);m.countDocuments.mockResolvedValue(1);m.insertOne.mockResolvedValue({insertedId:new ObjectId(id)});m.find.mockReturnValue(m);m.sort.mockReturnValue(m);vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
describe('Rabatte – Randfälle',()=>{
 it.each([{name:42},{artikelIds:Array(201).fill(id)},{kategorieIds:[42]},{riegen:Array(51).fill('TV')},{riegen:['x'.repeat(101)]},{maximaleMenge:1.5},{einmaligProMitglied:'ja'},{anspruchsgruppe:42},{anspruchsgruppe:'gruppe'},{gueltigAb:42},{gueltigBis:'2026-02-30'},{kombinierbar:0},{aktiv:1}])('verweigert ungültige Regel %#',async patch=>{
  expect((await POST(event('POST',{...basis,...patch}))).status).toBe(400);
  expect(m.collection).not.toHaveBeenCalled();
 });
 it('akzeptiert gültigen Schalttag, Dezimalbetrag und dedupliziert Zuordnungen',async()=>{
  const res=await POST(event('POST',{...basis,wert:0.29,geltungsbereich:'artikel',artikelIds:[id,id],riegen:[' TV ','TV'],gueltigAb:'2028-02-29',gueltigBis:'2028-02-29'}));
  expect(res.status).toBe(201);
  expect(m.countDocuments).toHaveBeenCalledWith({vereinId:'verein-a',_id:{$in:[new ObjectId(id)]}});
  expect(await res.json()).toMatchObject({artikelIds:[id],riegen:['TV'],wert:0.29,gueltigAb:'2028-02-29'});
 });
 it('normalisiert Anspruchsgruppe und erhält explizite Statuswerte',async()=>{
  const res=await POST(event('POST',{...basis,rabattart:'fixpreis',geltungsbereich:'kategorie',kategorieIds:[id],einmaligProMitglied:true,maximaleMenge:1,anspruchsgruppe:' Erst_Bezug ',aktiv:false,kombinierbar:true}));
  expect(res.status).toBe(201);
  expect(await res.json()).toMatchObject({anspruchsgruppe:'erst_bezug',aktiv:false,kombinierbar:true});
 });
 it('liefert Standardwerte für historische Regeln',async()=>{
  m.toArray.mockResolvedValue([{_id:new ObjectId(id),...basis}]);
  expect(await (await GET(event('GET'))).json()).toEqual([{_id:id,...basis,artikelIds:[],kategorieIds:[],riegen:[],maximaleMenge:null,gueltigAb:null,gueltigBis:null,einmaligProMitglied:false,kombinierbar:false,aktiv:true}]);
 });
 it('entfernt alte Anspruchsgruppe bei Umstellung auf normalen Rabatt',async()=>{
  m.findOneAndUpdate.mockResolvedValue({_id:new ObjectId(id),...basis});
  expect((await PUT(event('PUT',{...basis,_id:id}))).status).toBe(200);
  expect(m.findOneAndUpdate).toHaveBeenCalledWith({_id:new ObjectId(id),vereinId:'verein-a'},expect.objectContaining({$unset:{anspruchsgruppe:''}}),{returnDocument:'after'});
 });
 it('meldet Fehler bei Aktualisierung ohne interne Details',async()=>{
  m.findOneAndUpdate.mockRejectedValue(new Error('intern'));
  const res=await PUT(event('PUT',{...basis,_id:id}));
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({fehler:'Rabattregel konnte nicht aktualisiert werden.'});
 });
});
