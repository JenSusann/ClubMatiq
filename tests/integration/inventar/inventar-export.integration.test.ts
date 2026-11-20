import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), toArray: vi.fn(), sort: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: () => ({ find: m.find }) } }));
import { GET } from '../../../src/routes/api/export/inventar/+server';
const id = (n: number) => n.toString(16).padStart(24, '0');
const a = (overrides: Record<string, unknown> = {}) => ({ _id: id(1), name: 'Turnshirt', kategorieId: id(2), lagerortId: id(3), lieferantId: id(4), menge: 3, einzelwert: 12.5, hatGroessen: false, ...overrides });
const daten = (artikel: any[] = [a()], varianten: any[] = []) => ({ artikel, kategorien: [{ _id: id(2), name: 'Kleider' }], lagerorte: [{ _id: id(3), name: 'Lager' }], groessen: [{ _id: id(5), bezeichnung: 'M' }], artikelvarianten: varianten, lieferanten: [{ _id: id(4), name: 'Sport AG' }] });
function laden(d: ReturnType<typeof daten>) {
  m.find.mockImplementation((filter: any) => ({ sort: m.sort, toArray: m.toArray }));
  m.sort.mockReturnValue({ toArray: m.toArray });
  const reihen = [d.artikel, d.kategorien, d.lagerorte, d.groessen, d.artikelvarianten, d.lieferanten];
  let i = 0;
  m.toArray.mockImplementation(() => Promise.resolve(reihen[i++] ?? []));
}
function ctx(query = '', rolle = 'admin', benutzer: any = { rolle, vereinId: id(9) }) {
  return { locals: { benutzer }, url: new URL('http://localhost/api/export/inventar' + query) } as any;
}
beforeEach(() => { vi.resetAllMocks(); });
describe('Coverage P8 – Inventar- und Bewertungsexport', () => {
  it('verweigert unangemeldete, unberechtigte und ungültige Anfragen', async () => {
    expect((await GET(ctx('', 'admin', null))).status).toBe(401);
    expect((await GET(ctx('', 'mitglied', { rolle: 'mitglied', vereinId: id(9) }))).status).toBe(403);
    expect((await GET(ctx('?modus=unbekannt'))).status).toBe(400);
  });
  it('exportiert Inventar mit Preis, Lieferant und CHF-Formatierung', async () => {
    laden(daten()); const r = await GET(ctx()); const csv = await r.text();
    expect(r.status).toBe(200); expect(csv).toContain('Turnshirt'); expect(csv).toContain('Sport AG'); expect(csv).toContain('12,50'); expect(csv).toContain('37,50');
  });
  it('filtert nach Kategorie, Lagerort und Suche', async () => {
    laden(daten()); const r = await GET(ctx('?kategorie=Andere&lagerort=Lager')); expect(await r.text()).not.toContain('Turnshirt');
    laden(daten()); const s = await GET(ctx('?suche=sport')); expect(await s.text()).toContain('Turnshirt');
  });
  it('schützt CSV vor Formel-Injektion und maskiert Anführungszeichen', async () => {
    laden(daten([a({ name: '=SUM(1+1) "Test"' })])); const csv = await (await GET(ctx())).text();
    expect(csv).toContain("'=SUM(1+1)"); expect(csv).toContain('""Test""');
  });
  it('exportiert Artikel ohne Grössenvarianten auch bei leerem Variantenbestand', async () => {
    laden(daten([a({ hatGroessen: true })])); const csv = await (await GET(ctx())).text(); expect(csv).toContain('Turnshirt');
  });
  it('berücksichtigt Grössensuche und fehlende Preise im Bewertungsmodus', async () => {
    laden(daten([a({ hatGroessen: true })], [{ artikelId: id(1), groesseId: id(5), menge: 2, einzelwert: null }]));
    const csv = await (await GET(ctx('?modus=bewertung&suche=m&nurFehlende=true'))).text();
    expect(csv).toContain('Turnshirt'); expect(csv).toContain('"Ja"');
  });
  it('überspringt Varianten mit Bestand null im Bewertungsmodus', async () => {
    laden(daten([a({ hatGroessen: true })], [{ artikelId: id(1), groesseId: id(5), menge: 0, einzelwert: null }]));
    const csv = await (await GET(ctx('?modus=bewertung'))).text(); expect(csv).not.toContain('Turnshirt');
  });
  it('berücksichtigt fehlende Stammdaten und ungültige Preise', async () => {
    laden({ ...daten([a({ kategorieId: id(99), lagerortId: id(99), lieferantId: id(99), einzelwert: -2 })]), kategorien: [], lagerorte: [], lieferanten: [] });
    const csv = await (await GET(ctx())).text(); expect(csv).toContain('Unbekannt'); expect(csv).toContain('Nicht zugeordnet'); expect(csv).toContain('"Ja"');
  });
  it('liefert bei Datenbankfehler 500', async () => {
    m.find.mockImplementation(() => { throw new Error('DB'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await GET(ctx())).status).toBe(500); spy.mockRestore();
  });
});
