import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';
const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
function ev(user: unknown, body: unknown = {}, id?: string) {
  return { locals: { benutzer: user }, params: { id }, request: new Request('http://localhost/api/test', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}) };
}
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank!'); await client.connect(); });
afterAll(async () => { await client.close(); });
import { POST as artikelPOST } from '../../../src/routes/api/artikel/+server';
import { GET as artikelGET, PATCH as artikelPATCH } from '../../../src/routes/api/artikel/[id]/+server';
import { POST as ausleihenPOST } from '../../../src/routes/api/ausleihen/+server';
import { POST as rueckgabePOST } from '../../../src/routes/api/ausleihen/[id]/rueckgabe/+server';
const kategorieId=new ObjectId(), lagerortId=new ObjectId(), groesseS=new ObjectId(), groesseM=new ObjectId();
let artikelId='', ausleiheId='';
const payload=()=>({name:'Test Trainerjacke',kategorieId:kategorieId.toString(),lagerortId:lagerortId.toString(),einzelwert:0,mindestbestand:0,hatGroessen:true,istVereinskleidung:true,varianten:[{groesseId:groesseS.toString(),menge:5,einzelwert:40,mindestbestand:1},{groesseId:groesseM.toString(),menge:3,einzelwert:45,mindestbestand:1}]});
describe('Vereinskleider – Grössen und Ausleihen',()=>{
  beforeAll(async()=>{
    await db.collection('kategorien').insertOne({_id:kategorieId,vereinId,name:'Kleider Test'});
    await db.collection('lagerorte').insertOne({_id:lagerortId,vereinId,name:'Lager Test'});
    await db.collection('groessen').insertMany([{_id:groesseS,vereinId,bezeichnung:'S',sortierung:1},{_id:groesseM,vereinId,bezeichnung:'M',sortierung:2}]);
  });
  afterAll(async()=>{
    for(const name of ['ausleihen','artikelvarianten','artikel','kategorien','lagerorte','groessen']) await db.collection(name).deleteMany({vereinId});
  });
  it('erstellt Vereinskleidung mit zwei Grössen',async()=>{
    const r=await artikelPOST(ev(admin,payload()) as never);
    expect(r.status).toBe(201);
    const data=await r.json(); artikelId=data.artikelId;
    expect(data.gesamtmenge).toBe(8);
  });
  it('liefert beide Grössen und Einzelwerte',async()=>{
    const r=await artikelGET(ev(admin,{},artikelId) as never);
    expect(r.status).toBe(200);
    const data=await r.json();
    expect(data.varianten).toHaveLength(2);
    expect(data.varianten.find((v:{groesseId:string})=>v.groesseId===groesseS.toString())).toMatchObject({menge:5,einzelwert:40});
  });
  it('verhindert doppelte Grössen',async()=>{
    const daten=payload(); daten.varianten[1].groesseId=groesseS.toString();
    const r=await artikelPOST(ev(admin,daten) as never);
    expect(r.status).toBe(400);
  });
  it('verhindert fremde Grössen',async()=>{
    const daten=payload(); daten.varianten[1].groesseId=new ObjectId().toString();
    const r=await artikelPOST(ev(admin,daten) as never);
    expect(r.status).toBe(400);
  });
  it('leiht Grösse S aus und aktualisiert Gesamtbestand',async()=>{
    const r=await ausleihenPOST(ev(admin,{artikelId,groesseId:groesseS.toString(),person:'Testperson',menge:2,ausleihdatum:'2026-11-19',rueckgabedatum:'2026-11-26'}) as never);
    expect(r.status).toBe(201); ausleiheId=(await r.json()).ausleiheId;
    const a=await db.collection('artikel').findOne({_id:new ObjectId(artikelId),vereinId});
    const v=await db.collection('artikelvarianten').findOne({artikelId,vereinId,groesseId:groesseS.toString()});
    expect(a?.menge).toBe(6); expect(v?.menge).toBe(3);
  });
  it('bucht Rückgabe der Grösse S korrekt',async()=>{
    const r=await rueckgabePOST(ev(admin,{menge:2},ausleiheId) as never);
    expect(r.status).toBe(200);
    const a=await db.collection('artikel').findOne({_id:new ObjectId(artikelId),vereinId});
    const v=await db.collection('artikelvarianten').findOne({artikelId,vereinId,groesseId:groesseS.toString()});
    expect(a?.menge).toBe(8); expect(v?.menge).toBe(5);
  });
  it('verhindert Wechsel des Grössentyps',async()=>{
    const r=await artikelPATCH(ev(admin,{...payload(),hatGroessen:false,menge:8},artikelId) as never);
    expect(r.status).toBe(400);
  });
  it('verhindert Bearbeitung durch Mitglieder',async()=>{
    const r=await artikelPATCH(ev(mitglied,payload(),artikelId) as never);
    expect(r.status).toBe(403);
  });
});
