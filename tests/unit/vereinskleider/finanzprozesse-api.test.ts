import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const collections: Record<string, any> = {};
  const session = { withTransaction: vi.fn(async (fn: () => unknown) => fn()), endSession: vi.fn(async () => {}) };
  const collection = vi.fn((name: string) => collections[name]);
  return { collections, session, collection, startSession: vi.fn(() => session), permission: vi.fn<() => Response | null>(() => null) };
});
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: m.startSession } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));

import { GET as getStorno, POST as postStorno } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import { GET as getRechnungen, POST as postRechnung } from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import { PATCH as patchZahlung } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

const ID = '507f1f77bcf86cd799439011';
const RID = '507f1f77bcf86cd799439012';
const UUID = '12345678-1234-1234-1234-123456789abc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const req = (body: unknown) => ({ json: async () => body }) as any;
const call = (handler: any, body?: unknown, id = RID) => handler({ locals, request: req(body), params: { id } });
const response = async (r: Response) => ({ status: r.status, body: await r.json() as any });
const pos = (overrides: Record<string, unknown> = {}) => ({ artikelId: ID, groesseId: null, artikelname: 'T-Shirt', verkaufsart: 'bestellung', menge: 3, einzelpreis: 10, positionsbetrag: 30, reserviertMenge: 2, uebergebenMenge: 0, ...overrides });
const verkauf = (overrides: Record<string, unknown> = {}) => ({ _id: ID, vereinId: 'verein-1', status: 'offen', kaeufer: 'Test', zahlungsart: 'rechnung', positionen: [pos()], endbetrag: 30, zwischentotal: 30, rabattTotal: 0, erstelltAm: new Date('2026-01-01'), ...overrides });
const rechnung = (overrides: Record<string, unknown> = {}) => ({ _id: RID, vereinId: 'verein-1', verkaufId: ID, rechnungsnummer: '2026-00001', status: 'offen', gesamtbetrag: 30, bezahltBetrag: 0, zahlungen: [], positionen: [pos()], ...overrides });
const payment = (overrides: Record<string, unknown> = {}) => ({ betrag: 10, datum: '2026-11-17', zahlungsart: 'twint', zahlungId: UUID, ...overrides });
const cancel = (overrides: Record<string, unknown> = {}) => ({ verkaufId: ID, positionsIndex: 0, menge: 1, grund: 'Nicht benötigt', ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  m.session.withTransaction.mockImplementation(async (fn: () => unknown) => fn());
  const cursor = (rows: any[] = []) => ({ sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), project: vi.fn().mockReturnThis(), toArray: vi.fn(async () => rows) });
  for (const name of ['vereinskleider_verkaeufe', 'vereinskleider_rechnungen', 'vereinskleider_gutschriften', 'vereinskleider_rechnungsnummern']) {
    m.collections[name] = { findOne: vi.fn(async () => null), find: vi.fn(() => cursor()), updateOne: vi.fn(async () => ({ modifiedCount: 1 })), insertOne: vi.fn(async () => ({ acknowledged: true })), findOneAndUpdate: vi.fn(async () => ({ nummer: 1 })) };
  }
});

const denied = () => new Response(JSON.stringify({ fehler: 'Kein Zugriff' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

describe('Vereinskleider-Finanzprozesse: Berechtigungen und Listen', () => {
  it.each(['storno-get', 'storno-post', 'rechnung-get', 'rechnung-post', 'zahlung-patch'])('verweigert %s ohne Berechtigung', async (which) => {
    m.permission.mockReturnValue(denied());
    const handlers: Record<string, any> = { 'storno-get': getStorno, 'storno-post': postStorno, 'rechnung-get': getRechnungen, 'rechnung-post': postRechnung, 'zahlung-patch': patchZahlung };
    expect((await call(handlers[which], {})).status).toBe(403);
    expect(m.startSession).not.toHaveBeenCalled();
  });
  it('listet Gutschriften mit String-IDs und Begrenzungsflag', async () => {
    const docs = Array.from({ length: 1000 }, (_, i) => ({ _id: { toString: () => `gs-${i}` }, betrag: 2 }));
    m.collections.vereinskleider_gutschriften.find.mockReturnValue({ sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), project: vi.fn().mockReturnThis(), toArray: vi.fn(async () => docs) });
    const r = await response(await call(getStorno));
    expect(r.status).toBe(200); expect(r.body.begrenzt).toBe(true); expect(r.body.gutschriften[0]._id).toBe('gs-0');
  });
  it('meldet Datenbankfehler beim Laden von Gutschriften', async () => {
    m.collections.vereinskleider_gutschriften.find.mockImplementation(() => { throw Error('DB'); });
    expect((await call(getStorno)).status).toBe(500);
  });
  it('listet Rechnungen und unverrechnete Verkäufe', async () => {
    const cursor = (data: any[]) => ({ sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), project: vi.fn().mockReturnThis(), toArray: vi.fn(async () => data) });
    m.collections.vereinskleider_rechnungen.find.mockReturnValue(cursor([{ _id: { toString: () => RID }, status: 'offen' }]));
    m.collections.vereinskleider_verkaeufe.find.mockReturnValue(cursor([{ _id: { toString: () => ID } }]));
    const r = await response(await call(getRechnungen));
    expect(r.body.rechnungen[0]._id).toBe(RID); expect(r.body.unverrechneteVerkaeufe[0]._id).toBe(ID); expect(r.body.begrenzt).toBe(false);
  });
  it('setzt begrenzt bei 1000 Rechnungen', async () => {
    const rows = Array.from({ length: 1000 }, () => ({ _id: { toString: () => RID } }));
    m.collections.vereinskleider_rechnungen.find.mockReturnValue({ sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), toArray: vi.fn(async () => rows) });
    expect((await response(await call(getRechnungen))).body.begrenzt).toBe(true);
  });
  it('meldet Datenbankfehler bei der Verrechnungsübersicht', async () => {
    m.collections.vereinskleider_rechnungen.find.mockImplementation(() => { throw Error('DB'); });
    expect((await call(getRechnungen)).status).toBe(500);
  });
});

describe('Rechnung erstellen', () => {
  it.each([null, [], 'x', 123])('verwirft unzulässige Eingabe %j', async (body) => {
    expect((await call(postRechnung, body)).status).toBe(400);
  });
  it('verwirft ungültige Verkaufs-ID', async () => { expect((await call(postRechnung, { verkaufId: 'bad' })).status).toBe(400); });
  it('gibt 404 zurück, wenn Verkauf fehlt, und schliesst Session', async () => {
    const r = await response(await call(postRechnung, { verkaufId: ID }));
    expect(r.status).toBe(404); expect(m.session.endSession).toHaveBeenCalled();
  });
  it.each([
    [{ rechnungId: RID }, 'bereits verrechnet'],
    [{ positionen: [] }, 'ungültige Rechnungswerte'],
    [{ positionen: [pos({ menge: 0 })] }, 'ungültige Rechnungswerte'],
    [{ endbetrag: -1 }, 'ungültige Rechnungswerte'],
    [{ rabattTotal: NaN }, 'ungültige Rechnungswerte'],
    [{ zahlungen: 'falsch' }, 'Zahlungseingänge'],
    [{ zahlungen: [{ betrag: 0, datum: new Date(), zahlungsart: 'bar' }] }, 'Zahlungseingänge'],
    [{ zahlungen: [{ betrag: 5, datum: 'invalid', zahlungsart: 'bar' }] }, 'Zahlungseingänge'],
    [{ zahlungen: [{ betrag: 5, datum: new Date(), zahlungsart: 'karte' }] }, 'Zahlungseingänge'],
    [{ bezahltBetrag: 5 }, 'Zahlungsstatus'],
    [{ zahlungsstatus: 'bezahlt' }, 'Zahlungsstatus'],
  ])('prüft inkonsistenten Verkauf %j', async (overrides, message) => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf(overrides));
    const r = await response(await call(postRechnung, { verkaufId: ID }));
    expect(r.status).toBe(409); expect(r.body.fehler).toContain(message);
  });
  it.each([undefined, { nummer: 'abc' }])('meldet fehlenden Rechnungszähler %j', async (counter) => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf());
    m.collections.vereinskleider_rechnungsnummern.findOneAndUpdate.mockResolvedValue(counter);
    expect((await call(postRechnung, { verkaufId: ID })).status).toBe(500);
  });
  it('erkennt konkurrierende Verrechnung', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf());
    m.collections.vereinskleider_verkaeufe.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await call(postRechnung, { verkaufId: ID })).status).toBe(409);
  });
  it.each([
    [verkauf(), 'offen', 0],
    [verkauf({ zahlungen: [{ betrag: 10, datum: new Date('2026-11-17'), zahlungsart: 'twint' }], bezahltBetrag: 10 }), 'teilweise_bezahlt', 10],
    [verkauf({ zahlungen: [{ betrag: 30, datum: new Date('2026-11-17'), zahlungsart: 'bar' }], bezahltBetrag: 30, zahlungsstatus: 'bezahlt' }), 'bezahlt', 30],
  ])('erstellt eine Rechnung mit Status %s', async (v, status, paid) => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(v);
    const r = await response(await call(postRechnung, { verkaufId: ID }));
    expect(r.status).toBe(201); expect(r.body.rechnung.rechnungsnummer).toMatch(/^\d{4}-00001$/);
    const doc = m.collections.vereinskleider_rechnungen.insertOne.mock.calls[0][0];
    expect(doc.status).toBe(status); expect(doc.bezahltBetrag).toBe(paid);
    expect(doc.clubdeskExportStatus).toBe('nicht_exportiert');
    expect(m.session.endSession).toHaveBeenCalled();
  });
  it('liefert 500 bei unerwartetem Datenbankfehler', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockRejectedValue(Error('DB'));
    expect((await call(postRechnung, { verkaufId: ID })).status).toBe(500);
  });
});

describe('Zahlungseingänge', () => {
  it('prüft Rechnungs-ID', async () => { expect((await call(patchZahlung, payment(), 'bad')).status).toBe(400); });
  it.each([null, [], 123, 'invalid'])('prüft JSON-Objekt %j', async (body) => {
    expect((await call(patchZahlung, body)).status).toBe(400);
  });
  it.each([
    [{ betrag: 0 }, 'Betrag'], [{ betrag: -1 }, 'Betrag'], [{ betrag: 1.234 }, 'Betrag'], [{ betrag: '10' }, 'Betrag'],
    [{ datum: '2026-02-30' }, 'Zahlungsdatum'], [{ datum: 'morgen' }, 'Zahlungsdatum'],
    [{ zahlungsart: 'karte' }, 'Zahlungsart'], [{ zahlungId: 'bad' }, 'zahlungId'],
  ])('validiert Zahlung %j', async (overrides, message) => {
    const r = await response(await call(patchZahlung, payment(overrides)));
    expect(r.status).toBe(400); expect(r.body.fehler).toContain(message);
  });
  it('liefert 404 bei unbekannter Rechnung', async () => {
    expect((await call(patchZahlung, payment())).status).toBe(404); expect(m.session.endSession).toHaveBeenCalled();
  });
  it.each([
    [{ zahlungen: 'invalid' }, 'Zahlungen'],
    [{ status: 'storniert' }, 'stornierte Rechnungen'],
    [{ gesamtbetrag: -1 }, 'Rechnungsbeträge'],
    [{ bezahltBetrag: 40 }, 'Rechnungsbeträge'],
    [{ gutgeschriebenBetrag: 40 }, 'Rechnungsbeträge'],
    [{ gutgeschriebenBetrag: 25 }, 'offenen Betrag'],
  ])('verhindert ungültige Zahlung bei %j', async (overrides, message) => {
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung(overrides));
    const r = await response(await call(patchZahlung, payment()));
    expect(r.status).toBe(409); expect(r.body.fehler).toContain(message);
  });
  it('behandelt identische Zahlungs-ID idempotent', async () => {
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung({ zahlungen: [{ betrag: 10, datum: new Date('2026-11-17T12:00:00Z'), zahlungsart: 'twint', zahlungId: UUID }] }));
    const r = await response(await call(patchZahlung, payment()));
    expect(r.status).toBe(200); expect(r.body.bereitsErfasst).toBe(true);
    expect(m.collections.vereinskleider_rechnungen.updateOne).not.toHaveBeenCalled();
  });
  it.each([
    [{ betrag: 11 }, 'Betrag'], [{ zahlungsart: 'bar' }, 'Zahlungsart'], [{ datum: '2026-11-18' }, 'Datum']
  ])('verhindert Wiederverwendung einer Zahlungs-ID mit abweichenden Daten (%s)', async (overrides, _label) => {
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung({ zahlungen: [{ betrag: 10, datum: new Date('2026-11-17T12:00:00Z'), zahlungsart: 'twint', zahlungId: UUID }] }));
    expect((await call(patchZahlung, payment(overrides))).status).toBe(409);
  });
  it.each([
    [10, 'teilweise_bezahlt'], [30, 'bezahlt']
  ])('erfasst Zahlung %s und Status %s', async (betrag, status) => {
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung());
    const r = await response(await call(patchZahlung, payment({ betrag })));
    expect(r.status).toBe(200); expect(r.body.status).toBe(status);
    const update = m.collections.vereinskleider_rechnungen.updateOne.mock.calls[0][1];
    expect(update.$set.bezahltBetrag).toBe(betrag); expect(update.$set.zahlungen).toHaveLength(1);
  });
  it('verhindert Zahlung bei konkurrierender Änderung', async () => {
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung());
    m.collections.vereinskleider_rechnungen.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await call(patchZahlung, payment())).status).toBe(409);
  });
  it('liefert 500 bei unerwartetem Fehler', async () => {
    m.collections.vereinskleider_rechnungen.findOne.mockRejectedValue(Error('DB'));
    expect((await call(patchZahlung, payment())).status).toBe(500);
  });
});

describe('Stornierungen', () => {
  it.each([null, [], 'bad', 1])('prüft Eingabe %j', async (body) => { expect((await call(postStorno, body)).status).toBe(400); });
  it.each([
    [{ verkaufId: 'invalid' }], [{ positionsIndex: -1 }], [{ positionsIndex: 1.5 }],
    [{ menge: 0 }], [{ menge: 10001 }], [{ menge: 1.5 }], [{ grund: ' ' }], [{ grund: 'x'.repeat(1001) }]
  ])('verwirft ungültige Stornierungsparameter %j', async (overrides) => {
    expect((await call(postStorno, cancel(overrides))).status).toBe(400);
  });
  it('meldet fehlenden Verkauf', async () => {
    expect((await call(postStorno, cancel())).status).toBe(404); expect(m.session.endSession).toHaveBeenCalled();
  });
  it.each([
    [{ status: 'storniert' }, 'bereits storniert'],
    [{ bezahltBetrag: 5 }, 'bezahlte Verkäufe'],
    [{ zahlungen: [{ betrag: 5 }] }, 'bezahlte Verkäufe'],
    [{ rabatte: [{ betrag: 1 }] }, 'Rabatten'],
    [{ zusaetzlicherRabatt: 1 }, 'Rabatten'],
    [{ rabattTotal: 1 }, 'Rabatten'],
    [{ positionen: null }, 'Verkaufspositionen'],
    [{ positionen: [pos({ verkaufsart: 'direkt' })] }, 'Bestellartikel'],
    [{ positionen: [pos({ menge: 0 })] }, 'inkonsistent'],
    [{ positionen: [pos({ uebergebenMenge: 4 })] }, 'inkonsistent'],
    [{ positionen: [pos({ reserviertMenge: 4 })] }, 'inkonsistent'],
    [{ positionen: [pos({ einzelpreis: Infinity })] }, 'inkonsistent'],
    [{ positionen: [pos({ uebergebenMenge: 3, reserviertMenge: 0 })] }, 'Nur 0'],
    [{ positionen: [pos({ positionsbetrag: 1 })] }, 'Verkaufsbetrag'],
    [{ endbetrag: 1 }, 'Verkaufsbetrag'],
  ])('verhindert fehlerhafte Stornierung %j', async (overrides, message) => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf(overrides));
    const r = await response(await call(postStorno, cancel()));
    expect(r.status).toBe(409); expect(r.body.fehler).toContain(message);
  });
  it('storniert teilweise ohne Rechnung und gibt Reservation frei', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf());
    const r = await response(await call(postStorno, cancel({ grund: '  Retour  ', menge: 2 })));
    expect(r.status).toBe(200); expect(r.body.stornierung.freigegebeneReserve).toBe(2);
    expect(r.body.stornierung.gutschriftId).toBeNull(); expect(r.body.stornierung.status).toBe('offen');
    const updated = m.collections.vereinskleider_verkaeufe.updateOne.mock.calls[0][1].$set;
    expect(updated.positionen[0].menge).toBe(1); expect(updated.positionen[0].reserviertMenge).toBe(0);
    expect(updated.stornierungen[0].grund).toBe('Retour');
  });
  it('storniert die letzte Position vollständig', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf({ positionen: [pos({ menge: 1, positionsbetrag: 10, reserviertMenge: 1 })], endbetrag: 10, zwischentotal: 10 }));
    const r = await response(await call(postStorno, cancel()));
    expect(r.body.stornierung.status).toBe('storniert');
  });
  it('erkennt konkurrierende Stornierung', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf());
    m.collections.vereinskleider_verkaeufe.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await call(postStorno, cancel())).status).toBe(409);
  });
  it.each([
    [{ rechnungId: 'invalid' }, undefined, 'Belegreferenz'],
    [{ rechnungId: RID }, null, 'Rechnung fehlt'],
    [{ rechnungId: RID }, rechnung({ status: 'storniert' }), 'Rechnung fehlt'],
    [{ rechnungId: RID }, rechnung({ gesamtbetrag: 30.001 }), 'Rechnungsbeträge'],
    [{ rechnungId: RID }, rechnung({ bezahltBetrag: 40 }), 'Gutschrift übersteigt'],
    [{ rechnungId: RID }, rechnung({ gutgeschriebenBetrag: 30 }), 'Gutschrift übersteigt'],
    [{ rechnungId: RID }, rechnung({ positionen: [pos({ artikelId: RID })] }), 'Rechnungsposition'],
  ])('prüft Rechnungsreferenz und Belegkonsistenz %j', async (v, bill, message) => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf(v));
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(bill);
    const r = await response(await call(postStorno, cancel()));
    expect(r.status).toBe(409); expect(r.body.fehler).toContain(message);
  });
  it('erzeugt Gutschrift und Rückerstattungsvormerkung', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf({ rechnungId: RID, bezahltBetrag: 25 }));
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung({ bezahltBetrag: 25 }));
    const r = await response(await call(postStorno, cancel({ menge: 2 })));
    expect(r.status).toBe(200); expect(r.body.stornierung.gutschriftBetrag).toBe(20);
    expect(r.body.stornierung.rueckerstattungOffen).toBe(15);
    const credit = m.collections.vereinskleider_gutschriften.insertOne.mock.calls[0][0];
    expect(credit.betrag).toBe(20); expect(credit.pdfStatus).toBe('ausstehend');
    expect(m.collections.vereinskleider_rechnungen.updateOne.mock.calls[0][1].$set.status).toBe('bezahlt');
  });
  it('erkennt konkurrierende Rechnungsänderung', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf({ rechnungId: RID }));
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung());
    m.collections.vereinskleider_rechnungen.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await call(postStorno, cancel())).status).toBe(409);
  });
  it('liefert 500 bei unerwartetem Fehler', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockRejectedValue(Error('DB'));
    expect((await call(postStorno, cancel())).status).toBe(500);
  });
});

import { POST as postTeilzahlung } from '../../../src/routes/api/vereinskleider/teilzahlung/+server';

describe('Teilzahlungen vor Verrechnung – Randfälle', () => {
  const eingabe = { verkaufId: ID, betrag: 10, zahlungsart: 'bar' };
  it('verweigert Zugriff ohne Verkaufsberechtigung', async () => {
    m.permission.mockReturnValue(denied());
    expect((await call(postTeilzahlung, eingabe)).status).toBe(403);
    expect(m.startSession).not.toHaveBeenCalled();
  });
  it('verwirft fehlerhaftes JSON', async () => {
    expect((await postTeilzahlung({ locals, request: { json: async () => { throw new SyntaxError(); } } } as any)).status).toBe(400);
  });
  it.each([null, [], {...eingabe, verkaufId: 1}, {...eingabe, verkaufId: 'bad'},
    ...[0, -1, Infinity, NaN, '10', 1.001].map(betrag => ({...eingabe, betrag})),
    {...eingabe, zahlungsart: 'rechnung'}])('verwirft ungültige Eingabe %j', async body => {
    expect((await call(postTeilzahlung, body)).status).toBe(400);
    expect(m.startSession).not.toHaveBeenCalled();
  });
  it.each([
    { rechnungId: RID }, { trancheRechnungIds: [RID] }, { positionen: null },
    { positionen: [] }, { zahlungen: 'bad' }, { zahlungen: [null] },
    ...['10', Infinity, 0, -1].map(betrag => ({ zahlungen: [{ betrag, zahlungsart: 'bar' }] })),
    { zahlungen: [{ betrag: 5, zahlungsart: 'karte' }] }, { rabattTotal: 1 }
  ])('verhindert Zahlung bei inkonsistenter Bestellung %j', async overrides => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf(overrides));
    expect((await call(postTeilzahlung, eingabe)).status).toBe(409);
    expect(m.collections.vereinskleider_verkaeufe.updateOne).not.toHaveBeenCalled();
    expect(m.session.endSession).toHaveBeenCalled();
  });
  it.each(['bar', 'twint', 'rechnung'])('berücksichtigt bestehende Zahlung via %s', async zahlungsart => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf({ zahlungen: [{ betrag: 5, zahlungsart }] }));
    const r = await response(await call(postTeilzahlung, eingabe));
    expect(r.status).toBe(200);
    expect(r.body.ergebnis).toMatchObject({ bezahlt: 15, restbetrag: 15, zahlungsstatus: 'teilweise_bezahlt' });
    expect(m.collections.vereinskleider_verkaeufe.updateOne.mock.calls[0][0]).toMatchObject({ vereinId: 'verein-1' });
  });
  it('behält offene Preispositionen bei', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf({ positionen: [pos(), pos({ einzelpreis: null, preisOffen: true })] }));
    const r = await response(await call(postTeilzahlung, {...eingabe, betrag: 30}));
    expect(r.status).toBe(200);
    expect(r.body.ergebnis).toMatchObject({ offenePreispositionen: 1, zahlungsstatus: 'teilweise_bezahlt' });
  });
  it('verhindert konkurrierende Änderung', async () => {
    m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf());
    m.collections.vereinskleider_verkaeufe.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await call(postTeilzahlung, eingabe)).status).toBe(409);
  });
  it.each([[Error('Ungültiger Preis'), 400], [Error('DB'), 500], ['DB', 500]])('behandelt Transaktionsfehler %j', async (error, status) => {
    m.session.withTransaction.mockRejectedValueOnce(error);
    expect((await call(postTeilzahlung, eingabe)).status).toBe(status);
    expect(m.session.endSession).toHaveBeenCalled();
  });
});

import { PATCH as patchGutschrift } from '../../../src/routes/api/vereinskleider/gutschriften/status/+server';
import { POST as postPreisfestlegung } from '../../../src/routes/api/vereinskleider/preisfestlegung/+server';

describe('Gutschriftenstatus – finanzielle Konsistenz', () => {
  const input = { gutschriftId: ID, aktion: 'rueckerstattet', datum: '2026-11-26', zahlungsart: 'bank', bemerkung: ' Test ', betrag: 5 };
  const credit = { _id: ID, rechnungId: RID, betrag: 10 };
  function setup(g: Record<string, unknown> = {}, r: Record<string, unknown> = {}, all?: unknown[]) {
    const c = {...credit, ...g};
    m.collections.vereinskleider_gutschriften.findOne.mockResolvedValue(c);
    m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(rechnung({ bezahltBetrag: 30, gutgeschriebenBetrag: 10, ...r }));
    m.collections.vereinskleider_gutschriften.find.mockReturnValue({toArray: async () => all ?? [c]});
  }
  it('verweigert fehlendes Recht', async () => {
    m.permission.mockReturnValue(denied());
    expect((await call(patchGutschrift,input)).status).toBe(403);
  });
  it.each([{body:null},{body:[]},{body:{...input,gutschriftId:1}},{body:{...input,aktion:'bad'}}])('verwirft Eingabe %j', async ({body}) => {
    expect((await call(patchGutschrift,body)).status).toBe(400);
  });
  it('meldet fehlende Gutschrift', async () => {
    expect((await call(patchGutschrift,input)).status).toBe(404);
  });
  it.each([
    [{rechnungId:'bad'}, {},409], [{}, {gesamtbetrag:-1},400],
    [{}, {gesamtbetrag:Infinity},400], [{}, {gesamtbetrag:'30'},400],
    [{}, {gesamtbetrag:1.001},400], [{}, {gesamtbetrag:Number.MAX_SAFE_INTEGER},400],
    [{}, {gutgeschriebenBetrag:31},409], [{}, {bezahltBetrag:31},409],
    [{betrag:11}, {},409], [{rueckerstattetBetrag:11}, {},409],
    [{bearbeitungsstatus:'erledigt'}, {},409], [{bearbeitungsstatus:'rueckerstattet'}, {},409]
  ])('verhindert inkonsistente Gutschrift %j', async (g,r,status) => {
    setup(g as Record<string,unknown>,r as Record<string,unknown>);
    expect((await call(patchGutschrift,input)).status).toBe(status);
    expect(m.collections.vereinskleider_gutschriften.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert fehlende Rechnung', async () => {
    setup();m.collections.vereinskleider_rechnungen.findOne.mockResolvedValue(null);
    expect((await call(patchGutschrift,input)).status).toBe(409);
  });
  it.each([{all:[]},{all:[{...credit,betrag:9}]}])('verweigert inkonsistente Gesamtliste', async ({all}) => {
    setup({}, {}, all);expect((await call(patchGutschrift,input)).status).toBe(409);
  });
  it.each([{datum:42},{datum:'bad'},{datum:'2026-02-30'},{datum:'2026-13-01'},{zahlungsart:'karte'},{bemerkung:null},{bemerkung:'x'.repeat(1001)}])('verwirft Auszahlungsdaten %j', async patch => {
    setup();expect((await call(patchGutschrift,{...input,...patch})).status).toBe(400);
  });
  it.each([0,11])('verhindert unzulässige Auszahlung %s', async betrag => {
    setup();expect((await call(patchGutschrift,{...input,betrag})).status).toBe(409);
  });
  it.each([[5,'teilweise_rueckerstattet',5],[10,'rueckerstattet',0]])('dokumentiert Auszahlung %s', async (betrag,status,rest) => {
    setup();const r=await response(await call(patchGutschrift,{...input,betrag}));
    expect(r.status).toBe(200);expect(r.body).toMatchObject({status,rueckerstattungOffen:rest});
    expect(m.collections.vereinskleider_gutschriften.updateOne.mock.calls[0][1].$set).toMatchObject({rueckerstattetBetrag:betrag,rueckerstattungen:[expect.objectContaining({bemerkung:'Test',betrag})]});
  });
  it('schliesst ohne offene Rückerstattung ab', async () => {
    setup({}, {bezahltBetrag:20});
    expect((await response(await call(patchGutschrift,{...input,aktion:'erledigt'}))).body.status).toBe('erledigt');
  });
  it('verhindert Abschluss bei offener Rückerstattung', async () => {
    setup();expect((await call(patchGutschrift,{...input,aktion:'erledigt'})).status).toBe(409);
  });
  it.each(['vereinskleider_gutschriften','vereinskleider_rechnungen'])('erkennt konkurrierende Änderung %s', async name => {
    setup();m.collections[name].updateOne.mockResolvedValue({modifiedCount:0});
    expect((await call(patchGutschrift,input)).status).toBe(409);
    expect(m.session.endSession).toHaveBeenCalled();
  });
  it('meldet unerwarteten Fehler', async () => {
    m.session.withTransaction.mockRejectedValueOnce(Error('DB'));
    expect((await call(patchGutschrift,input)).status).toBe(500);
  });
});

describe('Preisfestlegung – offene Bestellpositionen', () => {
  const input={verkaufId:ID,positionsIndex:0,einzelpreis:10};
  const offen=pos({einzelpreis:null,preisOffen:true,positionsbetrag:0});
  const setup=(patch:Record<string,unknown>={})=>m.collections.vereinskleider_verkaeufe.findOne.mockResolvedValue(verkauf({positionen:[offen],...patch}));
  it('verweigert fehlendes Recht',async()=>{m.permission.mockReturnValue(denied());expect((await call(postPreisfestlegung,input)).status).toBe(403);});
  it.each([{body:null},{body:[]},...[
    {verkaufId:42},{verkaufId:'bad'},{positionsIndex:-1},{positionsIndex:1.5},
    {einzelpreis:-1},{einzelpreis:'10'},{einzelpreis:Infinity},{einzelpreis:1.001},
    {zahlung:null},{zahlung:1},{zahlung:[]},{zahlung:{betrag:-1,zahlungsart:'bar'}},
    {zahlung:{betrag:1,zahlungsart:'karte'}},{zahlung:{betrag:0,zahlungsart:'bar'}}
  ].map(p=>({body:{...input,...p}}))])('verwirft ungültige Preisfestlegung %j',async({body})=>{
    expect((await call(postPreisfestlegung,body)).status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();
  });
  it('meldet fehlende Bestellung',async()=>{expect((await call(postPreisfestlegung,input)).status).toBe(404);});
  it.each([
    [{rechnungId:RID},409],[{positionen:null},404],[{positionen:[]},404],[{status:'storniert'},409],
    ...[{verkaufsart:'direkt'},{preisOffen:false},{einzelpreis:1},{menge:0},{menge:1.5},{storniertMenge:1},{uebergebenMenge:1}].map(p=>[{positionen:[{...offen,...p}]},409]),
    [{zahlungen:'bad'},409],[{zahlungen:[null]},409],[{zahlungen:[{betrag:0,zahlungsart:'bar'}]},409],
    [{zahlungen:[{betrag:1,zahlungsart:'karte'}]},409],[{rabattTotal:1},409]
  ])('verhindert inkonsistente Preisfestlegung %j',async(patch,status)=>{
    setup(patch as Record<string,unknown>);expect((await call(postPreisfestlegung,input)).status).toBe(status);
    expect(m.collections.vereinskleider_verkaeufe.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert gleichzeitige Zahlung bei Teilrechnung',async()=>{
    setup({trancheRechnungIds:[RID]});expect((await call(postPreisfestlegung,{...input,zahlung:{betrag:10,zahlungsart:'bar'}})).status).toBe(409);
  });
  it.each([[0,'bezahlt'],[10,'offen']])('fixiert Preis %s ohne Zahlung',async(einzelpreis,status)=>{
    setup();const r=await response(await call(postPreisfestlegung,{...input,einzelpreis}));
    expect(r.status).toBe(200);expect(r.body.ergebnis).toMatchObject({einzelpreis,zahlungsstatus:status});
  });
  it('erlaubt Preisfestlegung mit bestehender Teilrechnung ohne neue Zahlung',async()=>{
    setup({trancheRechnungIds:[RID]});expect((await call(postPreisfestlegung,input)).status).toBe(200);
  });
  it.each([[0,'preis_offen'],[10,'teilweise_bezahlt']])('behält weitere offene Positionen bei',async(betrag,status)=>{
    setup({positionen:[offen,{...offen,artikelId:RID}]});
    const r=await response(await call(postPreisfestlegung,{...input,...(betrag?{zahlung:{betrag,zahlungsart:'twint'}}:{})}));
    expect(r.status).toBe(200);expect(r.body.ergebnis).toMatchObject({offenePreispositionen:1,zahlungsstatus:status});
  });
  it('erkennt konkurrierende Preisänderung',async()=>{
    setup();m.collections.vereinskleider_verkaeufe.updateOne.mockResolvedValue({modifiedCount:0});
    expect((await call(postPreisfestlegung,input)).status).toBe(409);
  });
  it.each([[Error('Ungültiger Preis'),400],[Error('DB'),500],['DB',500]])('behandelt Transaktionsfehler',async(error,status)=>{
    m.session.withTransaction.mockRejectedValueOnce(error);expect((await call(postPreisfestlegung,input)).status).toBe(status);expect(m.session.endSession).toHaveBeenCalled();
  });
});
