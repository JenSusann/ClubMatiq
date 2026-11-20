import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  collection: vi.fn(), createIndex: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  findOne: vi.fn(), updateOne: vi.fn(), pruefeBerechtigung: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.pruefeBerechtigung }));
import { GET, PUT } from '../../src/routes/api/vereinskleider/preise/+server';

const artikelId = new ObjectId().toHexString();
const groesseId = new ObjectId().toHexString();
const vereinId = 'verein-test';
const benutzer = { vereinId };
const standard = { artikelId, groesseId: null, preistyp: 'fix', druckkosten: 3.5, verkaufspreis: 25 };

function get() {
  return GET({ locals: { benutzer } } as Parameters<typeof GET>[0]);
}
function put(daten: unknown = standard) {
  return PUT({
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/preise', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten)
    })
  } as Parameters<typeof PUT>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.pruefeBerechtigung.mockReturnValue(null);
  mocks.collection.mockImplementation((name: string) => {
    if (name === 'vereinskleider_preise') return {
      createIndex: mocks.createIndex, find: mocks.find, updateOne: mocks.updateOne
    };
    if (name === 'artikel' || name === 'artikelvarianten') return { findOne: mocks.findOne };
    throw new Error(`Unerwartete Collection: ${name}`);
  });
  mocks.createIndex.mockResolvedValue('unique_vereinskleider_preis');
  mocks.find.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockResolvedValue([]);
  mocks.findOne.mockResolvedValue({ istVereinskleidung: true, hatGroessen: false });
  mocks.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
});

describe('GET /api/vereinskleider/preise', () => {
  it('prüft das Leserecht', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(mocks.pruefeBerechtigung).toHaveBeenCalledWith(benutzer, 'inventar:lesen');
  });
  it('gibt eine Berechtigungssperre direkt zurück', async () => {
    mocks.pruefeBerechtigung.mockReturnValue(new Response('Verboten', { status: 403 }));
    expect((await get()).status).toBe(403);
    expect(mocks.collection).not.toHaveBeenCalled();
  });
  it('erstellt einen eindeutigen Preisindex', async () => {
    await get();
    expect(mocks.createIndex).toHaveBeenCalledWith(
      { vereinId: 1, artikelId: 1, groesseId: 1 },
      { unique: true, name: 'unique_vereinskleider_preis' }
    );
  });
  it('filtert nach Verein und gibt eine leere Liste zurück', async () => {
    const response = await get();
    expect(await response.json()).toEqual([]);
    expect(mocks.find).toHaveBeenCalledWith({ vereinId });
  });
  it('serialisiert Preise und normalisiert fehlende Werte', async () => {
    const id1 = new ObjectId();
    const id2 = new ObjectId();
    mocks.toArray.mockResolvedValue([
      { _id: id1, artikelId, preistyp: 'variabel', druckkosten: 2 },
      { _id: id2, artikelId, groesseId, preistyp: 'fix', druckkosten: 0, verkaufspreis: 10 }
    ]);
    expect(await (await get()).json()).toEqual([
      { _id: id1.toString(), artikelId, groesseId: null, preistyp: 'variabel', druckkosten: 2, verkaufspreis: null },
      { _id: id2.toString(), artikelId, groesseId, preistyp: 'fix', druckkosten: 0, verkaufspreis: 10 }
    ]);
  });
  it.each(['createIndex', 'toArray'] as const)('behandelt Fehler bei %s', async (methode) => {
    mocks[methode].mockRejectedValueOnce(new Error('DB down'));
    const response = await get();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ fehler: 'Preise konnten nicht geladen werden.' });
  });
});

describe('PUT /api/vereinskleider/preise', () => {
  it('prüft das Bearbeitungsrecht', async () => {
    await put();
    expect(mocks.pruefeBerechtigung).toHaveBeenCalledWith(benutzer, 'inventar:bearbeiten');
  });
  it('gibt eine Berechtigungssperre direkt zurück', async () => {
    mocks.pruefeBerechtigung.mockReturnValue(new Response('Verboten', { status: 403 }));
    expect((await put()).status).toBe(403);
    expect(mocks.collection).not.toHaveBeenCalled();
  });
  it.each([null, [], 'text', 123, true])('lehnt ungültige Eingabestruktur %j ab', async (daten) => {
    const response = await put(daten);
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Preisdaten.');
  });
  it('lehnt ungültiges JSON ab', async () => {
    const response = await PUT({
      locals: { benutzer }, request: new Request('http://localhost', { method: 'PUT', body: '{kaputt' })
    } as Parameters<typeof PUT>[0]);
    expect(response.status).toBe(400);
  });
  it.each([undefined, null, '', 'keine-id', 42, {}, '00000000000000000000000z'])('lehnt Artikel-ID %j ab', async (wert) => {
    const response = await put({ ...standard, artikelId: wert });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Artikel-ID.');
  });
  it.each(['falsch', 12, {}, false, '00000000000000000000000z'])('lehnt Grössen-ID %j ab', async (wert) => {
    const response = await put({ ...standard, groesseId: wert });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Grössen-ID.');
  });
  it.each([null, '', 'fest', 0, undefined])('lehnt Preistyp %j ab', async (wert) => {
    const response = await put({ ...standard, preistyp: wert });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültiger Preistyp.');
  });
  it.each([-1, 1.234, null, undefined, '3.50', Infinity, NaN])('lehnt Druckkosten %j ab', async (wert) => {
    const response = await put({ ...standard, druckkosten: wert });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe('Ungültige Druckkosten.');
  });
  it.each([-1, 1.234, undefined, '20', true, Infinity, NaN])('lehnt Verkaufspreis %j ab', async (wert) => {
    const response = await put({ ...standard, verkaufspreis: wert });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe(
      typeof wert === 'number' && !Number.isFinite(wert)
        ? 'Bei einem Fixpreis muss ein Verkaufspreis angegeben werden.'
        : 'Ungültiger Verkaufspreis.'
    );
  });
  it('akzeptiert explizit offenen Fixpreis und speichert den Status', async () => {
    const response = await put({ ...standard, verkaufspreis: null, preisOffen: true });
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, artikelId }),
      expect.objectContaining({ $set: expect.objectContaining({ preisOffen: true, verkaufspreis: null }) }),
      { upsert: true }
    );
  });
  it('lehnt offenen Preis mit gleichzeitigem Betrag ab', async () => {
    const response = await put({ ...standard, preisOffen: true });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('offenem Preis');
  });
  it('lehnt ungültigen Preis-offen-Status ab', async () => {
    const response = await put({ ...standard, preisOffen: 'ja' });
    expect(response.status).toBe(400);
  });
  it('verlangt beim Fixpreis einen Verkaufspreis', async () => {
    const response = await put({ ...standard, verkaufspreis: null });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('Fixpreis');
  });
  it('akzeptiert variable Preise ohne Verkaufspreis', async () => {
    const response = await put({ ...standard, preistyp: 'variabel', verkaufspreis: null });
    expect(response.status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][1].$set.verkaufspreis).toBeNull();
  });
  it('akzeptiert Nullbeträge und zwei Nachkommastellen', async () => {
    const response = await put({ ...standard, druckkosten: 0, verkaufspreis: 0.01 });
    expect(response.status).toBe(200);
  });
  it('gibt 404 zurück, wenn der Artikel fehlt', async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    const response = await put();
    expect(response.status).toBe(404);
    expect((await response.json()).fehler).toBe('Artikel nicht gefunden.');
  });
  it('lehnt Artikel ab, die keine Vereinskleidung sind', async () => {
    mocks.findOne.mockResolvedValueOnce({ istVereinskleidung: false, hatGroessen: false });
    const response = await put();
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('nicht als Vereinskleidung');
  });
  it('verlangt bei Grössenartikeln eine Variante', async () => {
    mocks.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: true });
    const response = await put();
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('Grössenvariante ausgewählt');
  });
  it('verbietet eine Grössen-ID für Artikel ohne Grössen', async () => {
    const response = await put({ ...standard, groesseId });
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain('keine Grössenvarianten');
  });
  it('prüft, ob die Variante im Verein existiert', async () => {
    mocks.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: true });
    mocks.findOne.mockResolvedValueOnce(null);
    const response = await put({ ...standard, groesseId });
    expect(response.status).toBe(404);
    expect(mocks.findOne).toHaveBeenCalledWith({ artikelId, groesseId, vereinId });
  });
  it('speichert einen Grössenpreis per Upsert', async () => {
    mocks.findOne.mockResolvedValueOnce({ istVereinskleidung: true, hatGroessen: true });
    mocks.findOne.mockResolvedValueOnce({ menge: 5 });
    const response = await put({ ...standard, groesseId });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ erfolg: true, meldung: 'Vereinskleiderpreis gespeichert.' });
    expect(mocks.updateOne).toHaveBeenCalledOnce();
    const [filter, update, options] = mocks.updateOne.mock.calls[0];
    expect(filter).toEqual({ vereinId, artikelId, groesseId });
    expect(update.$set).toMatchObject({ preistyp: 'fix', druckkosten: 3.5, verkaufspreis: 25, aktualisiertAm: expect.any(Date) });
    expect(update.$setOnInsert).toMatchObject({ vereinId, artikelId, groesseId, erstelltAm: expect.any(Date) });
    expect(options).toEqual({ upsert: true });
  });
  it('speichert einen Preis ohne Grössenvariante', async () => {
    const response = await put();
    expect(response.status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][0]).toEqual({ vereinId, artikelId, groesseId: null });
    expect(mocks.createIndex).toHaveBeenCalledOnce();
  });
  it('filtert die Artikelsuche nach Verein', async () => {
    await put();
    expect(mocks.findOne).toHaveBeenCalledWith({ _id: new ObjectId(artikelId), vereinId });
  });
  it('behandelt einen doppelten Preiseintrag mit 409', async () => {
    mocks.updateOne.mockRejectedValueOnce({ code: 11000 });
    const response = await put();
    expect(response.status).toBe(409);
    expect((await response.json()).fehler).toContain('Preiseintrag existiert bereits');
  });
  it('behandelt Fehler bei der Indexerstellung mit 409, falls Duplicate Key', async () => {
    mocks.createIndex.mockRejectedValueOnce({ code: 11000 });
    expect((await put()).status).toBe(409);
  });
  it.each(['findOne', 'updateOne'] as const)('behandelt Datenbankfehler bei %s mit 500', async (methode) => {
    mocks[methode].mockRejectedValueOnce(new Error('DB down'));
    const response = await put();
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Preis konnte nicht gespeichert werden.');
  });
});
