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
import { GET as liste, POST as einladen } from '../../../src/routes/api/benutzer/einladen/+server';
import { GET as pruefen, POST as annehmen } from '../../../src/routes/api/einladung/+server';
import { createHash, randomBytes } from 'node:crypto';
describe('Einladungen und Annahme', () => {
  it('verweigert die Einladung ohne Anmeldung', async () => { expect((await einladen(ev(null))).status).toBe(401); });
  it('verweigert Mitgliedern Einladungen', async () => { expect((await einladen(ev(mitglied))).status).toBe(403); });
  it('validiert Pflichtfelder', async () => { expect((await einladen(ev(admin, { email:'a@b.ch', rolle:'admin' }))).status).toBe(400); });
  it('validiert Rollen', async () => { expect((await einladen(ev(admin, {vorname:'A',nachname:'B',email:'a@b.ch',rolle:'superadmin'}))).status).toBe(400); });
  it('verweigert das Einladungslisting ohne Anmeldung', async () => { expect((await liste(ev(null))).status).toBe(401); });
  it('zeigt ausschliesslich eigene Einladungen', async () => {
    await db.collection('einladungen').insertMany([{vereinId,email:'own@test.ch',vorname:'A',nachname:'B',rolle:'mitglied',status:'offen',ablaufdatum:new Date(Date.now()+86400000),erstelltAm:new Date(),tokenHash:randomBytes(32).toString('hex')},{vereinId:fremdId,email:'other@test.ch',vorname:'X',nachname:'Y',rolle:'mitglied',status:'offen',ablaufdatum:new Date(Date.now()+86400000),erstelltAm:new Date(),tokenHash:randomBytes(32).toString('hex')}]);
    const res=await liste(ev()); expect(res.status).toBe(200); const data=await res.json(); expect(data.some((x:any)=>x.email==='own@test.ch')).toBe(true); expect(data.some((x:any)=>x.email==='other@test.ch')).toBe(false);
  });
  it('weist ungültigen Token zurück', async () => { expect((await pruefen({url:new URL('http://localhost/api/einladung?token=abc')} as any)).status).toBe(400); });
  it('weist unbekannten Token zurück', async () => { expect((await pruefen({url:new URL('http://localhost/api/einladung?token='+randomBytes(32).toString('hex'))} as any)).status).toBe(404); });
  it('prüft die Mindestlänge des Passworts', async () => { expect((await annehmen(ev(null,{token:randomBytes(32).toString('hex'),passwort:'kurz'}))).status).toBe(400); });
  it('liest eine gültige Einladung', async () => {
    const token=randomBytes(32).toString('hex'); await db.collection('einladungen').insertOne({vereinId,tokenHash:createHash('sha256').update(token).digest('hex'),status:'offen',ablaufdatum:new Date(Date.now()+86400000),email:'valid@test.ch',vorname:'Ada',nachname:'Test',rolle:'mitglied',erstelltAm:new Date()});
    const res=await pruefen({url:new URL('http://localhost/api/einladung?token='+token)} as any); expect(res.status).toBe(200); expect((await res.json()).email).toBe('valid@test.ch');
  });
});
