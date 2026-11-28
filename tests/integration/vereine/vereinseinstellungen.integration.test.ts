import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb } from '../helper';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv'); config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});
import { db, client } from '../../../src/lib/server/mongodb';
import { GET, PATCH } from '../../../src/routes/api/vereine/+server';
import { POST } from '../../../src/routes/api/vereinskleider/verrechnung/+server';

const id = new ObjectId(), fremd = new ObjectId();
const vereinId = id.toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const ids = [id, fremd];
const patch = (body: unknown, benutzer: unknown = admin) => PATCH({ locals: { benutzer }, request: new Request('http://localhost/api/vereine', { method: 'PATCH', body: JSON.stringify(body) }) } as never);
const get = (benutzer: unknown = admin) => GET({ locals: { benutzer } } as never);
async function cleanup() {
  assertTestDb(db);
  await db.collection('vereine').deleteMany({ _id: { $in: ids } });
  await db.collection('vereinskleider_rechnungen').deleteMany({ vereinId });
  await db.collection('vereinskleider_verkaeufe').deleteMany({ vereinId });
  await db.collection<{ _id: string }>('vereinskleider_rechnungsnummern').deleteMany({ _id: { $regex: '^' + vereinId + ':' } });
}
beforeAll(async () => { assertTestDb(db); await client.connect(); });
beforeEach(async () => {
  await cleanup();
  await db.collection('vereine').insertMany([{ _id: id, name: 'Original', kuerzel: 'O' }, { _id: fremd, name: 'Fremd', kuerzel: 'F' }]);
});
afterAll(async () => { try { await cleanup(); } finally { await client.close(); } });

async function rechnung() {
  const verkaufId = new ObjectId();
  await db.collection('vereinskleider_verkaeufe').insertOne({
    _id: verkaufId, vereinId, kaeufer: 'Testmitglied', zahlungsart: 'rechnung',
    positionen: [{ artikelId: new ObjectId().toHexString(), groesseId: null, artikelname: 'Shirt', menge: 2, einzelpreis: 15, positionsbetrag: 30, verkaufsart: 'bestellung' }],
    zwischentotal: 30, rabattTotal: 0, endbetrag: 30, erstelltAm: new Date()
  });
  const res = await POST({ locals: { benutzer: admin }, request: new Request('http://localhost/api/vereinskleider/verrechnung', { method: 'POST', body: JSON.stringify({ verkaufId: verkaufId.toHexString() }) }) } as never);
  expect(res.status).toBe(201);
  return verkaufId.toHexString();
}
describe('Issue #76 – Vereinsprofil MongoDB', () => {
  it('liefert kompatible Standardwerte für bestehende Vereine', async () => {
    expect(await (await get()).json()).toMatchObject([{ _id: vereinId, name: 'Original', adresse: { strasse: '', plz: '', ort: '' }, logo: null }]);
  });
  it('speichert und lädt Profildaten ohne Änderung der Vereins-ID', async () => {
    expect((await patch({ name: 'Neu', kuerzel: 'N', adresse: { ort: 'Zürich' }, kontakt: { email: 'tv@example.ch' } })).status).toBe(200);
    expect(await (await get()).json()).toMatchObject([{ _id: vereinId, name: 'Neu', adresse: { ort: 'Zürich' }, kontakt: { email: 'tv@example.ch' } }]);
    expect(await db.collection('vereine').findOne({ _id: id })).toMatchObject({ profilRevision: 1, profilAktualisiertVon: admin.id });
  });
  it('ignoriert fremde Vereins-ID und geschützte Felder', async () => {
    expect((await patch({ name: 'Neu', _id: fremd.toHexString(), vereinId: fremd.toHexString(), logo: { url: 'bad' }, mailEinstellungen: { password: 'bad' } })).status).toBe(200);
    expect(await db.collection('vereine').findOne({ _id: fremd })).toMatchObject({ name: 'Fremd' });
    const eigener = await db.collection('vereine').findOne({ _id: id });
    expect(eigener?.logo).toBeUndefined();
    expect(eigener?.mailEinstellungen).toBeUndefined();
  });
  it('verweigert Mitgliedern Schreibzugriff', async () => {
    expect((await patch({ name: 'Neu' }, { ...admin, rolle: 'mitglied' })).status).toBe(403);
    expect(await db.collection('vereine').findOne({ _id: id })).toMatchObject({ name: 'Original' });
  });
  it('bewahrt ursprüngliche Ausstellerdaten über mehrere Änderungen', async () => {
    expect((await patch({ name: 'Neu' })).status).toBe(200);
    expect((await patch({ name: 'Dritter Name' })).status).toBe(200);
    expect(await db.collection('vereine').findOne({ _id: id })).toMatchObject({ name: 'Dritter Name', profilRevision: 2, ausstellerVorErsterAenderung: { name: 'Original', kuerzel: 'O' } });
  });
  it('speichert unabhängige Ausstellerdaten bei neuen Rechnungen', async () => {
    const erste = await rechnung();
    expect((await patch({ name: 'Neu', adresse: { ort: 'Zürich' } })).status).toBe(200);
    const zweite = await rechnung();
    const docs = db.collection('vereinskleider_rechnungen');
    expect(await docs.findOne({ vereinId, verkaufId: erste })).toMatchObject({ aussteller: { name: 'Original', adresse: { ort: '' } } });
    expect(await docs.findOne({ vereinId, verkaufId: zweite })).toMatchObject({ aussteller: { name: 'Neu', adresse: { ort: 'Zürich' } } });
  });
});
