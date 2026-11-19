import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  find: vi.fn(),
  aggregate: vi.fn(),
  updateOne: vi.fn(),
  insertOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
      find: (...args: unknown[]) => mocks.find(name, ...args),
      aggregate: (...args: unknown[]) => mocks.aggregate(name, ...args),
      updateOne: (...args: unknown[]) => mocks.updateOne(name, ...args),
      insertOne: (...args: unknown[]) => mocks.insertOne(name, ...args)
    }))
  },
  client: {
    startSession: () => ({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession
    })
  }
}));

import { GET, POST } from '../../src/routes/api/vereinskleider/+server';

const vereinId = 'verein-test';
const artikelId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const rabattId = new ObjectId().toString();
const admin = { id: 'admin', rolle: 'admin', vereinId };

const eingabe = (aenderungen: Record<string, unknown> = {}) => ({
  verkaufsart: 'direkt',
  kaeufer: 'Nathalie Muster',
  zahlungsart: 'twint',
  zahlungErhalten: true,
  riegen: ['Aktivriege'],
  positionen: [{ artikelId, groesseId: null, menge: 2 }],
  ...aenderungen
});

let artikel: Record<string, unknown>;
let variante: Record<string, unknown>;
let preis: Record<string, unknown>;
let regeln: Record<string, unknown>[];
let historienResultat: Record<string, unknown>;

function postKontext(daten: unknown = eingabe(), benutzer: typeof admin | null = admin) {
  return {
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten)
    })
  } as Parameters<typeof POST>[0];
}

function getKontext(query = '', benutzer: typeof admin | null = admin) {
  return {
    locals: { benutzer },
    url: new URL(`http://localhost/api/vereinskleider${query}`)
  } as Parameters<typeof GET>[0];
}

async function verkaufen(daten: unknown = eingabe()) {
  return POST(postKontext(daten));
}

async function verkaufsfehler(daten: unknown, status: number, meldung?: string) {
  const response = await verkaufen(daten);
  const body = await response.json();
  expect(response.status).toBe(status);
  if (meldung) expect(body.fehler).toContain(meldung);
  return body;
}

beforeEach(() => {
  vi.resetAllMocks();
  artikel = {
    _id: new ObjectId(artikelId), vereinId, name: 'Vereins-T-Shirt',
    kategorieId: 'kleider', istVereinskleidung: true, hatGroessen: false, menge: 10
  };
  variante = { artikelId, groesseId, vereinId, aktiv: true, menge: 10 };
  preis = { preistyp: 'fix', verkaufspreis: 25 };
  regeln = [];
  historienResultat = { eintraege: [], zaehler: [] };

  mocks.findOne.mockImplementation(async (name: string) => {
    if (name === 'artikel') return artikel;
    if (name === 'artikelvarianten') return variante;
    if (name === 'vereinskleider_preise') return preis;
    return null;
  });
  mocks.find.mockImplementation((name: string) => ({
    project: () => ({ toArray: async () => name === 'vereinskleider_rechnungen' ? [] : regeln }),
    toArray: async () => name === 'rabattregeln' ? regeln : []
  }));
  mocks.aggregate.mockImplementation(() => ({ toArray: async () => [historienResultat] }));
  mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
  mocks.withTransaction.mockImplementation(async (callback: () => Promise<unknown>) => callback());
  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Vereinskleider – Verkauf', () => {
  it('verweigert Verkäufe ohne Anmeldung', async () => {
    expect((await POST(postKontext(eingabe(), null))).status).toBe(401);
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'Ungültige Verkaufsdaten'],
    [[], 'Ungültige Verkaufsdaten'],
    [eingabe({ verkaufsart: 'unbekannt' }), 'Ungültige Verkaufsart'],
    [eingabe({ kaeufer: '  ' }), 'Käufer'],
    [eingabe({ zahlungsart: 'kreditkarte' }), 'Zahlungsart'],
    [eingabe({ zahlungErhalten: 'ja' }), 'Zahlungsbestätigung'],
    [eingabe({ zahlungsart: 'rechnung', zahlungErhalten: true }), 'Rechnung'],
    [eingabe({ bemerkung: 'x'.repeat(2001) }), 'Bemerkung'],
    [eingabe({ riegen: [] }), 'Riege'],
    [eingabe({ positionen: [] }), 'Warenkorb'],
    [eingabe({ positionen: [{ artikelId: 'falsch', groesseId: null, menge: 1 }] }), 'Warenkorbposition'],
    [eingabe({ positionen: [{ artikelId, groesseId: null, menge: 0 }] }), 'Warenkorbposition'],
    [eingabe({ positionen: [{ artikelId, groesseId: null, menge: 1.5 }] }), 'Warenkorbposition'],
    [eingabe({ positionen: [{ artikelId, groesseId: null, menge: 1, einzelpreis: -1 }] }), 'Warenkorbposition'],
    [eingabe({ rabattIds: [rabattId, rabattId] }), 'Rabattregel-Auswahl'],
    [eingabe({ zusaetzlicherRabatt: -1 }), 'zusätzlicher Rabatt']
  ])('validiert fehlerhafte Verkaufsdaten: %s', async (daten, meldung) => {
    await verkaufsfehler(daten, 400, meldung);
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it('verkauft Lagerware, reserviert ein Anprobierstück und erfasst Zahlung', async () => {
    const response = await verkaufen();
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.erfolg).toBe(true);
    expect(body.verkauf).toMatchObject({
      vereinId, verkaufsart: 'direkt', status: 'abgeschlossen',
      direktMenge: 2, bestellMenge: 0, zwischentotal: 50,
      endbetrag: 50, zahlungsstatus: 'bezahlt', bezahltBetrag: 50
    });
    expect(body.verkauf.zahlungen).toHaveLength(1);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({ vereinId, menge: { $gte: 3 } }),
      expect.objectContaining({ $inc: { menge: -2 } }),
      expect.anything()
    );
    expect(mocks.insertOne).toHaveBeenCalledWith(
      'vereinskleider_verkaeufe', expect.objectContaining({ endbetrag: 50 }), expect.anything()
    );
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('speichert eine reine Bestellung ohne Lagerabbuchung', async () => {
    const response = await verkaufen(eingabe({ verkaufsart: 'bestellung', zahlungsart: 'rechnung', zahlungErhalten: false }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf).toMatchObject({
      verkaufsart: 'bestellung', status: 'offen', direktMenge: 0,
      bestellMenge: 2, zahlungsstatus: 'offen', bezahltBetrag: 0
    });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('teilt einen automatischen Verkauf in Lagerverkauf und Bestellung auf', async () => {
    artikel.menge = 2;
    const response = await verkaufen(eingabe({ verkaufsart: 'automatisch', positionen: [{ artikelId, groesseId: null, menge: 3 }] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf).toMatchObject({ verkaufsart: 'gemischt', direktMenge: 1, bestellMenge: 2, status: 'offen' });
    expect(body.verkauf.positionen).toEqual([
      expect.objectContaining({ verkaufsart: 'direkt', menge: 1 }),
      expect.objectContaining({ verkaufsart: 'bestellung', menge: 2 })
    ]);
  });

  it('verhindert Direktverkäufe unter die Anprobierreserve', async () => {
    artikel.menge = 2;
    await verkaufsfehler(eingabe(), 409, 'Anprobierreserve');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Verkäufe unbekannter Artikel', async () => {
    artikel = null as unknown as Record<string, unknown>;
    await verkaufsfehler(eingabe(), 404, 'nicht gefunden');
  });

  it('verhindert Verkäufe von Artikeln ohne Vereinskleider-Kennzeichnung', async () => {
    artikel.istVereinskleidung = false;
    await verkaufsfehler(eingabe(), 400, 'Vereinskleidern');
  });

  it('verhindert eine falsche Grössenzuordnung', async () => {
    artikel.hatGroessen = true;
    await verkaufsfehler(eingabe(), 400, 'Grössenzuordnung');
  });

  it('verhindert Verkäufe fehlender Grössenvarianten', async () => {
    artikel.hatGroessen = true;
    variante = null as unknown as Record<string, unknown>;
    await verkaufsfehler(eingabe({ positionen: [{ artikelId, groesseId, menge: 2 }] }), 400, 'Grössenvariante');
  });

  it('verhindert Verkäufe ohne hinterlegten Preis', async () => {
    preis = null as unknown as Record<string, unknown>;
    await verkaufsfehler(eingabe(), 400, 'Verkaufspreis');
  });

  it('erkennt einen veralteten Fixpreis im Warenkorb', async () => {
    await verkaufsfehler(eingabe({ positionen: [{ artikelId, groesseId: null, menge: 2, einzelpreis: 20 }] }), 409, 'Warenkorb neu laden');
  });

  it('akzeptiert einen individuellen variablen Preis', async () => {
    preis = { preistyp: 'variabel', verkaufspreis: 25 };
    const response = await verkaufen(eingabe({ positionen: [{ artikelId, groesseId: null, menge: 2, einzelpreis: 19.5 }] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf.endbetrag).toBe(39);
  });

  it('verhindert unbekannte Preistypen', async () => {
    preis = { preistyp: 'unbekannt', verkaufspreis: 25 };
    await verkaufsfehler(eingabe(), 400, 'Preistyp');
  });

  it('verkauft Grössenvarianten und aktualisiert Varianten- sowie Gesamtbestand', async () => {
    artikel.hatGroessen = true;
    const response = await verkaufen(eingabe({ positionen: [{ artikelId, groesseId, menge: 2 }] }));
    expect(response.status).toBe(201);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikelvarianten', expect.objectContaining({ artikelId, groesseId, menge: { $gte: 3 } }),
      { $inc: { menge: -2 } }, expect.anything()
    );
    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel', expect.objectContaining({ vereinId, menge: { $gte: 2 } }),
      expect.objectContaining({ $inc: { menge: -2 } }), expect.anything()
    );
  });

  it('erkennt konkurrierende Lageränderungen', async () => {
    mocks.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await verkaufsfehler(eingabe(), 409, 'zwischenzeitlich geändert');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('erkennt konkurrierende Änderungen am Variantenbestand', async () => {
    artikel.hatGroessen = true;
    mocks.updateOne.mockImplementation(async (name: string) => ({ modifiedCount: name === 'artikelvarianten' ? 0 : 1 }));
    await verkaufsfehler(eingabe({ positionen: [{ artikelId, groesseId, menge: 2 }] }), 409, 'Bestand der Grösse');
  });

  it('erkennt fehlgeschlagene Aktualisierungen des Gesamtbestands', async () => {
    artikel.hatGroessen = true;
    mocks.updateOne.mockImplementation(async (name: string) => ({ modifiedCount: name === 'artikel' ? 0 : 1 }));
    await verkaufsfehler(eingabe({ positionen: [{ artikelId, groesseId, menge: 2 }] }), 409, 'Artikelbestand');
  });

  it('berechnet einen zusätzlichen Rabatt korrekt', async () => {
    const response = await verkaufen(eingabe({ zusaetzlicherRabatt: 5 }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf).toMatchObject({ zwischentotal: 50, rabattTotal: 5, endbetrag: 45 });
  });

  it('verhindert Rabatte über dem Warenkorbwert', async () => {
    await verkaufsfehler(eingabe({ zusaetzlicherRabatt: 51 }), 400, 'übersteigen');
  });

  it('verhindert die Verwendung unbekannter Rabattregeln', async () => {
    await verkaufsfehler(eingabe({ rabattIds: [rabattId] }), 400, 'existiert nicht');
  });

  it('berechnet einen prozentualen Warenkorbrabatt', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: '10 Prozent', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb', aktiv: true }];
    const response = await verkaufen(eingabe({ rabattIds: [rabattId] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf).toMatchObject({ zwischentotal: 50, rabattTotal: 5, endbetrag: 45 });
    expect(body.verkauf.rabatte).toEqual([expect.objectContaining({ rabattId, betrag: 5 })]);
  });

  it('begrenzt die rabattierte Stückzahl', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: 'Ein Stück', rabattart: 'prozent', wert: 20, geltungsbereich: 'warenkorb', maximaleMenge: 1 }];
    const response = await verkaufen(eingabe({ rabattIds: [rabattId] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf).toMatchObject({ rabattTotal: 5, endbetrag: 45 });
  });

  it('berechnet einen festen Rabattbetrag', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: '5 Franken', rabattart: 'betrag', wert: 5, geltungsbereich: 'warenkorb' }];
    const response = await verkaufen(eingabe({ rabattIds: [rabattId] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf.endbetrag).toBe(45);
  });

  it('verhindert ungültige Rabatte für andere Riegen', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: 'JUKO', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb', riegen: ['JUKO'] }];
    await verkaufsfehler(eingabe({ rabattIds: [rabattId] }), 400, 'gewählte Riege');
  });

  it('verhindert deaktivierte Rabattregeln', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: 'Alt', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb', aktiv: false }];
    await verkaufsfehler(eingabe({ rabattIds: [rabattId] }), 400, 'nicht gültig');
  });

  it('verhindert Sonderpreise für den gesamten Warenkorb', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: 'Sonderpreis', rabattart: 'fixpreis', wert: 15, geltungsbereich: 'warenkorb' }];
    await verkaufsfehler(eingabe({ rabattIds: [rabattId] }), 400, 'Sonderpreise');
  });

  it('wendet Sonderpreise auf passende Artikel an', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: 'Sonderpreis', rabattart: 'fixpreis', wert: 15, geltungsbereich: 'artikel', artikelIds: [artikelId] }];
    const response = await verkaufen(eingabe({ rabattIds: [rabattId] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.verkauf).toMatchObject({ rabattTotal: 20, endbetrag: 30 });
  });

  it('verhindert Rabatte ohne passende Artikel', async () => {
    regeln = [{ _id: new ObjectId(rabattId), name: 'Fremdartikel', rabattart: 'prozent', wert: 10, geltungsbereich: 'artikel', artikelIds: [new ObjectId().toString()] }];
    await verkaufsfehler(eingabe({ rabattIds: [rabattId] }), 400, 'keine passende Position');
  });

  it('gibt bei unerwarteten Datenbankfehlern 500 zurück und beendet die Session', async () => {
    mocks.withTransaction.mockRejectedValue(new Error('Datenbankfehler'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await verkaufsfehler(eingabe(), 500, 'nicht gespeichert');
    } finally {
      spy.mockRestore();
    }
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });
});

describe('ClubMatiq Vereinskleider – Verkaufshistorie', () => {
  it('verweigert den Abruf ohne Anmeldung', async () => {
    const response = await GET(getKontext('', null));
    expect(response.status).toBe(401);
  });

  it.each([
    ['?seite=0', 'Seitennummer'],
    ['?seite=10001', 'Seitennummer'],
    ['?seite=1.5', 'Seitennummer'],
    ['?art=unbekannt', 'Filterparameter'],
    ['?zahlung=unbekannt', 'Filterparameter'],
    ['?von=2026-02-30', 'Datumsbereich'],
    ['?von=2026-12-01&bis=2026-01-01', 'Datumsbereich'],
    [`?suche=${'x'.repeat(121)}`, 'Filterparameter']
  ])('verweigert ungültige Suchparameter: %s', async (query, meldung) => {
    const response = await GET(getKontext(query));
    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toContain(meldung);
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it('liefert eine leere paginierte Verkaufshistorie', async () => {
    const response = await GET(getKontext());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ verkaeufe: [], seite: 1, proSeite: 100, gesamt: 0, seiten: 0 });
  });

  it('wandelt MongoDB-IDs in Strings um und paginiert', async () => {
    const id = new ObjectId();
    const rechnungId = new ObjectId();
    historienResultat = {
      eintraege: [{ _id: id, kaeufer: 'Laura', rechnung: { _id: rechnungId, rechnungsnummer: 'R-1' } }],
      zaehler: [{ anzahl: 201 }]
    };
    const response = await GET(getKontext('?seite=2'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ seite: 2, gesamt: 201, seiten: 3 });
    expect(body.verkaeufe[0]).toMatchObject({ _id: id.toString(), rechnung: { _id: rechnungId.toString() } });
    expect(mocks.aggregate).toHaveBeenCalledWith(
      'vereinskleider_verkaeufe',
      expect.arrayContaining([expect.objectContaining({ $match: { vereinId } })])
    );
  });

  it('übernimmt Art-, Riegen- und Datumsfilter in die Aggregation', async () => {
    const response = await GET(getKontext('?art=gemischt&riege=JUKO&von=2026-01-01&bis=2026-01-31&zahlung=offen'));
    expect(response.status).toBe(200);
    const pipeline = mocks.aggregate.mock.calls[0][1] as Record<string, unknown>[];
    expect(pipeline[0]).toMatchObject({
      $match: { vereinId, verkaufsart: 'gemischt', riegen: 'JUKO' }
    });
    expect(pipeline.some((schritt) => '$facet' in schritt)).toBe(true);
    expect(pipeline.some((schritt) => '$match' in schritt && JSON.stringify(schritt).includes('nettoFilter'))).toBe(true);
  });

  it('sucht nach Käufer und Rechnungsnummer', async () => {
    const verkaufId = new ObjectId().toString();
    mocks.find.mockImplementation(() => ({
      project: () => ({ toArray: async () => [{ verkaufId }] })
    }));
    const response = await GET(getKontext('?suche=Laura'));
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      'vereinskleider_rechnungen', expect.objectContaining({ vereinId, rechnungsnummer: expect.any(RegExp) })
    );
    const pipeline = mocks.aggregate.mock.calls[0][1] as Array<{ $match?: Record<string, unknown> }>;
    expect(pipeline[0].$match?.$or).toBeDefined();
  });

  it('behandelt Datenbankfehler beim Laden der Historie', async () => {
    mocks.aggregate.mockImplementation(() => ({ toArray: async () => { throw new Error('DB nicht erreichbar'); } }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await GET(getKontext());
      expect(response.status).toBe(500);
      expect((await response.json()).fehler).toContain('nicht geladen');
    } finally {
      spy.mockRestore();
    }
  });
});
