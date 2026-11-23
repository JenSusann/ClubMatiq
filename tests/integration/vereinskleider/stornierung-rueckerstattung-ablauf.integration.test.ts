import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  updateOne: vi.fn(), insertOne: vi.fn(), startSession: vi.fn(),
  endSession: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection }, client: { startSession: m.startSession }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST as STORNIEREN } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import { PATCH as RUECKERSTATTEN } from '../../../src/routes/api/vereinskleider/gutschriften/status/+server';

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
