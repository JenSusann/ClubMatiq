import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  permission: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.permission }));



const ID = '507f1f77bcf86cd799439011';
const POS = '507f1f77bcf86cd799439012';
const USER = '507f1f77bcf86cd799439013';
const EVENT = '507f1f77bcf86cd799439014';
const d = (v: string) => new Date(v);
let inventur: Record<string, unknown> | null;
let protokoll: Record<string, unknown>[];
let positionen: Record<string, unknown>[];
let benutzer: Record<string, unknown>[];
let failure: string | null;
const cursor = (items: Record<string, unknown>[]) => ({ sort() { return this; }, project() { return this; }, async toArray() { return items; } });
function event(id = ID) { return { params: { id }, locals: { benutzer: { vereinId: 'verein-1' } } } as never; }
async function result(id = ID) {
  const response = await route0.GET(event(id));
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

beforeEach(() => {
  vi.clearAllMocks();
  inventur = { _id: new ObjectId(ID) };
  protokoll = []; positionen = []; benutzer = []; failure = null;
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockImplementation((name: string) => ({
    findOne: async () => { if (failure === name) throw new Error('DB down'); return inventur; },
    find: () => { if (failure === name) throw new Error('DB down'); return cursor(name === 'inventurprotokoll' ? protokoll : name === 'inventurpositionen' ? positionen : name === 'benutzer' ? benutzer : []); }
  }));
});
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';

// Ursprüngliche Datei: 33-inventur-korrekturhistorie.integration.test.ts
describe('Paket 33 – Inventur-Korrekturhistorie', () => {
  it('verweigert Zugriff ohne Berechtigung', async () => { mocks.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await result()).status).toBe(403); });
  it.each(['ungueltig', '', '123', 'z'.repeat(24)])('verwirft Inventur-ID %s', async id => { const r = await result(id); expect(r.status).toBe(400); });
  it('liefert 404 bei fehlender Inventur', async () => { inventur = null; expect((await result()).status).toBe(404); });
  it('liefert leere Korrekturen und Verlauf', async () => { const r = await result(); expect(r.status).toBe(200); expect(r.body).toEqual({ korrekturen: [], verlauf: [] }); });
  it.each(['inventuren', 'inventurprotokoll', 'inventurpositionen', 'benutzer'])('behandelt Datenbankfehler in %s', async name => {
    failure = name;
    if (name === 'benutzer') inventur = { erstelltVon: USER };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { const r = await result(); expect(r.status).toBe(500); expect(r.body.fehler).toMatch(/nicht geladen/); } finally { spy.mockRestore(); }
  });
  it('bildet nachträgliche Korrektur mit Person und Position ab', async () => {
    positionen = [{ _id: new ObjectId(POS), artikelName: 'Trainerjacke', groesseId: 'M' }];
    benutzer = [{ _id: new ObjectId(USER), vorname: 'Max', nachname: 'Muster' }];
    protokoll = [{ _id: new ObjectId(EVENT), aktion: 'nachtraeglich_korrigiert', ausgefuehrtAm: d('2026-01-05'), ausgefuehrtVon: USER, positionId: POS, alterIstBestand: 2, neuerIstBestand: 4, differenz: 2, begruendung: 'Nachzählung' }];
    const r = await result(); expect(r.status).toBe(200);
    expect(r.body.korrekturen[0]).toMatchObject({ artikelName: 'Trainerjacke', groesseId: 'M', bearbeitetVon: 'Max Muster', differenz: 2 });
    expect(r.body.verlauf[0]).toMatchObject({ aktion: 'nachtraeglich_korrigiert', begruendung: 'Nachzählung', alterIstBestand: 2 });
  });
  it('verwendet Ersatzwerte bei unbekannter Position und Person', async () => {
    protokoll = [{ _id: new ObjectId(EVENT), aktion: 'nachtraeglich_korrigiert', ausgefuehrtAm: '2026-01-05', positionId: POS, ausgefuehrtVon: null }];
    const r = await result(); expect(r.status).toBe(200);
    expect(r.body.korrekturen[0]).toMatchObject({ artikelName: 'Unbekannter Artikel', groesseId: null, bearbeitetVon: 'Unbekannter Benutzer' });
    expect(r.body.verlauf[0]).toMatchObject({ ausgefuehrtVon: null, differenz: null, statusVorher: null, positionen: null });
  });
  it('ergänzt alte Ereignisse und sortiert sie zeitlich', async () => {
    inventur = { erstelltAm: d('2026-01-01'), erstelltVon: USER, abgeschlossenAm: '2026-01-03', abgeschlossenVon: USER, anzahlKorrekturen: 2, storniertAm: d('2026-01-04'), storniertVon: USER, stornierungsgrund: 'Fehler' };
    benutzer = [{ _id: new ObjectId(USER), vorname: 'Anna', nachname: 'Beispiel' }];
    const r = await result(); expect(r.status).toBe(200);
    expect(r.body.verlauf.map((x: { aktion: string }) => x.aktion)).toEqual(['erstellt', 'abgeschlossen', 'storniert']);
    expect(r.body.verlauf[1]).toMatchObject({ anzahlKorrekturen: 2, bearbeitetVon: 'Anna Beispiel' });
    expect(r.body.verlauf[2]).toMatchObject({ begruendung: 'Fehler' });
  });
  it('dupliziert alte Ereignisse nicht, wenn Protokolle vorhanden sind', async () => {
    inventur = { erstelltAm: d('2026-01-01'), abgeschlossenAm: d('2026-01-02'), storniertAm: d('2026-01-03') };
    protokoll = ['erstellt', 'abgeschlossen', 'storniert'].map((aktion, i) => ({ _id: new ObjectId((15 + i).toString(16).padStart(24, '0')), aktion, ausgefuehrtAm: d(`2026-01-0${i+1}`) }));
    const r = await result(); expect(r.status).toBe(200); expect(r.body.verlauf).toHaveLength(3);
  });
  it('ignoriert ungültige historische Datumswerte', async () => {
    inventur = { erstelltAm: 'kein Datum', abgeschlossenAm: 123, storniertAm: null };
    const r = await result(); expect(r.status).toBe(200); expect(r.body.verlauf).toEqual([]);
  });
  it('filtert Protokolle ohne Datum aus dem Verlauf, nicht aus Korrekturen', async () => {
    protokoll = [{ _id: new ObjectId(EVENT), aktion: 'nachtraeglich_korrigiert', ausgefuehrtAm: null, positionId: POS }];
    const r = await result(); expect(r.status).toBe(200); expect(r.body.korrekturen).toHaveLength(1); expect(r.body.verlauf).toHaveLength(0);
  });
  it('übernimmt vorhandene Metadaten und ersetzt ungültige Werte mit null', async () => {
    protokoll = [{ _id: new ObjectId(EVENT), aktion: null, ausgefuehrtAm: '2026-02-01', artikelName: 'Altartikel', positionId: POS, ausgefuehrtVon: 123, begruendung: 4, alterIstBestand: '1', neuerIstBestand: 2, differenz: 1, statusVorher: 'offen', anzahlRueckbuchungen: 3, anzahlKorrekturen: 2, positionen: [{ a: 1 }] }];
    const r = await result(); expect(r.status).toBe(200);
    expect(r.body.verlauf[0]).toMatchObject({ aktion: 'unbekannt', artikelName: 'Altartikel', begruendung: null, alterIstBestand: null, neuerIstBestand: 2, differenz: 1, statusVorher: 'offen', anzahlRueckbuchungen: 3, anzahlKorrekturen: 2, positionen: [{ a: 1 }] });
  });
  it('nutzt Protokoll-Grösse vor Positions-Grösse', async () => {
    positionen = [{ _id: new ObjectId(POS), artikelName: 'Shirt', groesseId: 'M' }];
    protokoll = [{ _id: new ObjectId(EVENT), aktion: 'nachtraeglich_korrigiert', ausgefuehrtAm: '2026-01-01', positionId: POS, groesseId: 'L' }];
    const r = await result(); expect(r.body.korrekturen[0].groesseId).toBe('L');
  });
  it('behandelt Benutzer ohne Namen als unbekannt', async () => {
    inventur = { erstelltAm: d('2026-01-01'), erstelltVon: USER };
    benutzer = [{ _id: new ObjectId(USER), vorname: ' ', nachname: null }];
    const r = await result(); expect(r.body.verlauf[0].bearbeitetVon).toBe('Unbekannter Benutzer');
  });
});

