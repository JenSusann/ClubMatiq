import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  permission: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn(),
  findOne: vi.fn(), insertOne: vi.fn(), collection: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args) } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET as kategorienGET, POST as kategorienPOST } from '../../../src/routes/api/kategorien/+server';
import { GET as lagerorteGET, POST as lagerortePOST } from '../../../src/routes/api/lagerorte/+server';
import { GET as groessenGET, POST as groessenPOST } from '../../../src/routes/api/groessen/+server';

const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const event = () => ({ locals: { benutzer } } as any);
const kategorienPost = (value: unknown) => kategorienPOST({ ...event(), request: { json: async () => value } } as any);
const kategorienInvalidJson = () => kategorienPOST({ ...event(), request: { json: async () => { throw new Error('bad json'); } } } as any);

const lagerortePost = (value: unknown) => lagerortePOST({ ...event(), request: { json: async () => value } } as any);
const lagerorteInvalidJson = () => lagerortePOST({ ...event(), request: { json: async () => { throw new Error('bad json'); } } } as any);
const groessenPost = (value: unknown) => groessenPOST({ ...event(), request: { json: async () => value } } as any);
const groessenInvalidJson = () => groessenPOST({ ...event(), request: { json: async () => { throw new Error('bad json'); } } } as any);

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
    const response = await kategorienGET(event());
    expect(response.status).toBe(200);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'inventar:lesen');
    expect(mocks.collection).toHaveBeenCalledWith('kategorien');
    expect(mocks.find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
    expect(mocks.sort).toHaveBeenCalledWith({ name: 1 });
    expect(await response.json()).toEqual([]);
  });
  it('serialisiert IDs und Felder', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => 'id-1' }, name: 'XL',  intern: 'nicht ausgeben' }]);
    const response = await kategorienGET(event());
    expect(await response.json()).toEqual([{ _id: 'id-1', name: 'XL' }]);
  });
  it('gibt die Berechtigungssperre unverändert zurück', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await kategorienGET(event());
    expect(response.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('meldet Datenbankfehler mit 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB'));
    const response = await kategorienGET(event());
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Kategorien konnten nicht geladen werden.');
  });
});

describe('POST /api/kategorien', () => {
  it('prüft das Verwaltungsrecht', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await kategorienPost({name: 'XL'});
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'stammdaten:verwalten');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it.each([null, 'text', 17, true, []])('lehnt ungültige Datenstruktur %j ab', async (value) => {
    const response = await kategorienPost(value);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Kategoriedaten.');
  });
  it('lehnt nicht lesbares JSON ab', async () => {
    const response = await kategorienInvalidJson();
    expect(response.status).toBe(400);
  });
  it.each([undefined, null, 42, false, '', '   '])('lehnt ungültigen Namen %j ab', async (value) => {
    const response = await kategorienPost({name: value});
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Bitte einen Kategorienamen eingeben.');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('speichert bereinigte Daten und gibt 201 zurück', async () => {
    const response = await kategorienPost({name: '  XL  '});
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledWith({ vereinId: 'verein-a', name: 'XL' });
    expect(await response.json()).toEqual({ _id: 'id-neu', name: 'XL' });
  });
  it('gibt bei Datenbankfehlern 500 zurück', async () => {
    mocks.insertOne.mockRejectedValue(new Error('DB'));
    const response = await kategorienPost({name: 'XL'});
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Kategorie konnte nicht gespeichert werden.');
  });
});


describe('GET /api/lagerorte', () => {
  it('verwendet das Leserecht und begrenzt die Abfrage auf den Verein', async () => {
    const response = await lagerorteGET(event());
    expect(response.status).toBe(200);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'inventar:lesen');
    expect(mocks.collection).toHaveBeenCalledWith('lagerorte');
    expect(mocks.find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
    expect(mocks.sort).toHaveBeenCalledWith({ name: 1 });
    expect(await response.json()).toEqual([]);
  });
  it('serialisiert IDs und Felder', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => 'id-1' }, name: 'XL',  intern: 'nicht ausgeben' }]);
    const response = await lagerorteGET(event());
    expect(await response.json()).toEqual([{ _id: 'id-1', name: 'XL' }]);
  });
  it('gibt die Berechtigungssperre unverändert zurück', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await lagerorteGET(event());
    expect(response.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('meldet Datenbankfehler mit 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB'));
    const response = await lagerorteGET(event());
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Lagerorte konnten nicht geladen werden.');
  });
});

describe('POST /api/lagerorte', () => {
  it('prüft das Verwaltungsrecht', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await lagerortePost({name: 'XL'});
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'stammdaten:verwalten');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it.each([null, 'text', 17, true, []])('lehnt ungültige Datenstruktur %j ab', async (value) => {
    const response = await lagerortePost(value);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Lagerortdaten.');
  });
  it('lehnt nicht lesbares JSON ab', async () => {
    const response = await lagerorteInvalidJson();
    expect(response.status).toBe(400);
  });
  it.each([undefined, null, 42, false, '', '   '])('lehnt ungültigen Namen %j ab', async (value) => {
    const response = await lagerortePost({name: value});
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Bitte einen Lagerortnamen eingeben.');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('verhindert Dubletten im gleichen Verein', async () => {
    mocks.findOne.mockResolvedValue({ _id: 'vorhanden' });
    const response = await lagerortePost({name: 'XL'});
    expect(response.status).toBe(409);
    expect((await response.json()).fehler).toBe('Dieser Lagerort existiert in deinem Verein bereits.');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('maskiert Regex-Sonderzeichen und sucht nur im eigenen Verein', async () => {
    await lagerortePost({name: '  Test.*  '});
    expect(mocks.findOne).toHaveBeenCalledWith({ vereinId: 'verein-a', name: { $regex: '^Test\\.\\*$', $options: 'i' } });
  });
  it('speichert bereinigte Daten und gibt 201 zurück', async () => {
    const response = await lagerortePost({name: '  XL  '});
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledWith({ vereinId: 'verein-a', name: 'XL' });
    expect(await response.json()).toEqual({ _id: 'id-neu', name: 'XL' });
  });
  it('gibt bei Datenbankfehlern 500 zurück', async () => {
    mocks.insertOne.mockRejectedValue(new Error('DB'));
    const response = await lagerortePost({name: 'XL'});
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Lagerort konnte nicht gespeichert werden.');
  });
  it('behandelt Fehler bei der Dublettensuche', async () => {
    mocks.findOne.mockRejectedValue(new Error('DB'));
    const response = await lagerortePost({name: 'XL'});
    expect(response.status).toBe(500);
  });
});


describe('GET /api/groessen', () => {
  it('verwendet das Leserecht und begrenzt die Abfrage auf den Verein', async () => {
    const response = await groessenGET(event());
    expect(response.status).toBe(200);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'inventar:lesen');
    expect(mocks.collection).toHaveBeenCalledWith('groessen');
    expect(mocks.find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
    expect(mocks.sort).toHaveBeenCalledWith({ sortierung: 1, bezeichnung: 1 });
    expect(await response.json()).toEqual([]);
  });
  it('serialisiert IDs und Felder', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => 'id-1' }, bezeichnung: 'XL', sortierung: 2, intern: 'nicht ausgeben' }]);
    const response = await groessenGET(event());
    expect(await response.json()).toEqual([{ _id: 'id-1', bezeichnung: 'XL', sortierung: 2 }]);
  });
  it('gibt die Berechtigungssperre unverändert zurück', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await groessenGET(event());
    expect(response.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('meldet Datenbankfehler mit 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB'));
    const response = await groessenGET(event());
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Grössen konnten nicht geladen werden.');
  });
});

describe('POST /api/groessen', () => {
  it('prüft das Verwaltungsrecht', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await groessenPost({bezeichnung: 'XL', sortierung: 2});
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'stammdaten:verwalten');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it.each([null, 'text', 17, true, []])('lehnt ungültige Datenstruktur %j ab', async (value) => {
    const response = await groessenPost(value);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Grössendaten.');
  });
  it('lehnt nicht lesbares JSON ab', async () => {
    const response = await groessenInvalidJson();
    expect(response.status).toBe(400);
  });
  it.each([undefined, null, 42, false, '', '   '])('lehnt ungültigen Namen %j ab', async (value) => {
    const response = await groessenPost({bezeichnung: value, sortierung: 2});
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Bitte eine Grössenbezeichnung eingeben.');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it.each([undefined, null, -1, 1.5, '2', true])('lehnt ungültige Sortierung %j ab', async (value) => {
    const response = await groessenPost({ bezeichnung: 'XL', sortierung: value });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Bitte eine gültige Sortierung eingeben.');
  });
  it('verhindert Dubletten im gleichen Verein', async () => {
    mocks.findOne.mockResolvedValue({ _id: 'vorhanden' });
    const response = await groessenPost({bezeichnung: 'XL', sortierung: 2});
    expect(response.status).toBe(409);
    expect((await response.json()).fehler).toBe('Diese Grösse existiert in deinem Verein bereits.');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('maskiert Regex-Sonderzeichen und sucht nur im eigenen Verein', async () => {
    await groessenPost({bezeichnung: '  Test.*  ', sortierung: 2});
    expect(mocks.findOne).toHaveBeenCalledWith({ vereinId: 'verein-a', bezeichnung: { $regex: '^Test\\.\\*$', $options: 'i' } });
  });
  it('speichert bereinigte Daten und gibt 201 zurück', async () => {
    const response = await groessenPost({bezeichnung: '  XL  ', sortierung: 2});
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledWith({ vereinId: 'verein-a', bezeichnung: 'XL', sortierung: 2 });
    expect(await response.json()).toEqual({ _id: 'id-neu', bezeichnung: 'XL', sortierung: 2 });
  });
  it('gibt bei Datenbankfehlern 500 zurück', async () => {
    mocks.insertOne.mockRejectedValue(new Error('DB'));
    const response = await groessenPost({bezeichnung: 'XL', sortierung: 2});
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Grösse konnte nicht gespeichert werden.');
  });
  it('behandelt Fehler bei der Dublettensuche', async () => {
    mocks.findOne.mockRejectedValue(new Error('DB'));
    const response = await groessenPost({bezeichnung: 'XL', sortierung: 2});
    expect(response.status).toBe(500);
  });
});
