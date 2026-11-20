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
import { GET as kategorienGET, POST as kategorienPOST } from '../../../src/routes/api/kategorien/+server';
import { GET as lagerorteGET, POST as lagerortePOST } from '../../../src/routes/api/lagerorte/+server';
import { GET as groessenGET, POST as groessenPOST } from '../../../src/routes/api/groessen/+server';
describe('Stammdaten – API und Mandantentrennung', () => {
  afterAll(async () => {
    for (const name of ['kategorien','lagerorte','groessen']) await db.collection(name).deleteMany({vereinId});
  });
  it('erstellt Kategorie und liest sie wieder', async () => {
    const r = await kategorienPOST(ev(admin,{name:'Testkategorie'}) as never);
    expect(r.status).toBe(201);
    const id = (await r.json())._id;
    const list = await kategorienGET(ev(admin) as never);
    expect((await list.json()).some((x:{_id:string})=>x._id===id)).toBe(true);
  });
  it('erstellt Lagerort und liest ihn wieder', async () => {
    const r = await lagerortePOST(ev(admin,{name:'Testlager'}) as never);
    expect(r.status).toBe(201);
    const id = (await r.json())._id;
    const list = await lagerorteGET(ev(admin) as never);
    expect((await list.json()).some((x:{_id:string})=>x._id===id)).toBe(true);
  });
  it('verhindert doppelten Lagerort', async () => {
    const r = await lagerortePOST(ev(admin,{name:'testlager'}) as never);
    expect(r.status).toBe(409);
  });
  it('erstellt Grösse und liest sie wieder', async () => {
    const r = await groessenPOST(ev(admin,{bezeichnung:'XXL-Test',sortierung:90}) as never);
    expect(r.status).toBe(201);
    const id = (await r.json())._id;
    const list = await groessenGET(ev(admin) as never);
    expect((await list.json()).some((x:{_id:string})=>x._id===id)).toBe(true);
  });
  it('verhindert doppelte Grössenbezeichnung', async () => {
    const r = await groessenPOST(ev(admin,{bezeichnung:'xxl-test',sortierung:91}) as never);
    expect(r.status).toBe(409);
  });
  it('verhindert Stammdatenänderungen durch Mitglieder', async () => {
    for (const post of [kategorienPOST,lagerortePOST,groessenPOST]) {
      const r=await post(ev(mitglied,{name:'Unzulässig',bezeichnung:'Unzulässig',sortierung:1}) as never);
      expect(r.status).toBe(403);
    }
  });
  it('verhindert Zugriff ohne Anmeldung', async () => {
    for (const get of [kategorienGET,lagerorteGET,groessenGET]) {
      const r=await get(ev(null) as never);
      expect(r.status).toBe(401);
    }
  });
  it('trennt Stammdaten verschiedener Vereine', async () => {
    const r=await kategorienGET(ev({...admin,vereinId:fremdId}) as never);
    expect((await r.json()).some((x:{name:string})=>x.name==='Testkategorie')).toBe(false);
  });
});
