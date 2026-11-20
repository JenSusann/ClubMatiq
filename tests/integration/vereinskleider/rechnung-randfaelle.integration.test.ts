import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  docs: {} as Record<string, any>, rows: {} as Record<string, any[]>,
  update: vi.fn(async () => ({ modifiedCount: 1, matchedCount: 1 })),
  insert: vi.fn(async () => ({})),
  counter: vi.fn(async () => ({ nummer: 1 })),
  auth: vi.fn(() => null as Response | null),
  ended: vi.fn(async () => {}),
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    findOne: async () => h.docs[name] ?? null,
    findOneAndUpdate: h.counter,
    insertOne: h.insert,
    updateOne: h.update,
    find: () => ({ sort() { return this; }, limit() { return this; }, project() { return this; },
      toArray: async () => h.rows[name] ?? [] }),
  }) },
  client: { startSession: () => ({ withTransaction: async (fn: () => Promise<any>) => fn(), endSession: h.ended }) },
}));
import { POST as uebergabePOST } from '../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';
import { POST as rechnungPOST } from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import { PATCH as sammelPATCH } from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const req = (method: string, body: unknown) => new Request('http://localhost/api', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const uebergabe = (body: unknown) => uebergabePOST({ locals, request: req('POST', body) } as any);
const rechnung = (body: unknown) => rechnungPOST({ locals, request: req('POST', body) } as any);
const sammel = (body: unknown) => sammelPATCH({ locals, params: { id }, request: req('PATCH', body) } as any);
const pos = (extra: Record<string, unknown> = {}) => ({ artikelId: id2, groesseId: null, menge: 5, verkaufsart: 'bestellung', ...extra });
const vpos = () => ({ artikelId: id2, groesseId: null, menge: 2, einzelpreis: 10, positionsbetrag: 20 });
const verkauf = (extra: Record<string, unknown> = {}) => ({ kaeufer: 'Test', positionen: [vpos()], endbetrag: 20, zwischentotal: 20, rabattTotal: 0, zahlungsart: 'rechnung', ...extra });
const init = (position: any = pos()) => {
  h.docs.vereinskleider_verkaeufe = { positionen: [position] };
  h.docs.artikel = { menge: 20, hatGroessen: position.groesseId !== null };
  h.rows.vereinskleider_verkaeufe = [{ positionen: [position] }];
};
beforeEach(() => {
  h.docs = {}; h.rows = {};
  h.update.mockReset().mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
  h.insert.mockReset().mockResolvedValue({});
  h.counter.mockReset().mockResolvedValue({ nummer: 1 });
  h.auth.mockReset().mockReturnValue(null);
  h.ended.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Paket 19 – Übergabe: Sonderfälle und Varianten', () => {
  it.each([
    { vorgangId: id, positionsIndex: 0, menge: 10001 },
    { vorgangId: id, positionsIndex: 0, menge: Number.MAX_SAFE_INTEGER },
    { vorgangId: id, positionsIndex: -1, menge: 1 },
    { vorgangId: id, positionsIndex: 0.5, menge: 1 },
    { vorgangId: id, positionsIndex: 0, menge: 0 },
    { vorgangId: id, positionsIndex: 0, menge: 1.5 },
  ])('weist ungültige Grenzwerte zurück %#', async body => {
    expect((await uebergabe(body)).status).toBe(400);
  });
  it('akzeptiert eine Übergabe mit vorhandener eigener Reservierung und offenem Rest', async () => {
    init(pos({ reserviertMenge: 3, uebergebenMenge: 1 }));
    const res = await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 2 });
    expect(res.status).toBe(200);
    expect((await res.json()).uebergabe).toMatchObject({ uebergeben: 3, reserviert: 1, offen: 2, status: 'offen' });
  });
  it('akzeptiert vollständig abgeschlossene Bestellung und vorhandene Übergabehistorie', async () => {
    init(pos({ menge: 2, uebergebenMenge: 1, reserviertMenge: 1 }));
    h.docs.vereinskleider_verkaeufe.uebergaben = [{ positionsIndex: 0, artikelId: id2, groesseId: null, menge: 1 }];
    const res = await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 });
    expect(res.status).toBe(200);
    expect((await res.json()).uebergabe.status).toBe('abgeschlossen');
    expect(h.update.mock.calls.at(-1)?.[1].$set.uebergaben).toHaveLength(2);
  });
  it('verhindert die Übergabe bei fremder Reservierung und knapper Lagerware', async () => {
    init(pos({ reserviertMenge: 0 }));
    h.docs.artikel.menge = 4;
    h.rows.vereinskleider_verkaeufe.push({ positionen: [pos({ reserviertMenge: 3 })] });
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 })).status).toBe(409);
  });
  it('ignoriert fremde Artikel und direkte Verkäufe bei Reservierungssumme', async () => {
    init();
    h.rows.vereinskleider_verkaeufe.push({ positionen: [
      pos({ artikelId: id3, reserviertMenge: 4 }),
      pos({ verkaufsart: 'direkt', reserviertMenge: 4 }),
      pos({ groesseId: id3, reserviertMenge: 4 }),
    ] });
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 2 })).status).toBe(200);
  });
  it('prüft fehlende und inaktive Grössenvariante', async () => {
    init(pos({ groesseId: id3 }));
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 })).status).toBe(409);
  });
  it('übergibt eine Grössenvariante erfolgreich', async () => {
    init(pos({ groesseId: id3, reserviertMenge: 2 }));
    h.docs.artikelvarianten = { menge: 10 };
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 2 })).status).toBe(200);
    expect(h.update).toHaveBeenCalledTimes(3);
  });
  it('verhindert Übergabe bei fehlgeschlagener Varianten-Aktualisierung', async () => {
    init(pos({ groesseId: id3 })); h.docs.artikelvarianten = { menge: 10 };
    h.update.mockResolvedValueOnce({ modifiedCount: 0, matchedCount: 0 });
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 })).status).toBe(409);
  });
  it('verhindert Übergabe bei fehlgeschlagener Artikel-Aktualisierung nach Variante', async () => {
    init(pos({ groesseId: id3 })); h.docs.artikelvarianten = { menge: 10 };
    h.update.mockResolvedValueOnce({ modifiedCount: 1, matchedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0, matchedCount: 0 });
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 })).status).toBe(409);
  });
  it('verhindert Übergabe bei konkurrierender Änderung am Vorgang', async () => {
    init();
    h.update.mockResolvedValueOnce({ modifiedCount: 1, matchedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0, matchedCount: 0 });
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 })).status).toBe(409);
  });
  it('meldet ungültigen Bestand als Konflikt', async () => {
    init(); h.docs.artikel.menge = -1;
    expect((await uebergabe({ vorgangId: id, positionsIndex: 0, menge: 1 })).status).toBe(409);
  });
});

describe('Paket 19 – Rechnung: optionale und inkonsistente Daten', () => {
  it('interpretiert null-Zahlungen als keine vorhandenen Zahlungen', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf({ zahlungen: null });
    const res = await rechnung({ verkaufId: id });
    expect(res.status).toBe(201);
    expect(h.insert.mock.calls[0][0]).toMatchObject({ bezahltBetrag: 0, status: 'offen', zahlungen: [] });
  });
  it.each([
    { zahlungen: {} },
    { zahlungen: [null] },
    { zahlungen: [{ betrag: 0, datum: '2026-11-19', zahlungsart: 'bar' }] },
    { zahlungen: [{ betrag: 1, datum: 'ungültig', zahlungsart: 'bar' }] },
    { zahlungen: [{ betrag: 1, datum: '2026-11-19', zahlungsart: 'karte' }] },
    { zahlungen: [{ betrag: 1, datum: '2026-11-19', zahlungsart: 5 }] },
    { zahlungen: [{ betrag: 1, datum: '2026-11-19', zahlungsart: 'bar' }], bezahltBetrag: 0 },
    { zahlungen: [{ betrag: 21, datum: '2026-11-19', zahlungsart: 'bar' }] },
    { zahlungen: [], bezahltBetrag: -1 },
  ])('verhindert Rechnungsanlage bei inkonsistenten Zahlungsdaten %#', async extra => {
    h.docs.vereinskleider_verkaeufe = verkauf(extra);
    expect((await rechnung({ verkaufId: id })).status).toBe(409);
  });
  it('erstellt vollständig bezahlte Rechnung aus bereits erfassten Zahlungen', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf({ zahlungen: [{ betrag: 20, datum: '2026-11-19', zahlungsart: 'twint' }], bezahltBetrag: 20, zahlungsstatus: 'bezahlt' });
    expect((await rechnung({ verkaufId: id })).status).toBe(201);
    expect(h.insert.mock.calls[0][0].status).toBe('bezahlt');
  });
  it('verhindert Rechnungsanlage bei bereits verrechnetem Verkauf', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf({ rechnungId: id3 });
    expect((await rechnung({ verkaufId: id })).status).toBe(409);
  });
  it('verhindert Rechnungsanlage bei gleichzeitigem Beanspruchen', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf();
    h.update.mockResolvedValueOnce({ modifiedCount: 0, matchedCount: 0 });
    expect((await rechnung({ verkaufId: id })).status).toBe(409);
  });
  it('verhindert Rechnungsanlage ohne gültige Rechnungsnummer', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf(); h.counter.mockResolvedValueOnce(null);
    expect((await rechnung({ verkaufId: id })).status).toBe(500);
  });
});

describe('Paket 19 – Sammelbestellung: Eingabegrenzen', () => {
  it.each([
    { aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: null, menge: 1 }, { artikelId: id2, groesseId: null, menge: 2 }] },
    { aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: null, menge: 10001 }] },
    { aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: null, menge: 0 }] },
    { aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: null, menge: 1.5 }] },
    { aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: undefined, menge: 1 }] },
    { aktion: 'wareneingang', positionen: [null] },
    { aktion: 'wareneingang', positionen: [[]] },
    { aktion: 'wareneingang', positionen: [] },
  ])('weist ungültigen Wareneingang ab %#', async body => {
    expect((await sammel(body)).status).toBe(400);
  });
  it('lehnt Wareneingang bei unbekannter Sammelbestellung ab', async () => {
    expect((await sammel({ aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: null, menge: 1 }] })).status).toBe(404);
  });
  it('lehnt Bestellung bei unbekannter Sammelbestellung ab', async () => {
    expect((await sammel({ aktion: 'bestellen' })).status).toBe(404);
  });
  it('lehnt Wareneingang im Entwurf ab', async () => {
    h.docs.vereinskleider_sammelbestellungen = { status: 'entwurf', positionen: [] };
    expect((await sammel({ aktion: 'wareneingang', positionen: [{ artikelId: id2, groesseId: null, menge: 1 }] })).status).toBe(409);
  });
  it('lehnt Bestellung im Status bestellt ab', async () => {
    h.docs.vereinskleider_sammelbestellungen = { status: 'bestellt', positionen: [] };
    expect((await sammel({ aktion: 'bestellen' })).status).toBe(409);
  });
  it('markiert einen Entwurf als bestellt', async () => {
    h.docs.vereinskleider_sammelbestellungen = { status: 'entwurf', positionen: [] };
    expect((await sammel({ aktion: 'bestellen' })).status).toBe(200);
  });
});
