import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  collections: {} as Record<string, any>,
  permission: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => mocks.collections[name] }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args)
}));
import { GET, POST } from '../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

const artikelId = new ObjectId().toHexString();
const artikel2Id = new ObjectId().toHexString();
const groesseId = new ObjectId().toHexString();
const lieferantId = new ObjectId().toHexString();
const lieferant2Id = new ObjectId().toHexString();
const vorgangId = new ObjectId();

let data: Record<string, any[]>;
let insertOne: ReturnType<typeof vi.fn>;
let failCollection: string | null;

function collection(name: string) {
  return {
    find: vi.fn((_filter: unknown) => ({
      project: vi.fn(() => ({ toArray: vi.fn(async () => { if (failCollection === name) throw new Error('DB offline'); return data[name]; }) })),
      sort: vi.fn(() => ({ toArray: vi.fn(async () => { if (failCollection === name) throw new Error('DB offline'); return data[name]; }) }))
    })),
    insertOne
  };
}
function locals(benutzer: unknown = { vereinId: 'verein-1' }) { return { benutzer }; }
function getEvent(benutzer?: unknown) { return { locals: locals(benutzer) } as any; }
function postEvent(body: unknown, benutzer?: unknown) {
  return { locals: locals(benutzer), request: new Request('http://localhost/api/vereinskleider/sammelbestellungen', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  }) } as any;
}
function validPosition(overrides: Record<string, unknown> = {}) {
  return { artikelId, groesseId: null, menge: 3, ...overrides };
}
function setup(overrides: Partial<Record<string, any[]>> = {}) {
  data = {
    vereinskleider_verkaeufe: [],
    artikel: [{ _id: new ObjectId(artikelId), name: 'T-Shirt', menge: 2, hatGroessen: false, lieferantId }],
    artikelvarianten: [],
    vereinskleider_sammelbestellungen: [],
    lieferanten: [{ _id: new ObjectId(lieferantId), name: 'Lieferant A' }],
    ...overrides
  };
  for (const name of Object.keys(data)) mocks.collections[name] = collection(name);
}
async function json(response: Response) { return response.json(); }

beforeEach(() => {
  vi.clearAllMocks();
  failCollection = null;
  mocks.permission.mockReturnValue(null);
  insertOne = vi.fn().mockResolvedValue({ insertedId: vorgangId });
  setup();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Vereinskleider Sammelbestellungen GET', () => {
  it('verweigert Zugriff bei fehlender Berechtigung', async () => {
    mocks.permission.mockReturnValue(new Response('{}', { status: 403 }));
    expect((await GET(getEvent())).status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith({ vereinId: 'verein-1' }, 'verkauf:verwalten');
  });
  it('liefert leeren Katalog und keine Bestellungen', async () => {
    setup({ artikel: [] });
    expect(await json(await GET(getEvent()))).toEqual({ bedarf: [], sammelbestellungen: [] });
  });
  it('listet Artikel ohne Kundenbestellungen als Lagerbestelloption', async () => {
    const { bedarf } = await json(await GET(getEvent()));
    expect(bedarf).toEqual([{ artikelId, groesseId: null, artikelname: 'T-Shirt', lieferantId,
      lieferantName: 'Lieferant A', offen: 0, bestand: 2, verfuegbar: 1, bereitsInSammelbestellungen: 0, nachbestellen: 0 }]);
  });
  it('berechnet offenen Bedarf nach bereits erfolgten Übergaben', async () => {
    setup({ vereinskleider_verkaeufe: [{ positionen: [
      { ...validPosition({ menge: 7 }), verkaufsart: 'bestellung', uebergebenMenge: 2 },
      { ...validPosition({ menge: 9 }), verkaufsart: 'direkt' }
    ] }] });
    const { bedarf } = await json(await GET(getEvent()));
    expect(bedarf[0]).toMatchObject({ offen: 5, verfuegbar: 1, nachbestellen: 4 });
  });
  it('fasst mehrere Bestellvorgänge zusammen', async () => {
    setup({ vereinskleider_verkaeufe: [
      { positionen: [{ ...validPosition({ menge: 4 }), verkaufsart: 'bestellung' }] },
      { positionen: [{ ...validPosition({ menge: 3 }), verkaufsart: 'bestellung' }] }
    ] });
    expect((await json(await GET(getEvent()))).bedarf[0].nachbestellen).toBe(6);
  });
  it('ignoriert ungültige Bestellpositionen', async () => {
    setup({ vereinskleider_verkaeufe: [{ positionen: [
      { ...validPosition(), verkaufsart: 'bestellung', menge: -1 },
      { ...validPosition(), verkaufsart: 'bestellung', uebergebenMenge: 4 },
      { ...validPosition({ artikelId: 'falsch' }), verkaufsart: 'bestellung' },
      { ...validPosition(), verkaufsart: 'direkt' }
    ] }] });
    expect((await json(await GET(getEvent()))).bedarf[0].offen).toBe(0);
  });
  it('zieht nur ausstehende Mengen aus Sammelbestellungen ab', async () => {
    setup({
      vereinskleider_verkaeufe: [{ positionen: [{ ...validPosition({ menge: 10 }), verkaufsart: 'bestellung' }] }],
      vereinskleider_sammelbestellungen: [{ _id: vorgangId, status: 'bestellt', positionen: [
        { artikelId, groesseId: null, menge: 5, geliefertMenge: 2 }
      ], erstelltAm: new Date(), aktualisiertAm: new Date(), bemerkung: '' }]
    });
    const result = await json(await GET(getEvent()));
    expect(result.bedarf[0]).toMatchObject({ offen: 10, verfuegbar: 1, bereitsInSammelbestellungen: 3, nachbestellen: 6 });
    expect(result.sammelbestellungen[0].positionen[0]).toMatchObject({ geliefertMenge: 2, offenMenge: 3, kundenbedarfMenge: null, lagerreserveMenge: null });
  });
  it('ignoriert gelieferte Sammelbestellungen beim offenen Zulauf', async () => {
    setup({ vereinskleider_sammelbestellungen: [{ _id: vorgangId, status: 'geliefert', positionen: [
      { artikelId, groesseId: null, menge: 8 }
    ] }] });
    expect((await json(await GET(getEvent()))).bedarf[0].bereitsInSammelbestellungen).toBe(0);
  });
  it('ignoriert inkonsistente Liefermengen', async () => {
    setup({ vereinskleider_sammelbestellungen: [{ _id: vorgangId, status: 'entwurf', positionen: [
      { artikelId, groesseId: null, menge: 3, geliefertMenge: 5 }
    ] }] });
    expect((await json(await GET(getEvent()))).bedarf[0].bereitsInSammelbestellungen).toBe(0);
  });
  it('schützt eine Einheit Anprobierreserve auch bei kleinem Bestand', async () => {
    setup({ artikel: [{ _id: new ObjectId(artikelId), name: 'Shirt', menge: 1, hatGroessen: false, lieferantId }] });
    expect((await json(await GET(getEvent()))).bedarf[0].verfuegbar).toBe(0);
  });
  it('setzt ungültigen Bestand auf null und verfügbare Menge auf 0', async () => {
    setup({ artikel: [{ _id: new ObjectId(artikelId), name: 'Shirt', menge: -3, hatGroessen: false, lieferantId }] });
    expect((await json(await GET(getEvent()))).bedarf[0]).toMatchObject({ bestand: null, verfuegbar: 0 });
  });
  it('zeigt aktive Grössenvarianten und keine Basisposition für Grössenartikel', async () => {
    setup({
      artikel: [{ _id: new ObjectId(artikelId), name: 'Jacke', menge: 10, hatGroessen: true, lieferantId }],
      artikelvarianten: [{ artikelId, groesseId, menge: 4 }]
    });
    expect((await json(await GET(getEvent()))).bedarf).toEqual([
      expect.objectContaining({ artikelId, groesseId, artikelname: 'Jacke', bestand: 4, verfuegbar: 3 })
    ]);
  });
  it('liefert 500 bei Datenbankfehler', async () => {
    failCollection = 'artikel';
    const response = await GET(getEvent());
    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({ fehler: 'Sammelbestellungen konnten nicht geladen werden.' });
  });
});

describe('Vereinskleider Sammelbestellungen POST', () => {
  it('verweigert unberechtigten Zugriff', async () => {
    mocks.permission.mockReturnValue(new Response('{}', { status: 401 }));
    expect((await POST(postEvent({ positionen: [validPosition()] }))).status).toBe(401);
    expect(insertOne).not.toHaveBeenCalled();
  });
  it.each([null, [], 3, 'text'])('verweigert ungültige Eingabe %s', async (body) => {
    const response = await POST(postEvent(body));
    expect(response.status).toBe(400);
    expect((await json(response)).fehler).toBe('Ungültige Eingabe.');
  });
  it('verweigert nicht parsebares JSON', async () => {
    const response = await POST({ locals: locals(), request: new Request('http://localhost/', { method: 'POST', body: '{' }) } as any);
    expect(response.status).toBe(400);
  });
  it.each([undefined, [], Array.from({ length: 101 }, () => validPosition())])('verweigert fehlende, leere oder zu lange Positionslisten', async (positionen) => {
    expect((await POST(postEvent({ positionen }))).status).toBe(400);
  });
  it.each([42, 'x'.repeat(2001), null])('verweigert ungültige Bemerkung', async (bemerkung) => {
    expect((await POST(postEvent({ positionen: [validPosition()], bemerkung }))).status).toBe(400);
  });
  it.each([null, [], 'text', 5])('verweigert ungültige Bestellposition %s', async (position) => {
    expect((await POST(postEvent({ positionen: [position] }))).status).toBe(400);
  });
  it.each([
    { artikelId: 'x' }, { groesseId: 'x' }, { groesseId: undefined },
    { menge: 0 }, { menge: -1 }, { menge: 10001 }, { menge: 1.5 }, { menge: '2' }
  ])('verweigert ungültige Positionsfelder %j', async (fields) => {
    expect((await POST(postEvent({ positionen: [validPosition(fields)] }))).status).toBe(400);
  });
  it('verweigert doppelte Artikel-Grössen-Kombinationen', async () => {
    const response = await POST(postEvent({ positionen: [validPosition(), validPosition()] }));
    expect(response.status).toBe(400);
    expect((await json(response)).fehler).toContain('doppelt');
  });
  it('erstellt Entwurf mit Lieferant, Bestellmengen und getrimmter Bemerkung', async () => {
    setup({ vereinskleider_verkaeufe: [{ positionen: [{ ...validPosition({ menge: 7 }), verkaufsart: 'bestellung' }] }] });
    const response = await POST(postEvent({ positionen: [validPosition({ menge: 5 })], bemerkung: '  bitte rasch  ' }));
    expect(response.status).toBe(201);
    expect(await json(response)).toEqual({ erfolg: true, id: vorgangId.toString(), status: 'entwurf', lieferantId });
    const inserted = insertOne.mock.calls[0][0];
    expect(inserted).toMatchObject({ vereinId: 'verein-1', lieferantId, lieferantName: 'Lieferant A', status: 'entwurf', bemerkung: 'bitte rasch' });
    expect(inserted.positionen[0]).toMatchObject({ artikelId, groesseId: null, artikelname: 'T-Shirt', menge: 5, kundenbedarfMenge: 5, lagerreserveMenge: 0 });
    expect(inserted.erstelltAm).toBeInstanceOf(Date);
  });
  it('ordnet Mengen oberhalb des Kundenbedarfs der Lagerreserve zu', async () => {
    const response = await POST(postEvent({ positionen: [validPosition({ menge: 4 })] }));
    expect(response.status).toBe(201);
    expect(insertOne.mock.calls[0][0].positionen[0]).toMatchObject({ kundenbedarfMenge: 0, lagerreserveMenge: 4 });
  });
  it('verweigert nicht bestellbare Artikel', async () => {
    expect((await POST(postEvent({ positionen: [validPosition({ artikelId: artikel2Id })] }))).status).toBe(409);
  });
  it('verweigert Artikel ohne gültigen Standardlieferanten', async () => {
    setup({ artikel: [{ _id: new ObjectId(artikelId), name: 'T-Shirt', menge: 5, hatGroessen: false }] });
    const response = await POST(postEvent({ positionen: [validPosition()] }));
    expect(response.status).toBe(409);
    expect((await json(response)).fehler).toContain('Standardlieferant');
  });
  it('verweigert Artikel verschiedener Lieferanten in einer Sammelbestellung', async () => {
    setup({
      artikel: [
        { _id: new ObjectId(artikelId), name: 'Shirt', menge: 5, hatGroessen: false, lieferantId },
        { _id: new ObjectId(artikel2Id), name: 'Hose', menge: 5, hatGroessen: false, lieferantId: lieferant2Id }
      ],
      lieferanten: [{ _id: new ObjectId(lieferantId), name: 'A' }, { _id: new ObjectId(lieferant2Id), name: 'B' }]
    });
    const response = await POST(postEvent({ positionen: [validPosition(), validPosition({ artikelId: artikel2Id })] }));
    expect(response.status).toBe(400);
    expect((await json(response)).fehler).toContain('desselben Lieferanten');
  });
  it('verweigert Artikel mit ungültigem Bestand', async () => {
    setup({ artikel: [{ _id: new ObjectId(artikelId), name: 'Shirt', menge: -1, hatGroessen: false, lieferantId }] });
    expect((await POST(postEvent({ positionen: [validPosition()] }))).status).toBe(409);
  });
  it('liefert 500 bei Datenbankfehler während Erstellung', async () => {
    insertOne.mockRejectedValue(new Error('DB offline'));
    const response = await POST(postEvent({ positionen: [validPosition()] }));
    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({ fehler: 'Sammelbestellung konnte nicht erstellt werden.' });
  });
});

// Ergänzende Randfälle mit denselben Collection- und Berechtigungs-Mocks.
const aidEdge = '507f1f77bcf86cd799439011';
const gidEdge = '507f1f77bcf86cd799439012';
const lidEdge = '507f1f77bcf86cd799439013';
const aid2Edge = '507f1f77bcf86cd799439014';
const lid2Edge = '507f1f77bcf86cd799439015';
const benutzerEdge = { vereinId: 'verein-1', rolle: 'admin' };
const getEdge = () => GET({ locals: { benutzer: benutzerEdge } } as never);
const postEdge = (value: unknown) => POST({ locals: { benutzer: benutzerEdge }, request: { json: async () => value } } as never);
const artikelEdge = (id = aidEdge, overrides: Record<string, unknown> = {}) => ({ _id: new ObjectId(id), name: 'Trainingsjacke', menge: 5, hatGroessen: false, lieferantId: lidEdge, ...overrides });
const posEdge = (overrides: Record<string, unknown> = {}) => ({ artikelId: aidEdge, groesseId: null, menge: 2, ...overrides });
const setupEdge = () => { data = { artikel: [artikelEdge()], artikelvarianten: [], lieferanten: [{ _id: new ObjectId(lidEdge), name: 'Lieferant A' }], vereinskleider_verkaeufe: [], vereinskleider_sammelbestellungen: [] }; for (const name of Object.keys(data)) mocks.collections[name] = collection(name); };

describe('Paket 19 – Sammelbestellungen Branches', () => {
  beforeEach(() => {
    setupEdge();
    failCollection = null;
    insertOne.mockResolvedValue({ insertedId: new ObjectId(aidEdge) });
  });
  it('GET liefert leere Übersicht', async () => { data.artikel = []; expect(await (await getEdge()).json()).toEqual({ bedarf: [], sammelbestellungen: [] }); });
  it('GET berechnet Bedarf ohne offene Verkäufe', async () => { const resultEdge = await (await getEdge()).json(); expect(resultEdge.bedarf[0]).toMatchObject({ offen: 0, bestand: 5, verfuegbar: 4, nachbestellen: 0, lieferantName: 'Lieferant A' }); });
  it('GET zählt gültige offene Positionen und berücksichtigt Übergaben', async () => { data.vereinskleider_verkaeufe = [{ positionen: [{ ...posEdge({ menge: 8 }), verkaufsart: 'bestellung', uebergebenMenge: 1 }] }]; const resultEdge = await (await getEdge()).json(); expect(resultEdge.bedarf[0]).toMatchObject({ offen: 7, nachbestellen: 3 }); });
  it('GET summiert mehrere offene Positionen', async () => { data.vereinskleider_verkaeufe = [{ positionen: [{ ...posEdge({ menge: 5 }), verkaufsart: 'bestellung' }, { ...posEdge({ menge: 4 }), verkaufsart: 'bestellung' }] }]; expect((await (await getEdge()).json()).bedarf[0].offen).toBe(9); });
  it('GET ignoriert fehlerhafte Verkaufspositionen', async () => { data.vereinskleider_verkaeufe = [{ positionen: [{ ...posEdge(), verkaufsart: 'direkt' }, { ...posEdge({ artikelId: 'x' }), verkaufsart: 'bestellung' }, { ...posEdge({ menge: 0 }), verkaufsart: 'bestellung' }, { ...posEdge({ menge: 2, uebergebenMenge: 3 }), verkaufsart: 'bestellung' }] }]; expect((await (await getEdge()).json()).bedarf[0].offen).toBe(0); });
  it('GET ignoriert nicht-array Positionen', async () => { data.vereinskleider_verkaeufe = [{ positionen: null }]; expect((await (await getEdge()).json()).bedarf[0].offen).toBe(0); });
  it('GET zieht nur noch ausstehende Sammelbestellungen ab', async () => { data.vereinskleider_verkaeufe = [{ positionen: [{ ...posEdge({ menge: 9 }), verkaufsart: 'bestellung' }] }]; data.vereinskleider_sammelbestellungen = [{ _id: new ObjectId(aidEdge), status: 'bestellt', positionen: [{ ...posEdge({ menge: 3 }), geliefertMenge: 1 }] }]; const resultEdge = await (await getEdge()).json(); expect(resultEdge.bedarf[0]).toMatchObject({ bereitsInSammelbestellungen: 2, nachbestellen: 3 }); expect(resultEdge.sammelbestellungen[0].positionen[0]).toMatchObject({ offenMenge: 2, kundenbedarfMenge: null, lagerreserveMenge: null }); });
  it('GET ignoriert gelieferte und ungültige Sammelpositionen', async () => { data.vereinskleider_sammelbestellungen = [{ _id: new ObjectId(aidEdge), status: 'geliefert', positionen: [posEdge()] }, { _id: new ObjectId(gidEdge), status: 'entwurf', positionen: [posEdge({ menge: -1 }), posEdge({ geliefertMenge: 5 })] }]; expect((await (await getEdge()).json()).bedarf[0].bereitsInSammelbestellungen).toBe(0); });
  it('GET zeigt Grössenvarianten und ignoriert verwaiste Varianten', async () => { data.artikel = [artikelEdge(aidEdge, { hatGroessen: true })]; data.artikelvarianten = [{ artikelId: aidEdge, groesseId: gidEdge, menge: 3 }, { artikelId: aid2Edge, groesseId: gidEdge, menge: 3 }, { artikelId: aidEdge, groesseId: 'invalid', menge: 3 }]; const resultEdge = await (await getEdge()).json(); expect(resultEdge.bedarf).toHaveLength(1); expect(resultEdge.bedarf[0]).toMatchObject({ groesseId: gidEdge, bestand: 3 }); });
  it('GET zeigt keinen Lieferanten bei verwaister Lieferanten-ID', async () => { data.lieferanten = []; expect((await (await getEdge()).json()).bedarf[0]).toMatchObject({ lieferantId: null, lieferantName: null }); });
  it('GET behandelt ungültige Bestandszahlen als unbekannt', async () => { data.artikel = [artikelEdge(aidEdge, { menge: -2 })]; expect((await (await getEdge()).json()).bedarf[0]).toMatchObject({ bestand: null, verfuegbar: 0 }); });
  it('GET ergänzt Legacy-Sammelbestellungen ohne optionale Felder', async () => { data.vereinskleider_sammelbestellungen = [{ _id: new ObjectId(aidEdge), status: 'entwurf', positionen: [posEdge()], lieferantId: lidEdge }]; const resultEdge = await (await getEdge()).json(); expect(resultEdge.sammelbestellungen[0]).toMatchObject({ lieferantName: 'Lieferant A', bestelltAm: null, geliefertAm: null }); });
  it('GET verweigert Zugriff', async () => { mocks.permission.mockReturnValueOnce(new Response('Nein', { status: 403 })); expect((await getEdge()).status).toBe(403); });
  it('GET meldet Datenbankfehler', async () => { failCollection = 'artikel'; expect((await getEdge()).status).toBe(500); });
  it.each([null, [], 'text', 42])('POST verweigert ungültige Eingabe %s', async value => { expect((await postEdge(value)).status).toBe(400); });
  it.each([[], Array.from({ length: 101 }, () => posEdge())])('POST prüft Positionsanzahl', async positionen => { expect((await postEdge({ positionen })).status).toBe(400); });
  it.each([null, [], 'text'])('POST prüft einzelne Position %s', async value => { expect((await postEdge({ positionen: [value] })).status).toBe(400); });
  it.each([0, -1, 10001, 1.2, '2'])('POST prüft Menge %s', async menge => { expect((await postEdge({ positionen: [posEdge({ menge })] })).status).toBe(400); });
  it('POST prüft ungültige IDs', async () => { expect((await postEdge({ positionen: [posEdge({ artikelId: 'falsch' })] })).status).toBe(400); expect((await postEdge({ positionen: [posEdge({ groesseId: 'falsch' })] })).status).toBe(400); });
  it('POST verhindert doppelte Positionen', async () => { expect((await postEdge({ positionen: [posEdge(), posEdge()] })).status).toBe(400); });
  it('POST prüft Bemerkung', async () => { expect((await postEdge({ positionen: [posEdge()], bemerkung: 42 })).status).toBe(400); expect((await postEdge({ positionen: [posEdge()], bemerkung: 'x'.repeat(2001) })).status).toBe(400); });
  it('POST verweigert unbekannte Artikel', async () => { expect((await postEdge({ positionen: [posEdge({ artikelId: aid2Edge })] })).status).toBe(409); });
  it('POST verweigert Artikel ohne gültigen Lieferanten', async () => { data.lieferanten = []; expect((await postEdge({ positionen: [posEdge()] })).status).toBe(409); });
  it('POST verhindert gemischte Lieferanten', async () => { data.artikel.push(artikelEdge(aid2Edge, { lieferantId: lid2Edge })); data.lieferanten.push({ _id: new ObjectId(lid2Edge), name: 'Lieferant B' }); expect((await postEdge({ positionen: [posEdge(), posEdge({ artikelId: aid2Edge })] })).status).toBe(400); });
  it('POST speichert Bestellung mit Lagerreserve und getrimmter Bemerkung', async () => { const r = await postEdge({ positionen: [posEdge()], bemerkung: ' Test ' }); expect(r.status).toBe(201); expect(insertOne.mock.calls[0][0]).toMatchObject({ bemerkung: 'Test', lieferantId: lidEdge, positionen: [{ kundenbedarfMenge: 0, lagerreserveMenge: 2 }] }); });
  it('POST berechnet Kundenbedarf und Reserve getrennt', async () => { data.vereinskleider_verkaeufe = [{ positionen: [{ ...posEdge({ menge: 7 }), verkaufsart: 'bestellung' }] }]; const r = await postEdge({ positionen: [posEdge({ menge: 5 })] }); expect(r.status).toBe(201); expect(insertOne.mock.calls[0][0].positionen[0]).toMatchObject({ kundenbedarfMenge: 3, lagerreserveMenge: 2 }); });
  it('POST verweigert Zugriff', async () => { mocks.permission.mockReturnValueOnce(new Response('Nein', { status: 403 })); expect((await postEdge({ positionen: [posEdge()] })).status).toBe(403); });
  it('POST meldet Datenbankfehler', async () => { failCollection = 'artikel'; expect((await postEdge({ positionen: [posEdge()] })).status).toBe(500); });
});

describe('Sammelbestellungen – historische Daten und Mengen', () => {
  it.each([{groesseId:'invalid'},{menge:1.5},{uebergebenMenge:-1},{uebergebenMenge:0.5}])('ignoriert inkonsistente Kundenposition %#',async patch=>{
    setup({vereinskleider_verkaeufe:[{positionen:[{...validPosition(),verkaufsart:'bestellung',...patch}]}]});
    expect((await json(await GET(getEvent()))).bedarf[0].offen).toBe(0);
  });
  it.each([{menge:1.5},{geliefertMenge:-1},{geliefertMenge:0.5}])('ignoriert inkonsistenten Zulauf %#',async patch=>{
    setup({vereinskleider_sammelbestellungen:[{_id:vorgangId,status:'bestellt',positionen:[{...validPosition(),...patch}]}]});
    expect((await json(await GET(getEvent()))).bedarf[0].bereitsInSammelbestellungen).toBe(0);
  });
  it('behandelt fehlende historische Bestellpositionen und Lieferanten',async()=>{
    setup({vereinskleider_sammelbestellungen:[{_id:vorgangId,status:'entwurf',lieferantId:lieferant2Id}]});
    const result=await json(await GET(getEvent()));
    expect(result.sammelbestellungen[0]).toMatchObject({positionen:[],lieferantName:null});
  });
  it('behält gespeicherte Lieferantennamen und Mengenaufteilung',async()=>{
    setup({vereinskleider_sammelbestellungen:[{_id:vorgangId,status:'bestellt',lieferantId,lieferantName:'Alter Name',positionen:[{...validPosition(),kundenbedarfMenge:2,lagerreserveMenge:1}]}]});
    const result=await json(await GET(getEvent()));
    expect(result.sammelbestellungen[0]).toMatchObject({lieferantName:'Alter Name',positionen:[{kundenbedarfMenge:2,lagerreserveMenge:1,offenMenge:3}]});
  });
  it('ignoriert Varianten eines Artikels ohne Grössen',async()=>{
    setup({artikelvarianten:[{artikelId,groesseId,menge:9}]});
    expect((await json(await GET(getEvent()))).bedarf).toEqual([expect.objectContaining({groesseId:null,bestand:2})]);
  });
  it('verwendet Ersatznamen bei fehlenden Artikel- und Lieferantennamen',async()=>{
    setup({artikel:[{_id:new ObjectId(artikelId),menge:2,lieferantId}],lieferanten:[{_id:new ObjectId(lieferantId)}]});
    expect((await json(await GET(getEvent()))).bedarf[0]).toMatchObject({artikelname:'Unbenannter Artikel',lieferantName:''});
  });
  it('summiert ausstehenden Zulauf über mehrere Sammelbestellungen',async()=>{
    setup({vereinskleider_sammelbestellungen:[{_id:vorgangId,status:'entwurf',positionen:[validPosition()]},{_id:new ObjectId(),status:'bestellt',positionen:[{...validPosition(),geliefertMenge:1}]}]});
    expect((await json(await GET(getEvent()))).bedarf[0].bereitsInSammelbestellungen).toBe(5);
  });
});
