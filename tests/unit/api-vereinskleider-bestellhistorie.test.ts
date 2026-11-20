import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  project: vi.fn(),
  toArray: vi.fn(),
  pruefeBerechtigung: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn(() => ({
      find: (...args: unknown[]) => mocks.find(...args)
    }))
  }
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: (...args: unknown[]) => mocks.pruefeBerechtigung(...args)
}));

import { GET } from '../../src/routes/api/vereinskleider/bestellungen/historie/+server';

const vereinId = 'verein-1';
const vorgangId = new ObjectId('507f1f77bcf86cd799439011');
const benutzer = { vereinId, rolle: 'admin' };

function aufrufen(locals: Record<string, unknown> = { benutzer }) {
  return GET({ locals } as unknown as Parameters<typeof GET>[0]);
}

function vorgang(overrides: Record<string, unknown> = {}) {
  return {
    _id: vorgangId,
    vereinId,
    kaeufer: 'Jennifer',
    riegen: ['Aktive'],
    positionen: [{ artikelId: 'artikel-1', artikelname: 'Vereinsjacke', groesseId: 'groesse-m' }],
    uebergaben: [{ positionsIndex: 0, menge: 2, uebergebenAm: '2026-11-10T10:00:00.000Z' }],
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pruefeBerechtigung.mockReturnValue(null);
  mocks.find.mockImplementation(() => ({ project: mocks.project }));
  mocks.project.mockImplementation(() => ({ toArray: mocks.toArray }));
  mocks.toArray.mockResolvedValue([]);
});

describe('GET /api/vereinskleider/bestellungen/historie', () => {
  it('verweigert den Zugriff ohne Berechtigung und fragt die Datenbank nicht ab', async () => {
    const fehler = new Response(JSON.stringify({ fehler: 'Kein Zugriff' }), { status: 403 });
    mocks.pruefeBerechtigung.mockReturnValue(fehler);
    const antwort = await aufrufen({ benutzer: null });
    expect(antwort.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('prüft die korrekte Berechtigung', async () => {
    await aufrufen();
    expect(mocks.pruefeBerechtigung).toHaveBeenCalledWith(benutzer, 'verkauf:verwalten');
  });

  it('filtert ausschliesslich Übergaben des eigenen Vereins', async () => {
    await aufrufen();
    expect(mocks.find).toHaveBeenCalledWith({ vereinId, 'uebergaben.0': { $exists: true } });
  });

  it('fragt nur benötigte Felder ab', async () => {
    await aufrufen();
    expect(mocks.project).toHaveBeenCalledWith({ kaeufer: 1, riegen: 1, positionen: 1, uebergaben: 1 });
  });

  it('liefert eine leere Historie, wenn keine Übergaben vorhanden sind', async () => {
    const antwort = await aufrufen();
    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({ historie: [] });
  });

  it('bereitet einen vollständigen Übergabeeintrag korrekt auf', async () => {
    mocks.toArray.mockResolvedValue([vorgang()]);
    const antwort = await aufrufen();
    expect(await antwort.json()).toEqual({ historie: [{
      id: `${vorgangId}:0`, vorgangId: String(vorgangId), positionsIndex: 0,
      kaeufer: 'Jennifer', riegen: ['Aktive'], artikelId: 'artikel-1',
      artikelname: 'Vereinsjacke', groesseId: 'groesse-m', menge: 2,
      uebergebenAm: '2026-11-10T10:00:00.000Z'
    }] });
  });

  it('sortiert Übergaben verschiedener Vorgänge nach Datum absteigend', async () => {
    mocks.toArray.mockResolvedValue([
      vorgang({ uebergaben: [{ positionsIndex: 0, menge: 1, uebergebenAm: '2026-11-01' }] }),
      vorgang({ _id: new ObjectId('507f1f77bcf86cd799439012'), uebergaben: [{ positionsIndex: 0, menge: 1, uebergebenAm: '2026-11-15' }] })
    ]);
    const daten = await (await aufrufen()).json();
    expect(daten.historie.map((e: { uebergebenAm: string }) => e.uebergebenAm)).toEqual([
      '2026-11-15T00:00:00.000Z', '2026-11-01T00:00:00.000Z'
    ]);
  });

  it('vergibt für mehrere Übergaben desselben Vorgangs eindeutige IDs', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ uebergaben: [
      { positionsIndex: 0, menge: 1, uebergebenAm: '2026-11-01' },
      { positionsIndex: 0, menge: 1, uebergebenAm: '2026-11-02' }
    ] })]);
    const daten = await (await aufrufen()).json();
    expect(daten.historie.map((e: { id: string }) => e.id)).toEqual([`${vorgangId}:1`, `${vorgangId}:0`]);
  });

  it('verwendet Fallbacks für fehlenden Käufer, Riegen und Artikel', async () => {
    mocks.toArray.mockResolvedValue([vorgang({
      kaeufer: undefined, riegen: undefined, positionen: [],
      uebergaben: [{ positionsIndex: 3, menge: 1, uebergebenAm: '2026-11-10' }]
    })]);
    const daten = await (await aufrufen()).json();
    expect(daten.historie[0]).toMatchObject({
      kaeufer: 'Unbekannt', riegen: [], artikelId: '',
      artikelname: 'Unbekannter Artikel', groesseId: null
    });
  });

  it('übernimmt Artikel- und Grössen-ID aus dem Übergabeeintrag, falls vorhanden', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ uebergaben: [{
      positionsIndex: 0, artikelId: 'artikel-2', groesseId: 'groesse-l',
      menge: 1, uebergebenAm: '2026-11-10'
    }] })]);
    const daten = await (await aufrufen()).json();
    expect(daten.historie[0]).toMatchObject({ artikelId: 'artikel-2', groesseId: 'groesse-l' });
  });

  it('verwendet eine leere Positionsliste bei fehlerhaften Positionsdaten', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ positionen: 'kaputt' })]);
    const daten = await (await aufrufen()).json();
    expect(daten.historie[0].artikelname).toBe('Unbekannter Artikel');
  });

  it('ignoriert eine fehlerhafte Übergabeliste', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ uebergaben: 'kaputt' })]);
    expect(await (await aufrufen()).json()).toEqual({ historie: [] });
  });

  it.each([
    ['fehlender Positionsindex', { menge: 1, uebergebenAm: '2026-11-10' }],
    ['negativer Positionsindex', { positionsIndex: -1, menge: 1, uebergebenAm: '2026-11-10' }],
    ['gebrochener Positionsindex', { positionsIndex: 0.5, menge: 1, uebergebenAm: '2026-11-10' }],
    ['fehlende Menge', { positionsIndex: 0, uebergebenAm: '2026-11-10' }],
    ['Menge null', { positionsIndex: 0, menge: 0, uebergebenAm: '2026-11-10' }],
    ['negative Menge', { positionsIndex: 0, menge: -1, uebergebenAm: '2026-11-10' }],
    ['nicht-ganzzahlige Menge', { positionsIndex: 0, menge: 1.5, uebergebenAm: '2026-11-10' }],
    ['fehlendes Datum', { positionsIndex: 0, menge: 1 }],
    ['ungültiges Datum', { positionsIndex: 0, menge: 1, uebergebenAm: 'kein-datum' }]
  ])('ignoriert ungültige Übergaben: %s', async (_name, eintrag) => {
    mocks.toArray.mockResolvedValue([vorgang({ uebergaben: [eintrag] })]);
    expect(await (await aufrufen()).json()).toEqual({ historie: [] });
  });

  it('überspringt fehlerhafte Übergaben, ohne gültige zu verlieren', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ uebergaben: [
      { positionsIndex: -1, menge: 1, uebergebenAm: '2026-11-10' },
      { positionsIndex: 0, menge: 2, uebergebenAm: '2026-11-11' }
    ] })]);
    const daten = await (await aufrufen()).json();
    expect(daten.historie).toHaveLength(1);
    expect(daten.historie[0].id).toBe(`${vorgangId}:1`);
  });

  it('liefert bei Datenbankfehlern HTTP 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('MongoDB offline'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const antwort = await aufrufen();
      expect(antwort.status).toBe(500);
      expect(await antwort.json()).toEqual({ fehler: 'Übergabehistorie konnte nicht geladen werden.' });
    } finally {
      spy.mockRestore();
    }
  });
});
