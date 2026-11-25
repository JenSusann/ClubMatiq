import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { PDFDocument } from 'pdf-lib';
import * as pack12_1_route0 from '../../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';

describe('inventur-zuruecksetzen', () => {
const route0 = pack12_1_route0;
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
  
});


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


});
import * as pack12_2_route0 from '../../../src/routes/api/inventuren/[id]/pdf/+server';

describe('inventur-pdf', () => {
const route0 = pack12_2_route0;
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
  
});


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


});
import * as pack12_3_route0 from '../../../src/routes/api/inventuren/+server';

describe('inventur', () => {
const route0 = pack12_3_route0;
const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
function ev(user: unknown, body: unknown = {}, id?: string) {
  return { locals: { benutzer: user }, params: { id }, request: new Request('http://localhost/api/test', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}) };
}
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank!'); await client.connect(); });
afterAll(async () => {  });

const artikelId=new ObjectId(), lagerortId=new ObjectId();


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


});
import * as pack12_4_suite0_route0 from '../../../src/routes/api/inventuren/[id]/korrigieren/+server';
import * as pack12_4_suite1_route0 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

describe('inventur-korrekturen', () => {
const suite0_route0 = pack12_4_suite0_route0;
const suite1_route0 = pack12_4_suite1_route0;


describe('inventur-korrekturen', () => {
const route0 = suite0_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/inventuren/testid/korrigieren', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/inventuren/testid/korrigieren')
  } as never;
}


// Ursprüngliche Datei: inventur-korrekturen.integration.test.ts
describe('inventuren/[id]/korrigieren', () => {
  it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => {
    const res = await route0.POST(event({}, id, null));
    expect(res.status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verwaltungsberechtigung den Zugriff', async () => {
    const res = await route0.POST(event({}, id, { ...admin, rolle: 'mitglied' }));
    expect(res.status).toBe(403);
  });
  it('weist ungültige JSON-Eingaben zurück', async () => {
    const ev = event({});
    (ev as any).request = new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{kaputt' });
    const res = await route0.POST(ev);
    expect(res.status).toBe(400);
  });
  it('ungueltige Inventur-ID', async () => {
    const res = await route0.POST(event({"positionId": "x", "neuerIstBestand": 1, "begruendung": "Korrektur nötig", "version": 0}, 'ungueltig'));
    expect(res.status).toBe(400);
  });
  it('ungueltige Position', async () => {
    const res = await route0.POST(event({"positionId": "x", "neuerIstBestand": 1, "begruendung": "Korrektur nötig", "version": 0}, id));
    expect(res.status).toBe(400);
  });
  it('negativer Bestand', async () => {
    const res = await route0.POST(event({"positionId": id, "neuerIstBestand": -1, "begruendung": "Korrektur nötig", "version": 0}, id));
    expect(res.status).toBe(400);
  });
  it('fehlende Version', async () => {
    const res = await route0.POST(event({"positionId": id, "neuerIstBestand": 1, "begruendung": "Korrektur nötig"}, id));
    expect(res.status).toBe(400);
  });
  it('zu kurze Begründung', async () => {
    const res = await route0.POST(event({"positionId": id, "neuerIstBestand": 1, "begruendung": "abc", "version": 0}, id));
    expect(res.status).toBe(400);
  });
});


});



describe('inventur-stornierung', () => {
const route0 = suite1_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/inventuren/testid/stornieren', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/inventuren/testid/stornieren')
  } as never;
}


// Ursprüngliche Datei: inventur-stornierung.integration.test.ts
describe('inventuren/[id]/stornieren', () => {
  it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => {
    const res = await route0.POST(event({}, id, null));
    expect(res.status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verwaltungsberechtigung den Zugriff', async () => {
    const res = await route0.POST(event({}, id, { ...admin, rolle: 'mitglied' }));
    expect(res.status).toBe(403);
  });
  it('weist ungültige JSON-Eingaben zurück', async () => {
    const ev = event({});
    (ev as any).request = new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{kaputt' });
    const res = await route0.POST(ev);
    expect(res.status).toBe(400);
  });
  it('ungueltige Inventur-ID', async () => {
    const res = await route0.POST(event({}, 'ungueltig'));
    expect(res.status).toBe(400);
  });
});


});

});
