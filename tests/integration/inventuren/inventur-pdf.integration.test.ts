import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';

const vereinId = new ObjectId().toString();
const andererVerein = new ObjectId().toString();
const inventurId = new ObjectId();
const fremdId = new ObjectId();
const positionId = new ObjectId();
const benutzer = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
function event(id: string, user: unknown = benutzer) { return { params: { id }, locals: { benutzer: user } } as never; }
beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank!');
  await client.connect();
  await db.collection('inventuren').insertMany([
    { _id: inventurId, vereinId, name: 'Integrationstest Inventur', typ: 'gesamt', status: 'offen', erstelltAm: new Date(), erstelltVon: benutzer.id },
    { _id: fremdId, vereinId: andererVerein, name: 'Fremde Inventur', typ: 'gesamt', status: 'offen', erstelltAm: new Date() }
  ]);
  await db.collection('inventurpositionen').insertOne({ _id: positionId, vereinId, inventurId: inventurId.toString(), artikelName: 'Testball', groesseId: null, sollBestand: 5, istBestand: 4, bemerkung: 'Gezaehlt' });
});
afterAll(async () => {
  await db.collection('inventurpositionen').deleteOne({ _id: positionId });
  await db.collection('inventuren').deleteMany({ _id: { $in: [inventurId, fremdId] } });
  await client.close();
});
import * as route0 from '../../../src/routes/api/inventuren/[id]/pdf/+server';

// Ursprüngliche Datei: inventur-pdf.integration.test.ts
describe('Inventurbericht PDF', () => {
  it('401 ohne Anmeldung', async () => expect((await route0.GET(event(inventurId.toString(), null))).status).toBe(401));
  it('400 bei ungültiger ID', async () => { await expect(route0.GET(event('falsch'))).rejects.toMatchObject({ status: 400 }); });
  it('404 bei fremdem Verein', async () => { await expect(route0.GET(event(fremdId.toString()))).rejects.toMatchObject({ status: 404 }); });
  it('liefert ein valides PDF mit mindestens einer Seite', async () => {
    const res = await route0.GET(event(inventurId.toString()));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const bytes = await res.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(pdf.getTitle()).toContain('Integrationstest Inventur');
  });
});

