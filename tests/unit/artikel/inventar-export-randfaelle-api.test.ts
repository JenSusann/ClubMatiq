import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ collections: {} as Record<string, any> }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => m.collections[name] } }));
import { GET } from '../../../src/routes/api/export/inventar/+server';

const base = {
  artikel: [{ _id: 'a1', name: 'Ball', kategorieId: 'k1', lagerortId: 'l1', lieferantId: 'f1', menge: 2, einzelwert: 5, hatGroessen: false }],
  kategorien: [{ _id: 'k1', name: 'Sport' }],
  lagerorte: [{ _id: 'l1', name: 'Halle' }],
  lieferanten: [{ _id: 'f1', name: 'Muster AG' }],
  groessen: [{ _id: 's1', bezeichnung: 'XL' }],
  artikelvarianten: []
};
type Data = Record<string, any[]>;
function setup(overrides: Data = {}) {
  const daten: Data = { ...base, ...overrides };
  const collections: Record<string, any> = {};
  for (const name of ['artikel', 'kategorien', 'lagerorte', 'lieferanten', 'groessen', 'artikelvarianten']) {
    const toArray = vi.fn().mockResolvedValue(daten[name]);
    collections[name] = { find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray }), toArray }) };
  }
  m.collections = collections;
  return collections;
}
async function csv(query = '') {
  const result = await GET({ locals: { benutzer: { rolle: 'admin', vereinId: 'v1' } }, url: new URL(`http://localhost/api/export/inventar?${query}`) } as any);
  expect(result.status).toBe(200);
  return result.text();
}
const shirt = { _id: 'a1', name: 'Shirt', kategorieId: 'k1', lagerortId: 'l1', lieferantId: 'f1', hatGroessen: true };
const variant = (menge: unknown, einzelwert: unknown, groesseId: unknown = 's1') => ({ artikelId: 'a1', groesseId, menge, einzelwert });

beforeEach(() => { vi.clearAllMocks(); setup(); });

describe('Coverage P16 – CSV Inventar/Bewertung Branches', () => {
  it.each([
    ['ohne Kategorie', { kategorien: [] }, 'Unbekannt'],
    ['ohne Lagerort', { lagerorte: [] }, 'Unbekannt'],
    ['ohne Lieferant', { lieferanten: [] }, 'Nicht zugeordnet'],
    ['ohne Kategorie-ID', { artikel: [{ ...base.artikel[0], kategorieId: undefined }] }, 'Unbekannt'],
    ['ohne Lagerort-ID', { artikel: [{ ...base.artikel[0], lagerortId: undefined }] }, 'Unbekannt'],
    ['ohne Lieferanten-ID', { artikel: [{ ...base.artikel[0], lieferantId: undefined }] }, 'Nicht zugeordnet'],
  ] as const)('%s', async (_name, override, expected) => {
    setup(override as unknown as Data);
    expect(await csv()).toContain(`"${expected}"`);
  });

  it.each([
    ['ohne Namen', { name: undefined }, '""'],
    ['ohne Menge', { menge: undefined }, '"0"'],
    ['ohne Einzelwert', { einzelwert: undefined }, '"Ja"'],
    ['Einzelwert null', { einzelwert: null }, '"Ja"'],
    ['Einzelwert negativ', { einzelwert: -1 }, '"Ja"'],
    ['Einzelwert String', { einzelwert: '4' }, '"Ja"'],
    ['Einzelwert Infinity', { einzelwert: Infinity }, '"Ja"'],
    ['Einzelwert NaN', { einzelwert: NaN }, '"Ja"'],
    ['Einzelwert null bei Nullbestand', { menge: 0, einzelwert: null }, '"Nein"'],
    ['Einzelwert null bei Negativbestand', { menge: -1, einzelwert: null }, '"Nein"'],
  ] as const)('%s', async (_name, changes, expected) => {
    setup({ artikel: [{ ...base.artikel[0], ...changes }] });
    expect(await csv()).toContain(expected);
  });

  it('ignoriert nicht zugehörige Varianten und erkennt fehlende Grösse', async () => {
    setup({ artikel: [shirt], artikelvarianten: [variant(2, 3, 'nicht-da'), { ...variant(2, 3), artikelId: 'fremd' }] });
    const result = await csv();
    expect(result).toContain('"Unbekannt"');
    expect(result).toContain('"6,00"');
    expect(result.match(/"Shirt"/g)).toHaveLength(1);
  });

  it.each([
    ['ohne Variantenmenge', variant(undefined, 3), '"0"'],
    ['ohne Variantenpreis', variant(3, undefined), '"Ja"'],
    ['mit Variantenpreis null', variant(3, null), '"Ja"'],
    ['mit Variantenpreis null und Menge null', variant(null, null), '"Nein"'],
    ['mit gültigem Nullpreis', variant(3, 0), '"0,00"'],
    ['mit ungültigem negativem Preis', variant(3, -5), '"Ja"'],
    ['mit ungültigem Textpreis', variant(3, '3'), '"Ja"'],
  ] as const)('%s', async (_name, v, expected) => {
    setup({ artikel: [shirt], artikelvarianten: [v] });
    expect(await csv()).toContain(expected);
  });

  it('zeigt grössenlose Artikel ohne Varianten im Inventarmodus trotz Suchfilter nicht als Treffer an', async () => {
    setup({ artikel: [shirt], artikelvarianten: [] });
    expect(await csv('suche=nomatch')).toContain('"Shirt"');
  });

  it('zeigt grössenlose Artikel ohne Varianten im Bewertungsmodus nicht an', async () => {
    setup({ artikel: [shirt], artikelvarianten: [] });
    expect(await csv('modus=bewertung')).not.toContain('"Shirt"');
  });

  it('findet im Bewertungsmodus über Grösse statt Artikelname', async () => {
    setup({ artikel: [shirt], artikelvarianten: [variant(2, 3)] });
    expect(await csv('modus=bewertung&suche=xl')).toContain('"Shirt"');
    expect(await csv('modus=bewertung&suche=unauffindbar')).not.toContain('"Shirt"');
  });

  it('findet Lieferant im Inventarmodus, nicht aber im Bewertungsmodus', async () => {
    expect(await csv('suche=muster')).toContain('"Ball"');
    expect(await csv('modus=bewertung&suche=muster')).not.toContain('"Ball"');
  });

  it.each(['ball', 'sport', 'halle'])('findet Inventar über %s', async suche => {
    expect(await csv(`suche=${suche}`)).toContain('"Ball"');
  });

  it('berücksichtigt Filter in Kombination und ohne Suchbegriff', async () => {
    expect(await csv('kategorie=Sport&lagerort=Halle')).toContain('"Ball"');
    expect(await csv('kategorie=Sport&lagerort=Anders')).not.toContain('"Ball"');
  });

  it('nurFehlende gilt nur im Bewertungsmodus', async () => {
    expect(await csv('nurFehlende=true')).toContain('"Ball"');
    expect(await csv('modus=bewertung&nurFehlende=true')).not.toContain('"Ball"');
    setup({ artikel: [{ ...base.artikel[0], einzelwert: null }] });
    expect(await csv('modus=bewertung&nurFehlende=true')).toContain('"Ball"');
  });

  it('filtert nichtpositive Varianten in Bewertung, aber nicht im Inventar', async () => {
    setup({ artikel: [shirt], artikelvarianten: [variant(-2, 3)] });
    expect(await csv('modus=bewertung')).not.toContain('"Shirt"');
    expect(await csv('modus=inventar')).toContain('"Shirt"');
  });

  it.each(['=1+1', '+SUM(1)', '@cmd', '-1+2', '\t=1+1', '  =1+1', '\r=1+1'])('schützt Formeltext %s', async name => {
    setup({ artikel: [{ ...base.artikel[0], name }] });
    expect(await csv()).toContain(`'${name}`);
  });

  it('schützt numerische negative Werte nicht mit einem Apostroph', async () => {
    setup({ artikel: [{ ...base.artikel[0], menge: -2, einzelwert: 3 }] });
    expect(await csv()).toContain('"-2"');
  });

  it('escapt doppelte Anführungszeichen im Namen', async () => {
    setup({ artikel: [{ ...base.artikel[0], name: 'Test "Spezial"' }] });
    expect(await csv()).toContain('"Test ""Spezial"""');
  });
});
