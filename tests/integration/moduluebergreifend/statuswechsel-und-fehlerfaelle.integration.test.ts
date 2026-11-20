import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

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
const vereinId = `paket9-${new ObjectId().toHexString()}`;
const fremdId = `fremd-${new ObjectId().toHexString()}`;
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const locals = { benutzer } as any;
const id = () => new ObjectId();
const req = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ctx = (request?: Request, params?: Record<string, string>) => ({ locals, request, params }) as any;
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Testdatenbank!'); await client.connect(); });
afterAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Testdatenbank!');
  for (const name of ['artikel', 'artikelvarianten', 'vereinskleider_verkaeufe', 'vereinskleider_rechnungen', 'vereinskleider_sammelbestellungen', 'vereinskleider_gutschriften', 'inventuren', 'inventurpositionen', 'inventurprotokoll', 'schadensmeldungen']) {
    await db.collection(name).deleteMany({ vereinId: { $in: [vereinId, fremdId] } });
  }
  await db.collection('vereinskleider_rechnungsnummern').deleteMany({ vereinId });
  await client.close();
});
import * as route0 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: inventur-storno-offen.integration.test.ts
describe('Paket 9: offene Inventur stornieren', () => {
  it('storniert eine offene Inventur ohne Lagerbuchung und mit Protokoll', async () => {
    const inventur=id();const artikel=id();await db.collection('artikel').insertOne({_id:artikel,vereinId,name:'Ball',menge:10});
    await db.collection('inventuren').insertOne({_id:inventur,vereinId,status:'offen',version:0});
    const res=await route0.POST(ctx(req({begruendung:'Fehlerhafte Erfassung'}),{id:inventur.toHexString()}));
    expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toBe(0);
    expect((await db.collection('inventuren').findOne({_id:inventur}))?.status).toBe('storniert');
    expect((await db.collection('artikel').findOne({_id:artikel}))?.menge).toBe(10);
    expect(await db.collection('inventurprotokoll').countDocuments({vereinId,inventurId:inventur.toHexString(),aktion:'storniert'})).toBe(1);
  });
  it('verweigert die zweite Stornierung', async () => {
    const inventur=id();await db.collection('inventuren').insertOne({_id:inventur,vereinId,status:'storniert',version:1});
    const res=await route0.POST(ctx(req({begruendung:'Erneute Stornierung'}),{id:inventur.toHexString()}));expect(res.status).toBe(409);
  });
});
import * as route1 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: paket9-sammelbestellung-status.integration.test.ts
describe('Paket 9: Sammelbestellung Status', () => {
  it('setzt einen Entwurf auf bestellt', async () => {
    const bestellung=id();await db.collection('vereinskleider_sammelbestellungen').insertOne({_id:bestellung,vereinId,status:'entwurf',positionen:[{artikelId:id().toHexString(),groesseId:null,menge:2,artikelname:'Shirt'}],aktualisiertAm:new Date()});
    const res=await route1.PATCH(ctx(req({aktion:'bestellen'}),{id:bestellung.toHexString()}));expect(res.status).toBe(200);
    const d=await db.collection('vereinskleider_sammelbestellungen').findOne({_id:bestellung});expect(d?.status).toBe('bestellt');expect(d?.bestelltAm).toBeInstanceOf(Date);
  });
  it('verhindert erneutes Bestellen', async () => {
    const bestellung=id();await db.collection('vereinskleider_sammelbestellungen').insertOne({_id:bestellung,vereinId,status:'bestellt',positionen:[],aktualisiertAm:new Date()});
    const res=await route1.PATCH(ctx(req({aktion:'bestellen'}),{id:bestellung.toHexString()}));expect(res.status).toBe(409);
  });
  it('verhindert fremde Bestellungen', async () => {
    const bestellung=id();await db.collection('vereinskleider_sammelbestellungen').insertOne({_id:bestellung,vereinId:fremdId,status:'entwurf',positionen:[],aktualisiertAm:new Date()});
    const res=await route1.PATCH(ctx(req({aktion:'bestellen'}),{id:bestellung.toHexString()}));expect(res.status).toBe(404);
  });
});
import * as route2 from '../../../src/routes/api/meldungen/[id]/+server';

// Ursprüngliche Datei: paket9-schadensstatus.integration.test.ts
describe('Paket 9: Schadensstatus', () => {
  it('ändert Status und protokolliert den Bearbeiter', async () => {
    const meldung=id();await db.collection('schadensmeldungen').insertOne({_id:meldung,vereinId,status:'offen'});
    const res=await route2.PATCH(ctx(req({status:'erledigt',bearbeitungsnotiz:'  Behoben  '}),{id:meldung.toHexString()}));
    expect(res.status).toBe(200);
    const d=await db.collection('schadensmeldungen').findOne({_id:meldung});
    expect(d?.status).toBe('erledigt');expect(d?.bearbeitungsnotiz).toBe('Behoben');expect(d?.bearbeitetVonId).toBe(benutzer.id);
  });
  it('ändert fremde Meldungen nicht', async () => {
    const meldung=id();await db.collection('schadensmeldungen').insertOne({_id:meldung,vereinId:fremdId,status:'offen'});
    const res=await route2.PATCH(ctx(req({status:'erledigt',bearbeitungsnotiz:'Test'}),{id:meldung.toHexString()}));
    expect(res.status).toBe(404);expect((await db.collection('schadensmeldungen').findOne({_id:meldung}))?.status).toBe('offen');
  });
});
import * as route3 from '../../../src/routes/api/vereinskleider/bestellungen/historie/+server';

// Ursprüngliche Datei: paket9-uebergabehistorie.integration.test.ts
describe('Paket 9: Übergabehistorie', () => {
  it('liefert chronologisch sortierte Übergaben und keine fremden Daten', async () => {
    const a = id(), b = id(), artikel = id().toHexString();
    await db.collection('vereinskleider_verkaeufe').insertMany([
      { _id:a, vereinId, kaeufer:'A', positionen:[{artikelId:artikel, artikelname:'Shirt', groesseId:null}], uebergaben:[{positionsIndex:0,menge:2,uebergebenAm:new Date('2026-01-01')},{positionsIndex:0,menge:1,uebergebenAm:new Date('2026-02-01')}] },
      { _id:b, vereinId:fremdId, kaeufer:'Fremd', positionen:[{artikelId:artikel}], uebergaben:[{positionsIndex:0,menge:1,uebergebenAm:new Date()}] }
    ]);
    const res=await route3.GET(ctx()); const data=await res.json();
    expect(res.status).toBe(200); expect(data.historie).toHaveLength(2);
    expect(data.historie[0].menge).toBe(1); expect(data.historie.every((x:any)=>x.kaeufer==='A')).toBe(true);
  });
  it('ignoriert defekte Historieneinträge', async () => {
    await db.collection('vereinskleider_verkaeufe').insertOne({ _id:id(), vereinId, uebergaben:[{positionsIndex:-1,menge:2,uebergebenAm:new Date()},{positionsIndex:0,menge:0,uebergebenAm:new Date()},{positionsIndex:0,menge:1,uebergebenAm:'kaputt'}] });
    const data=await (await route3.GET(ctx())).json();
    expect(data.historie).toHaveLength(2);
    expect(data.historie.every((eintrag: any) => eintrag.kaeufer === 'A')).toBe(true);
    expect(data.historie.map((eintrag: any) => eintrag.menge)).toEqual([1, 2]);
  });
});
import * as route4 from '../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: rechnung-transaktion.integration.test.ts
describe('Paket 9: Rechnungserstellung Transaktion', () => {
  it('erstellt eine Rechnung und verknüpft sie genau einmal mit dem Verkauf', async () => {
    const verkauf=id();await db.collection('vereinskleider_verkaeufe').insertOne({_id:verkauf,vereinId,kaeufer:'Testperson',zahlungsart:'rechnung',positionen:[{artikelId:id().toHexString(),groesseId:null,artikelname:'Shirt',menge:2,einzelpreis:15,positionsbetrag:30,verkaufsart:'bestellung'}],zwischentotal:30,rabattTotal:0,endbetrag:30,bezahltBetrag:0,zahlungen:[],erstelltAm:new Date()});
    const first=await route4.POST(ctx(req({verkaufId:verkauf.toHexString()})));expect(first.status).toBe(201);
    const data=await first.json();expect(data.rechnung.gesamtbetrag).toBe(30);
    const sale=await db.collection('vereinskleider_verkaeufe').findOne({_id:verkauf});expect(sale?.rechnungId).toBe(data.rechnung._id);
    const invoice=await db.collection('vereinskleider_rechnungen').findOne({_id:new ObjectId(data.rechnung._id)});expect(invoice?.status).toBe('offen');
    const second=await route4.POST(ctx(req({verkaufId:verkauf.toHexString()})));expect(second.status).toBe(409);
    expect(await db.collection('vereinskleider_rechnungen').countDocuments({vereinId,verkaufId:verkauf.toHexString()})).toBe(1);
  });
  it('weist einen Verkauf eines anderen Vereins zurück', async () => {
    const verkauf=id();await db.collection('vereinskleider_verkaeufe').insertOne({_id:verkauf,vereinId:fremdId,kaeufer:'Fremd',positionen:[],erstelltAm:new Date()});
    const res=await route4.POST(ctx(req({verkaufId:verkauf.toHexString()})));expect(res.status).toBe(404);
  });
});
import * as route5 from '../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: rechnungsuebersicht.integration.test.ts
describe('Paket 9: Rechnungsübersicht', () => {
  it('trennt Rechnungen und unverrechnete Verkäufe vereinsbezogen', async () => {
    // Testdaten isolieren: vorherige Tests dieser konsolidierten Datei
    // können bereits Rechnungen und Verkäufe angelegt haben.
    await Promise.all([
      db.collection('vereinskleider_rechnungen').deleteMany({ vereinId: { $in: [vereinId, fremdId] } }),
      db.collection('vereinskleider_verkaeufe').deleteMany({ vereinId: { $in: [vereinId, fremdId] } })
    ]);
    await db.collection('vereinskleider_rechnungen').insertMany([{_id:id(),vereinId,rechnungsnummer:'T-1',erstelltAm:new Date()},{_id:id(),vereinId:fremdId,rechnungsnummer:'F-1',erstelltAm:new Date()}]);
    await db.collection('vereinskleider_verkaeufe').insertMany([{_id:id(),vereinId,kaeufer:'Eigen',endbetrag:20,erstelltAm:new Date()},{_id:id(),vereinId,kaeufer:'Berechnet',rechnungId:id().toHexString(),erstelltAm:new Date()},{_id:id(),vereinId:fremdId,kaeufer:'Fremd',erstelltAm:new Date()}]);
    const res=await route5.GET(ctx());const d=await res.json();expect(res.status).toBe(200);
    expect(d.rechnungen).toHaveLength(1);expect(d.unverrechneteVerkaeufe).toHaveLength(1);
    expect(d.unverrechneteVerkaeufe[0].kaeufer).toBe('Eigen');
  });
  it('verweigert nicht angemeldeten Benutzern die Übersicht', async () => {
    const res=await route5.GET({locals:{benutzer:null}} as any);expect(res.status).toBe(401);
  });
});
