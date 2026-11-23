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
