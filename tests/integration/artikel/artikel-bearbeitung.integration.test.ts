import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn(), countDocuments: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(), insertOne: vi.fn(), insertMany: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn(), withTransaction: vi.fn(), endSession: vi.fn(), startSession: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: m.startSession } }));

import { GET as suite0_GET, PATCH as suite0_PATCH, DELETE as suite0_DELETE } from '../../../src/routes/api/artikel/[id]/+server';

describe('artikel-bearbeitung', () => {
const GET = suite0_GET;
const PATCH = suite0_PATCH;
const DELETE = suite0_DELETE;
beforeEach(() => { vi.resetAllMocks(); });
const id = new ObjectId().toHexString();
const id2 = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const ctx = (method: string, data?: unknown, itemId=id) => ({ params: { id: itemId }, locals: { benutzer }, request: new Request('http://localhost/api/test', { method, ...(method !== 'GET' && method !== 'DELETE' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {}) }) }) as never;
beforeEach(() => {
 vi.resetAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {});
 m.collection.mockReturnValue(m); m.find.mockReturnValue(m); m.sort.mockReturnValue(m); m.toArray.mockResolvedValue([]);
 m.findOne.mockResolvedValue(null); m.countDocuments.mockResolvedValue(0); m.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
 m.insertOne.mockResolvedValue({ insertedId: new ObjectId() }); m.insertMany.mockResolvedValue({ insertedCount: 1 });
 m.deleteOne.mockResolvedValue({ deletedCount: 1 }); m.deleteMany.mockResolvedValue({ deletedCount: 1 });
 m.withTransaction.mockImplementation(async (cb: () => Promise<void>) => { await cb(); });
 m.startSession.mockReturnValue({ withTransaction: m.withTransaction, endSession: m.endSession });
});

const patch=(d:unknown)=>PATCH(ctx('PATCH',d));
const good={name:'Ball',kategorieId:id2,lagerortId:id2,menge:2,einzelwert:5,beschreibung:'',hatGroessen:false,mindestbestand:0};
describe('Artikelbearbeitung zusätzliche Fälle',()=>{
 it('GET Datenbankfehler',async()=>{m.findOne.mockRejectedValueOnce(new Error('DB'));expect((await GET(ctx('GET'))).status).toBe(500)});
 it('GET Artikel mit Varianten und Standardwerten',async()=>{m.findOne.mockResolvedValueOnce({_id:new ObjectId(id),hatGroessen:true});m.toArray.mockResolvedValueOnce([{_id:new ObjectId(id2),artikelId:id,groesseId:id2,menge:2}]);const r=await GET(ctx('GET'));expect(r.status).toBe(200);expect((await r.json()).varianten[0]).toMatchObject({einzelwert:0,mindestbestand:0,aktiv:true})});
 it.each([null,[],4])('PATCH ungültiges Objekt %j',async d=>{expect((await patch(d)).status).toBe(400)});
 it.each([{mindestbestand:-1},{mindestbestand:1.5},{name:' '},{kategorieId:'falsch'},{einzelwert:-1},{hatGroessen:'ja'},{beschreibung:2},{lieferantId:'falsch'},{istVereinskleidung:'ja'},{menge:-1},{menge:1.5}])('PATCH ungültige Angaben %j',async d=>{expect((await patch({...good,...d})).status).toBe(400)});
 it('PATCH Grössenvarianten fehlen',async()=>{expect((await patch({...good,hatGroessen:true})).status).toBe(400)});
 it('PATCH Grössenvariante ungültig',async()=>{expect((await patch({...good,hatGroessen:true,varianten:[{groesseId:'x',menge:1,einzelwert:2,mindestbestand:0}]})).status).toBe(400)});
 it('PATCH doppelte Grössen',async()=>{const v={groesseId:id2,menge:1,einzelwert:2,mindestbestand:0};expect((await patch({...good,hatGroessen:true,varianten:[v,v]})).status).toBe(400)});
 it('PATCH Artikel fehlt',async()=>{expect((await patch(good)).status).toBe(404)});
 it('PATCH Grössentyp kann nicht wechseln',async()=>{m.findOne.mockResolvedValueOnce({hatGroessen:true});expect((await patch(good)).status).toBe(400)});
 it('PATCH Kategorie fehlt',async()=>{m.findOne.mockResolvedValueOnce({hatGroessen:false});expect((await patch(good)).status).toBe(400)});
 it('PATCH Lieferant fehlt',async()=>{m.findOne.mockResolvedValueOnce({hatGroessen:false}).mockResolvedValueOnce({_id:new ObjectId(id2)}).mockResolvedValueOnce({_id:new ObjectId(id2)}).mockResolvedValueOnce(null);expect((await patch({...good,lieferantId:id2})).status).toBe(400)});
 it('PATCH erfolgreich ohne Grössen',async()=>{m.findOne.mockResolvedValue({_id:new ObjectId(id),hatGroessen:false});expect((await patch(good)).status).toBe(200);expect(m.endSession).toHaveBeenCalled()});
 it('PATCH Transaktionsfehler',async()=>{m.findOne.mockResolvedValue({_id:new ObjectId(id),hatGroessen:false});m.updateOne.mockResolvedValueOnce({matchedCount:0});expect((await patch(good)).status).toBe(500)});
 it('DELETE Artikel fehlt',async()=>{expect((await DELETE(ctx('DELETE'))).status).toBe(404)});
 it('DELETE durch Ausleihe blockiert',async()=>{m.findOne.mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce({_id:new ObjectId()});expect((await DELETE(ctx('DELETE'))).status).toBe(409)});
 it('DELETE durch Meldung blockiert',async()=>{m.findOne.mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null).mockResolvedValueOnce({_id:new ObjectId()});expect((await DELETE(ctx('DELETE'))).status).toBe(409)});
 it('DELETE erfolgreich',async()=>{m.findOne.mockResolvedValueOnce({_id:new ObjectId(id)});expect((await DELETE(ctx('DELETE'))).status).toBe(200);expect(m.deleteMany).toHaveBeenCalled();expect(m.endSession).toHaveBeenCalled()});
 it('DELETE fehlgeschlagene Löschung',async()=>{m.findOne.mockResolvedValueOnce({_id:new ObjectId(id)});m.deleteOne.mockResolvedValueOnce({deletedCount:0});expect((await DELETE(ctx('DELETE'))).status).toBe(500)});
});
});

import * as suite1_route0 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route1 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route2 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route3 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route4 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route5 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route6 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route7 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route8 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route9 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route10 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route11 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route12 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route13 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route14 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route15 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route16 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route17 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route18 from '../../../src/routes/api/artikel/[id]/+server';

import * as suite1_route19 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route20 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route21 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route22 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route23 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route24 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route25 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

import * as suite1_route26 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

describe('artikel-id', () => {
const route0 = suite1_route0;
const route1 = suite1_route1;
const route2 = suite1_route2;
const route3 = suite1_route3;
const route4 = suite1_route4;
const route5 = suite1_route5;
const route6 = suite1_route6;
const route7 = suite1_route7;
const route8 = suite1_route8;
const route9 = suite1_route9;
const route10 = suite1_route10;
const route11 = suite1_route11;
const route12 = suite1_route12;
const route13 = suite1_route13;
const route14 = suite1_route14;
const route15 = suite1_route15;
const route16 = suite1_route16;
const route17 = suite1_route17;
const route18 = suite1_route18;
const route19 = suite1_route19;
const route20 = suite1_route20;
const route21 = suite1_route21;
const route22 = suite1_route22;
const route23 = suite1_route23;
const route24 = suite1_route24;
const route25 = suite1_route25;
const route26 = suite1_route26;
beforeEach(() => { vi.resetAllMocks(); });
const id = new ObjectId().toString();
const vereinId = new ObjectId().toString();
const kategorieId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const event = (method: string, body?: unknown, rolle = 'admin') => ({
  locals: { benutzer: { id, vereinId, rolle } }, params: { id },
  url: new URL('http://localhost/api/test'),
  request: new Request('http://localhost/api/test', { method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  })
});
const payload = () => ({
  name: 'Trainingsmaterial', kategorieId, lagerortId,
  menge: 4, einzelwert: 12.5, mindestbestand: 1,
  hatGroessen: false, beschreibung: 'Vereinsinventar'
});
beforeEach(() => {
  vi.clearAllMocks();
  m.collection.mockImplementation(() => m);
  m.findOne.mockResolvedValue(null);
  m.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  m.deleteOne.mockResolvedValue({ deletedCount: 1 });
  m.deleteMany.mockResolvedValue({ deletedCount: 0 });
  m.countDocuments.mockResolvedValue(1);
  m.find.mockReturnValue({ toArray: async () => [], sort: () => ({ toArray: async () => [] }),
    project: () => ({ toArray: async () => [] }) });
  m.startSession.mockReturnValue({ withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {} });
});


// Ursprüngliche Datei: 23-artikel-delete-ausleihe.integration.test.ts
describe('23-artikel-delete-ausleihe', () => {
  it('Ausgeliehener Artikel wird geschützt', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
    const response = await route0.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(409);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-delete-erfolg.integration.test.ts
describe('23-artikel-delete-erfolg', () => {
  it('Artikel und Varianten werden gelöscht', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    const response = await route1.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(200);
    expect(m.deleteMany).toHaveBeenCalledOnce();
    expect(m.deleteOne).toHaveBeenCalledOnce();
  });
});



// Ursprüngliche Datei: 23-artikel-delete-fehler.integration.test.ts
describe('23-artikel-delete-fehler', () => {
  it('Fehlgeschlagenes Löschen liefert Fehler', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    const response = await route2.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(500);
    expect(m.deleteOne).toHaveBeenCalledOnce();
  });
});



// Ursprüngliche Datei: 23-artikel-delete-schaden.integration.test.ts
describe('23-artikel-delete-schaden', () => {
  it('Artikel mit Schadensmeldung wird geschützt', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce(null);
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
    const response = await route3.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(409);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-lese-erfolg.integration.test.ts
describe('23-artikel-lese-erfolg', () => {
  it('Artikel ohne Grössen wird geladen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), name: 'Ball', hatGroessen: false });
    const response = await route4.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe('Ball');
  });
});



// Ursprüngliche Datei: 23-artikel-lese-varianten.integration.test.ts
describe('23-artikel-lese-varianten', () => {
  it('Varianten werden mit Beständen geladen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), name: 'Shirt', hatGroessen: true });
    m.find.mockReturnValueOnce({ toArray: async () => [{ _id: new ObjectId(), artikelId: id, groesseId, menge: 3, einzelwert: 15, mindestbestand: 1 }] });
    const response = await route5.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).varianten).toHaveLength(1);
  });
});



// Ursprüngliche Datei: 23-artikel-update-bestandschutz.integration.test.ts
describe('23-artikel-update-bestandschutz', () => {
  it('Nicht ausgewählte Grösse mit Bestand verhindert Änderung', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: true });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    m.find.mockReturnValueOnce({ toArray: async () => [{ groesseId: id, menge: 5 }] });
    const response = await route6.PATCH(event('PATCH', { ...payload(), hatGroessen: true, varianten: [{ groesseId, menge: 3, einzelwert: 15, mindestbestand: 1 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-erfolg.integration.test.ts
describe('23-artikel-update-erfolg', () => {
  it('Artikel wird atomar aktualisiert', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    const response = await route7.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(200);
    expect(m.updateOne).toHaveBeenCalledOnce();
    expect((await response.json()).gesamtmenge).toBe(4);
  });
});



// Ursprüngliche Datei: 23-artikel-update-fremde-kategorie.integration.test.ts
describe('23-artikel-update-fremde-kategorie', () => {
  it('Kategorie aus anderem Verein abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    const response = await route8.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-fremder-artikel.integration.test.ts
describe('23-artikel-update-fremder-artikel', () => {
  it('Nicht vorhandener Vereinsartikel', async () => {
    const response = await route9.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(404);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-groessentyp.integration.test.ts
describe('23-artikel-update-groessentyp', () => {
  it('Grössentyp kann nicht gewechselt werden', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: true });
    const response = await route10.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-invalid-minimum.integration.test.ts
describe('23-artikel-update-invalid-minimum', () => {
  it('23-artikel-update-invalid-minimum', async () => {
    const response = await route11.PATCH(event('PATCH', { ...payload(), mindestbestand: -1 }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-invalid-name.integration.test.ts
describe('23-artikel-update-invalid-name', () => {
  it('23-artikel-update-invalid-name', async () => {
    const response = await route12.PATCH(event('PATCH', { ...payload(), name: '' }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-invalid-price.integration.test.ts
describe('23-artikel-update-invalid-price', () => {
  it('23-artikel-update-invalid-price', async () => {
    const response = await route13.PATCH(event('PATCH', { ...payload(), einzelwert: -5 }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-invalid-stock.integration.test.ts
describe('23-artikel-update-invalid-stock', () => {
  it('23-artikel-update-invalid-stock', async () => {
    const response = await route14.PATCH(event('PATCH', { ...payload(), menge: -2 }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-invalid-supplier.integration.test.ts
describe('23-artikel-update-invalid-supplier', () => {
  it('23-artikel-update-invalid-supplier', async () => {
    const response = await route15.PATCH(event('PATCH', { ...payload(), lieferantId: 'abc' }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-invalid-variant.integration.test.ts
describe('23-artikel-update-invalid-variant', () => {
  it('23-artikel-update-invalid-variant', async () => {
    const response = await route16.PATCH(event('PATCH', { ...payload(), hatGroessen: true, varianten: [] }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-lieferant.integration.test.ts
describe('23-artikel-update-lieferant', () => {
  it('Fremder Lieferant wird abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    const response = await route17.PATCH(event('PATCH', { ...payload(), lieferantId: id }) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-artikel-update-varianten.integration.test.ts
describe('23-artikel-update-varianten', () => {
  it('Grössenvarianten werden aktualisiert', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: true });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    const response = await route18.PATCH(event('PATCH', { ...payload(), hatGroessen: true, varianten: [{ groesseId, menge: 3, einzelwert: 15, mindestbestand: 1 }] }) as never);
    expect(response.status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledOnce();
    expect(m.updateOne).toHaveBeenCalledTimes(2);
  });
});



// Ursprüngliche Datei: 23-sammel-status-bereits-bestellt.integration.test.ts
describe('23-sammel-status-bereits-bestellt', () => {
  it('Bestellte Bestellung nicht erneut bestellen', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt' });
    const response = await route19.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-sammel-status-bestellen.integration.test.ts
describe('23-sammel-status-bestellen', () => {
  it('Entwurf wird bestellt', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'entwurf' });
    const response = await route20.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('bestellt');
  });
});



// Ursprüngliche Datei: 23-sammel-status-fehlt.integration.test.ts
describe('23-sammel-status-fehlt', () => {
  it('Fehlende Bestellung', async () => {
    const response = await route21.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(404);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-sammel-status-konflikt.integration.test.ts
describe('23-sammel-status-konflikt', () => {
  it('Konkurrierende Statusänderung', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'entwurf' });
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    const response = await route22.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).toHaveBeenCalledOnce();
  });
});



// Ursprüngliche Datei: 23-sammel-wareneingang-erfolg.integration.test.ts
describe('23-sammel-wareneingang-erfolg', () => {
  it('Wareneingang erhöht Bestand und schliesst Bestellung ab', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt', positionen: [{ artikelId: id, groesseId: null, menge: 2, geliefertMenge: 0, artikelname: 'Ball' }] });
    m.findOne.mockResolvedValueOnce({ menge: 5 });
    const response = await route23.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 2 }] }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('geliefert');
    expect(m.updateOne).toHaveBeenCalledTimes(2);
  });
});



// Ursprüngliche Datei: 23-sammel-wareneingang-menge.integration.test.ts
describe('23-sammel-wareneingang-menge', () => {
  it('Überlieferung wird abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt', positionen: [{ artikelId: id, groesseId: null, menge: 1, geliefertMenge: 0, artikelname: 'Ball' }] });
    const response = await route24.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 2 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-sammel-wareneingang-position.integration.test.ts
describe('23-sammel-wareneingang-position', () => {
  it('Fremde Lieferposition wird abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt', positionen: [] });
    const response = await route25.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 1 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: 23-sammel-wareneingang-status.integration.test.ts
describe('23-sammel-wareneingang-status', () => {
  it('Wareneingang nur bei bestellt', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'entwurf' });
    const response = await route26.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 1 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});


});

import { GET as suite2_GET, POST as suite2_POST } from '../../../src/routes/api/artikel/+server';

describe('artikel-validierung-zusatz', () => {
const GET = suite2_GET;
const POST = suite2_POST;
const mocks = m;
beforeEach(() => { vi.resetAllMocks(); });
const vereinId = new ObjectId().toString();
const kategorieId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const base = () => ({ name: '  Testartikel  ', kategorieId, lagerortId, menge: 2,
  einzelwert: 10, mindestbestand: 1, hatGroessen: false, beschreibung: 'Test' });
const event = (body: unknown) => ({
  locals: { benutzer: { id: new ObjectId().toString(), vereinId, rolle: 'admin' } },
  request: new Request('http://localhost/api/artikel', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue(mocks);
  mocks.findOne.mockResolvedValue({ _id: new ObjectId() });
  mocks.countDocuments.mockResolvedValue(1);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
  mocks.insertMany.mockResolvedValue({ acknowledged: true });
  mocks.deleteMany.mockResolvedValue({ deletedCount: 0 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.find.mockReturnValue({ sort: () => ({ toArray: async () => [] }) });
});

describe('Artikel-API: zusätzliche Validierungszweige', () => {
  it('Null als Payload', async () => {
    const response = await POST(event(null) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Array statt Objekt', async () => {
    const response = await POST(event([]) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Leerer Name', async () => {
    const response = await POST(event({ ...base(), name: '  ' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Name ist Zahl', async () => {
    const response = await POST(event({ ...base(), name: 123 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Kategorie ungültig', async () => {
    const response = await POST(event({ ...base(), kategorieId: 'abc' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Lagerort ungültig', async () => {
    const response = await POST(event({ ...base(), lagerortId: 'abc' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Einzelwert fehlt', async () => {
    const response = await POST(event({ ...base(), einzelwert: null }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Einzelwert negativ', async () => {
    const response = await POST(event({ ...base(), einzelwert: -1 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Vereinskleidung kein Boolean', async () => {
    const response = await POST(event({ ...base(), istVereinskleidung: 'ja' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('hatGroessen kein Boolean', async () => {
    const response = await POST(event({ ...base(), hatGroessen: 'nein' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Beschreibung kein String', async () => {
    const response = await POST(event({ ...base(), beschreibung: 3 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Lieferant ungültig', async () => {
    const response = await POST(event({ ...base(), lieferantId: 'falsch' }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Mindestbestand negativ', async () => {
    const response = await POST(event({ ...base(), mindestbestand: -1 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Mindestbestand Dezimalzahl', async () => {
    const response = await POST(event({ ...base(), mindestbestand: 1.5 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Menge negativ', async () => {
    const response = await POST(event({ ...base(), menge: -1 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Menge Dezimalzahl', async () => {
    const response = await POST(event({ ...base(), menge: 1.5 }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenliste fehlt', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenliste leer', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante null', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [null] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante falsche ID', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId: 'ungültig', menge: 1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante negative Menge', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: -1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante negativer Wert', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: 1, einzelwert: -10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Grössenvariante negativer Mindestbestand', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: -1 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Doppelte Grössenvariante', async () => {
    const response = await POST(event({ ...base(), hatGroessen: true, varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: 0 }, { groesseId, menge: 2, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('Kategorie aus anderem Verein verhindert das Anlegen', async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    const response = await POST(event(base()) as never);
    expect(response.status).toBe(400);
  });
  it('Lagerort aus anderem Verein verhindert das Anlegen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId() }).mockResolvedValueOnce(null);
    const response = await POST(event(base()) as never);
    expect(response.status).toBe(400);
  });
  it('Unbekannter Lieferant verhindert das Anlegen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId() })
      .mockResolvedValueOnce({ _id: new ObjectId() }).mockResolvedValueOnce(null);
    const response = await POST(event({ ...base(), lieferantId: new ObjectId().toString() }) as never);
    expect(response.status).toBe(400);
  });
  it('Nicht vorhandene Grösse verhindert das Anlegen', async () => {
    mocks.countDocuments.mockResolvedValueOnce(0);
    const response = await POST(event({ ...base(), hatGroessen: true,
      varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(400);
  });
  it('Fehler beim Anlegen wird als 500 zurückgegeben', async () => {
    mocks.insertOne.mockRejectedValueOnce(new Error('Datenbankfehler'));
    const response = await POST(event(base()) as never);
    expect(response.status).toBe(500);
  });
  it('Fehler beim Anlegen von Varianten löst Rollback aus', async () => {
    mocks.insertMany.mockRejectedValueOnce(new Error('Variantenfehler'));
    const response = await POST(event({ ...base(), hatGroessen: true,
      varianten: [{ groesseId, menge: 1, einzelwert: 10, mindestbestand: 0 }] }) as never);
    expect(response.status).toBe(500);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
    expect(mocks.deleteOne).toHaveBeenCalledOnce();
  });
  it('GET meldet Datenbankfehler mit Status 500', async () => {
    mocks.find.mockImplementationOnce(() => { throw new Error('Datenbankfehler'); });
    const response = await GET({ locals: event(base()).locals } as never);
    expect(response.status).toBe(500);
  });
});

});
