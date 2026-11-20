import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  permission: vi.fn(),
  insert: vi.fn(),
  fail: ''
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    find: () => ({
      project: () => ({ toArray: async () => { if (m.fail === name) throw Error('DB'); return m.rows[name] ?? []; } }),
      sort: () => ({ toArray: async () => { if (m.fail === name) throw Error('DB'); return m.rows[name] ?? []; } })
    }),
    insertOne: (...args: unknown[]) => m.insert(...args)
  }) }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: (...args: unknown[]) => m.permission(...args)
}));
import { GET, POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const G = 'cccccccccccccccccccccccc';
const L = 'dddddddddddddddddddddddd';
const L2 = 'eeeeeeeeeeeeeeeeeeeeeeee';
const oid = (s: string) => new ObjectId(s);
const user = { vereinId: 'verein-p14' };
const event = () => ({ locals: { benutzer: user } }) as any;
const post = (positionen: unknown[], bemerkung?: unknown) => POST({ ...event(), request: new Request('http://localhost/api/vereinskleider/sammelbestellungen', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ positionen, ...(bemerkung === undefined ? {} : { bemerkung }) })
}) } as any);
const position = (artikelId = A, groesseId: string | null = null, menge = 2) => ({ artikelId, groesseId, menge });
const customer = (positionen: unknown) => ({ positionen });
const ordered = (artikelId: string, groesseId: string | null, menge: number, extra: Record<string, unknown> = {}) => ({ artikelId, groesseId, artikelname: 'Artikel', menge, verkaufsart: 'bestellung', ...extra });
const collect = async () => (await GET(event())).json();

beforeEach(() => {
  vi.clearAllMocks();
  m.fail = '';
  m.permission.mockReturnValue(null);
  m.insert.mockResolvedValue({ insertedId: oid(B) });
  m.rows = {
    vereinskleider_verkaeufe: [],
    artikel: [{ _id: oid(A), name: 'Shirt', menge: 1, hatGroessen: false, lieferantId: L }],
    artikelvarianten: [],
    vereinskleider_sammelbestellungen: [],
    lieferanten: [{ _id: oid(L), name: 'Lieferant' }]
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Paket 14 – Sammelbestellungen: zusätzliche Bedarfszweige', () => {
  it.each([
    ['negative Menge', -3], ['NaN als Bestand', 'unbekannt'], ['unendlicher Bestand', Infinity]
  ])('%s ergibt unbekannten Bestand', async (_name, menge) => {
    m.rows.artikel[0].menge = menge;
    const result = await collect();
    expect(result.bedarf[0]).toMatchObject({ bestand: null, verfuegbar: 0 });
  });

  it('verwendet Ersatznamen und null bei fehlendem Standardlieferanten', async () => {
    m.rows.artikel[0].name = null;
    m.rows.artikel[0].lieferantId = 'nicht-vorhanden';
    const result = await collect();
    expect(result.bedarf[0]).toMatchObject({ artikelname: 'Unbenannter Artikel', lieferantId: null, lieferantName: null });
    const response = await post([position()]);
    expect(response.status).toBe(409);
    expect((await response.json()).fehler).toContain('Standardlieferant');
  });

  it('berechnet offene Kundenmenge nach Teilübergabe und ignoriert Direktverkäufe', async () => {
    m.rows.vereinskleider_verkaeufe = [customer([
      ordered(A, null, 7, { uebergebenMenge: 2 }),
      { ...ordered(A, null, 9), verkaufsart: 'direkt' },
      ordered(A, null, 2, { uebergebenMenge: 2 })
    ])];
    expect((await collect()).bedarf[0]).toMatchObject({ offen: 5, nachbestellen: 5 });
  });

  it.each([
    ['Menge 0', { menge: 0 }],
    ['Übergabe negativ', { uebergebenMenge: -1 }],
    ['Übergabe grösser als Menge', { uebergebenMenge: 4 }],
    ['Übergabe keine Ganzzahl', { uebergebenMenge: 1.5 }]
  ])('ignoriert fehlerhafte Kundenbestellung: %s', async (_label, overrides) => {
    m.rows.vereinskleider_verkaeufe = [customer([ordered(A, null, 3, overrides)])];
    expect((await collect()).bedarf[0].offen).toBe(0);
  });

  it('addiert offene Mengen mehrerer Vorgänge', async () => {
    m.rows.vereinskleider_verkaeufe = [customer([ordered(A, null, 2)]), customer([ordered(A, null, 4, { uebergebenMenge: 1 })])];
    expect((await collect()).bedarf[0].offen).toBe(5);
  });

  it('zieht nur ausstehende Mengen bestellter und entworfener Sammelbestellungen ab', async () => {
    m.rows.vereinskleider_verkaeufe = [customer([ordered(A, null, 12)])];
    m.rows.vereinskleider_sammelbestellungen = [
      { _id: oid(B), status: 'entwurf', positionen: [{ artikelId: A, groesseId: null, menge: 4, geliefertMenge: 1 }] },
      { _id: oid(G), status: 'bestellt', positionen: [{ artikelId: A, groesseId: null, menge: 3 }] },
      { _id: oid(L), status: 'geliefert', positionen: [{ artikelId: A, groesseId: null, menge: 20 }] }
    ];
    expect((await collect()).bedarf[0]).toMatchObject({ offen: 12, bereitsInSammelbestellungen: 6, nachbestellen: 6 });
  });

  it.each([
    ['Menge negativ', { menge: -1 }],
    ['geliefert negativ', { menge: 2, geliefertMenge: -1 }],
    ['mehr geliefert als bestellt', { menge: 2, geliefertMenge: 3 }],
    ['geliefert Dezimalzahl', { menge: 2, geliefertMenge: 0.5 }]
  ])('ignoriert ungültige offene Sammelposition: %s', async (_label, overrides) => {
    m.rows.vereinskleider_sammelbestellungen = [{ _id: oid(B), status: 'bestellt', positionen: [{ artikelId: A, groesseId: null, ...overrides }] }];
    expect((await collect()).bedarf[0].bereitsInSammelbestellungen).toBe(0);
  });

  it('liefert Legacy-Bestellungen ohne Aufteilung und ohne optionale Daten korrekt aus', async () => {
    m.rows.vereinskleider_sammelbestellungen = [{ _id: oid(B), status: 'entwurf', positionen: [{ artikelId: A, groesseId: null, menge: 3 }], bemerkung: '' }];
    const result = await collect();
    expect(result.sammelbestellungen[0]).toMatchObject({
      lieferantId: null, lieferantName: null, bestelltAm: null, geliefertAm: null,
      positionen: [{ geliefertMenge: 0, kundenbedarfMenge: null, lagerreserveMenge: null, offenMenge: 3 }]
    });
  });

  it('berücksichtigt Variantenbestände und Lieferantennamen aus Stammdaten', async () => {
    m.rows.artikel = [{ _id: oid(A), name: 'Jacke', hatGroessen: true, lieferantId: L }];
    m.rows.artikelvarianten = [{ artikelId: A, groesseId: G, menge: 4 }];
    m.rows.vereinskleider_verkaeufe = [customer([ordered(A, G, 8)])];
    const result = await collect();
    expect(result.bedarf[0]).toMatchObject({ groesseId: G, bestand: 4, verfuegbar: 3, offen: 8, nachbestellen: 5 });
    const response = await post([position(A, G, 7)], '  Eilig  ');
    expect(response.status).toBe(201);
    expect(m.insert.mock.calls[0][0]).toMatchObject({ lieferantName: 'Lieferant', bemerkung: 'Eilig', positionen: [{ kundenbedarfMenge: 5, lagerreserveMenge: 2 }] });
  });

  it('ignoriert ungültige Varianten und Varianten ohne passenden Grössenartikel', async () => {
    m.rows.artikel = [{ _id: oid(A), name: 'Shirt', hatGroessen: false, lieferantId: L }];
    m.rows.artikelvarianten = [{ artikelId: A, groesseId: G, menge: 4 }, { artikelId: B, groesseId: G, menge: 5 }, { artikelId: A, groesseId: 'invalid', menge: 2 }];
    expect((await collect()).bedarf).toHaveLength(1);
  });

  it('lehnt Sammelbestellungen mit unterschiedlichen Lieferanten ab', async () => {
    m.rows.artikel.push({ _id: oid(B), name: 'Hose', menge: 3, hatGroessen: false, lieferantId: L2 });
    m.rows.lieferanten.push({ _id: oid(L2), name: 'Lieferant 2' });
    const response = await post([position(A), position(B)]);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('desselben Lieferanten');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('lehnt inzwischen nicht mehr vorhandene Artikel ab', async () => {
    const response = await post([position(B)]);
    expect(response.status).toBe(409);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('gibt 500 bei fehlgeschlagenem Einfügen zurück', async () => {
    m.insert.mockRejectedValueOnce(new Error('DB offline'));
    const response = await post([position()]);
    expect(response.status).toBe(500);
  });

  it('gibt 500 bei fehlgeschlagener Datenbankabfrage zurück', async () => {
    m.fail = 'artikel';
    const response = await GET(event());
    expect(response.status).toBe(500);
  });
});
