import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(),
  toArray: vi.fn(), endSession: vi.fn(), withTransaction: vi.fn(),
  permission: vi.fn(() => null),
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn((name: string) => ({
    findOne: (...a: unknown[]) => mocks.findOne(name, ...a),
    updateOne: (...a: unknown[]) => mocks.updateOne(name, ...a),
    insertOne: (...a: unknown[]) => mocks.insertOne(name, ...a),
    find: () => ({ sort: () => ({ limit: () => ({ project: () => ({ toArray: mocks.toArray }) }) }) })
  })) },
  client: { startSession: () => ({
    withTransaction: (cb: () => Promise<unknown>) => mocks.withTransaction(cb),
    endSession: mocks.endSession
  }) }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.permission }));
import { GET, POST } from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

const VID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const AID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RID = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: VID, rolle: 'admin' } } as any;
const position = () => ({ artikelId: AID, groesseId: null, artikelname: 'Trainer', verkaufsart: 'bestellung', menge: 3, einzelpreis: 20, positionsbetrag: 60, uebergebenMenge: 0, reserviertMenge: 2 });
const verkauf = () => ({ _id: AID, vereinId: VID, status: 'offen', positionen: [position()], rabattTotal: 0, endbetrag: 60, zwischentotal: 60 });
const rechnung = () => ({ _id: RID, vereinId: VID, verkaufId: AID, rechnungsnummer: 'R-1', gesamtbetrag: 60, bezahltBetrag: 0, status: 'offen', positionen: [position()] });
const send = (body: unknown) => POST({ locals, request: new Request('http://localhost/api/vereinskleider/stornierungen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) } as any);
const valid = () => ({ verkaufId: AID, positionsIndex: 0, menge: 1, grund: 'Nicht benötigt' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockReturnValue(null);
  mocks.withTransaction.mockImplementation((cb: () => Promise<unknown>) => cb());
  mocks.endSession.mockResolvedValue(undefined);
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.insertOne.mockResolvedValue({ insertedId: RID });
  mocks.findOne.mockImplementation((name: string) => name === 'vereinskleider_verkaeufe' ? verkauf() : rechnung());
});

describe('Stornierungen – weitere Validierungen und Transaktionen', () => {
  it.each([null, [], 12, 'text'])('lehnt ungültigen Body %s ab', async (body) => {
    expect((await send(body)).status).toBe(400);
  });
  it.each([
    { verkaufId: 'falsch' }, { positionsIndex: -1 }, { positionsIndex: 1.5 },
    { menge: 0 }, { menge: 10001 }, { menge: 1.5 }, { grund: ' ' },
    { grund: 'x'.repeat(1001) }
  ])('lehnt ungültige Eingabe %j ab', async (change) => {
    expect((await send({ ...valid(), ...change })).status).toBe(400);
  });
  it('meldet fehlenden Verkauf', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await send(valid())).status).toBe(404);
  });
  it.each([
    ['bereits storniert', { status: 'storniert' }],
    ['bezahlter Verkauf ohne Beleg', { bezahltBetrag: 10 }],
    ['Zahlung ohne Beleg', { zahlungen: [{ betrag: 2 }] }],
    ['Rabatt', { rabatte: [{ betrag: 1 }] }],
    ['zusätzlicher Rabatt', { zusaetzlicherRabatt: 1 }],
    ['RabattTotal', { rabattTotal: 1 }],
    ['fehlende Positionen', { positionen: null }],
    ['keine Bestellposition', { positionen: [{ ...position(), verkaufsart: 'direkt' }] }],
    ['ungültige Menge', { positionen: [{ ...position(), menge: 0 }] }],
    ['zu viele übergeben', { positionen: [{ ...position(), uebergebenMenge: 4 }] }],
    ['negative Reserve', { positionen: [{ ...position(), reserviertMenge: -1 }] }],
    ['ungültiger Preis', { positionen: [{ ...position(), einzelpreis: Infinity }] }],
    ['inkonsistenter Verkaufspreis', { endbetrag: 0 }],
    ['ungültige Rechnungsreferenz', { rechnungId: 'falsch' }]
  ])('verweigert %s', async (_name, change) => {
    mocks.findOne.mockResolvedValue({ ...verkauf(), ...change });
    expect((await send(valid())).status).toBe(409);
  });
  it('verweigert Stornierung über offener Menge', async () => {
    expect((await send({ ...valid(), menge: 4 })).status).toBe(409);
  });
  it('meldet fehlenden Rechnungsbeleg', async () => {
    mocks.findOne.mockImplementation((name: string) => name === 'vereinskleider_verkaeufe' ? { ...verkauf(), rechnungId: RID } : null);
    expect((await send(valid())).status).toBe(409);
  });
  it.each([
    ['bereits stornierte Rechnung', { status: 'storniert' }],
    ['ungültiger Gesamtbetrag', { gesamtbetrag: -1 }],
    ['ungültiger Zahlbetrag', { bezahltBetrag: -1 }],
    ['ungültige Gutschrift', { gutgeschriebenBetrag: 0.001 }],
    ['Überzahlung', { bezahltBetrag: 100 }],
    ['zu hohe Gutschrift', { gutgeschriebenBetrag: 100 }],
    ['andere Rechnungsposition', { positionen: [{ ...position(), artikelId: RID }] }]
  ])('verweigert %s', async (_name, change) => {
    mocks.findOne.mockImplementation((name: string) => name === 'vereinskleider_verkaeufe' ? { ...verkauf(), rechnungId: RID } : { ...rechnung(), ...change });
    expect((await send(valid())).status).toBe(409);
  });
  it('meldet konkurrierende Rechnungsänderung', async () => {
    mocks.findOne.mockImplementation((name: string) => name === 'vereinskleider_verkaeufe' ? { ...verkauf(), rechnungId: RID } : rechnung());
    mocks.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await send(valid())).status).toBe(409);
  });
  it('meldet konkurrierende Verkaufsänderung', async () => {
    mocks.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await send(valid())).status).toBe(409);
  });
  it('storniert eine unbezahlte Position ohne Rechnung und gibt Reserve frei', async () => {
    const res = await send(valid());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stornierung).toMatchObject({ storniert: 1, freigegebeneReserve: 1, status: 'offen', gutschriftId: null });
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('storniert vollständig ohne Rechnung', async () => {
    const res = await send({ ...valid(), menge: 3 });
    expect(res.status).toBe(200);
    expect((await res.json()).stornierung.status).toBe('storniert');
  });
  it('erzeugt eine Gutschrift bei bestehender Rechnung', async () => {
    mocks.findOne.mockImplementation((name: string) => name === 'vereinskleider_verkaeufe' ? { ...verkauf(), rechnungId: RID } : rechnung());
    const res = await send(valid());
    expect(res.status).toBe(200);
    expect((await res.json()).stornierung.gutschriftBetrag).toBe(20);
    expect(mocks.insertOne).toHaveBeenCalledOnce();
    expect(mocks.updateOne).toHaveBeenCalledTimes(2);
  });
  it('liefert bei unerwartetem Transaktionsfehler 500 und beendet die Session', async () => {
    mocks.withTransaction.mockRejectedValue(new Error('DB down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await send(valid())).status).toBe(500);
    expect(mocks.endSession).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
  it('liefert Gutschriftenliste und Begrenzungsindikator', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => RID }, betrag: 20 }]);
    const res = await GET({ locals } as any);
    expect(res.status).toBe(200);
    expect((await res.json()).gutschriften[0]._id).toBe(RID);
  });
  it('liefert 500 bei Fehler beim Laden der Gutschriften', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await GET({ locals } as any)).status).toBe(500);
    spy.mockRestore();
  });
});

describe('Issue #130 – Stornierung mehrerer Erstbezüge', () => {
  const hoseId = 'dddddddddddddddddddddddd';
  const mitgliedId = 'eeeeeeeeeeeeeeeeeeeeeeee';
  const regelIds = ['111111111111111111111111','222222222222222222222222'];
  const positionen = [
    { ...position(), menge: 1, reserviertMenge: 0, einzelpreis: 115, positionsbetrag: 115 },
    { ...position(), artikelId: hoseId, menge: 1, reserviertMenge: 0, einzelpreis: 98, positionsbetrag: 98 }
  ];
  const vorgang = () => ({
    ...verkauf(), mitgliedId, positionen, zwischentotal: 213, rabattTotal: 163, endbetrag: 50,
    erstbezugsIds: [AID,hoseId],
    erstbezugsPositionen: [AID,hoseId].map((anspruch,i) => ({
      anspruch, rabattId: regelIds[i], positionsIndex: i, rabattBetrag: [65,98][i]
    })),
    rabatte: regelIds.map((rabattId,i) => ({ rabattId, betrag: [65,98][i], einmaligProMitglied: true }))
  });
  it('gibt nur den Anspruch der kostenlosen Hose frei', async () => {
    mocks.findOne.mockResolvedValue(vorgang());
    const res = await send({ ...valid(), positionsIndex: 1 });
    expect(res.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith('clubdesk_mitglieder', expect.anything(),
      { $pullAll: { erstbezugsRabattIds: [hoseId] } }, expect.anything());
    expect(mocks.updateOne).toHaveBeenCalledWith('vereinskleider_verkaeufe', expect.anything(),
      { $set: expect.objectContaining({ endbetrag: 50, rabattTotal: 65, erstbezugsIds: [AID] }) }, expect.anything());
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('erstellt eine Gutschrift von CHF 50 für das Gwändli und behält den Hosenanspruch', async () => {
    mocks.findOne.mockImplementation((name: string) => name === 'vereinskleider_verkaeufe'
      ? { ...vorgang(), rechnungId: RID }
      : { ...rechnung(), gesamtbetrag: 50, positionen });
    const res = await send(valid());
    expect(res.status).toBe(200);
    expect((await res.json()).stornierung.gutschriftBetrag).toBe(50);
    expect(mocks.insertOne).toHaveBeenCalledWith('vereinskleider_gutschriften',
      expect.objectContaining({ betrag: 50, rabattBetrag: 65 }), expect.anything());
    expect(mocks.updateOne).toHaveBeenCalledWith('clubdesk_mitglieder', expect.anything(),
      { $pullAll: { erstbezugsRabattIds: [AID] } }, expect.anything());
    expect(mocks.updateOne).toHaveBeenCalledWith('vereinskleider_verkaeufe', expect.anything(),
      { $set: expect.objectContaining({ endbetrag: 0, rabattTotal: 98, erstbezugsIds: [hoseId] }) }, expect.anything());
  });
});
