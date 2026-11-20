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
import { GET as bestellungen } from '../../../src/routes/api/vereinskleider/bestellungen/+server';
import { GET as stornierungen } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
describe('Vereinskleider Bestellübersicht und Gutschriften', () => {
  it('verweigert Bestellungen ohne Anmeldung', async () => { expect((await bestellungen(ev(null))).status).toBe(401); });
  it('verweigert Bestellungen für Mitglieder', async () => { expect((await bestellungen(ev(mitglied))).status).toBe(403); });
  it('validiert Statusfilter', async () => { expect((await bestellungen({...ev(),url:new URL('http://localhost/api/vereinskleider/bestellungen?status=ungueltig')})).status).toBe(400); });
  it('listet offene Bestellpositionen aus eigenem Verein', async () => {
    await db.collection('vereinskleider_verkaeufe').insertMany([{vereinId,erstelltAm:new Date(),kaeufer:'Ada',positionen:[{artikelId:new ObjectId().toString(),groesseId:null,artikelname:'Shirt',menge:3,einzelpreis:25,verkaufsart:'bestellung',uebergebenMenge:1,reserviertMenge:1}]},{vereinId:fremdId,erstelltAm:new Date(),kaeufer:'Fremd',positionen:[{artikelId:new ObjectId().toString(),groesseId:null,artikelname:'Fremdshirt',menge:2,einzelpreis:10,verkaufsart:'bestellung'}]}]);
    const res=await bestellungen({...ev(),url:new URL('http://localhost/api/vereinskleider/bestellungen?status=alle')}); expect(res.status).toBe(200); const data=await res.json(); expect(data.bestellungen.some((x:any)=>x.kaeufer==='Ada')).toBe(true); expect(data.bestellungen.some((x:any)=>x.kaeufer==='Fremd')).toBe(false);
  });
  it('verweigert Gutschriften ohne Anmeldung', async () => { expect((await stornierungen(ev(null))).status).toBe(401); });
  it('listet nur eigene Gutschriften', async () => {
    await db.collection('vereinskleider_gutschriften').insertMany([{vereinId,gutschriftnummer:'GS-OWN',erstelltAm:new Date(),betrag:10},{vereinId:fremdId,gutschriftnummer:'GS-OTHER',erstelltAm:new Date(),betrag:10}]);
    const res=await stornierungen(ev()); expect(res.status).toBe(200); const data=await res.json(); expect(data.gutschriften.some((x:any)=>x.gutschriftnummer==='GS-OWN')).toBe(true); expect(data.gutschriften.some((x:any)=>x.gutschriftnummer==='GS-OTHER')).toBe(false);
  });
});
