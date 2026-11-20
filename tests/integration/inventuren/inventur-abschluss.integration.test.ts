import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';
import { POST as erstellen } from '../../../src/routes/api/inventuren/+server';
import { GET as lesen, PATCH as zaehlen } from '../../../src/routes/api/inventuren/[id]/+server';
import { POST as abschliessen } from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';
const vereinId = new ObjectId().toString();
const artikelId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const fremd = { ...admin, vereinId: new ObjectId().toString() };
function ev(benutzer: unknown, id?: string, body?: unknown) {
  return { locals: { benutzer }, params: { id }, request: new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }) };
}
describe('Inventur – Zählung und Abschluss mit MongoDB', () => {
  let inventurId = '';
  let positionId = '';
  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank');
    await client.connect();
    await db.collection('artikel').insertOne({ _id: artikelId, vereinId, name: 'Inventur-Testball', menge: 10, einzelwert: 15, hatGroessen: false, lagerortId: new ObjectId().toString() });
  });
  afterAll(async () => {
    try {
      await db.collection('inventurprotokoll').deleteMany({ vereinId });
      await db.collection('inventurpositionen').deleteMany({ vereinId });
      await db.collection('inventuren').deleteMany({ vereinId });
      await db.collection('artikel').deleteOne({ _id: artikelId, vereinId });
    } finally { await client.close(); }
  });
  it('erstellt Inventur mit Sollbestand 10', async () => {
    const res = await erstellen(ev(admin, undefined, { name: 'Integration Inventur', typ: 'gesamt' }) as never);
    expect(res.status).toBe(201);
    inventurId = (await res.json()).inventurId;
    const details = await lesen(ev(admin, inventurId) as never);
    expect(details.status).toBe(200);
    const data = await details.json();
    expect(data.positionen).toHaveLength(1);
    expect(data.positionen[0].sollBestand).toBe(10);
    positionId = data.positionen[0]._id;
  });
  it('schützt Inventur vor fremden Vereinen', async () => {
    expect((await lesen(ev(fremd, inventurId) as never)).status).toBe(404);
  });
  it('verhindert Abschluss bei offenen Zählpositionen', async () => {
    expect((await abschliessen(ev(admin, inventurId) as never)).status).toBe(409);
    expect((await db.collection('artikel').findOne({ _id: artikelId }))?.menge).toBe(10);
  });
  it('verhindert negative Ist-Bestände', async () => {
    expect((await zaehlen(ev(admin, inventurId, { positionId, istBestand: -1 }) as never)).status).toBe(400);
  });
  it('speichert Ist-Bestand 8 und Differenz -2', async () => {
    const res = await zaehlen(ev(admin, inventurId, { positionId, istBestand: 8, bemerkung: 'Zwei fehlen' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, istBestand: 8, differenz: -2 });
  });
  it('schliesst Inventur ab und korrigiert Lagerbestand', async () => {
    const res = await abschliessen(ev(admin, inventurId) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, anzahlKorrekturen: 1 });
    expect((await db.collection('artikel').findOne({ _id: artikelId }))?.menge).toBe(8);
    expect((await db.collection('inventuren').findOne({ _id: new ObjectId(inventurId) }))?.status).toBe('abgeschlossen');
    expect(await db.collection('inventurprotokoll').countDocuments({ vereinId, inventurId })).toBe(1);
  });
  it('verhindert erneuten Abschluss', async () => {
    expect((await abschliessen(ev(admin, inventurId) as never)).status).toBe(409);
    expect((await db.collection('artikel').findOne({ _id: artikelId }))?.menge).toBe(8);
  });
  it('verhindert nachträgliches Ändern der Zählung', async () => {
    expect((await zaehlen(ev(admin, inventurId, { positionId, istBestand: 12 }) as never)).status).toBe(409);
  });
});
