import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const h = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  auth: vi.fn(() => null as Response | null),
  insert: vi.fn(async (_document: any) => ({ insertedId: { toString: () => 'aaaaaaaaaaaaaaaaaaaaaaaa' } })),
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    find: () => ({ project() { return this; }, sort() { return this; },
      toArray: async () => h.rows[name] ?? [] }),
    insertOne: h.insert,
  }) },
}));
import { GET, POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const get = async () => (await GET({ locals } as any)).json();
const post = (body: unknown) => POST({ locals, request: new Request('http://localhost/api', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}) } as any);
const artikel = (extra: Record<string, unknown> = {}) => ({ _id: new ObjectId(A), name: 'Shirt',
  menge: 0, hatGroessen: false, lieferantId: B, ...extra });
const lieferant = { _id: new ObjectId(B), name: 'Lieferant' };
const position = (extra: Record<string, unknown> = {}) => ({ artikelId: A, groesseId: null,
  artikelname: 'Shirt', menge: 5, verkaufsart: 'bestellung', ...extra });
const sammel = (extra: Record<string, unknown> = {}) => ({ _id: new ObjectId(C),
  status: 'bestellt', positionen: [{ artikelId: A, groesseId: null, menge: 3 }],
  bemerkung: '', erstelltAm: new Date('2026-11-01'), aktualisiertAm: new Date('2026-11-02'), ...extra });

beforeEach(() => {
  h.rows = {}; h.auth.mockReset().mockReturnValue(null);
  h.insert.mockReset().mockResolvedValue({ insertedId: { toString: () => A } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Paket 20 – gezielte offene GET-Branches der Sammelbestellungen', () => {
  it('summiert mehrere Kundenpositionen und berücksichtigt bereits übergebene Stücke', async () => {
    h.rows.artikel = [artikel()];
    h.rows.vereinskleider_verkaeufe = [
      { positionen: [position({ menge: 4, uebergebenMenge: 1 }), position({ menge: 3, uebergebenMenge: 2 })] },
    ];
    const result = await get();
    expect(result.bedarf[0]).toMatchObject({ offen: 4, nachbestellen: 4 });
  });
  it('ignoriert nicht bestellbare Positionen und ungültige Übergabewerte', async () => {
    h.rows.artikel = [artikel()];
    h.rows.vereinskleider_verkaeufe = [
      { positionen: [position({ verkaufsart: 'direkt' }), position({ artikelId: 'ungueltig' }),
        position({ groesseId: 'ungueltig' }), position({ menge: 0 }),
        position({ uebergebenMenge: -1 }), position({ uebergebenMenge: 6 }),
        position({ uebergebenMenge: 1.5 }), position({ menge: 2, uebergebenMenge: 1 })] },
      { positionen: null },
    ];
    expect((await get()).bedarf[0].offen).toBe(1);
  });
  it('berechnet nur noch nicht gelieferte Sammelbestellmengen', async () => {
    h.rows.artikel = [artikel()];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [position()] }];
    h.rows.vereinskleider_sammelbestellungen = [sammel({ positionen: [
      { artikelId: A, groesseId: null, menge: 4, geliefertMenge: 2 },
      { artikelId: A, groesseId: null, menge: 2, geliefertMenge: 1 },
    ] })];
    expect((await get()).bedarf[0]).toMatchObject({ offen: 5, bereitsInSammelbestellungen: 3, nachbestellen: 2 });
  });
  it('ignoriert gelieferte Bestellungen und inkonsistente Liefermengen', async () => {
    h.rows.artikel = [artikel()];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [position()] }];
    h.rows.vereinskleider_sammelbestellungen = [
      sammel({ status: 'geliefert' }),
      sammel({ status: 'bestellt', positionen: [
        { artikelId: A, groesseId: null, menge: -1 },
        { artikelId: A, groesseId: null, menge: 2, geliefertMenge: 3 },
        { artikelId: A, groesseId: null, menge: 2, geliefertMenge: -1 },
        { artikelId: A, groesseId: null, menge: 2, geliefertMenge: 0.5 },
      ] }),
    ];
    expect((await get()).bedarf[0]).toMatchObject({ bereitsInSammelbestellungen: 0, nachbestellen: 5 });
  });
  it('nutzt Ersatzbezeichnung und verwirft unplausiblen Lagerbestand', async () => {
    h.rows.artikel = [artikel({ name: null, menge: -5, lieferantId: null })];
    const result = await get();
    expect(result.bedarf[0]).toMatchObject({ artikelname: 'Unbenannter Artikel', bestand: null, verfuegbar: 0, lieferantId: null });
  });
  it('bildet Grössenvarianten ab und berücksichtigt deren eigenen Bestand', async () => {
    h.rows.artikel = [artikel({ hatGroessen: true, menge: 100 })];
    h.rows.artikelvarianten = [{ artikelId: A, groesseId: C, menge: 3 }];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [position({ groesseId: C, menge: 5 })] }];
    const result = await get();
    expect(result.bedarf[0]).toMatchObject({ groesseId: C, bestand: 3, verfuegbar: 2, nachbestellen: 3 });
  });
  it('ignoriert verwaiste oder ungültige Varianten', async () => {
    h.rows.artikel = [artikel({ hatGroessen: true })];
    h.rows.artikelvarianten = [
      { artikelId: B, groesseId: C, menge: 3 },
      { artikelId: A, groesseId: 'falsch', menge: 3 },
    ];
    expect((await get()).bedarf).toHaveLength(0);
  });
  it('bildet alte Sammelbestellungen ohne Liefer- und Aufteilungsfelder ab', async () => {
    h.rows.vereinskleider_sammelbestellungen = [sammel({ status: 'entwurf', lieferantId: B,
      positionen: [{ artikelId: A, groesseId: null, menge: 3 }] })];
    h.rows.lieferanten = [lieferant];
    const result = await get();
    expect(result.sammelbestellungen[0]).toMatchObject({ lieferantName: 'Lieferant',
      positionen: [{ geliefertMenge: 0, kundenbedarfMenge: null, lagerreserveMenge: null, offenMenge: 3 }] });
  });
  it('verwendet vorhandenen Lieferantennamen und gespeicherte Aufteilung', async () => {
    h.rows.vereinskleider_sammelbestellungen = [sammel({ lieferantName: 'Historischer Lieferant',
      positionen: [{ artikelId: A, groesseId: null, menge: 4, geliefertMenge: 2,
        kundenbedarfMenge: 3, lagerreserveMenge: 1 }] })];
    const result = await get();
    expect(result.sammelbestellungen[0]).toMatchObject({ lieferantName: 'Historischer Lieferant',
      positionen: [{ offenMenge: 2, kundenbedarfMenge: 3, lagerreserveMenge: 1 }] });
  });
});

describe('Paket 20 – zusätzliche POST-Branches', () => {
  it('verweigert eine Bestellung ohne Standardlieferanten', async () => {
    h.rows.artikel = [artikel({ lieferantId: null })];
    expect((await post({ positionen: [{ artikelId: A, groesseId: null, menge: 2 }] })).status).toBe(409);
  });
  it('verweigert eine Sammelbestellung mit zwei verschiedenen Lieferanten', async () => {
    h.rows.artikel = [artikel(), { _id: new ObjectId(C), name: 'Jacke', menge: 1, hatGroessen: false, lieferantId: A }];
    h.rows.lieferanten = [lieferant, { _id: new ObjectId(A), name: 'Anderer Lieferant' }];
    expect((await post({ positionen: [
      { artikelId: A, groesseId: null, menge: 2 }, { artikelId: C, groesseId: null, menge: 2 },
    ] })).status).toBe(400);
  });
  it('speichert Lieferanten-Snapshot und trennt Kundenbedarf von Lagerreserve', async () => {
    h.rows.artikel = [artikel()]; h.rows.lieferanten = [lieferant];
    h.rows.vereinskleider_verkaeufe = [{ positionen: [position({ menge: 2 })] }];
    const response = await post({ positionen: [{ artikelId: A, groesseId: null, menge: 5 }] });
    expect(response.status).toBe(201);
    expect(h.insert.mock.calls[0][0]).toMatchObject({ lieferantName: 'Lieferant',
      positionen: [{ kundenbedarfMenge: 2, lagerreserveMenge: 3 }] });
  });
});
