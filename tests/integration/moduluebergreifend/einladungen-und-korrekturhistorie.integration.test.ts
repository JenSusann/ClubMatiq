import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({
 collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), createIndex: vi.fn(), updateOne: vi.fn(),
 insertOne: vi.fn(), startSession: vi.fn(), endSession: vi.fn(), withTransaction: vi.fn(),
 hash: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
 db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('argon2', () => ({ hash: m.hash, argon2id: 2 }));
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const groesseId = new ObjectId().toHexString();
const token = 'a'.repeat(64);
const ev = (method: string, body?: unknown, query = '') => ({
 locals: { benutzer: { id, vereinId, rolle: 'admin' } },
 params: { id }, url: new URL('http://localhost/api/test' + query),
 cookies: { set: vi.fn() },
 request: new Request('http://localhost/api/test', {
  method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body) })
 })
});
beforeEach(() => {
 vi.clearAllMocks();
 m.collection.mockImplementation(() => m);
 m.findOne.mockResolvedValue(null);
 m.find.mockReturnValue({ toArray: async () => [], sort: () => ({ toArray: async () => [] }),
 project: () => ({ toArray: async () => [] }) });
 m.createIndex.mockResolvedValue('unique_vereinskleider_preis');
 m.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
 m.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
 m.hash.mockResolvedValue('argon-hash');
 m.startSession.mockReturnValue({ withTransaction: async (fn: () => Promise<unknown>) => fn(),
 endSession: m.endSession });
});
import * as route0 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-abgelaufen.integration.test.ts
describe('25-einladung-annehmen-abgelaufen', () => {
 it('prüft den realen Handler', async () => {

  const response = await route0.POST(ev('POST', { token, passwort: 'SehrSicheresPasswort123' }, '') as never);
  expect(response.status).toBe(410);
  expect(m.insertOne).not.toHaveBeenCalled();
  expect(m.endSession).toHaveBeenCalledOnce();
 });
});

import * as route1 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-doppelte-email.integration.test.ts
describe('25-einladung-annehmen-doppelte-email', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId(), email: 'test@example.ch', vorname: 'Eva', nachname: 'Test', vereinId, rolle: 'mitglied' });
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
  const response = await route1.POST(ev('POST', { token, passwort: 'SehrSicheresPasswort123' }, '') as never);
  expect(response.status).toBe(409);
  expect(m.insertOne).not.toHaveBeenCalled();
 });
});

import * as route2 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-erfolg.integration.test.ts
describe('25-einladung-annehmen-erfolg', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId(), email: 'test@example.ch', vorname: 'Eva', nachname: 'Test', vereinId, rolle: 'mitglied' });
  const response = await route2.POST(ev('POST', { token, passwort: 'SehrSicheresPasswort123' }, '') as never);
  expect(response.status).toBe(200);
  expect(m.updateOne).toHaveBeenCalledOnce();
  expect(m.insertOne).toHaveBeenCalledOnce();
  expect(m.endSession).toHaveBeenCalledOnce();
 });
});

import * as route3 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-insert-fehler.integration.test.ts
describe('25-einladung-annehmen-insert-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId(), email: 'test@example.ch', vorname: 'Eva', nachname: 'Test', vereinId, rolle: 'mitglied' });
  m.insertOne.mockRejectedValueOnce(new Error('DB'));
  const response = await route3.POST(ev('POST', { token, passwort: 'SehrSicheresPasswort123' }, '') as never);
  expect(response.status).toBe(500);
  expect(m.endSession).toHaveBeenCalledOnce();
 });
});

import * as route4 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-konflikt.integration.test.ts
describe('25-einladung-annehmen-konflikt', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId(), email: 'test@example.ch', vorname: 'Eva', nachname: 'Test', vereinId, rolle: 'mitglied' });
  m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
  const response = await route4.POST(ev('POST', { token, passwort: 'SehrSicheresPasswort123' }, '') as never);
  expect(response.status).toBe(410);
  expect(m.insertOne).not.toHaveBeenCalled();
 });
});

import * as route5 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-kurzes-passwort.integration.test.ts
describe('25-einladung-annehmen-kurzes-passwort', () => {
 it('prüft den realen Handler', async () => {

  const response = await route5.POST(ev('POST', { token, passwort: 'kurz' }, '') as never);
  expect(response.status).toBe(400);
  expect(m.startSession).not.toHaveBeenCalled();
 });
});

import * as route6 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-annehmen-token-fehlt.integration.test.ts
describe('25-einladung-annehmen-token-fehlt', () => {
 it('prüft den realen Handler', async () => {

  const response = await route6.POST(ev('POST', { passwort: 'SehrSicheresPasswort123' }, '') as never);
  expect(response.status).toBe(400);
  expect(m.startSession).not.toHaveBeenCalled();
 });
});

import * as route7 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-lesen-erfolg.integration.test.ts
describe('25-einladung-lesen-erfolg', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId(), email: 'test@example.ch', vorname: 'Eva', nachname: 'Test', vereinId, rolle: 'mitglied' });
  const response = await route7.GET(ev('GET', undefined, '?token=' + token) as never);
  expect(response.status).toBe(200);
  expect((await response.json()).email).toBe('test@example.ch');
 });
});

import * as route8 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-lesen-fehlt.integration.test.ts
describe('25-einladung-lesen-fehlt', () => {
 it('prüft den realen Handler', async () => {

  const response = await route8.GET(ev('GET', undefined, '?token=' + token) as never);
  expect(response.status).toBe(404);

 });
});

import * as route9 from '../../../src/routes/api/einladung/+server';

// Ursprüngliche Datei: 25-einladung-lesen-token-ungueltig.integration.test.ts
describe('25-einladung-lesen-token-ungueltig', () => {
 it('prüft den realen Handler', async () => {

  const response = await route9.GET(ev('GET', undefined, '?token=abc') as never);
  expect(response.status).toBe(400);

 });
});

import * as route10 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';

// Ursprüngliche Datei: 25-korrekturhistorie-db-fehler.integration.test.ts
describe('25-korrekturhistorie-db-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockRejectedValueOnce(new Error('DB'));
  const response = await route10.GET(ev('GET', undefined, ) as never);
  expect(response.status).toBe(500);

 });
});

import * as route11 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';

// Ursprüngliche Datei: 25-korrekturhistorie-erfolg.integration.test.ts
describe('25-korrekturhistorie-erfolg', () => {
 it('prüft den realen Handler', async () => {
  const protokoll = [
    { _id: new ObjectId(), aktion: 'nachtraeglich_korrigiert', positionId: id,
      ausgefuehrtVon: id, ausgefuehrtAm: new Date('2026-01-03'),
      alterIstBestand: 2, neuerIstBestand: 3, differenz: 1, begruendung: 'Zählfehler' }
  ];
  m.collection.mockImplementation((name: string) => ({
    findOne: m.findOne,
    find: () => ({
      sort: () => ({ toArray: async () => name === 'inventurprotokoll' ? protokoll : [] }),
      project: () => ({ toArray: async () =>
        name === 'inventurpositionen' ? [{ _id: new ObjectId(id), artikelName: 'Shirt' }]
        : name === 'benutzer' ? [{ _id: new ObjectId(id), vorname: 'Eva', nachname: 'Test' }] : [] })
    })
  }));
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), erstelltVon: id,
    erstelltAm: new Date('2026-01-01'), abgeschlossenAm: new Date('2026-01-02'),
    abgeschlossenVon: id, anzahlKorrekturen: 1 });

  const response = await route11.GET(ev('GET', undefined, ) as never);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.korrekturen).toHaveLength(1);
  expect(data.korrekturen[0].artikelName).toBe('Shirt');
  expect(data.korrekturen[0].bearbeitetVon).toBe('Eva Test');
  expect(data.verlauf.map((x: {aktion: string}) => x.aktion)).toContain('erstellt');
 });
});

import * as route12 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';

// Ursprüngliche Datei: 25-korrekturhistorie-inventur-fehlt.integration.test.ts
describe('25-korrekturhistorie-inventur-fehlt', () => {
 it('prüft den realen Handler', async () => {

  const response = await route12.GET(ev('GET', undefined, ) as never);
  expect(response.status).toBe(404);

 });
});

import * as route13 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-artikel-fehlt.integration.test.ts
describe('25-preise-artikel-fehlt', () => {
 it('prüft den realen Handler', async () => {

  const response = await route13.PUT(ev('PUT', { artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, ) as never);
  expect(response.status).toBe(404);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
});

import * as route14 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-doppelter-index.integration.test.ts
describe('25-preise-doppelter-index', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: false });
  m.createIndex.mockRejectedValueOnce({ code: 11000 });
  const response = await route14.PUT(ev('PUT', { artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, ) as never);
  expect(response.status).toBe(409);

 });
});

import * as route15 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-falsche-cent.integration.test.ts
describe('25-preise-falsche-cent', () => {
 it('prüft den realen Handler', async () => {

  const response = await route15.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, verkaufspreis: 12.345 }, ) as never);
  expect(response.status).toBe(400);

 });
});

import * as route16 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-falsche-groesse.integration.test.ts
describe('25-preise-falsche-groesse', () => {
 it('prüft den realen Handler', async () => {

  const response = await route16.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, groesseId: 'abc' }, ) as never);
  expect(response.status).toBe(400);

 });
});

import * as route17 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-falscher-artikel.integration.test.ts
describe('25-preise-falscher-artikel', () => {
 it('prüft den realen Handler', async () => {

  const response = await route17.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, artikelId: 'abc' }, ) as never);
  expect(response.status).toBe(400);

 });
});

import * as route18 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-falscher-typ.integration.test.ts
describe('25-preise-falscher-typ', () => {
 it('prüft den realen Handler', async () => {

  const response = await route18.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, preistyp: 'gratis' }, ) as never);
  expect(response.status).toBe(400);

 });
});

import * as route19 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-fix-erstellen.integration.test.ts
describe('25-preise-fix-erstellen', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: false });
  const response = await route19.PUT(ev('PUT', { artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, ) as never);
  expect(response.status).toBe(200);
  expect(m.updateOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), { upsert: true });
 });
});

import * as route20 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-fix-ohne-verkaufspreis.integration.test.ts
describe('25-preise-fix-ohne-verkaufspreis', () => {
 it('prüft den realen Handler', async () => {

  const response = await route20.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, verkaufspreis: null }, ) as never);
  expect(response.status).toBe(400);

 });
});

import * as route21 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-groesse-erforderlich.integration.test.ts
describe('25-preise-groesse-erforderlich', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: true });
  const response = await route21.PUT(ev('PUT', { artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, ) as never);
  expect(response.status).toBe(400);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
});

import * as route22 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-groesse-verboten.integration.test.ts
describe('25-preise-groesse-verboten', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: false });
  const response = await route22.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, groesseId }, ) as never);
  expect(response.status).toBe(400);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
});

import * as route23 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-keine-vereinskleidung.integration.test.ts
describe('25-preise-keine-vereinskleidung', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: false, hatGroessen: false });
  const response = await route23.PUT(ev('PUT', { artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, ) as never);
  expect(response.status).toBe(400);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
});

import * as route24 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-liste-db-fehler.integration.test.ts
describe('25-preise-liste-db-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.createIndex.mockRejectedValueOnce(new Error('DB'));
  const response = await route24.GET(ev('GET', undefined, ) as never);
  expect(response.status).toBe(500);

 });
});

import * as route25 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-liste-erfolg.integration.test.ts
describe('25-preise-liste-erfolg', () => {
 it('prüft den realen Handler', async () => {
  m.find.mockReturnValueOnce({ toArray: async () => [{ _id: new ObjectId(), artikelId: id, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }] });
  const response = await route25.GET(ev('GET', undefined, ) as never);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data[0].groesseId).toBeNull();
 });
});

import * as route26 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-mit-groesse.integration.test.ts
describe('25-preise-mit-groesse', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: true });
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
  const response = await route26.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, groesseId }, ) as never);
  expect(response.status).toBe(200);
  expect(m.updateOne).toHaveBeenCalledOnce();
 });
});

import * as route27 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-negative-druckkosten.integration.test.ts
describe('25-preise-negative-druckkosten', () => {
 it('prüft den realen Handler', async () => {

  const response = await route27.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, druckkosten: -1 }, ) as never);
  expect(response.status).toBe(400);

 });
});

import * as route28 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-update-fehler.integration.test.ts
describe('25-preise-update-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: false });
  m.updateOne.mockRejectedValueOnce(new Error('MongoDB'));
  const response = await route28.PUT(ev('PUT', { artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, ) as never);
  expect(response.status).toBe(500);

 });
});

import * as route29 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-variabel-erstellen.integration.test.ts
describe('25-preise-variabel-erstellen', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: false });
  const response = await route29.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, preistyp: 'variabel', verkaufspreis: null }, ) as never);
  expect(response.status).toBe(200);
  expect(m.updateOne).toHaveBeenCalledOnce();
 });
});

import * as route30 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: 25-preise-variante-fehlt.integration.test.ts
describe('25-preise-variante-fehlt', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: true });
  const response = await route30.PUT(ev('PUT', { ...{ artikelId: id, groesseId: null, preistyp: 'fix', druckkosten: 2, verkaufspreis: 25 }, groesseId }, ) as never);
  expect(response.status).toBe(404);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
});

import * as route31 from '../../../src/routes/api/registrieren/+server';

// Ursprüngliche Datei: 25-registrieren-admin-db-fehler.integration.test.ts
describe('25-registrieren-admin-db-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });
  m.insertOne.mockRejectedValueOnce(new Error('DB'));
  const response = await route31.POST(ev('POST', { vereinsname: 'TV Muster', vereinskuerzel: 'TVM', vorname: 'Eva', nachname: 'Test', email: 'eva@example.ch', passwort: 'SehrSicheresPasswort123' }, ) as never);
  expect(response.status).toBe(500);
  expect(m.insertOne).toHaveBeenCalledTimes(2);
 });
});

import * as route32 from '../../../src/routes/api/registrieren/+server';

// Ursprüngliche Datei: 25-registrieren-email-bereits-vorhanden.integration.test.ts
describe('25-registrieren-email-bereits-vorhanden', () => {
 it('prüft den realen Handler', async () => {
  m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
  const response = await route32.POST(ev('POST', { vereinsname: 'TV Muster', vereinskuerzel: 'TVM', vorname: 'Eva', nachname: 'Test', email: 'eva@example.ch', passwort: 'SehrSicheresPasswort123' }, ) as never);
  expect(response.status).toBe(409);
  expect(m.insertOne).not.toHaveBeenCalled();
 });
});

import * as route33 from '../../../src/routes/api/registrieren/+server';

// Ursprüngliche Datei: 25-registrieren-erfolg.integration.test.ts
describe('25-registrieren-erfolg', () => {
 it('prüft den realen Handler', async () => {

  const response = await route33.POST(ev('POST', { vereinsname: 'TV Muster', vereinskuerzel: 'TVM', vorname: 'Eva', nachname: 'Test', email: 'eva@example.ch', passwort: 'SehrSicheresPasswort123' }, ) as never);
  expect(response.status).toBe(201);
  expect(m.insertOne).toHaveBeenCalledTimes(3);
  expect((await response.json()).erfolg).toBe(true);
 });
});

import * as route34 from '../../../src/routes/api/registrieren/+server';

// Ursprüngliche Datei: 25-registrieren-session-db-fehler.integration.test.ts
describe('25-registrieren-session-db-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });
  m.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });
  m.insertOne.mockRejectedValueOnce(new Error('DB'));
  const response = await route34.POST(ev('POST', { vereinsname: 'TV Muster', vereinskuerzel: 'TVM', vorname: 'Eva', nachname: 'Test', email: 'eva@example.ch', passwort: 'SehrSicheresPasswort123' }, ) as never);
  expect(response.status).toBe(500);
  expect(m.insertOne).toHaveBeenCalledTimes(3);
 });
});

import * as route35 from '../../../src/routes/api/registrieren/+server';

// Ursprüngliche Datei: 25-registrieren-verein-db-fehler.integration.test.ts
describe('25-registrieren-verein-db-fehler', () => {
 it('prüft den realen Handler', async () => {
  m.insertOne.mockRejectedValueOnce(new Error('DB'));
  const response = await route35.POST(ev('POST', { vereinsname: 'TV Muster', vereinskuerzel: 'TVM', vorname: 'Eva', nachname: 'Test', email: 'eva@example.ch', passwort: 'SehrSicheresPasswort123' }, ) as never);
  expect(response.status).toBe(500);
  expect(m.insertOne).toHaveBeenCalledOnce();
 });
});

