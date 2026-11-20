import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  pruefeBerechtigung: vi.fn(), startSession: vi.fn(), withTransaction: vi.fn(), endSession: vi.fn(),
  sammelFindOne: vi.fn(), sammelUpdateOne: vi.fn(), artikelUpdateOne: vi.fn(), artikelFindOne: vi.fn(),
  variantenUpdateOne: vi.fn(), variantenFindOne: vi.fn(), verkaufFind: vi.fn(), verkaufUpdateOne: vi.fn(),
  sort: vi.fn(), toArray: vi.fn()
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.pruefeBerechtigung }));
vi.mock('../../src/lib/server/mongodb', () => ({
  client: { startSession: mocks.startSession },
  db: { collection: vi.fn((name: string) => {
    if (name === 'vereinskleider_sammelbestellungen') return { findOne: mocks.sammelFindOne, updateOne: mocks.sammelUpdateOne };
    if (name === 'artikel') return { updateOne: mocks.artikelUpdateOne, findOne: mocks.artikelFindOne };
    if (name === 'artikelvarianten') return { updateOne: mocks.variantenUpdateOne, findOne: mocks.variantenFindOne };
    if (name === 'vereinskleider_verkaeufe') return { find: mocks.verkaufFind, updateOne: mocks.verkaufUpdateOne };
    throw new Error(`Unbekannte Collection ${name}`);
  }) }
}));
import { PATCH } from '../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

const id = new ObjectId().toHexString();
const artikelId = new ObjectId().toHexString();
const groesseId = new ObjectId().toHexString();
const vereinId = 'verein-1';
const benutzer = { vereinId };
const position = (overrides: Record<string, unknown> = {}) => ({ artikelId, groesseId: null, artikelname: 'Vereinsshirt', menge: 5, ...overrides });
const bestellung = (overrides = {}) => ({ vereinId, status: 'bestellt', positionen: [position()], ...overrides });
const request = (body: unknown) => new Request('http://localhost/api/vereinskleider/sammelbestellungen/' + id, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
});
const call = (body: unknown, overrideId = id, overrideLocals: any = { benutzer }) =>
  PATCH({ params: { id: overrideId }, request: request(body), locals: overrideLocals } as any);
const assertError = async (response: Response, status: number, message?: string) => {
  expect(response.status).toBe(status);
  const data = await response.json();
  expect(data.fehler).toEqual(expect.any(String));
  if (message) expect(data.fehler).toContain(message);
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pruefeBerechtigung.mockReturnValue(null);
  mocks.withTransaction.mockImplementation(async (fn: () => Promise<void>) => fn());
  mocks.endSession.mockResolvedValue(undefined);
  mocks.startSession.mockReturnValue({ withTransaction: mocks.withTransaction, endSession: mocks.endSession });
  mocks.sammelFindOne.mockResolvedValue(bestellung());
  mocks.sammelUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.artikelUpdateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.variantenUpdateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.artikelFindOne.mockResolvedValue({ menge: 6 });
  mocks.variantenFindOne.mockResolvedValue({ menge: 6 });
  mocks.verkaufFind.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockResolvedValue([]);
  mocks.verkaufUpdateOne.mockResolvedValue({ modifiedCount: 1 });
});

describe('PATCH Vereinskleider-Sammelbestellung – Eingaben und Berechtigung', () => {
  it('verweigert Zugriff ohne Berechtigung', async () => {
    mocks.pruefeBerechtigung.mockReturnValue(new Response('Verboten', { status: 403 }));
    expect((await call({ aktion: 'bestellen' })).status).toBe(403);
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
  it('prüft die Berechtigung verkauf:verwalten', async () => {
    await call({ aktion: 'bestellen' });
    expect(mocks.pruefeBerechtigung).toHaveBeenCalledWith(benutzer, 'verkauf:verwalten');
  });
  it.each(['abc', '', '123', 'z'.repeat(24)])('lehnt ungültige ID %s ab', async (badId) => {
    await assertError(await call({ aktion: 'bestellen' }, badId), 400, 'Sammelbestellungs-ID');
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
  it.each([null, [], 'abc', 123, true])('lehnt ungültigen JSON-Inhalt %j ab', async (body) => {
    await assertError(await call(body), 400, 'Ungültige Eingabe');
  });
  it('lehnt defektes JSON ab', async () => {
    const res = await PATCH({ params: { id }, locals: { benutzer }, request: new Request('http://localhost', { method: 'PATCH', body: '{' }) } as any);
    await assertError(res, 400, 'Ungültige Eingabe');
  });
  it.each(['', 'liefern', null, 5, undefined])('lehnt Aktion %j ab', async (aktion) => {
    await assertError(await call({ aktion }), 400, 'Aktion muss');
  });
  it.each([undefined, null, [], {}, Array(101).fill({ artikelId, groesseId: null, menge: 1 })])('lehnt unzulässige Positionsliste ab', async (positionen) => {
    await assertError(await call({ aktion: 'wareneingang', positionen }), 400, '1 bis 100');
  });
  it.each([null, 2, 'text', []])('lehnt fehlerhafte Position %j ab', async (entry) => {
    await assertError(await call({ aktion: 'wareneingang', positionen: [entry] }), 400, 'Wareneingangsposition');
  });
  it.each([
    { artikelId: 'ungültig', groesseId: null, menge: 1 },
    { artikelId, groesseId: undefined, menge: 1 },
    { artikelId, groesseId: 'bad', menge: 1 },
    { artikelId, groesseId: null, menge: 0 },
    { artikelId, groesseId: null, menge: 10001 },
    { artikelId, groesseId: null, menge: 1.5 },
    { artikelId, groesseId: null, menge: '2' }
  ])('lehnt ungültige Positionswerte %j ab', async (entry) => {
    await assertError(await call({ aktion: 'wareneingang', positionen: [entry] }), 400, 'Menge ungültig');
  });
  it('lehnt doppelte Wareneingangspositionen ab', async () => {
    const p = { artikelId, groesseId: null, menge: 1 };
    await assertError(await call({ aktion: 'wareneingang', positionen: [p, p] }), 400, 'Doppelte');
  });
});

describe('PATCH Sammelbestellung – Status bestellen', () => {
  it('markiert einen Entwurf als bestellt', async () => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ status: 'entwurf' }));
    const res = await call({ aktion: 'bestellen' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ erfolg: true, status: 'bestellt' });
    expect(mocks.sammelUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, status: 'entwurf' }),
      { $set: expect.objectContaining({ status: 'bestellt', bestelltAm: expect.any(Date), aktualisiertAm: expect.any(Date) }) },
      expect.objectContaining({ session: expect.anything() })
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
  it('gibt 404 zurück, wenn die Bestellung fehlt', async () => {
    mocks.sammelFindOne.mockResolvedValue(null);
    await assertError(await call({ aktion: 'bestellen' }), 404, 'nicht gefunden');
  });
  it.each(['bestellt', 'geliefert'])('verbietet Statuswechsel aus %s', async (status) => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ status }));
    await assertError(await call({ aktion: 'bestellen' }), 409, 'Nur Entwürfe');
  });
  it('erkennt fehlgeschlagenes Statusupdate', async () => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ status: 'entwurf' }));
    mocks.sammelUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    await assertError(await call({ aktion: 'bestellen' }), 409, 'Bestellstatus');
  });
  it('beendet die Session auch bei unerwartetem Fehler', async () => {
    mocks.sammelFindOne.mockRejectedValue(new Error('Datenbank nicht verfügbar'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await assertError(await call({ aktion: 'bestellen' }), 500, 'nicht gespeichert');
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally { spy.mockRestore(); }
  });
});

describe('PATCH Sammelbestellung – Wareneingang und Lager', () => {
  const eingang = (p: { artikelId: string; groesseId: string | null; menge: number } = { artikelId, groesseId: null, menge: 2 }) => ({ aktion: 'wareneingang', positionen: [p] });
  it.each(['entwurf', 'geliefert'])('verbietet Wareneingang bei Status %s', async (status) => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ status }));
    await assertError(await call(eingang()), 409, 'nur für bestellte');
  });
  it('bucht Teilmenge in Artikelbestand und belässt Status bestellt', async () => {
    const res = await call(eingang());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ erfolg: true, status: 'bestellt', vollstaendig: false, zuordnungen: [] });
    expect(mocks.artikelUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, hatGroessen: false }),
      { $inc: { menge: 2 } }, expect.objectContaining({ session: expect.anything() })
    );
    expect(mocks.sammelUpdateOne).toHaveBeenCalledWith(expect.anything(),
      { $set: expect.objectContaining({ status: 'bestellt', positionen: [expect.objectContaining({ geliefertMenge: 2 })] }) },
      expect.anything());
  });
  it('schliesst vollständig gelieferte Bestellung ab', async () => {
    const res = await call(eingang({ artikelId, groesseId: null, menge: 5 }));
    expect(await res.json()).toEqual({ erfolg: true, status: 'geliefert', vollstaendig: true, zuordnungen: [] });
    expect(mocks.sammelUpdateOne).toHaveBeenCalledWith(expect.anything(),
      { $set: expect.objectContaining({ status: 'geliefert', geliefertAm: expect.any(Date) }) }, expect.anything());
  });
  it('berücksichtigt bereits gelieferte Mengen', async () => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ positionen: [position({ geliefertMenge: 3 })] }));
    const res = await call(eingang());
    expect((await res.json()).status).toBe('geliefert');
  });
  it('lehnt eine fremde Position ab', async () => {
    await assertError(await call(eingang({ artikelId: new ObjectId().toHexString(), groesseId: null, menge: 1 })), 409, 'gehört nicht');
  });
  it('lehnt Überlieferung ab', async () => {
    await assertError(await call(eingang({ artikelId, groesseId: null, menge: 6 })), 409, 'überschreitet');
  });
  it.each([-1, 6, 1.2])('lehnt inkonsistenten bisherigen Wareneingang %s ab', async (geliefertMenge) => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ positionen: [position({ geliefertMenge })] }));
    await assertError(await call(eingang()), 409, 'überschreitet');
  });
  it('erkennt fehlenden Artikel beim Lagerzugang', async () => {
    mocks.artikelUpdateOne.mockResolvedValue({ matchedCount: 0 });
    await assertError(await call(eingang()), 409, 'Artikel ohne Grösse');
  });
  it('bucht Grössenvariante und Artikelbestand', async () => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ positionen: [position({ groesseId })] }));
    const res = await call(eingang({ artikelId, groesseId, menge: 2 }));
    expect(res.status).toBe(200);
    expect(mocks.variantenUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, artikelId, groesseId }), { $inc: { menge: 2 } }, expect.anything());
    expect(mocks.artikelUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, hatGroessen: true }), { $inc: { menge: 2 } }, expect.anything());
  });
  it('erkennt fehlende oder inaktive Grössenvariante', async () => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ positionen: [position({ groesseId })] }));
    mocks.variantenUpdateOne.mockResolvedValue({ matchedCount: 0 });
    await assertError(await call(eingang({ artikelId, groesseId, menge: 2 })), 409, 'Artikelvariante');
  });
  it('erkennt fehlenden Hauptartikel bei Grössenvariante', async () => {
    mocks.sammelFindOne.mockResolvedValue(bestellung({ positionen: [position({ groesseId })] }));
    mocks.artikelUpdateOne.mockResolvedValue({ matchedCount: 0 });
    await assertError(await call(eingang({ artikelId, groesseId, menge: 2 })), 409, 'Zugehöriger Artikel');
  });
  it('erkennt fehlgeschlagenen Abschluss des Wareneingangs', async () => {
    mocks.sammelUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    await assertError(await call(eingang()), 409, 'nicht abgeschlossen');
  });
});

describe('PATCH Sammelbestellung – Kundenreservierungen', () => {
  const eingang = { aktion: 'wareneingang', positionen: [{ artikelId, groesseId: null, menge: 3 }] };
  const vorgang = (p = {}) => ({ _id: new ObjectId(), positionen: [{ artikelId, groesseId: null, menge: 5, verkaufsart: 'bestellung', uebergebenMenge: 0, reserviertMenge: 0, ...p }] });
  it('reserviert eingetroffene Ware für offene Kundenbestellungen', async () => {
    const v = vorgang();
    mocks.toArray.mockResolvedValue([v]);
    const res = await call(eingang);
    const body = await res.json();
    expect(body.zuordnungen).toEqual([{ vorgangId: v._id.toString(), positionsIndex: 0, artikelId, groesseId: null, menge: 3 }]);
    expect(mocks.verkaufUpdateOne).toHaveBeenCalledWith(
      { _id: v._id, vereinId }, { $inc: { 'positionen.0.reserviertMenge': 3 } }, expect.anything());
    expect(mocks.sort).toHaveBeenCalledWith({ erstelltAm: 1, _id: 1 });
  });
  it('schützt Anprobierreserve und bestehende Reservierungen', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ reserviertMenge: 2 })]);
    mocks.artikelFindOne.mockResolvedValue({ menge: 4 });
    const body = await (await call(eingang)).json();
    expect(body.zuordnungen).toEqual([{ vorgangId: expect.any(String), positionsIndex: 0, artikelId, groesseId: null, menge: 1 }]);
  });
  it('reserviert keine Ware bei ausschliesslich Direktverkauf', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ verkaufsart: 'direkt' })]);
    expect((await (await call(eingang)).json()).zuordnungen).toEqual([]);
  });
  it('reserviert keine Ware, wenn die Bestellung bereits gedeckt ist', async () => {
    mocks.toArray.mockResolvedValue([vorgang({ reserviertMenge: 5 })]);
    expect((await (await call(eingang)).json()).zuordnungen).toEqual([]);
  });
  it.each([{ menge: 0 }, { uebergebenMenge: 6 }, { reserviertMenge: -1 }, { reserviertMenge: 6 }])(
    'lehnt inkonsistente Kundenbestellmengen %j ab', async (p) => {
      mocks.toArray.mockResolvedValue([vorgang(p)]);
      await assertError(await call(eingang), 409, 'inkonsistent');
    });
  it('erkennt fehlgeschlagene Reservierungsaktualisierung', async () => {
    mocks.toArray.mockResolvedValue([vorgang()]);
    mocks.verkaufUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    await assertError(await call(eingang), 409, 'Kundenreservierung');
  });
  it('lehnt ungültigen Lagerbestand ab', async () => {
    mocks.artikelFindOne.mockResolvedValue({ menge: -1 });
    await assertError(await call(eingang), 409, 'Lagerbestand');
  });
  it('teilt Liefermenge chronologisch auf mehrere Kunden auf', async () => {
    const first = vorgang({ menge: 2 });
    const second = vorgang({ menge: 4 });
    mocks.toArray.mockResolvedValue([first, second]);
    const body = await (await call(eingang)).json();
    expect(body.zuordnungen.map((z: { menge: number }) => z.menge)).toEqual([2, 1]);
  });
});
