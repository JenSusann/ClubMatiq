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
