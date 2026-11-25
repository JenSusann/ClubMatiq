import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({ collection: vi.fn(), find: vi.fn(), project: vi.fn(), sort: vi.fn(), toArray: vi.fn(), findOne: vi.fn(), insertOne: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));

import { GET as GET0, POST as POST0 } from '../../../src/routes/api/groessen/+server';
describe('groessen-coverage-erweiterung', () => {
const GET = GET0;
const POST = POST0;
const vereinId = new ObjectId().toHexString();
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.collection.mockReturnValue(mocks);
  mocks.find.mockReturnValue(mocks);
  mocks.project.mockReturnValue(mocks);
  mocks.sort.mockReturnValue(mocks);
  mocks.toArray.mockResolvedValue([]);
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
});

const post = (daten: unknown) => POST({ locals: { benutzer }, request: new Request('http://localhost/api/groessen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) }) } as never);
const invalidJson = () => POST({ locals: { benutzer }, request: new Request('http://localhost/api/groessen', { method: 'POST', body: '{' }) } as never);
describe('Grössen: zusätzliche Integrationstests', () => {
  it('GET liefert leere Liste', async () => { const r = await GET({ locals: { benutzer } } as never); expect(r.status).toBe(200); expect(await r.json()).toEqual([]); });
  it('GET wandelt ID um und sortiert', async () => { const id = new ObjectId(); mocks.toArray.mockResolvedValueOnce([{ _id: id, bezeichnung: 'M', sortierung: 2 }]); const r = await GET({ locals: { benutzer } } as never); expect(await r.json()).toEqual([{ _id: id.toString(), bezeichnung: 'M', sortierung: 2 }]); expect(mocks.sort).toHaveBeenCalledWith({ sortierung: 1, bezeichnung: 1 }); });
  it('GET behandelt Datenbankfehler', async () => { mocks.toArray.mockRejectedValueOnce(new Error('DB')); expect((await GET({ locals: { benutzer } } as never)).status).toBe(500); });
  it.each([null, [], 12, 'abc'])('POST lehnt ungültiges Datenformat %s ab', async (daten) => { expect((await post(daten)).status).toBe(400); });
  it('POST lehnt ungültiges JSON ab', async () => { expect((await invalidJson()).status).toBe(400); });
  it.each([{}, { bezeichnung: '' }, { bezeichnung: '   ' }, { bezeichnung: 3 }, { bezeichnung: null }])('POST lehnt ungültige Bezeichnung ab: %j', async (daten) => { expect((await post({ sortierung: 1, ...daten })).status).toBe(400); });
  it.each([undefined, null, '2', -1, 1.5])('POST lehnt ungültige Sortierung %s ab', async (sortierung) => { expect((await post({ bezeichnung: 'S', sortierung })).status).toBe(400); });
  it('POST lehnt doppelte Grösse ab', async () => { mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId() }); expect((await post({ bezeichnung: 'S', sortierung: 1 })).status).toBe(409); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST speichert getrimmte Bezeichnung', async () => { const r = await post({ bezeichnung: '  XL  ', sortierung: 4 }); expect(r.status).toBe(201); expect(mocks.insertOne).toHaveBeenCalledWith({ vereinId, bezeichnung: 'XL', sortierung: 4 }); });
  it('POST maskiert Sonderzeichen in Regex', async () => { await post({ bezeichnung: 'S (Kids)+', sortierung: 1 }); expect(mocks.findOne).toHaveBeenCalledWith({ vereinId, bezeichnung: { $regex: '^S \\(Kids\\)\\+$', $options: 'i' } }); });
  it('POST behandelt Fehler bei Duplikatprüfung', async () => { mocks.findOne.mockRejectedValueOnce(new Error('DB')); expect((await post({ bezeichnung: 'S', sortierung: 1 })).status).toBe(500); });
  it('POST behandelt Fehler beim Speichern', async () => { mocks.insertOne.mockRejectedValueOnce(new Error('DB')); expect((await post({ bezeichnung: 'S', sortierung: 1 })).status).toBe(500); });
});

});

import { GET as GET1, POST as POST1 } from '../../../src/routes/api/kategorien/+server';
describe('kategorien-coverage-zusatz', () => {
const GET = GET1;
const POST = POST1;
const vereinId = new ObjectId().toHexString();
const user = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const event = (payload: unknown) => ({ locals: { benutzer: user }, request: new Request('http://localhost/api/kategorien', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }) });
const badJsonEvent = () => ({ locals: { benutzer: user }, request: new Request('http://localhost/api/kategorien', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.collection.mockReturnValue(mocks);
  mocks.find.mockReturnValue(mocks);
  mocks.sort.mockReturnValue(mocks);
  mocks.toArray.mockResolvedValue([]);
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
});

describe('Kategorie: zusätzliche Integrationsfälle', () => {
  it('POST weist null zurück', async () => { const response = await POST(event(null) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist array zurück', async () => { const response = await POST(event([]) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist number zurück', async () => { const response = await POST(event(123) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist string zurück', async () => { const response = await POST(event("abc") as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist empty-object zurück', async () => { const response = await POST(event({}) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist name-null zurück', async () => { const response = await POST(event({ name: null }) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist name-number zurück', async () => { const response = await POST(event({ name: 123 }) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist name-blank zurück', async () => { const response = await POST(event({ name: '   ' }) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist fehlerhaftes JSON zurück', async () => { const response = await POST(badJsonEvent() as never); expect(response.status).toBe(400); });
  it('POST speichert getrimmten Namen', async () => { const response = await POST(event({ name: '  Turnhalle  ' }) as never); expect(response.status).toBe(201); expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId, name: 'Turnhalle' })); });
  it('POST behandelt Datenbankfehler', async () => { mocks.insertOne.mockRejectedValueOnce(new Error('DB')); const response = await POST(event({ name: 'Neu' }) as never); expect(response.status).toBe(500); });
  it('GET gibt leere Liste zurück', async () => { const response = await GET({ locals: { benutzer: user } } as never); expect(response.status).toBe(200); expect(await response.json()).toEqual([]); });
  it('GET bildet Datenbank-IDs als Strings ab', async () => { const id = new ObjectId(); mocks.toArray.mockResolvedValueOnce([{ _id: id, name: 'Material' }]); const response = await GET({ locals: { benutzer: user } } as never); expect(await response.json()).toEqual([{ _id: id.toString(), name: 'Material' }]); expect(mocks.find).toHaveBeenCalledWith({ vereinId }); });
  it('GET behandelt Datenbankfehler', async () => { mocks.toArray.mockRejectedValueOnce(new Error('DB')); const response = await GET({ locals: { benutzer: user } } as never); expect(response.status).toBe(500); });
});

});

import { GET as GET2, POST as POST2 } from '../../../src/routes/api/lagerorte/+server';
describe('lagerorte-coverage-zusatz', () => {
const GET = GET2;
const POST = POST2;
const vereinId = new ObjectId().toHexString();
const user = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const event = (payload: unknown) => ({ locals: { benutzer: user }, request: new Request('http://localhost/api/lagerorte', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }) });
const badJsonEvent = () => ({ locals: { benutzer: user }, request: new Request('http://localhost/api/lagerorte', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.collection.mockReturnValue(mocks);
  mocks.find.mockReturnValue(mocks);
  mocks.sort.mockReturnValue(mocks);
  mocks.toArray.mockResolvedValue([]);
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
});

describe('Lagerort: zusätzliche Integrationsfälle', () => {
  it('POST weist null zurück', async () => { const response = await POST(event(null) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist array zurück', async () => { const response = await POST(event([]) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist number zurück', async () => { const response = await POST(event(123) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist string zurück', async () => { const response = await POST(event("abc") as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist empty-object zurück', async () => { const response = await POST(event({}) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist name-null zurück', async () => { const response = await POST(event({ name: null }) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist name-number zurück', async () => { const response = await POST(event({ name: 123 }) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist name-blank zurück', async () => { const response = await POST(event({ name: '   ' }) as never); expect(response.status).toBe(400); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST weist fehlerhaftes JSON zurück', async () => { const response = await POST(badJsonEvent() as never); expect(response.status).toBe(400); });
  it('POST speichert getrimmten Namen', async () => { const response = await POST(event({ name: '  Turnhalle  ' }) as never); expect(response.status).toBe(201); expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId, name: 'Turnhalle' })); });
  it('POST behandelt Datenbankfehler', async () => { mocks.insertOne.mockRejectedValueOnce(new Error('DB')); const response = await POST(event({ name: 'Neu' }) as never); expect(response.status).toBe(500); });
  it('GET gibt leere Liste zurück', async () => { const response = await GET({ locals: { benutzer: user } } as never); expect(response.status).toBe(200); expect(await response.json()).toEqual([]); });
  it('GET bildet Datenbank-IDs als Strings ab', async () => { const id = new ObjectId(); mocks.toArray.mockResolvedValueOnce([{ _id: id, name: 'Material' }]); const response = await GET({ locals: { benutzer: user } } as never); expect(await response.json()).toEqual([{ _id: id.toString(), name: 'Material' }]); expect(mocks.find).toHaveBeenCalledWith({ vereinId }); });
  it('GET behandelt Datenbankfehler', async () => { mocks.toArray.mockRejectedValueOnce(new Error('DB')); const response = await GET({ locals: { benutzer: user } } as never); expect(response.status).toBe(500); });
  it('POST erkennt vorhandenen Lagerort', async () => { mocks.findOne.mockResolvedValueOnce({ name: 'Halle' }); const response = await POST(event({ name: 'Halle' }) as never); expect(response.status).toBe(409); expect(mocks.insertOne).not.toHaveBeenCalled(); });
  it('POST maskiert Regex-Sonderzeichen bei Duplikatprüfung', async () => { await POST(event({ name: 'Halle (A)+' }) as never); expect(mocks.findOne).toHaveBeenCalledWith(expect.objectContaining({ name: { '$regex': '^Halle \\(A\\)\\+$', $options: 'i' } })); });
  it('POST behandelt Fehler bei Duplikatprüfung', async () => { mocks.findOne.mockRejectedValueOnce(new Error('DB')); const response = await POST(event({ name: 'Halle' }) as never); expect(response.status).toBe(500); });
});

});
