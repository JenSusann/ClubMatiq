import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ permission: vi.fn(), toArray: vi.fn() }));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({ find: () => ({ project: () => ({ toArray: m.toArray }) }) })) }
}));
import { GET } from '../../../../src/routes/api/vereinskleider/bestellungen/historie/+server';
const locals = { benutzer: { vereinId: 'verein-1', rolle: 'admin' } };
const call = () => GET({ locals } as any);
const id = { toString: () => 'verkauf-1' };
beforeEach(() => {
  vi.resetAllMocks();
  m.permission.mockReturnValue(null);
  m.toArray.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('Übergabehistorie – Branches', () => {
  it('liefert leere Historie', async () => {
    expect(await (await call()).json()).toEqual({ historie: [] });
  });
  it('liefert vollständig ausgefüllte Übergabe', async () => {
    m.toArray.mockResolvedValue([{
      _id: id, kaeufer: 'Anna', riegen: ['Aktive'],
      positionen: [{ artikelId: 'a', artikelname: 'Jacke', groesseId: 'M' }],
      uebergaben: [{ positionsIndex: 0, menge: 2, uebergebenAm: '2026-01-02', artikelId: 'b', groesseId: 'L' }]
    }]);
    const { historie } = await (await call()).json();
    expect(historie).toHaveLength(1);
    expect(historie[0]).toMatchObject({
      id: 'verkauf-1:0', vorgangId: 'verkauf-1', artikelId: 'b',
      artikelname: 'Jacke', groesseId: 'L', kaeufer: 'Anna',
      riegen: ['Aktive'], menge: 2
    });
  });
  it('verwendet Standardwerte und Positionsdaten', async () => {
    m.toArray.mockResolvedValue([{
      _id: id,
      positionen: [{ artikelId: 'a', groesseId: 'S' }],
      uebergaben: [{ positionsIndex: 0, menge: 1, uebergebenAm: new Date('2026-02-01') }]
    }]);
    const { historie } = await (await call()).json();
    expect(historie[0]).toMatchObject({
      kaeufer: 'Unbekannt', riegen: [], artikelId: 'a',
      artikelname: 'Unbekannter Artikel', groesseId: 'S'
    });
  });
  it('verarbeitet fehlende Position und fehlende Listen', async () => {
    m.toArray.mockResolvedValue([
      { _id: id },
      { _id: id, positionen: null, uebergaben: [{ positionsIndex: 2, menge: 1, uebergebenAm: '2026-01-01' }] }
    ]);
    const { historie } = await (await call()).json();
    expect(historie).toHaveLength(1);
    expect(historie[0]).toMatchObject({ artikelId: '', artikelname: 'Unbekannter Artikel', groesseId: null });
  });
  it.each([
    ['fehlender Index', { menge: 1, uebergebenAm: '2026-01-01' }],
    ['negativer Index', { positionsIndex: -1, menge: 1, uebergebenAm: '2026-01-01' }],
    ['gebrochener Index', { positionsIndex: 0.5, menge: 1, uebergebenAm: '2026-01-01' }],
    ['fehlende Menge', { positionsIndex: 0, uebergebenAm: '2026-01-01' }],
    ['negative Menge', { positionsIndex: 0, menge: -1, uebergebenAm: '2026-01-01' }],
    ['gebrochene Menge', { positionsIndex: 0, menge: 1.5, uebergebenAm: '2026-01-01' }],
    ['fehlendes Datum', { positionsIndex: 0, menge: 1 }],
    ['ungültiges Datum', { positionsIndex: 0, menge: 1, uebergebenAm: 'ungueltig' }]
  ])('ignoriert %s', async (_, entry) => {
    m.toArray.mockResolvedValue([{ _id: id, uebergaben: [entry] }]);
    expect((await (await call()).json()).historie).toHaveLength(0);
  });
  it('sortiert die Übergaben absteigend nach Datum', async () => {
    m.toArray.mockResolvedValue([{ _id: id, uebergaben: [
      { positionsIndex: 0, menge: 1, uebergebenAm: '2026-01-01' },
      { positionsIndex: 0, menge: 1, uebergebenAm: '2026-03-01' }
    ] }]);
    const { historie } = await (await call()).json();
    expect(historie.map((x: any) => x.id)).toEqual(['verkauf-1:1', 'verkauf-1:0']);
  });
  it('liefert 500 bei Datenbankfehler', async () => {
    m.toArray.mockRejectedValue(new Error('DB offline'));
    const response = await call();
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toContain('nicht geladen');
  });
  it('gibt Berechtigungsfehler zurück', async () => {
    m.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    expect((await call()).status).toBe(403);
    expect(m.toArray).not.toHaveBeenCalled();
  });
});
