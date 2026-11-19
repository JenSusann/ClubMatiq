import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(),
  withTransaction: vi.fn(), endSession: vi.fn(), startSession: vi.fn()
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn((name: string) => ({
    findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
    find: (...args: unknown[]) => mocks.find(name, ...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(name, ...args)
  })) },
  client: { startSession: () => {
    mocks.startSession();
    return { withTransaction: mocks.withTransaction, endSession: mocks.endSession };
  } }
}));
import { POST } from '../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

const vereinId = 'verein-test';
const vorgangId = new ObjectId().toString();
const artikelId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const admin = { id: 'admin', rolle: 'admin', vereinId };
const position = (a: Record<string, unknown> = {}) => ({
  artikelId, groesseId: null as string | null, menge: 5,
  verkaufsart: 'bestellung', uebergebenMenge: 0, reserviertMenge: 0, ...a
});
let positionen: ReturnType<typeof position>[];
let vorgang: Record<string, unknown> | null;
let artikel: Record<string, unknown> | null;
let variante: Record<string, unknown> | null;
let reservierteVorgaenge: Array<Record<string, unknown>>;

function kontext(daten: unknown, benutzer: typeof admin | null = admin) {
  return {
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/bestellungen/uebergabe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(daten)
    })
  } as Parameters<typeof POST>[0];
}
const eingabe = (a: Record<string, unknown> = {}) => ({ vorgangId, positionsIndex: 0, menge: 2, ...a });
async function ausfuehren(daten: unknown = eingabe(), benutzer: typeof admin | null = admin) {
  return POST(kontext(daten, benutzer));
}
async function fehlerErwarten(status: number, teil: string, daten: unknown = eingabe()) {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await ausfuehren(daten);
    expect(response.status).toBe(status);
    expect((await response.json()).fehler).toContain(teil);
  } finally { spy.mockRestore(); }
}

beforeEach(() => {
  vi.resetAllMocks();
  positionen = [position()];
  vorgang = { _id: new ObjectId(vorgangId), vereinId, positionen, uebergaben: [] };
  artikel = { _id: new ObjectId(artikelId), vereinId, hatGroessen: false, menge: 10 };
  variante = { artikelId, groesseId, menge: 10, aktiv: true };
  reservierteVorgaenge = [{ positionen }];
  mocks.findOne.mockImplementation(async (name: string) => {
    if (name === 'vereinskleider_verkaeufe') return vorgang;
    if (name === 'artikel') return artikel;
    if (name === 'artikelvarianten') return variante;
    return null;
  });
  mocks.find.mockImplementation(() => ({ toArray: async () => reservierteVorgaenge }));
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.withTransaction.mockImplementation(async (callback: () => Promise<unknown>) => callback());
  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Vereinskleider – Bestellübergabe', () => {
  it('verweigert die Übergabe ohne Anmeldung', async () => {
    const response = await ausfuehren(eingabe(), null);
    expect(response.status).toBe(401);
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
  it.each([null, [], 'text', 12])('weist ungültige Übergabedaten zurück: %j', async (daten) => {
    await fehlerErwarten(400, 'Ungültige Übergabedaten', daten);
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
  it.each([
    { vorgangId: 'falsch' }, { positionsIndex: -1 }, { positionsIndex: 1.2 },
    { menge: 0 }, { menge: -1 }, { menge: 10001 }, { menge: 1.5 }
  ])('validiert Vorgang, Position und Menge: %j', async (a) => {
    await fehlerErwarten(400, 'Vorgang, Position oder Übergabemenge', eingabe(a));
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
  it('übergibt eine Teilmenge und reduziert den Lagerbestand', async () => {
    const response = await ausfuehren();
    expect(response.status).toBe(200);
    const daten = await response.json();
    expect(daten.erfolg).toBe(true);
    expect(daten.uebergabe).toMatchObject({ vorgangId, positionsIndex: 0, uebergeben: 2, reserviert: 0, offen: 3, status: 'offen' });
    expect(mocks.updateOne).toHaveBeenCalledWith('artikel', expect.objectContaining({ vereinId, menge: { $gte: 3 } }), expect.objectContaining({ $inc: { menge: -2 } }), expect.anything());
    expect(mocks.updateOne).toHaveBeenCalledWith('vereinskleider_verkaeufe', expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ 'positionen.0.uebergebenMenge': 2, status: 'offen' }) }), expect.anything());
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
  it('schliesst die Bestellung bei vollständiger Übergabe ab', async () => {
    const response = await ausfuehren(eingabe({ menge: 5 }));
    expect(response.status).toBe(200);
    expect((await response.json()).uebergabe).toMatchObject({ uebergeben: 5, offen: 0, status: 'abgeschlossen' });
  });
  it('berücksichtigt bereits übergebene Mengen', async () => {
    positionen[0] = position({ uebergebenMenge: 2 });
    const response = await ausfuehren(eingabe({ menge: 3 }));
    expect(response.status).toBe(200);
    expect((await response.json()).uebergabe).toMatchObject({ uebergeben: 5, offen: 0 });
  });
  it('verbraucht eigene Reservierungen', async () => {
    positionen[0] = position({ reserviertMenge: 3 });
    const response = await ausfuehren();
    expect(response.status).toBe(200);
    expect((await response.json()).uebergabe).toMatchObject({ reserviert: 1, uebergeben: 2 });
  });
  it('schützt fremde Reservierungen und die Anprobierreserve', async () => {
    artikel!.menge = 5;
    reservierteVorgaenge = [
      { positionen }, { positionen: [position({ reserviertMenge: 3 })] }
    ];
    await fehlerErwarten(409, 'Nur 1 Stück');
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('ignoriert Reservierungen anderer Artikel und Grössen', async () => {
    reservierteVorgaenge = [{ positionen: [
      position({ artikelId: new ObjectId().toString(), reserviertMenge: 5 }),
      position({ groesseId, reserviertMenge: 5 }),
      position({ verkaufsart: 'direkt', reserviertMenge: 5 }),
      position()
    ] }];
    const response = await ausfuehren();
    expect(response.status).toBe(200);
  });
  it('übergibt Grössenvarianten und korrigiert Varianten- und Gesamtbestand', async () => {
    positionen[0] = position({ groesseId });
    artikel!.hatGroessen = true;
    const response = await ausfuehren();
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith('artikelvarianten', expect.objectContaining({ groesseId, menge: { $gte: 3 } }), { $inc: { menge: -2 } }, expect.anything());
    expect(mocks.updateOne).toHaveBeenCalledWith('artikel', expect.anything(), expect.objectContaining({ $inc: { menge: -2 } }), expect.anything());
  });
  it('meldet einen fehlenden Vorgang', async () => {
    vorgang = null;
    await fehlerErwarten(404, 'Vorgang nicht gefunden');
  });
  it('verhindert Übergaben für Direktverkaufspositionen', async () => {
    positionen[0] = position({ verkaufsart: 'direkt' });
    await fehlerErwarten(400, 'keine offene Bestellung');
  });
  it('verhindert Übergaben für nicht vorhandene Positionen', async () => {
    await fehlerErwarten(400, 'keine offene Bestellung', eingabe({ positionsIndex: 2 }));
  });
  it('validiert Artikel- und Grössen-IDs im gespeicherten Vorgang', async () => {
    positionen[0] = position({ artikelId: 'ungueltig' });
    await fehlerErwarten(400, 'Artikel- oder Grössen-ID');
  });
  it('verhindert inkonsistente Bestellmengen', async () => {
    positionen[0] = position({ reserviertMenge: 6 });
    await fehlerErwarten(409, 'inkonsistent');
  });
  it('verhindert Übergaben oberhalb der offenen Menge', async () => {
    positionen[0] = position({ uebergebenMenge: 4 });
    await fehlerErwarten(409, 'nur noch 1 Stück');
  });
  it('meldet einen nicht mehr vorhandenen Artikel', async () => {
    artikel = null;
    await fehlerErwarten(404, 'Artikel nicht gefunden');
  });
  it('erkennt eine geänderte Grössenverwaltung', async () => {
    positionen[0] = position({ groesseId });
    await fehlerErwarten(409, 'Grössenzuordnung');
  });
  it('verhindert inkonsistente Reservierungen anderer Bestellungen', async () => {
    reservierteVorgaenge = [{ positionen: [position({ reserviertMenge: 10 })] }];
    await fehlerErwarten(409, 'Bestehende Reservierungen');
  });
  it('erkennt ungültige Lagerbestände', async () => {
    artikel!.menge = -1;
    await fehlerErwarten(409, 'Lagerbestand ist ungültig');
  });
  it('erkennt deaktivierte oder fehlende Grössenvarianten', async () => {
    positionen[0] = position({ groesseId });
    artikel!.hatGroessen = true;
    variante = null;
    await fehlerErwarten(409, 'Lagerbestand ist ungültig');
  });
  it('erkennt konkurrierende Lageränderungen', async () => {
    mocks.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await fehlerErwarten(409, 'Nicht genügend freier Lagerbestand');
  });
  it('erkennt konkurrierende Variantenänderungen', async () => {
    positionen[0] = position({ groesseId });
    artikel!.hatGroessen = true;
    mocks.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await fehlerErwarten(409, 'Nicht genügend freier Grössenbestand');
  });
  it('erkennt fehlgeschlagene Gesamtbestandsänderungen', async () => {
    positionen[0] = position({ groesseId });
    artikel!.hatGroessen = true;
    mocks.updateOne.mockImplementation(async (name: string) => ({ modifiedCount: name === 'artikel' ? 0 : 1 }));
    await fehlerErwarten(409, 'Artikelbestand konnte nicht aktualisiert');
  });
  it('erkennt konkurrierende Bestellungsänderungen', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({ modifiedCount: name === 'vereinskleider_verkaeufe' ? 0 : 1 }));
    await fehlerErwarten(409, 'zwischenzeitlich geändert');
  });
  it('übernimmt frühere Übergaben in die Historie', async () => {
    vorgang!.uebergaben = [{ positionsIndex: 0, menge: 1 }];
    const response = await ausfuehren();
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith('vereinskleider_verkaeufe', expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ uebergaben: expect.arrayContaining([expect.objectContaining({ menge: 1 }), expect.objectContaining({ menge: 2 })]) }) }), expect.anything());
  });
  it('gibt bei unerwarteten Datenbankfehlern 500 zurück', async () => {
    mocks.withTransaction.mockRejectedValue(new Error('Datenbank nicht verfügbar'));
    await fehlerErwarten(500, 'Übergabe konnte nicht gespeichert werden');
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
});
