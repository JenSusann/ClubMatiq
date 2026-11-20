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

const artikelId=new ObjectId(), lagerortId=new ObjectId();
import * as route0 from '../../../src/routes/api/inventuren/+server';

// Ursprüngliche Datei: inventur.integration.test.ts
describe('Inventur – Erstellung und Momentaufnahme',()=>{
  beforeAll(async()=>{
    await db.collection('lagerorte').insertOne({_id:lagerortId,vereinId,name:'Testlager Inventur'});
    await db.collection('artikel').insertOne({_id:artikelId,vereinId,name:'Inventur Testball',menge:12,einzelwert:15,hatGroessen:false,lagerortId:lagerortId.toString()});
  });
  afterAll(async()=>{
    for(const name of ['inventurpositionen','inventuren','artikel','lagerorte']) await db.collection(name).deleteMany({vereinId});
  });
  it('verweigert Inventur ohne Anmeldung',async()=>{
    const r=await route0.POST(ev(null,{name:'Test',typ:'gesamt'}) as never);expect(r.status).toBe(401);
  });
  it('verweigert Erstellung durch Mitglieder',async()=>{
    const r=await route0.POST(ev(mitglied,{name:'Test',typ:'gesamt'}) as never);expect(r.status).toBe(403);
  });
  it('verweigert ungültigen Inventurtyp',async()=>{
    const r=await route0.POST(ev(admin,{name:'Test',typ:'falsch'}) as never);expect(r.status).toBe(400);
  });
  it('verweigert fremden Lagerort',async()=>{
    const r=await route0.POST(ev(admin,{name:'Test',typ:'lagerort',lagerortId:new ObjectId().toString()}) as never);expect(r.status).toBe(404);
  });
  it('erstellt Lagerortinventur mit Sollbestand',async()=>{
    const r=await route0.POST(ev(admin,{name:'Inventur Test',typ:'lagerort',lagerortId:lagerortId.toString()}) as never);
    expect(r.status).toBe(201);
    const data=await r.json(); expect(data.anzahlArtikel).toBe(1);expect(data.anzahlPositionen).toBe(1);
    const pos=await db.collection('inventurpositionen').findOne({vereinId,inventurId:data.inventurId});
    expect(pos).toMatchObject({sollBestand:12,istBestand:null,einzelwert:15});
  });
  it('liest Inventuren nur des eigenen Vereins',async()=>{
    const r=await route0.GET(ev(admin) as never);expect(r.status).toBe(200);
    expect((await r.json()).some((x:{name:string})=>x.name==='Inventur Test')).toBe(true);
    const fremd=await route0.GET(ev({...admin,vereinId:fremdId}) as never);
    expect((await fremd.json()).some((x:{name:string})=>x.name==='Inventur Test')).toBe(false);
  });
});

