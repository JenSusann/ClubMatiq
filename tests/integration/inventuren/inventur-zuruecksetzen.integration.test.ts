import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config();
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';
const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
function ev(user: any = admin, body: any = {}, url = 'http://localhost/api/test', method = 'POST') {
  return { locals: { benutzer: user }, request: new Request(url, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) }), url: new URL(url), params: { id: new ObjectId().toString() } } as any;
}
beforeAll(async () => { await client.connect(); });
afterAll(async () => {
  for (const name of ['einladungen','benutzer','vereine','inventuren','inventurpositionen','inventurprotokoll','vereinskleider_verkaeufe','vereinskleider_gutschriften','vereinskleider_rechnungen','sessions']) {
    await db.collection(name).deleteMany({ vereinId: { $in: [vereinId, fremdId] } });
  }
  await client.close();
});
import * as route0 from '../../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';

// Ursprüngliche Datei: inventur-zuruecksetzen.integration.test.ts
describe('Inventur zurücksetzen', () => {
  it('verweigert Zugriff ohne Anmeldung', async () => { expect((await route0.POST(ev(null))).status).toBe(401); });
  it('verweigert Zugriff ohne Berechtigung', async () => { expect((await route0.POST(ev(mitglied))).status).toBe(403); });
  it('weist ungültige ID zurück', async () => { expect((await route0.POST({...ev(),params:{id:'kaputt'}})).status).toBe(400); });
  it('weist fremde Inventur zurück', async () => { const id=new ObjectId(); await db.collection('inventuren').insertOne({_id:id,vereinId:fremdId,status:'offen'}); expect((await route0.POST({...ev(),params:{id:id.toString()}})).status).toBe(409); });
  it('setzt offene Zählungen zurück und protokolliert', async () => {
    const id=new ObjectId(), pos=new ObjectId(); await db.collection('inventuren').insertOne({_id:id,vereinId,status:'offen',version:0}); await db.collection('inventurpositionen').insertOne({_id:pos,vereinId,inventurId:id.toString(),istBestand:4,bemerkung:'gezählt'});
    const res=await route0.POST({...ev(),params:{id:id.toString()}}); expect(res.status).toBe(200); expect((await res.json()).anzahlZurueckgesetzt).toBe(1);
    expect((await db.collection('inventurpositionen').findOne({_id:pos}))?.istBestand).toBeNull(); expect(await db.collection('inventurprotokoll').countDocuments({vereinId,inventurId:id.toString(),aktion:'zurueckgesetzt'})).toBe(1);
  });
  it('verweigert Zurücksetzen abgeschlossener Inventur', async () => { const id=new ObjectId(); await db.collection('inventuren').insertOne({_id:id,vereinId,status:'abgeschlossen'}); expect((await route0.POST({...ev(),params:{id:id.toString()}})).status).toBe(409); });
});

