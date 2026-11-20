import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({ collection: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
import { GET } from '../../../src/routes/api/inventar-uebersicht/+server';

const vereinId = 'verein-p10';
const id = (n: number) => new ObjectId(n.toString(16).padStart(24, '0'));
const docs: Record<string, any[]> = {};
const call = (benutzer: any = { vereinId }) => GET({ locals: { benutzer } } as Parameters<typeof GET>[0]);
const basis = (extra: Record<string, unknown> = {}) => ({
  _id: id(1), name: 'Trainingsjacke', kategorieId: id(2).toString(), lagerortId: id(3).toString(),
  hatGroessen: false, menge: 3, einzelwert: 20, mindestbestand: 5, ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const name of ['artikel', 'kategorien', 'lagerorte', 'groessen', 'artikelvarianten']) docs[name] = [];
  mocks.collection.mockImplementation((name: string) => ({ find: (filter: unknown) => {
    mocks.find(name, filter);
    return { sort: (order: unknown) => { mocks.sort(name, order); return { toArray: () => mocks.toArray(name) }; }, toArray: () => mocks.toArray(name) };
  } }));
  mocks.toArray.mockImplementation(async (name: string) => docs[name]);
});

describe('Inventarübersicht – zusätzliche Branches', () => {
  it('verweigert anonyme Zugriffe ohne Datenbankabfrage', async () => {
    expect((await call(null)).status).toBe(401);
    expect(mocks.collection).not.toHaveBeenCalled();
  });
  it('filtert alle fünf Collections auf den Verein', async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledTimes(5);
    for (const [, filter] of mocks.find.mock.calls) expect(filter).toEqual({ vereinId });
  });
  it('liefert bei leerer Datenbank eine leere Liste', async () => {
    expect(await (await call()).json()).toEqual([]);
  });
  it('liefert bei Datenbankfehler HTTP 500', async () => {
    mocks.toArray.mockRejectedValueOnce(new Error('offline'));
    expect((await call()).status).toBe(500);
  });
  it('löst Kategorie und Lagerort auf und berechnet Wert sowie Mindestbestand', async () => {
    docs.artikel = [basis()];
    docs.kategorien = [{ _id: id(2), name: 'Kleider' }];
    docs.lagerorte = [{ _id: id(3), name: 'Materialraum' }];
    const [a] = await (await call()).json();
    expect(a).toMatchObject({ kategorie: 'Kleider', lagerort: 'Materialraum', gesamtmenge: 3,
      einzelwert: 20, inventarwert: 60, preisFehlt: false, unterMindestbestand: true });
  });
  it.each([
    ['fehlender Preis', undefined, 0, true],
    ['negativer Preis', -1, 0, true],
    ['NaN-ähnlicher Nullwert', null, 0, true],
    ['gültiger Nullpreis', 0, 0, false],
    ['gültiger Preis', 12.5, 37.5, false]
  ])('%s: fehlende Preise werden kenntlich gemacht', async (_label, einzelwert, inventarwert, preisFehlt) => {
    docs.artikel = [basis({ einzelwert })];
    const [a] = await (await call()).json();
    expect(a.inventarwert).toBe(inventarwert);
    expect(a.preisFehlt).toBe(preisFehlt);
  });
  it('markiert fehlende Preise bei Nullbestand nicht als fehlend', async () => {
    docs.artikel = [basis({ menge: 0, einzelwert: undefined })];
    const [a] = await (await call()).json();
    expect(a.preisFehlt).toBe(false);
  });
  it.each([undefined, null, -3, 0, 1.2, 4])('normalisiert ungültigen oder niedrigen Mindestbestand %s', async (mindestbestand) => {
    docs.artikel = [basis({ mindestbestand, menge: 5 })];
    const [a] = await (await call()).json();
    expect(a.unterMindestbestand).toBe(false);
    expect(a.mindestbestand).toBe(mindestbestand === 4 ? 4 : 0);
  });
  it('nutzt Fallbacks für fehlende Stammdaten und Beschreibung', async () => {
    docs.artikel = [basis({ beschreibung: undefined, kategorieId: 'unbekannt', lagerortId: 'unbekannt' })];
    const [a] = await (await call()).json();
    expect(a).toMatchObject({ kategorie: 'Unbekannt', lagerort: 'Unbekannt', beschreibung: '' });
  });
  it('berechnet Variantenwert und sortiert Grössen aufsteigend', async () => {
    docs.artikel = [basis({ hatGroessen: true, menge: 99, einzelwert: 99 })];
    docs.groessen = [
      { _id: id(4), bezeichnung: 'L', sortierung: 20 },
      { _id: id(5), bezeichnung: 'S', sortierung: 10 }
    ];
    docs.artikelvarianten = [
      { artikelId: id(1).toString(), groesseId: id(4).toString(), menge: 2, einzelwert: 30, mindestbestand: 3 },
      { artikelId: id(1).toString(), groesseId: id(5).toString(), menge: 4, einzelwert: 10, mindestbestand: 2 }
    ];
    const [a] = await (await call()).json();
    expect(a.gesamtmenge).toBe(6);
    expect(a.inventarwert).toBe(100);
    expect(a.unterMindestbestand).toBe(true);
    expect(a.varianten.map((v: any) => v.groesse)).toEqual(['S', 'L']);
  });
  it('kennzeichnet Varianten mit fehlenden Preisen nur bei positivem Bestand', async () => {
    docs.artikel = [basis({ hatGroessen: true })];
    docs.artikelvarianten = [
      { artikelId: id(1).toString(), groesseId: 'g1', menge: 0, einzelwert: null, aktiv: false },
      { artikelId: id(1).toString(), groesseId: 'g2', menge: 2, einzelwert: undefined, mindestbestand: 3, aktiv: false }
    ];
    const [a] = await (await call()).json();
    expect(a).toMatchObject({ preisFehlt: true, unterMindestbestand: false, inventarwert: 0 });
    expect(a.varianten[0]).toMatchObject({ groesse: 'Unbekannt', sortierung: 9999, einzelwert: 0, preisFehlt: true });
  });
  it('ignoriert Varianten anderer Artikel und setzt fehlende Mengen auf null', async () => {
    docs.artikel = [basis({ hatGroessen: true })];
    docs.artikelvarianten = [
      { artikelId: 'fremd', groesseId: 'g1', menge: 100, einzelwert: 500 },
      { artikelId: id(1).toString(), groesseId: 'g2', einzelwert: 5 }
    ];
    const [a] = await (await call()).json();
    expect(a.gesamtmenge).toBe(0);
    expect(a.varianten).toHaveLength(1);
    expect(a.varianten[0].menge).toBe(0);
  });
});
