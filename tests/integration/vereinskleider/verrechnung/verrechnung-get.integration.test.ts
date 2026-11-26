import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({ collection: vi.fn(), find: vi.fn(), sort: vi.fn(), limit: vi.fn(), project: vi.fn(), toArray: vi.fn(), pruefeBerechtigung: vi.fn() }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection }, client: { startSession: vi.fn() } }));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.pruefeBerechtigung }));
import { GET } from '../../../../src/routes/api/vereinskleider/verrechnung/+server';
const benutzer = { vereinId: 'verein-p10', rolle: 'admin' };
const daten: Record<string, any[]> = {};
const call = () => GET({ locals: { benutzer } } as Parameters<typeof GET>[0]);
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  daten.vereinskleider_rechnungen = [];
  daten.vereinskleider_verkaeufe = [];
  mocks.pruefeBerechtigung.mockReturnValue(null);
  mocks.collection.mockImplementation((name: string) => ({ find: (filter: unknown) => {
    mocks.find(name, filter);
    const chain: any = {
      sort: (order: unknown) => { mocks.sort(name, order); return chain; },
      limit: (limit: number) => { mocks.limit(name, limit); return chain; },
      project: (fields: unknown) => { mocks.project(name, fields); return chain; },
      toArray: () => mocks.toArray(name)
    };
    return chain;
  } }));
  mocks.toArray.mockImplementation(async (name: string) => daten[name]);
});
describe('Verrechnung GET – Grenzwerte und Fehlerzweige', () => {
  it('blockiert ohne Berechtigung', async () => {
    mocks.pruefeBerechtigung.mockReturnValue(new Response('Verboten', { status: 403 }));
    expect((await call()).status).toBe(403);
    expect(mocks.collection).not.toHaveBeenCalled();
  });
  it('verwendet die korrekten Filter, Projektion und Limits', async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith('vereinskleider_rechnungen', { vereinId: benutzer.vereinId });
    expect(mocks.find).toHaveBeenCalledWith('vereinskleider_verkaeufe', {
      vereinId: benutzer.vereinId, rechnungId: { $exists: false }, status: { $ne: 'storniert' },
      $nor: [{ endbetrag: 0, preisOffen: { $ne: true }, 'erstbezugsIds.0': { $exists: true } }]
    });
    expect(mocks.limit).toHaveBeenCalledWith('vereinskleider_rechnungen', 1000);
    expect(mocks.limit).toHaveBeenCalledWith('vereinskleider_verkaeufe', 1000);
    expect(mocks.project).toHaveBeenCalledWith('vereinskleider_verkaeufe', {
      kaeufer: 1, riegen: 1, endbetrag: 1, erstelltAm: 1, zahlungsart: 1, zahlungsstatus: 1, bezahltBetrag: 1, preisOffen: 1, offenePreispositionen: 1, trancheRechnungIds: 1
    });
  });
  it.each([[0,0,false],[999,999,false],[1000,0,true],[0,1000,true],[1000,1000,true]])
  ('setzt begrenzt korrekt für %i Rechnungen und %i Verkäufe', async (rechnungen, verkaeufe, begrenzt) => {
    daten.vereinskleider_rechnungen = Array.from({ length: rechnungen }, (_, i) => ({ _id: new ObjectId(), nummer: i }));
    daten.vereinskleider_verkaeufe = Array.from({ length: verkaeufe }, (_, i) => ({ _id: new ObjectId(), nummer: i }));
    const result = await (await call()).json();
    expect(result.begrenzt).toBe(begrenzt);
    expect(result.rechnungen).toHaveLength(rechnungen);
    expect(result.unverrechneteVerkaeufe).toHaveLength(verkaeufe);
  });
  it('serialisiert beide MongoDB-ID-Typen zu Strings', async () => {
    const rid = new ObjectId(); const vid = new ObjectId();
    daten.vereinskleider_rechnungen = [{ _id: rid, status: 'offen' }];
    daten.vereinskleider_verkaeufe = [{ _id: vid, kaeufer: 'Test' }];
    const result = await (await call()).json();
    expect(result.rechnungen[0]._id).toBe(rid.toString());
    expect(result.unverrechneteVerkaeufe[0]._id).toBe(vid.toString());
  });
  it.each(['vereinskleider_rechnungen', 'vereinskleider_verkaeufe'])('fängt Datenbankfehler in %s ab', async (name) => {
    mocks.toArray.mockImplementation(async (collection: string) => {
      if (collection === name) throw new Error('MongoDB offline');
      return [];
    });
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ fehler: 'Verrechnungsdaten konnten nicht geladen werden.' });
  });
});
