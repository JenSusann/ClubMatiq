import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, event, oid, vereinId } from '../../helper';
vi.mock('../../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../../src/lib/server/mongodb';


afterAll(async () => { await client.close(); });
import { PATCH as wareneingang } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';
import * as route0 from '../../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

describe('uebergabe-erfolg', () => {

const orders: ObjectId[] = []; const sales: ObjectId[] = []; const articles: ObjectId[] = [];
async function fixture(stock = 10, reserved = 2, ordered = 3) { const sale = oid(), article = oid(); sales.push(sale); articles.push(article); await db.collection('artikel').insertOne({ _id: article, vereinId, menge: stock, hatGroessen: false }); await db.collection('vereinskleider_verkaeufe').insertOne({ _id: sale, vereinId, positionen: [{ artikelId: article.toString(), groesseId: null, verkaufsart: 'bestellung', menge: ordered, uebergebenMenge: 0, reserviertMenge: reserved }], erstelltAm: new Date() }); return { sale, article }; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('vereinskleider_sammelbestellungen').deleteMany({_id:{$in:orders}}); await db.collection('lagerbewegungen').deleteMany({vereinId, artikelId: {$in: articles.map(a=>a.toString())}}); await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: sales } }); await db.collection('artikel').deleteMany({ _id: { $in: articles } });  });


// Ursprüngliche Datei: uebergabe-erfolg.integration.test.ts
describe('Paket 8 – Kleiderübergabe', () => {
 it('übergibt reservierte Ware und reduziert Lager', async () => { const f = await fixture(); const res = await route0.POST(event({ vorgangId: f.sale.toString(), positionsIndex: 0, menge: 2 })); expect(res.status).toBe(200); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(8); const v = await db.collection('vereinskleider_verkaeufe').findOne({ _id: f.sale }); expect(v?.positionen[0].uebergebenMenge).toBe(2); expect(v?.uebergaben).toHaveLength(1); });
 it('Issue #65: tatsächlicher Wareneingang und Übergabe bis Bestand null', async () => {
   const f=await fixture(0,0,1), order=oid(); orders.push(order);
   const position={artikelId:f.article.toString(),groesseId:null,menge:1};
   await db.collection('vereinskleider_sammelbestellungen').insertOne({_id:order,vereinId,status:'bestellt',positionen:[{...position,artikelname:'Testartikel',geliefertMenge:0}]});
   expect((await wareneingang(event({aktion:'wareneingang',positionen:[position]},order.toString()))).status).toBe(200);
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(1);
   expect((await db.collection('vereinskleider_sammelbestellungen').findOne({_id:order}))?.status).toBe('geliefert');
   expect((await route0.POST(event({vorgangId:f.sale.toString(),positionsIndex:0,menge:1}))).status).toBe(200);
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(0);
   const sale=await db.collection('vereinskleider_verkaeufe').findOne({_id:f.sale});
   expect(sale?.status).toBe('abgeschlossen');
   expect(sale?.uebergaben).toHaveLength(1);
   const journal=await db.collection('lagerbewegungen').find({vereinId,artikelId:f.article.toString()}).toArray();
   expect(journal).toHaveLength(2);
   expect(journal).toEqual(expect.arrayContaining([expect.objectContaining({art:'wareneingang',mengeDelta:1}),expect.objectContaining({art:'verkauf',mengeDelta:-1})]));
 });
 it('Issue #65: fremder Verein kann Bestellung nicht übergeben', async () => {
   const f=await fixture(1,0,1);
   const ev=event({vorgangId:f.sale.toString(),positionsIndex:0,menge:1});
   ev.locals={benutzer:{...ev.locals.benutzer,vereinId:oid().toString()}};
   expect((await route0.POST(ev)).status).toBe(404);
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(1);
   expect(await db.collection('lagerbewegungen').countDocuments({referenzId:f.sale.toString()})).toBe(0);
 });
 it('Issue #65: Rollback bei fehlgeschlagenem Journalinsert', async () => {
   const f=await fixture(1,0,1);
   const original=db.collection.bind(db);
   const spy=vi.spyOn(db,'collection').mockImplementation(((name:string,...args:any[])=>{
     const collection=original(name,...args);
     if(name==='lagerbewegungen') vi.spyOn(collection,'insertOne').mockRejectedValueOnce(new Error('Test: Journalfehler'));
     return collection;
   }) as typeof db.collection);
   try {
     expect((await route0.POST(event({vorgangId:f.sale.toString(),positionsIndex:0,menge:1}))).status).toBe(500);
   } finally { spy.mockRestore(); }
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(1);
   const sale=await db.collection('vereinskleider_verkaeufe').findOne({_id:f.sale});
   expect(sale?.positionen[0].uebergebenMenge).toBe(0);
   expect(sale?.uebergaben??[]).toHaveLength(0);
   expect(await db.collection('lagerbewegungen').countDocuments({referenzId:f.sale.toString()})).toBe(0);
 });
 it('Issue #65: übergibt das letzte unreservierte Stück', async () => {
   const f=await fixture(1,0,1);
   const res=await route0.POST(event({vorgangId:f.sale.toString(),positionsIndex:0,menge:1}));
   expect(res.status).toBe(200);
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(0);
   const v=await db.collection('vereinskleider_verkaeufe').findOne({_id:f.sale});
   expect(v?.status).toBe('abgeschlossen');
   expect(v?.positionen[0].uebergebenMenge).toBe(1);
   expect(v?.uebergaben).toHaveLength(1);
   expect(await db.collection('lagerbewegungen').findOne({vereinId,referenzId:f.sale.toString()})).toMatchObject({mengeDelta:-1,art:'verkauf'});
 });
 it('Issue #65: schützt das letzte fremdreservierte Stück', async () => {
   const f=await fixture(1,0,1), fremd=oid(); sales.push(fremd);
   await db.collection('vereinskleider_verkaeufe').insertOne({_id:fremd,vereinId,positionen:[{artikelId:f.article.toString(),groesseId:null,verkaufsart:'bestellung',menge:1,uebergebenMenge:0,reserviertMenge:1}]});
   expect((await route0.POST(event({vorgangId:f.sale.toString(),positionsIndex:0,menge:1}))).status).toBe(409);
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(1);
   expect(await db.collection('lagerbewegungen').countDocuments({vereinId,referenzId:f.sale.toString()})).toBe(0);
 });
 it('Issue #65: übergibt das letzte Stück als Teilübergabe', async () => {
   const f=await fixture(1,0,3);
   expect((await route0.POST(event({vorgangId:f.sale.toString(),positionsIndex:0,menge:1}))).status).toBe(200);
   const v=await db.collection('vereinskleider_verkaeufe').findOne({_id:f.sale});
   expect(v?.status).toBe('offen');
   expect(v?.positionen[0].uebergebenMenge).toBe(1);
   expect((await db.collection('artikel').findOne({_id:f.article}))?.menge).toBe(0);
 });
 it('verhindert Übergabe über offene Menge', async () => { const f = await fixture(); expect((await route0.POST(event({ vorgangId: f.sale.toString(), positionsIndex: 0, menge: 4 }))).status).toBe(409); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(10); });
 it('verhindert Übergabe bei zu wenig Lager', async () => { const f = await fixture(0, 0); const res = await route0.POST(event({ vorgangId: f.sale.toString(), positionsIndex: 0, menge: 1 })); expect(res.status).toBe(409); expect((await db.collection('artikel').findOne({ _id: f.article }))?.menge).toBe(0); });
});


});
import * as route1 from '../../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

describe('vereinskleider-uebergaben', () => {
const route0 = route1;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/bestellungen/uebergabe', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/vereinskleider/bestellungen/uebergabe')
  } as never;
}


// Ursprüngliche Datei: vereinskleider-uebergaben.integration.test.ts
describe('vereinskleider/bestellungen/uebergabe', () => {
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
});


});
