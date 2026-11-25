import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, event, oid, vereinId } from '../helper';
vi.mock('../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../src/lib/server/mongodb';


afterAll(async () => { await client.close(); });
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrigieren/+server';

describe('inventur-korrektur-erfolg', () => {

const inventoryIds: ObjectId[] = []; const articleIds: ObjectId[] = [];
async function fixture(status = 'abgeschlossen', amount = 10) { const inventur = oid(), position = oid(), artikel = oid(); inventoryIds.push(inventur); articleIds.push(artikel); await db.collection('inventuren').insertOne({ _id: inventur, vereinId, status, version: 0 }); await db.collection('inventurpositionen').insertOne({ _id: position, inventurId: inventur.toString(), vereinId, artikelId: artikel.toString(), groesseId: null, istBestand: amount, sollBestand: amount }); await db.collection('artikel').insertOne({ _id: artikel, vereinId, menge: amount, hatGroessen: false }); return { inventur, position, artikel }; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('inventurprotokoll').deleteMany({ vereinId, inventurId: { $in: inventoryIds.map(x => x.toString()) } }); await db.collection('inventurpositionen').deleteMany({ vereinId, inventurId: { $in: inventoryIds.map(x => x.toString()) } }); await db.collection('inventuren').deleteMany({ _id: { $in: inventoryIds } }); await db.collection('artikel').deleteMany({ _id: { $in: articleIds } });  });


// Ursprüngliche Datei: inventur-korrektur-erfolg.integration.test.ts
describe('Paket 8 – Inventurkorrektur', () => {
 it('erhöht Bestand, Version und schreibt Protokoll', async () => { const f = await fixture(); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 13, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(200); expect((await db.collection('artikel').findOne({ _id: f.artikel }))?.menge).toBe(13); expect((await db.collection('inventuren').findOne({ _id: f.inventur }))?.version).toBe(1); expect(await db.collection('inventurprotokoll').countDocuments({ inventurId: f.inventur.toString(), aktion: 'nachtraeglich_korrigiert' })).toBe(1); });
 it('verhindert veraltete Version ohne Bestandsänderung', async () => { const f = await fixture(); await db.collection('inventuren').updateOne({ _id: f.inventur }, { $set: { version: 2 } }); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 12, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(409); expect((await db.collection('artikel').findOne({ _id: f.artikel }))?.menge).toBe(10); });
 it('lehnt Korrektur offener Inventur ab', async () => { const f = await fixture('offen'); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 12, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(409); });
 it('verhindert negativen Bestand', async () => { const f = await fixture('abgeschlossen', 10); await db.collection('artikel').updateOne({ _id: f.artikel }, { $set: { menge: 1 } }); const res = await route0.POST(event({ positionId: f.position.toString(), neuerIstBestand: 5, begruendung: 'Nachzählung', version: 0 }, f.inventur.toString())); expect(res.status).toBe(409); expect((await db.collection('artikel').findOne({ _id: f.artikel }))?.menge).toBe(1); });
});


});
import * as route1 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

describe('inventur-stornierung-erfolg', () => {
const route0 = route1;
const inventories: ObjectId[] = []; const articles: ObjectId[] = [];
async function fixture(status: string, current: number, soll: number, ist: number) { const inv = oid(), article = oid(), pos = oid(); inventories.push(inv); articles.push(article); await db.collection('inventuren').insertOne({ _id: inv, vereinId, status, version: 0, anzahlPositionen: 1, anzahlNachtraeglicheKorrekturen: 0 }); await db.collection('inventurpositionen').insertOne({ _id: pos, inventurId: inv.toString(), vereinId, artikelId: article.toString(), groesseId: null, sollBestand: soll, istBestand: ist }); await db.collection('artikel').insertOne({ _id: article, vereinId, menge: current, hatGroessen: false }); return { inv, article }; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('inventurprotokoll').deleteMany({ vereinId, inventurId: { $in: inventories.map(x => x.toString()) } }); await db.collection('inventurpositionen').deleteMany({ vereinId, inventurId: { $in: inventories.map(x => x.toString()) } }); await db.collection('inventuren').deleteMany({ _id: { $in: inventories } }); await db.collection('artikel').deleteMany({ _id: { $in: articles } });  });


// Ursprüngliche Datei: inventur-stornierung-erfolg.integration.test.ts
describe('Paket 8 – Inventurstornierung', () => {
 it('storniert offene Inventur ohne Lageränderung', async () => { const f = await fixture('offen', 10, 10, 10); const res = await route0.POST(event({ begruendung: 'Fehlerhafte Zählung' }, f.inv.toString())); expect(res.status).toBe(200); expect((await db.collection('inventuren').findOne({ _id: f.inv }))?.status).toBe('storniert'); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(10); });
 it('bucht abgeschlossene Inventur zurück', async () => { const f = await fixture('abgeschlossen', 8, 10, 8); const res = await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString())); expect(res.status).toBe(200); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(10); expect((await res.json()).anzahlRueckbuchungen).toBe(1); });
 it('rollt zurück wenn Bestand für Rückbuchung nicht reicht', async () => { const f = await fixture('abgeschlossen', 1, 2, 5); const res = await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString())); expect(res.status).toBe(409); expect((await db.collection('inventuren').findOne({ _id: f.inv }))?.status).toBe('abgeschlossen'); });
 it('verhindert wiederholte Stornierung', async () => { const f = await fixture('offen', 10, 10, 10); expect((await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString()))).status).toBe(200); expect((await route0.POST(event({ begruendung: 'Falscher Abschluss' }, f.inv.toString()))).status).toBe(409); });
});


});
import { POST as erstellen } from '../../../src/routes/api/inventuren/+server';
import { GET as lesen, PATCH as zaehlen } from '../../../src/routes/api/inventuren/[id]/+server';
import { POST as abschliessen } from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

describe('inventur-abschluss', () => {

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
    } finally { /* shared client closed by outer hook */ }
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

});
