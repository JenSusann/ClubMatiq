import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  updateOne: vi.fn(), insertOne: vi.fn(), findOneAndUpdate: vi.fn(), startSession: vi.fn(),
  endSession: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST } from '../../../src/routes/api/vereinskleider/stornierungen/+server';

describe('teilrechnung-stornierung', () => {
beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); });
const verkaufId = new ObjectId();
const ersteId = new ObjectId();
const zweiteId = new ObjectId();
const artikelId = new ObjectId().toHexString();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const position = (preis: number, name: string) => ({
  artikelId, groesseId: null, artikelname: name, verkaufsart: 'bestellung',
  menge: 1, einzelpreis: preis, positionsbetrag: preis,
  reserviertMenge: 1, uebergebenMenge: 0, storniertMenge: 0, preisOffen: false
});
const ctx = (positionsIndex = 1, menge = 1) => ({
  locals: { benutzer },
  request: new Request('http://localhost/api/vereinskleider/stornierungen', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verkaufId: verkaufId.toHexString(), positionsIndex, menge, grund: 'Bestellung storniert' })
  })
}) as never;

let verkauf: Record<string, unknown>;
let rechnungen: Record<string, unknown>[];
let gutschriften: Record<string, unknown>[];

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  verkauf = {
    _id: verkaufId, vereinId: 'verein-a', status: 'offen',
    positionen: [position(55, 'Bekannte Artikel'), position(48, 'Trainerjacke')],
    trancheRechnungIds: [ersteId.toHexString(), zweiteId.toHexString()],
    zwischentotal: 103, endbetrag: 103, rabattTotal: 0,
    bezahltBetrag: 55, zahlungen: [{ betrag: 55 }],
    aktualisiertAm: new Date('2026-11-22'), stornierungen: []
  };
  rechnungen = [
    { _id: ersteId, vereinId: 'verein-a', verkaufId: verkaufId.toHexString(),
      rechnungstranche: true, rechnungsnummer: '2026-00001',
      positionen: [{ ...position(55, 'Bekannte Artikel'), positionsIndex: 0 }],
      gesamtbetrag: 55, bezahltBetrag: 55, status: 'bezahlt' },
    { _id: zweiteId, vereinId: 'verein-a', verkaufId: verkaufId.toHexString(),
      rechnungstranche: true, rechnungsnummer: '2026-00002',
      positionen: [{ ...position(48, 'Trainerjacke'), positionsIndex: 1 }],
      gesamtbetrag: 48, bezahltBetrag: 0, status: 'offen' }
  ];
  gutschriften = [];
  m.collection.mockImplementation((name: string) => {
    if (name === 'vereinskleider_verkaeufe') return { findOne: m.findOne, updateOne: m.updateOne };
    if (name === 'vereinskleider_rechnungen') return { find: m.find, updateOne: m.updateOne };
    return { insertOne: m.insertOne };
  });
  m.findOne.mockImplementation(async (filter: { vereinId: string }) =>
    filter.vereinId === 'verein-a' ? { ...verkauf, positionen: (verkauf.positionen as Record<string, unknown>[]).map((p) => ({ ...p })) } : null);
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockImplementation(async () => rechnungen.map((r) => ({ ...r, positionen: (r.positionen as Record<string, unknown>[]).map((p) => ({ ...p })) })));
  m.updateOne.mockImplementation(async (filter: { _id: ObjectId }, update: { $set: Record<string, unknown> }) => {
    if (filter._id.toHexString() === verkaufId.toHexString()) Object.assign(verkauf, update.$set);
    else {
      const rechnung = rechnungen.find((r) => (r._id as ObjectId).toHexString() === filter._id.toHexString());
      if (rechnung) Object.assign(rechnung, update.$set);
    }
    return { modifiedCount: 1 };
  });
  m.insertOne.mockImplementation(async (doc: Record<string, unknown>) => {
    gutschriften.push(structuredClone(doc));
    return { acknowledged: true };
  });
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #68/#70 – Stornierung bei mehreren Teilrechnungen', () => {
  it('ordnet die CHF-48-Gutschrift ausschliesslich der zweiten Rechnung zu', async () => {
    const response = await POST(ctx());
    expect(response.status).toBe(200);
    expect(gutschriften).toHaveLength(1);
    expect(gutschriften[0]).toEqual(expect.objectContaining({
      rechnungId: zweiteId.toHexString(), betrag: 48, positionsIndex: 1
    }));
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);
    expect(rechnungen[0].gutgeschriebenBetrag).toBeUndefined();
    expect(rechnungen[1].gutgeschriebenBetrag).toBe(48);
    expect(verkauf.endbetrag).toBe(55);
    expect((verkauf.positionen as { menge: number }[])[1].menge).toBe(0);
  });

  it('verhindert eine zweite Stornierung derselben Menge', async () => {
    expect((await POST(ctx())).status).toBe(200);
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(1);
  });

  it('verhindert Stornierung einer bereits übergebenen Position', async () => {
    (verkauf.positionen as { uebergebenMenge: number }[])[1].uebergebenMenge = 1;
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(0);
  });

  it('verhindert Stornierung bei mehrdeutiger Rechnungszuordnung', async () => {
    (rechnungen[0].positionen as { positionsIndex: number }[])[0].positionsIndex = 1;
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(0);
  });

  it('verhindert Stornierung bei paralleler Änderung der Teilrechnung', async () => {
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await POST(ctx())).status).toBe(409);
    expect(gutschriften).toHaveLength(0);
  });

  it('verweigert Zugriff auf einen fremden Verein', async () => {
    m.findOne.mockResolvedValueOnce(null);
    expect((await POST(ctx())).status).toBe(404);
    expect(gutschriften).toHaveLength(0);
  });
});

});
import { PATCH } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

describe('teilrechnung-zahlung', () => {
beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); });
const id = new ObjectId();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin' };
const zahlungId = '123e4567-e89b-42d3-a456-426614174000';
const ctx = (betrag: number, kennung = zahlungId) => ({
  params: { id: id.toHexString() }, locals: { benutzer },
  request: new Request('http://localhost/api/vereinskleider/verrechnung/' + id, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ betrag, datum: '2026-11-22', zahlungsart: 'twint', zahlungId: kennung })
  })
}) as never;
let rechnung: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  rechnung = {
    _id: id, vereinId: 'verein-a', verkaufId: new ObjectId().toHexString(),
    gesamtbetrag: 48, bezahltBetrag: 0, gutgeschriebenBetrag: 0,
    status: 'offen', zahlungen: []
  };
  m.collection.mockReturnValue({ findOne: m.findOne, updateOne: m.updateOne });
  m.findOne.mockImplementation(async (filter: { vereinId: string }) =>
    filter.vereinId === 'verein-a' ? structuredClone(rechnung) : null);
  m.updateOne.mockImplementation(async (_filter: unknown, update: { $set: Record<string, unknown> }) => {
    Object.assign(rechnung, update.$set);
    return { modifiedCount: 1 };
  });
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #68/#70 – Restzahlung und Schutz gegen Doppelbuchungen', () => {
  it('verbucht CHF 48 einmal und erkennt wiederholte Zahlungs-ID', async () => {
    const erste = await PATCH(ctx(48));
    expect(erste.status).toBe(200);
    expect(rechnung.bezahltBetrag).toBe(48);
    expect(rechnung.status).toBe('bezahlt');
    expect((rechnung.zahlungen as unknown[])).toHaveLength(1);

    const wiederholung = await PATCH(ctx(48));
    expect(wiederholung.status).toBe(200);
    expect((await wiederholung.json()).bereitsErfasst).toBe(true);
    expect((rechnung.zahlungen as unknown[])).toHaveLength(1);
    expect(rechnung.bezahltBetrag).toBe(48);
  });

  it('verweigert dieselbe Zahlungs-ID mit abweichendem Betrag', async () => {
    expect((await PATCH(ctx(20))).status).toBe(200);
    expect((await PATCH(ctx(25))).status).toBe(409);
    expect(rechnung.bezahltBetrag).toBe(20);
  });

  it('verweigert Überzahlung nach einer Gutschrift', async () => {
    rechnung.gutgeschriebenBetrag = 20;
    expect((await PATCH(ctx(29))).status).toBe(409);
    expect((rechnung.zahlungen as unknown[])).toHaveLength(0);
  });

  it('erfasst nach Gutschrift nur den verbleibenden Nettobetrag', async () => {
    rechnung.gutgeschriebenBetrag = 20;
    expect((await PATCH(ctx(28))).status).toBe(200);
    expect(rechnung.bezahltBetrag).toBe(28);
    expect(rechnung.status).toBe('bezahlt');
  });

  it('blockiert Zahlung bei paralleler Änderung der Rechnung', async () => {
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await PATCH(ctx(48))).status).toBe(409);
  });

  it('schützt Rechnungen anderer Vereine', async () => {
    m.findOne.mockResolvedValueOnce(null);
    expect((await PATCH(ctx(48))).status).toBe(404);
    expect(m.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-a' }), expect.anything()
    );
  });
});

});
import { POST as STORNIEREN } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import { PATCH as RUECKERSTATTEN } from '../../../src/routes/api/vereinskleider/gutschriften/status/+server';

describe('stornierung-rueckerstattung-ablauf', () => {
beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); });
const verkaufId = new ObjectId();
const ersteId = new ObjectId();
const zweiteId = new ObjectId();
const artikelId = new ObjectId().toHexString();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin' };
const position = (preis: number, index: number) => ({
  artikelId, groesseId: null, artikelname: index === 0 ? 'Bekannte Artikel' : 'Trainerjacke',
  verkaufsart: 'bestellung', menge: 1, einzelpreis: preis,
  positionsbetrag: preis, reserviertMenge: 1, uebergebenMenge: 0,
  storniertMenge: 0, preisOffen: false, positionsIndex: index
});
const kontext = (pfad: string, daten: Record<string, unknown>, methode: 'POST' | 'PATCH') => ({
  locals: { benutzer },
  request: new Request('http://localhost' + pfad, {
    method: methode, headers: { 'content-type': 'application/json' },
    body: JSON.stringify(daten)
  })
}) as never;

let verkauf: Record<string, unknown>;
let rechnungen: Record<string, unknown>[];
let gutschriften: Record<string, unknown>[];
let aktiveSammlung: string;

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  verkauf = {
    _id: verkaufId, vereinId: 'verein-a', status: 'offen',
    positionen: [position(55, 0), position(48, 1)],
    trancheRechnungIds: [ersteId.toHexString(), zweiteId.toHexString()],
    zwischentotal: 103, endbetrag: 103, rabattTotal: 0,
    bezahltBetrag: 55, zahlungen: [{ betrag: 55 }],
    aktualisiertAm: new Date('2026-11-22'), stornierungen: []
  };
  rechnungen = [
    { _id: ersteId, vereinId: 'verein-a', verkaufId: verkaufId.toHexString(),
      rechnungstranche: true, rechnungsnummer: '2026-00001',
      positionen: [position(55, 0)], gesamtbetrag: 55, bezahltBetrag: 55,
      status: 'bezahlt' },
    { _id: zweiteId, vereinId: 'verein-a', verkaufId: verkaufId.toHexString(),
      rechnungstranche: true, rechnungsnummer: '2026-00002',
      positionen: [position(48, 1)], gesamtbetrag: 48, bezahltBetrag: 48,
      status: 'bezahlt' }
  ];
  gutschriften = [];
  m.collection.mockImplementation((name: string) => ({
    findOne: (...args: unknown[]) => m.findOne(name, ...args),
    find: (...args: unknown[]) => { aktiveSammlung = name; return m.find(...args); },
    updateOne: (...args: unknown[]) => m.updateOne(name, ...args),
    insertOne: (...args: unknown[]) => m.insertOne(name, ...args)
  }));
  m.findOne.mockImplementation(async (name: string, filter: { _id: ObjectId; vereinId: string }) => {
    if (filter.vereinId !== 'verein-a') return null;
    if (name === 'vereinskleider_verkaeufe') return { ...verkauf, positionen: (verkauf.positionen as Record<string, unknown>[]).map((p) => ({ ...p })) };
    const daten = name === 'vereinskleider_rechnungen' ? rechnungen : gutschriften;
    const gefunden = daten.find((d) => (d._id as ObjectId).toHexString() === filter._id.toHexString());
    return gefunden ? { ...gefunden } : null;
  });
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockImplementation(async () => {
    const daten = aktiveSammlung === 'vereinskleider_rechnungen' ? rechnungen : gutschriften;
    return daten.map((d) => ({ ...d }));
  });
  m.updateOne.mockImplementation(async (name: string, filter: { _id: ObjectId }, update: { $set: Record<string, unknown> }) => {
    const daten = name === 'vereinskleider_verkaeufe' ? [verkauf] :
      name === 'vereinskleider_rechnungen' ? rechnungen : gutschriften;
    const ziel = daten.find((d) => (d._id as ObjectId).toHexString() === filter._id.toHexString());
    if (!ziel) return { modifiedCount: 0 };
    Object.assign(ziel, update.$set);
    return { modifiedCount: 1 };
  });
  m.insertOne.mockImplementation(async (_name: string, dokument: Record<string, unknown>) => {
    gutschriften.push({ ...dokument });
    return { acknowledged: true };
  });
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

const stornieren = () => STORNIEREN(kontext('/api/vereinskleider/stornierungen', {
  verkaufId: verkaufId.toHexString(), positionsIndex: 1, menge: 1,
  grund: 'Trainerjacke abbestellt'
}, 'POST'));
const auszahlen = (betrag: number) => RUECKERSTATTEN(kontext('/api/vereinskleider/gutschriften/status', {
  gutschriftId: (gutschriften[0]._id as ObjectId).toHexString(),
  aktion: 'rueckerstattet', betrag, datum: '2026-11-22',
  zahlungsart: 'twint', bemerkung: 'Auszahlung bestätigt'
}, 'PATCH'));

describe('Issue #68/#70 – bezahlte Teilrechnung, Gutschrift und Rückerstattung', () => {
  it('erstellt CHF 48 Gutschrift, dokumentiert Auszahlung und verändert die erste Rechnung nicht', async () => {
    expect((await stornieren()).status).toBe(200);
    expect(gutschriften).toHaveLength(1);
    expect(gutschriften[0].rechnungId).toBe(zweiteId.toHexString());
    expect(gutschriften[0].betrag).toBe(48);
    expect(rechnungen[1].gutgeschriebenBetrag).toBe(48);
    expect(rechnungen[1].rueckerstattungOffen).toBe(48);
    expect(rechnungen[1].bezahltBetrag).toBe(48);
    expect(rechnungen[0].bezahltBetrag).toBe(55);
    expect(rechnungen[0].gutgeschriebenBetrag).toBeUndefined();

    expect((await auszahlen(48)).status).toBe(200);
    expect(gutschriften[0].rueckerstattetBetrag).toBe(48);
    expect(gutschriften[0].bearbeitungsstatus).toBe('rueckerstattet');
    expect(rechnungen[1].rueckerstattungOffen).toBe(0);
    expect(rechnungen[1].bezahltBetrag).toBe(48);
    expect(rechnungen[0].bezahltBetrag).toBe(55);
    expect((gutschriften[0].rueckerstattungen as unknown[])).toHaveLength(1);
  });

  it('erlaubt Teilrückerstattung und Restzahlung, aber keine doppelte Auszahlung', async () => {
    expect((await stornieren()).status).toBe(200);
    expect((await auszahlen(20)).status).toBe(200);
    expect(rechnungen[1].rueckerstattungOffen).toBe(28);
    expect(gutschriften[0].bearbeitungsstatus).toBe('teilweise_rueckerstattet');
    expect((await auszahlen(29)).status).toBe(409);
    expect((await auszahlen(28)).status).toBe(200);
    expect(rechnungen[1].rueckerstattungOffen).toBe(0);
    expect((await auszahlen(1)).status).toBe(409);
    expect((gutschriften[0].rueckerstattungen as unknown[])).toHaveLength(2);
  });
});

});
import { POST as TRANCHE } from '../../../src/routes/api/vereinskleider/verrechnung/tranche/+server';
import { POST as PREIS } from '../../../src/routes/api/vereinskleider/preisfestlegung/+server';

describe('rechnungstranchen-ablauf', () => {
beforeEach(() => { vi.resetAllMocks(); m.permission.mockReturnValue(null); });
const id = new ObjectId();
const benutzer = { id: 'user-a', vereinId: 'verein-a', rolle: 'admin' };
const ctx = (url: string, data: Record<string, unknown>) => ({
  locals: { benutzer },
  request: new Request('http://localhost' + url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verkaufId: id.toHexString(), ...data })
  })
}) as never;
const pos = (preis: number | null, offen: boolean) => ({
  artikelId: id.toHexString(), groesseId: null, artikelname: 'Artikel',
  menge: 1, einzelpreis: preis, preisOffen: offen,
  positionsbetrag: preis ?? 0, verkaufsart: 'bestellung'
});
let verkauf: Record<string, unknown>;
let rechnungen: Record<string, unknown>[];
let nummer: number;

beforeEach(() => {
  vi.clearAllMocks();
  nummer = 0;
  verkauf = {
    _id: id, vereinId: 'verein-a', kaeufer: 'Test', zahlungsart: 'twint',
    positionen: [pos(25, false), pos(30, false), pos(null, true)],
    zwischentotal: 55, endbetrag: 55, rabattTotal: 0,
    bezahltBetrag: 55, zahlungen: [{ betrag: 55, zahlungsart: 'twint', datum: new Date('2026-11-22') }],
    preisOffen: true, aktualisiertAm: new Date('2026-11-22')
  };
  rechnungen = [];
  m.permission.mockReturnValue(null);
  m.collection.mockImplementation((name: string) => {
    if (name === 'vereinskleider_verkaeufe') return {
      findOne: m.findOne, updateOne: m.updateOne
    };
    if (name === 'vereinskleider_rechnungen') return {
      find: m.find, insertOne: m.insertOne
    };
    return { findOneAndUpdate: m.findOneAndUpdate };
  });
  m.findOne.mockImplementation(async (filter: { vereinId: string }) =>
    filter.vereinId === 'verein-a' ? structuredClone(verkauf) : null);
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockImplementation(async () => structuredClone(rechnungen));
  m.updateOne.mockImplementation(async (_filter: unknown, update: Record<string, Record<string, unknown>>) => {
    Object.assign(verkauf, update.$set ?? {});
    if (update.$addToSet?.trancheRechnungIds) {
      verkauf.trancheRechnungIds = [
        ...((verkauf.trancheRechnungIds as string[] | undefined) ?? []),
        update.$addToSet.trancheRechnungIds
      ];
    }
    return { modifiedCount: 1 };
  });
  m.insertOne.mockImplementation(async (doc: Record<string, unknown>) => {
    rechnungen.push(structuredClone(doc));
    return { acknowledged: true };
  });
  m.findOneAndUpdate.mockImplementation(async () => ({ nummer: ++nummer }));
  m.startSession.mockReturnValue({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: m.endSession
  });
});

describe('Issue #68 – gemischte Bestellung und spätere Rechnungstranche', () => {
  it('verrechnet CHF 55, fixiert später CHF 48 und erstellt nur die neue CHF-48-Tranche', async () => {
    const erste = await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}));
    expect(erste.status).toBe(201);
    expect(rechnungen).toHaveLength(1);
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);
    expect((rechnungen[0].positionen as unknown[])).toHaveLength(2);

    const preis = await PREIS(ctx('/api/vereinskleider/preisfestlegung', {
      positionsIndex: 2, einzelpreis: 48
    }));
    expect(preis.status).toBe(200);
    expect((verkauf.positionen as { einzelpreis: number | null }[])[2].einzelpreis).toBe(48);
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);

    const zweite = await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}));
    expect(zweite.status).toBe(201);
    expect(rechnungen).toHaveLength(2);
    expect(rechnungen[1].gesamtbetrag).toBe(48);
    expect(rechnungen[1].bezahltBetrag).toBe(0);
    expect((rechnungen[1].positionen as { positionsIndex: number }[])[0].positionsIndex).toBe(2);
    expect(rechnungen[0].gesamtbetrag).toBe(55);
    expect(rechnungen[0].bezahltBetrag).toBe(55);

    const nochmal = await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}));
    expect(nochmal.status).toBe(409);
    expect(rechnungen).toHaveLength(2);
  });

  it('verbietet Zahlung direkt bei der Preisfestlegung nach erster Teilrechnung', async () => {
    expect((await TRANCHE(ctx('/api/vereinskleider/verrechnung/tranche', {}))).status).toBe(201);
    const response = await PREIS(ctx('/api/vereinskleider/preisfestlegung', {
      positionsIndex: 2, einzelpreis: 48, zahlung: { betrag: 48, zahlungsart: 'twint' }
    }));
    expect(response.status).toBe(409);
    expect((verkauf.positionen as { einzelpreis: number | null }[])[2].einzelpreis).toBeNull();
    expect(rechnungen).toHaveLength(1);
  });
});

});
