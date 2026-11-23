import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  permission: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn(),
  findOne: vi.fn(), insertOne: vi.fn(), collection: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args) } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET, POST } from '../../../src/routes/api/kategorien/+server';

const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const event = () => ({ locals: { benutzer } } as any);
const post = (value: unknown) => POST({ ...event(), request: { json: async () => value } } as any);
const invalidJson = () => POST({ ...event(), request: { json: async () => { throw new Error('bad json'); } } } as any);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockReturnValue({ find: mocks.find, findOne: mocks.findOne, insertOne: mocks.insertOne });
  mocks.find.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockResolvedValue([]);
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ insertedId: { toString: () => 'id-neu' } });
});

describe('GET /api/kategorien', () => {
  it('verwendet das Leserecht und begrenzt die Abfrage auf den Verein', async () => {
    const response = await GET(event());
    expect(response.status).toBe(200);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'inventar:lesen');
    expect(mocks.collection).toHaveBeenCalledWith('kategorien');
    expect(mocks.find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
    expect(mocks.sort).toHaveBeenCalledWith({ name: 1 });
    expect(await response.json()).toEqual([]);
  });
  it('serialisiert IDs und Felder', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => 'id-1' }, name: 'XL',  intern: 'nicht ausgeben' }]);
    const response = await GET(event());
    expect(await response.json()).toEqual([{ _id: 'id-1', name: 'XL' }]);
  });
  it('gibt die Berechtigungssperre unverändert zurück', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await GET(event());
    expect(response.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('meldet Datenbankfehler mit 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB'));
    const response = await GET(event());
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Kategorien konnten nicht geladen werden.');
  });
});

describe('POST /api/kategorien', () => {
  it('prüft das Verwaltungsrecht', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await post({name: 'XL'});
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'stammdaten:verwalten');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it.each([null, 'text', 17, true, []])('lehnt ungültige Datenstruktur %j ab', async (value) => {
    const response = await post(value);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Kategoriedaten.');
  });
  it('lehnt nicht lesbares JSON ab', async () => {
    const response = await invalidJson();
    expect(response.status).toBe(400);
  });
  it.each([undefined, null, 42, false, '', '   '])('lehnt ungültigen Namen %j ab', async (value) => {
    const response = await post({name: value});
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Bitte einen Kategorienamen eingeben.');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('speichert bereinigte Daten und gibt 201 zurück', async () => {
    const response = await post({name: '  XL  '});
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledWith({ vereinId: 'verein-a', name: 'XL' });
    expect(await response.json()).toEqual({ _id: 'id-neu', name: 'XL' });
  });
  it('gibt bei Datenbankfehlern 500 zurück', async () => {
    mocks.insertOne.mockRejectedValue(new Error('DB'));
    const response = await post({name: 'XL'});
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Kategorie konnte nicht gespeichert werden.');
  });
});
