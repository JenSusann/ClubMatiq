import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

afterAll(async () => { await client.close(); });
import { GET as suite0_bestellungen } from '../../../src/routes/api/vereinskleider/bestellungen/+server';
import { GET as suite0_stornierungen } from '../../../src/routes/api/vereinskleider/stornierungen/+server';

describe('vereinskleider-bestellungen-liste', () => {
const bestellungen = suite0_bestellungen;
const stornierungen = suite0_stornierungen;
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

});
import { GET as suite1_GET } from '../../../src/routes/api/vereinskleider/bestellungen/stornierungen/historie/+server';

describe('stornierungen/stornierungshistorie', () => {
const GET = suite1_GET;
const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const event = (benutzer: unknown = admin) => ({ locals: { benutzer } }) as any;
const verkaufId = new ObjectId();
const fremdVerkaufId = new ObjectId();

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Testdatenbank');
  await client.connect();
  await db.collection('vereinskleider_verkaeufe').insertMany([
    {
      _id: verkaufId, vereinId, kaeufer: 'Ada Muster', riegen: ['Aktive'],
      positionen: [{ artikelId: new ObjectId().toString(), artikelname: 'T-Shirt', groesseId: null, verkaufsart: 'bestellung' }],
      stornierungen: [
        { positionsIndex: 0, menge: 1, grund: 'Falsche Grösse', storniertAm: new Date('2026-11-18T12:00:00Z') },
        { positionsIndex: 0, menge: 2, grund: 'Nicht mehr benötigt', storniertAm: new Date('2026-11-20T12:00:00Z'), storniertVon: admin.id, storniertVonName: 'Test Admin' }
      ]
    },
    {
      _id: fremdVerkaufId, vereinId: fremdId, kaeufer: 'Fremdes Mitglied',
      positionen: [{ artikelname: 'Fremd', verkaufsart: 'bestellung' }],
      stornierungen: [{ positionsIndex: 0, menge: 1, grund: 'Geheim', storniertAm: new Date() }]
    }
  ]);
});
afterAll(async () => {
  await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: [verkaufId, fremdVerkaufId] } });
  
});

describe('Vereinskleider Stornierungshistorie #61', () => {
  it('verweigert nicht angemeldeten Personen den Zugriff', async () => {
    expect((await GET(event(null))).status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verkaufsberechtigung den Zugriff', async () => {
    expect((await GET(event({ ...admin, rolle: 'mitglied' }))).status).toBe(403);
  });
  it('zeigt nur eigene Stornierungen, jede Teilstornierung einzeln und neueste zuerst', async () => {
    const res = await GET(event());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.historie).toHaveLength(2);
    expect(data.historie.map((x: any) => x.menge)).toEqual([2, 1]);
    expect(data.historie.map((x: any) => x.grund)).toEqual(['Nicht mehr benötigt', 'Falsche Grösse']);
    expect(data.historie.every((x: any) => x.vorgangId === verkaufId.toString())).toBe(true);
    expect(data.historie[0]).toMatchObject({ kaeufer: 'Ada Muster', artikelname: 'T-Shirt', storniertVonName: 'Test Admin', storniertVon: admin.id });
    expect(data.historie[1]).toMatchObject({ storniertVon: null, storniertVonName: null });
  });
});

});
import { GET as suite2_GET, POST as suite2_POST } from '../../../src/routes/api/vereinskleider/retouren/+server';

describe('retouren-mongodb', () => {
const GET = suite2_GET;
const POST = suite2_POST;
const vereinId = 'issue69-' + new ObjectId().toString();
const fremdvereinId = 'issue69-fremd-' + new ObjectId().toString();
const artikelId = new ObjectId();
const verkaufId = new ObjectId();
const rechnungId = new ObjectId();
const benutzer = { id: 'issue69-tester', rolle: 'admin', vereinId };

function request(ueberschreiben: Record<string, unknown> = {}, user: unknown = benutzer) {
  return {
    locals: { benutzer: user },
    request: new Request('http://localhost/api/vereinskleider/retouren', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verkaufId: verkaufId.toString(), positionsIndex: 0, menge: 1,
        grund: 'falsche_groesse', wiederverkaufbar: true,
        bemerkung: 'Integrationstest', datum: '2026-11-23', ...ueberschreiben
      })
    })
  } as never;
}
async function post(a: Record<string, unknown> = {}, user: unknown = benutzer) {
  const antwort = await POST(request(a, user));
  return { status: antwort.status, body: await antwort.json() };
}
async function zustand() {
  const [artikel, verkauf, rechnung, gutschriften, bewegungen] = await Promise.all([
    db.collection('artikel').findOne({ _id: artikelId }),
    db.collection('vereinskleider_verkaeufe').findOne({ _id: verkaufId }),
    db.collection('vereinskleider_rechnungen').findOne({ _id: rechnungId }),
    db.collection('vereinskleider_gutschriften').find({ vereinId }).toArray(),
    db.collection('lagerbewegungen').find({ vereinId }).toArray()
  ]);
  return { artikel, verkauf, rechnung, gutschriften, bewegungen };
}
async function bereinigen() {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Testdatenbank');
  for (const collection of ['artikel', 'vereinskleider_verkaeufe', 'vereinskleider_rechnungen',
    'vereinskleider_gutschriften', 'lagerbewegungen']) {
    await db.collection(collection).deleteMany({ vereinId: { $in: [vereinId, fremdvereinId] } });
  }
}
beforeAll(async () => {
  if (!process.env.MONGODB_TEST_URI || db.databaseName !== 'clubmatiq_test') {
    throw new Error('Echte MongoDB-Tests dürfen nur mit MONGODB_TEST_URI auf clubmatiq_test laufen.');
  }
  await client.connect();
  // Transaktionen benötigen einen Replica Set (Atlas-Cluster).
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error('MongoDB-Transaktionen benötigen einen Replica Set oder Sharded Cluster.');
  }
});
beforeEach(async () => {
  await bereinigen();
  await db.collection('artikel').insertOne({ _id: artikelId, vereinId, name: 'Testshirt', menge: 5 });
  await db.collection('vereinskleider_verkaeufe').insertOne({
    _id: verkaufId, vereinId, kaeufer: 'Testmitglied',
    positionen: [{ artikelId: artikelId.toString(), groesseId: null, artikelname: 'Testshirt',
      menge: 3, einzelpreis: 28, verkaufsart: 'direkt' }],
    retouren: [], rabatte: [], rabattTotal: 0
  });
  await db.collection('vereinskleider_rechnungen').insertOne({
    _id: rechnungId, vereinId, verkaufId: verkaufId.toString(),
    rechnungsnummer: 'TEST-69', positionen: [{ positionsIndex: 0,
      artikelId: artikelId.toString(), groesseId: null, menge: 3, einzelpreis: 28 }],
    gesamtbetrag: 84, bezahltBetrag: 84, gutgeschriebenBetrag: 0, rueckerstattungOffen: 0
  });
});
afterEach(bereinigen);
afterAll(async () => { await bereinigen();  });

describe('Issue #69 – echte MongoDB-Transaktionen für Retouren', () => {
  it('erstellt Teilretoure mit Lagerzugang, Gutschrift, Referenzen und offenem Rückerstattungsbetrag', async () => {
    const antwort = await post();
    expect(antwort.status).toBe(201);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(6);
    expect(z.verkauf?.retouren).toHaveLength(1);
    expect(z.verkauf?.retouren[0]).toMatchObject({ menge: 1, betrag: 28, wiederverkaufbar: true,
      rechnungId: rechnungId.toString(), erfasstVon: benutzer.id });
    expect(z.rechnung).toMatchObject({ gutgeschriebenBetrag: 28, rueckerstattungOffen: 28 });
    expect(z.gutschriften).toHaveLength(1);
    expect(z.gutschriften[0]).toMatchObject({ betrag: 28, rechnungId: rechnungId.toString(),
      retourId: antwort.body.retourId, clubdeskExportStatus: 'nicht_exportiert' });
    expect(z.bewegungen).toHaveLength(1);
    expect(z.bewegungen[0]).toMatchObject({ art: 'rueckgabe', mengeDelta: 1,
      referenzId: antwort.body.retourId });
  });

  it('retourniert defekte Ware ohne verfügbaren Lagerbestand zu erhöhen', async () => {
    const antwort = await post({ grund: 'defekt', wiederverkaufbar: false });
    expect(antwort.status).toBe(201);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(5);
    expect(z.bewegungen).toHaveLength(0);
    expect(z.gutschriften).toHaveLength(1);
    expect(z.rechnung?.rueckerstattungOffen).toBe(28);
  });

  it('erlaubt zwei Teilretouren, blockiert aber die vierte Rückgabe und Doppelgutschrift', async () => {
    expect((await post({ menge: 2 })).status).toBe(201);
    expect((await post({ menge: 1 })).status).toBe(201);
    expect((await post({ menge: 1 })).status).toBe(409);
    const z = await zustand();
    expect(z.verkauf?.retouren).toHaveLength(2);
    expect(z.gutschriften).toHaveLength(2);
    expect(z.artikel?.menge).toBe(8);
    expect(z.rechnung?.gutgeschriebenBetrag).toBe(84);
  });

  it('blockiert unklare Rechnungstranchen und lässt sämtliche Daten unverändert', async () => {
    await db.collection('vereinskleider_rechnungen').insertOne({
      vereinId, verkaufId: verkaufId.toString(), rechnungsnummer: 'TEST-69-ZWEI',
      positionen: [{ positionsIndex: 0, artikelId: artikelId.toString(), groesseId: null,
        menge: 1, einzelpreis: 28 }], gesamtbetrag: 28, bezahltBetrag: 0,
      gutgeschriebenBetrag: 0, rueckerstattungOffen: 0
    });
    const antwort = await post();
    expect(antwort.status).toBe(409);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(5);
    expect(z.rechnung?.gutgeschriebenBetrag).toBe(0);
    expect(z.verkauf?.retouren).toHaveLength(0);
    expect(z.gutschriften).toHaveLength(0);
    expect(z.bewegungen).toHaveLength(0);
  });

  it('weist fremde Vereine und fehlende Berechtigungen ohne Buchungen zurück', async () => {
    expect((await post({}, { ...benutzer, vereinId: fremdvereinId })).status).toBe(404);
    expect((await post({}, { ...benutzer, rolle: 'mitglied' })).status).toBe(403);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(5);
    expect(z.gutschriften).toHaveLength(0);
  });

  it('verarbeitet zwei gleichzeitig eintreffende Retouren höchstens einmal', async () => {
    const antworten = await Promise.all([post({ menge: 2 }), post({ menge: 2 })]);
    expect(antworten.filter((a) => a.status === 201)).toHaveLength(1);
    expect(antworten.filter((a) => a.status !== 201)).toHaveLength(1);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(7);
    expect(z.verkauf?.retouren).toHaveLength(1);
    expect(z.gutschriften).toHaveLength(1);
    expect(z.bewegungen).toHaveLength(1);
  });

  it('liefert Retourenübersicht mit verbleibender Rückgabemenge', async () => {
    expect((await post({ menge: 1 })).status).toBe(201);
    const response = await GET({ locals: { benutzer },
      url: new URL('http://localhost/api/vereinskleider/retouren?verkaufId=' + verkaufId) } as never);
    expect(response.status).toBe(200);
    const daten = await response.json();
    expect(daten.positionen[0]).toMatchObject({ uebergeben: 3, retourniert: 1, maximal: 2 });
  });
});

});
import { POST as suite3_artikelPOST } from '../../../src/routes/api/artikel/+server';
import { GET as suite3_artikelGET, PATCH as suite3_artikelPATCH } from '../../../src/routes/api/artikel/[id]/+server';
import { POST as suite3_ausleihenPOST } from '../../../src/routes/api/ausleihen/+server';
import { POST as suite3_rueckgabePOST } from '../../../src/routes/api/ausleihen/[id]/rueckgabe/+server';

describe('vereinskleider-ergaenzung-weitere', () => {
const artikelPOST = suite3_artikelPOST;
const artikelGET = suite3_artikelGET;
const artikelPATCH = suite3_artikelPATCH;
const ausleihenPOST = suite3_ausleihenPOST;
const rueckgabePOST = suite3_rueckgabePOST;
const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
function ev(user: unknown, body: unknown = {}, id?: string) {
  return { locals: { benutzer: user }, params: { id }, request: new Request('http://localhost/api/test', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}) };
}
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank!'); await client.connect(); });
afterAll(async () => {  });




const kategorieId=new ObjectId(), lagerortId=new ObjectId(), groesseS=new ObjectId(), groesseM=new ObjectId();
let artikelId='', ausleiheId='';
const payload=()=>({name:'Test Trainerjacke',kategorieId:kategorieId.toString(),lagerortId:lagerortId.toString(),einzelwert:0,mindestbestand:0,hatGroessen:true,istVereinskleidung:true,varianten:[{groesseId:groesseS.toString(),menge:5,einzelwert:40,mindestbestand:1},{groesseId:groesseM.toString(),menge:3,einzelwert:45,mindestbestand:1}]});
describe('Vereinskleider – Grössen und Ausleihen',()=>{
  beforeAll(async()=>{
    await db.collection('kategorien').insertOne({_id:kategorieId,vereinId,name:'Kleider Test'});
    await db.collection('lagerorte').insertOne({_id:lagerortId,vereinId,name:'Lager Test'});
    await db.collection('groessen').insertMany([{_id:groesseS,vereinId,bezeichnung:'S',sortierung:1},{_id:groesseM,vereinId,bezeichnung:'M',sortierung:2}]);
  });
  afterAll(async()=>{
    for(const name of ['ausleihen','artikelvarianten','artikel','kategorien','lagerorte','groessen']) await db.collection(name).deleteMany({vereinId});
  });
  it('erstellt Vereinskleidung mit zwei Grössen',async()=>{
    const r=await artikelPOST(ev(admin,payload()) as never);
    expect(r.status).toBe(201);
    const data=await r.json(); artikelId=data.artikelId;
    expect(data.gesamtmenge).toBe(8);
  });
  it('liefert beide Grössen und Einzelwerte',async()=>{
    const r=await artikelGET(ev(admin,{},artikelId) as never);
    expect(r.status).toBe(200);
    const data=await r.json();
    expect(data.varianten).toHaveLength(2);
    expect(data.varianten.find((v:{groesseId:string})=>v.groesseId===groesseS.toString())).toMatchObject({menge:5,einzelwert:40});
  });
  it('verhindert doppelte Grössen',async()=>{
    const daten=payload(); daten.varianten[1].groesseId=groesseS.toString();
    const r=await artikelPOST(ev(admin,daten) as never);
    expect(r.status).toBe(400);
  });
  it('verhindert fremde Grössen',async()=>{
    const daten=payload(); daten.varianten[1].groesseId=new ObjectId().toString();
    const r=await artikelPOST(ev(admin,daten) as never);
    expect(r.status).toBe(400);
  });
  it('leiht Grösse S aus und aktualisiert Gesamtbestand',async()=>{
    const r=await ausleihenPOST(ev(admin,{artikelId,groesseId:groesseS.toString(),person:'Testperson',menge:2,ausleihdatum:'2026-11-19',rueckgabedatum:'2026-11-26'}) as never);
    expect(r.status).toBe(201); ausleiheId=(await r.json()).ausleiheId;
    const a=await db.collection('artikel').findOne({_id:new ObjectId(artikelId),vereinId});
    const v=await db.collection('artikelvarianten').findOne({artikelId,vereinId,groesseId:groesseS.toString()});
    expect(a?.menge).toBe(6); expect(v?.menge).toBe(3);
  });
  it('bucht Rückgabe der Grösse S korrekt',async()=>{
    const r=await rueckgabePOST(ev(admin,{menge:2},ausleiheId) as never);
    expect(r.status).toBe(200);
    const a=await db.collection('artikel').findOne({_id:new ObjectId(artikelId),vereinId});
    const v=await db.collection('artikelvarianten').findOne({artikelId,vereinId,groesseId:groesseS.toString()});
    expect(a?.menge).toBe(8); expect(v?.menge).toBe(5);
  });
  it('verhindert Wechsel des Grössentyps',async()=>{
    const r=await artikelPATCH(ev(admin,{...payload(),hatGroessen:false,menge:8},artikelId) as never);
    expect(r.status).toBe(400);
  });
  it('verhindert Bearbeitung durch Mitglieder',async()=>{
    const r=await artikelPATCH(ev(mitglied,payload(),artikelId) as never);
    expect(r.status).toBe(403);
  });
});

});
