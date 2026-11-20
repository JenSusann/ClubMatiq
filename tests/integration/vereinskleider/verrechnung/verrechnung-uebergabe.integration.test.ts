import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  docs: {} as Record<string, any>, rows: {} as Record<string, any[]>,
  update: vi.fn(async () => ({ modifiedCount: 1 })),
  insert: vi.fn(async () => ({})),
  counter: vi.fn(async (): Promise<{ nummer: unknown } | null> => ({ nummer: 1 })),
  auth: vi.fn(() => null as Response | null),
  failure: '' as string,
  transactionFailure: false,
  ended: vi.fn(async () => {}),
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    findOne: async () => { if (h.failure === name) throw Error('DB'); return h.docs[name] ?? null; },
    findOneAndUpdate: h.counter,
    insertOne: h.insert,
    updateOne: h.update,
    find: () => ({ sort() { return this; }, limit() { return this; }, project() { return this; },
      toArray: async () => { if (h.failure === name) throw Error('DB'); return h.rows[name] ?? []; } }),
  }) },
  client: { startSession: () => ({ withTransaction: async (fn: () => Promise<any>) => {
    if (h.transactionFailure) throw Error('transaction'); return fn();
  }, endSession: h.ended }) },
}));

import { GET as rechnungenGET, POST as rechnungenPOST } from '../../../../src/routes/api/vereinskleider/verrechnung/+server';
import { PATCH as zahlungPATCH } from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';
import { POST as uebergabePOST } from '../../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const uuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const locals = { benutzer: { id: 'integration-user', vereinId: 'verein-1' } } as any;
const req = (method: string, body: unknown) => new Request('http://localhost/api', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const verkauf = () => ({ kaeufer: 'Muster', positionen: [{ artikelId: id, groesseId: null, menge: 2, einzelpreis: 10, positionsbetrag: 20 }], endbetrag: 20, zwischentotal: 20, rabattTotal: 0, zahlungsart: 'rechnung' });
const rechnung = () => ({ status: 'offen', gesamtbetrag: 20, bezahltBetrag: 0, zahlungen: [] });
const position = () => ({ artikelId: id2, groesseId: null, menge: 5, verkaufsart: 'bestellung', uebergebenMenge: 0, reserviertMenge: 0 });
const postRechnung = (v: unknown) => rechnungenPOST({ locals, request: req('POST', v) } as any);
const patchZahlung = (v: unknown) => zahlungPATCH({ locals, params: { id }, request: req('PATCH', v) } as any);
const postUebergabe = (v: unknown) => uebergabePOST({ locals, request: req('POST', v) } as any);
const zahlung = () => ({ betrag: 5, datum: '2026-11-18', zahlungsart: 'twint', zahlungId: uuid });
const uebergabe = () => ({ vorgangId: id, positionsIndex: 0, menge: 2 });
const initUebergabe = () => {
  h.docs.vereinskleider_verkaeufe = { positionen: [position()] };
  h.docs.artikel = { menge: 20, hatGroessen: false };
  h.rows.vereinskleider_verkaeufe = [{ positionen: [position()] }];
};
beforeEach(() => {
  h.docs = {}; h.rows = {}; h.failure = ''; h.transactionFailure = false;
  h.update.mockReset().mockResolvedValue({ modifiedCount: 1 });
  h.insert.mockReset().mockResolvedValue({});
  h.counter.mockReset().mockResolvedValue({ nummer: 1 });
  h.auth.mockReset().mockReturnValue(null);
  h.ended.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Paket 17 – Verrechnungsübersicht', () => {
  it('verweigert fehlende Berechtigung', async () => { h.auth.mockReturnValue(new Response('', { status: 403 })); expect((await rechnungenGET({ locals } as any)).status).toBe(403); });
  it('liefert beide Listen und begrenzt bei 1000 Rechnungen', async () => {
    h.rows.vereinskleider_rechnungen = Array.from({ length: 1000 }, () => ({ _id: { toString: () => id } }));
    const res = await rechnungenGET({ locals } as any);
    expect(res.status).toBe(200); expect((await res.json()).begrenzt).toBe(true);
  });
  it('begrenzt auch bei 1000 unverrechneten Verkäufen', async () => {
    h.rows.vereinskleider_verkaeufe = Array.from({ length: 1000 }, () => ({ _id: { toString: () => id } }));
    expect((await (await rechnungenGET({ locals } as any)).json()).begrenzt).toBe(true);
  });
  it('behandelt Datenbankfehler', async () => { h.failure = 'vereinskleider_rechnungen'; expect((await rechnungenGET({ locals } as any)).status).toBe(500); });
});

describe('Paket 17 – Rechnung aus Verkauf erstellen', () => {
  it.each([null, [], 'text', 5, {}, { verkaufId: 'falsch' }])('validiert ungültige Anfrage %#', async v => { expect((await postRechnung(v)).status).toBe(400); });
  it('verweigert fehlende Berechtigung', async () => { h.auth.mockReturnValue(new Response('', { status: 403 })); expect((await postRechnung({ verkaufId: id })).status).toBe(403); });
  it('liefert 404 bei fehlendem Verkauf', async () => { expect((await postRechnung({ verkaufId: id })).status).toBe(404); expect(h.ended).toHaveBeenCalled(); });
  it('verhindert doppelte Verrechnung', async () => { h.docs.vereinskleider_verkaeufe = { ...verkauf(), rechnungId: id }; expect((await postRechnung({ verkaufId: id })).status).toBe(409); });
  it.each([
    { positionen: [] }, { positionen: null }, { endbetrag: -1 }, { zwischentotal: 1.234 },
    { rabattTotal: NaN }, { positionen: [{ ...verkauf().positionen[0], menge: 0 }] },
    { positionen: [{ ...verkauf().positionen[0], einzelpreis: -1 }] },
    { positionen: [{ ...verkauf().positionen[0], positionsbetrag: 1.001 }] },
  ])('verweigert inkonsistente Verkaufswerte %#', async override => {
    h.docs.vereinskleider_verkaeufe = { ...verkauf(), ...override };
    expect((await postRechnung({ verkaufId: id })).status).toBe(409);
  });
  it.each([
    { zahlungen: 'falsch' }, { zahlungen: [null] },
    { zahlungen: [{ betrag: 0, datum: '2026-11-18', zahlungsart: 'bar' }] },
    { zahlungen: [{ betrag: 5, datum: 'falsch', zahlungsart: 'bar' }] },
    { zahlungen: [{ betrag: 5, datum: '2026-11-18', zahlungsart: 'bank' }] },
    { bezahltBetrag: -1 }, { bezahltBetrag: 5 },
    { zahlungsstatus: 'bezahlt' },
  ])('validiert Zahlungen und Zahlungsstatus %#', async override => {
    h.docs.vereinskleider_verkaeufe = { ...verkauf(), ...override };
    expect((await postRechnung({ verkaufId: id })).status).toBe(409);
  });
  it('erkennt Überzahlung', async () => {
    h.docs.vereinskleider_verkaeufe = { ...verkauf(), zahlungen: [{ betrag: 25, datum: new Date(), zahlungsart: 'bar' }] };
    expect((await postRechnung({ verkaufId: id })).status).toBe(409);
  });
  it('prüft fehlenden Rechnungsnummernzähler', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf(); h.counter.mockResolvedValueOnce(null);
    expect((await postRechnung({ verkaufId: id })).status).toBe(500);
  });
  it('prüft fehlerhaften Rechnungsnummernzähler', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf(); h.counter.mockResolvedValueOnce({ nummer: 'x' });
    expect((await postRechnung({ verkaufId: id })).status).toBe(500);
  });
  it('erkennt konkurrierende Rechnungsanlage', async () => {
    h.docs.vereinskleider_verkaeufe = verkauf(); h.update.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await postRechnung({ verkaufId: id })).status).toBe(409);
  });
  it.each([0, 5, 20])('übernimmt Zahlungseingänge und legt Rechnung an (%i CHF)', async betrag => {
    h.docs.vereinskleider_verkaeufe = { ...verkauf(), zahlungen: betrag ? [{ betrag, datum: new Date('2026-11-18'), zahlungsart: 'twint' }] : [], bezahltBetrag: betrag };
    const res = await postRechnung({ verkaufId: id }); expect(res.status).toBe(201); expect(h.insert).toHaveBeenCalled();
  });
  it('behandelt Transaktionsfehler', async () => { h.transactionFailure = true; expect((await postRechnung({ verkaufId: id })).status).toBe(500); });
});

describe('Paket 17 – Zahlungseingang', () => {
  it('verweigert fehlende Berechtigung', async () => { h.auth.mockReturnValue(new Response('', { status: 403 })); expect((await patchZahlung(zahlung())).status).toBe(403); });
  it('prüft ungültige Rechnungs-ID', async () => { expect((await zahlungPATCH({ locals, params: { id: 'x' }, request: req('PATCH', zahlung()) } as any)).status).toBe(400); });
  it.each([null, [], 'x', {}, 3])('prüft ungültige JSON-Daten %#', async v => { expect((await patchZahlung(v)).status).toBe(400); });
  it.each([{ betrag: 0 }, { betrag: -1 }, { betrag: 1.234 }, { betrag: '5' }, { betrag: 1e20 },
    { datum: '2026-02-30' }, { datum: '2026-13-01' }, { datum: 123 },
    { zahlungsart: 'rechnung' }, { zahlungId: 'abc' }, { zahlungId: null }])('validiert Eingabefelder %#', async override => {
      expect((await patchZahlung({ ...zahlung(), ...override })).status).toBe(400);
    });
  it('meldet fehlende Rechnung', async () => { expect((await patchZahlung(zahlung())).status).toBe(404); });
  it('verhindert Zahlungen auf stornierte Rechnungen', async () => { h.docs.vereinskleider_rechnungen = { ...rechnung(), status: 'storniert' }; expect((await patchZahlung(zahlung())).status).toBe(409); });
  it('verhindert ungültige gespeicherte Zahlungslisten', async () => { h.docs.vereinskleider_rechnungen = { ...rechnung(), zahlungen: 'kaputt' }; expect((await patchZahlung(zahlung())).status).toBe(409); });
  it.each([{ gesamtbetrag: -1 }, { bezahltBetrag: -1 }, { gutgeschriebenBetrag: -1 }, { gutgeschriebenBetrag: 21 }, { bezahltBetrag: 21 }])('prüft gespeicherte Beträge %#', async override => {
    h.docs.vereinskleider_rechnungen = { ...rechnung(), ...override }; expect((await patchZahlung(zahlung())).status).toBe(409);
  });
  it('berücksichtigt Gutschriften und sperrt Überzahlung', async () => {
    h.docs.vereinskleider_rechnungen = { ...rechnung(), gutgeschriebenBetrag: 18 };
    expect((await patchZahlung(zahlung())).status).toBe(409);
  });
  it('erkennt widersprüchliche Wiederholung derselben Zahlungs-ID', async () => {
    h.docs.vereinskleider_rechnungen = { ...rechnung(), zahlungen: [{ ...zahlung(), betrag: 3, datum: new Date('2026-11-18') }] };
    expect((await patchZahlung(zahlung())).status).toBe(409);
  });
  it('akzeptiert idempotente Wiederholung derselben Zahlung', async () => {
    h.docs.vereinskleider_rechnungen = { ...rechnung(), bezahltBetrag: 5, zahlungen: [{ ...zahlung(), datum: new Date('2026-11-18') }] };
    const res = await patchZahlung(zahlung()); expect(res.status).toBe(200); expect((await res.json()).bereitsErfasst).toBe(true);
  });
  it('erkennt konkurrierende Aktualisierung', async () => {
    h.docs.vereinskleider_rechnungen = rechnung(); h.update.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await patchZahlung(zahlung())).status).toBe(409);
  });
  it.each([5, 20])('speichert Teil- und Vollzahlung (%i CHF)', async betrag => {
    h.docs.vereinskleider_rechnungen = rechnung(); const res = await patchZahlung({ ...zahlung(), betrag });
    expect(res.status).toBe(200); expect((await res.json()).bereitsErfasst).toBe(false);
  });
  it('behandelt Datenbankausfall', async () => { h.transactionFailure = true; expect((await patchZahlung(zahlung())).status).toBe(500); });
});

describe('Paket 17 – Bestellungsübergabe', () => {
  it('verweigert fehlende Berechtigung', async () => { h.auth.mockReturnValue(new Response('', { status: 403 })); expect((await postUebergabe(uebergabe())).status).toBe(403); });
  it.each([null, [], 'x', {}, { vorgangId: 'x', positionsIndex: 0, menge: 1 },
    { vorgangId: id, positionsIndex: -1, menge: 1 }, { vorgangId: id, positionsIndex: 0.5, menge: 1 },
    { vorgangId: id, positionsIndex: 0, menge: 0 }, { vorgangId: id, positionsIndex: 0, menge: 10001 }])('prüft Anfrage %#', async v => {
    expect((await postUebergabe(v)).status).toBe(400);
  });
  it('meldet unbekannten Vorgang', async () => { expect((await postUebergabe(uebergabe())).status).toBe(404); });
  it('verweigert direkte Verkaufsposition', async () => {
    initUebergabe(); h.docs.vereinskleider_verkaeufe.positionen[0].verkaufsart = 'direkt';
    expect((await postUebergabe(uebergabe())).status).toBe(400);
  });
  it.each([{ artikelId: 'x' }, { groesseId: 'x' }, { menge: 0 }, { uebergebenMenge: -1 },
    { uebergebenMenge: 6 }, { reserviertMenge: -1 }, { reserviertMenge: 6 }])('prüft Bestellposition %#', async override => {
    initUebergabe(); Object.assign(h.docs.vereinskleider_verkaeufe.positionen[0], override);
    expect((await postUebergabe(uebergabe())).status).toBeGreaterThanOrEqual(400);
  });
  it('verhindert Übergabe über offene Menge', async () => {
    initUebergabe(); expect((await postUebergabe({ ...uebergabe(), menge: 6 })).status).toBe(409);
  });
  it('meldet fehlenden Artikel', async () => { initUebergabe(); delete h.docs.artikel; expect((await postUebergabe(uebergabe())).status).toBe(404); });
  it('prüft Grössenzuordnung', async () => { initUebergabe(); h.docs.artikel.hatGroessen = true; expect((await postUebergabe(uebergabe())).status).toBe(409); });
  it('prüft inkonsistente fremde Reservierung', async () => {
    initUebergabe(); h.rows.vereinskleider_verkaeufe = [{ positionen: [{ ...position(), reserviertMenge: 10 }] }];
    expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('prüft ungültigen Lagerbestand', async () => { initUebergabe(); h.docs.artikel.menge = -1; expect((await postUebergabe(uebergabe())).status).toBe(409); });
  it('schützt Anprobierreserve', async () => {
    initUebergabe();
    h.docs.artikel.menge = 2;
    h.rows.vereinskleider_verkaeufe.push({ positionen: [{ ...position(), reserviertMenge: 1 }] });
    expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('erkennt gescheiterte Lageraktualisierung', async () => {
    initUebergabe(); h.update.mockResolvedValueOnce({ modifiedCount: 0 }); expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('erkennt konkurrierende Änderung am Vorgang', async () => {
    initUebergabe(); h.update.mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('übergibt Teilmenge ohne Grössenvariante', async () => {
    initUebergabe(); const res = await postUebergabe(uebergabe()); expect(res.status).toBe(200); expect((await res.json()).uebergabe.status).toBe('offen');
  });
  it('schliesst vollständig übergebene Bestellung ab', async () => {
    initUebergabe(); const res = await postUebergabe({ ...uebergabe(), menge: 5 });
    expect(res.status).toBe(200); expect((await res.json()).uebergabe.status).toBe('abgeschlossen');
  });
  it('berücksichtigt eigene Reservierung', async () => {
    initUebergabe(); h.docs.vereinskleider_verkaeufe.positionen[0].reserviertMenge = 2;
    h.rows.vereinskleider_verkaeufe[0].positionen[0].reserviertMenge = 2;
    const res = await postUebergabe(uebergabe()); expect(res.status).toBe(200); expect((await res.json()).uebergabe.reserviert).toBe(0);
  });
  it('übergibt Variante mit Grösse', async () => {
    initUebergabe(); h.docs.vereinskleider_verkaeufe.positionen[0].groesseId = id;
    h.rows.vereinskleider_verkaeufe[0].positionen[0].groesseId = id;
    h.docs.artikel.hatGroessen = true; h.docs.artikelvarianten = { menge: 20 };
    const res = await postUebergabe(uebergabe()); expect(res.status).toBe(200);
  });
  it('verhindert konkurrierende Variantenänderung', async () => {
    initUebergabe(); h.docs.vereinskleider_verkaeufe.positionen[0].groesseId = id;
    h.rows.vereinskleider_verkaeufe[0].positionen[0].groesseId = id;
    h.docs.artikel.hatGroessen = true; h.docs.artikelvarianten = { menge: 20 };
    h.update.mockResolvedValueOnce({ modifiedCount: 0 }); expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('behandelt Transaktionsfehler', async () => { h.transactionFailure = true; expect((await postUebergabe(uebergabe())).status).toBe(500); });
});
