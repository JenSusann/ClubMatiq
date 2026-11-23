
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  find: vi.fn(),
  updateOne: vi.fn(),
  insertOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
      find: (...args: unknown[]) => mocks.find(name, ...args),
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

import { POST } from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

const vereinId = 'verein-test';
const inventurId = new ObjectId().toString();
const artikelId = new ObjectId().toString();
const groesseId = new ObjectId().toString();

const admin = { id: 'admin', rolle: 'admin', vereinId };

function inventur(aenderungen: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(inventurId),
    vereinId,
    status: 'offen',
    version: 2,
    ...aenderungen
  };
}

function position(aenderungen: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    artikelId,
    artikelName: 'Trainingsball',
    groesseId: null,
    sollBestand: 10,
    istBestand: 8,
    ...aenderungen
  };
}

let positionen: ReturnType<typeof position>[];
let artikelDaten: Record<string, unknown>;
let variantenDaten: Record<string, unknown>;

function kontext(
  benutzer: typeof admin | null = admin,
  id = inventurId
) {
  return {
    params: { id },
    locals: { benutzer }
  } as Parameters<typeof POST>[0];
}

async function ausfuehren(
  benutzer: typeof admin | null = admin,
  id = inventurId
) {
  return POST(kontext(benutzer, id));
}

async function fehlerErwarten(text?: string) {
  const spy = vi.spyOn(console, 'error')
    .mockImplementation(() => {});

  try {
    const response = await ausfuehren();
    const daten = await response.json();

    expect(response.status).toBe(409);

    if (text) {
      expect(daten.fehler).toContain(text);
    }

    return daten;
  } finally {
    spy.mockRestore();
  }
}

beforeEach(() => {
  vi.resetAllMocks();

  positionen = [position()];
  artikelDaten = {
    _id: new ObjectId(artikelId),
    vereinId,
    hatGroessen: false,
    menge: 10
  };
  variantenDaten = {
    artikelId,
    groesseId,
    vereinId,
    aktiv: true,
    menge: 10
  };

  mocks.findOne.mockImplementation(async (name: string) => {
    if (name === 'inventuren') return inventur();
    if (name === 'artikel') return artikelDaten;
    if (name === 'artikelvarianten') return variantenDaten;
    return null;
  });

  mocks.find.mockImplementation(() => ({
    toArray: vi.fn().mockImplementation(async () => positionen)
  }));

  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );

  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Inventur abschliessen', () => {

  it('verweigert den Abschluss ohne Anmeldung', async () => {
    const response = await ausfuehren(null);
    expect(response.status).toBe(401);
  });

  it('verhindert ungültige Inventur-IDs', async () => {
    const response = await ausfuehren(admin, 'ungueltig');
    expect(response.status).toBe(400);
  });

  it('schliesst eine vollständig gezählte Inventur ab', async () => {
    const response = await ausfuehren();
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);
    expect(daten.anzahlKorrekturen).toBe(1);
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('übernimmt Bestandsdifferenzen korrekt', async () => {
    await ausfuehren();

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({
        vereinId,
        menge: 10
      }),
      { $set: { menge: 8 } },
      expect.anything()
    );
  });

  it('protokolliert den Inventurabschluss', async () => {
    await ausfuehren();

    expect(mocks.insertOne).toHaveBeenCalledWith(
      'inventurprotokoll',
      expect.objectContaining({
        vereinId,
        inventurId,
        aktion: 'abgeschlossen',
        anzahlKorrekturen: 1,
        versionVorher: 2,
        versionNachher: 3
      }),
      expect.anything()
    );
  });

  it('nimmt bei identischen Beständen keine Korrektur vor', async () => {
    positionen = [position({ istBestand: 10 })];

    const response = await ausfuehren();
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.anzahlKorrekturen).toBe(0);

    expect(mocks.updateOne).not.toHaveBeenCalledWith(
      'artikel',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('verhindert einen erneuten Abschluss', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') {
        return inventur({ status: 'abgeschlossen' });
      }
      return artikelDaten;
    });

    await fehlerErwarten('bereits abgeschlossen');
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert den Abschluss unbekannter Inventuren', async () => {
    mocks.findOne.mockResolvedValue(null);

    await fehlerErwarten('Inventur nicht gefunden');
  });

  it('verhindert Inventuren ohne Positionen', async () => {
    positionen = [];

    await fehlerErwarten('keine Positionen');
  });

  it('verhindert den Abschluss unvollständig gezählter Inventuren', async () => {
    positionen = [position({ istBestand: null })];

    await fehlerErwarten('nicht gezählt');
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert den Abschluss bei ungültigen Artikel-IDs', async () => {
    positionen = [position({ artikelId: 'ungueltig' })];

    await fehlerErwarten('Ungültige Artikel-ID');
  });

  it('verhindert den Abschluss bei gelöschten Artikeln', async () => {
    artikelDaten = null as unknown as Record<string, unknown>;

    await fehlerErwarten('existiert nicht mehr');
  });

  it('erkennt nachträglich veränderte Lagerbestände', async () => {
    artikelDaten.menge = 12;

    await fehlerErwarten('seit Inventurbeginn verändert');
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('erkennt eine nachträglich aktivierte Grössenverwaltung', async () => {
    artikelDaten.hatGroessen = true;

    await fehlerErwarten('Grössenverwaltung');
  });

  it('erhöht den Variantenbestand bei einer Grösseninventur', async () => {
    artikelDaten.hatGroessen = true;
    positionen = [
      position({ groesseId, sollBestand: 10, istBestand: 12 })
    ];

    const response = await ausfuehren();

    expect(response.status).toBe(200);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikelvarianten',
      expect.objectContaining({
        artikelId,
        groesseId,
        vereinId
      }),
      { $inc: { menge: 2 } },
      expect.anything()
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({ hatGroessen: true }),
      { $inc: { menge: 2 } },
      expect.anything()
    );
  });

  it('verhindert den Abschluss deaktivierter Grössen', async () => {
    artikelDaten.hatGroessen = true;
    variantenDaten.aktiv = false;
    positionen = [position({ groesseId })];

    await fehlerErwarten('deaktiviert');
  });

  it('erkennt veränderte Variantenbestände', async () => {
    artikelDaten.hatGroessen = true;
    variantenDaten.menge = 15;
    positionen = [position({ groesseId })];

    await fehlerErwarten('seit Inventurbeginn verändert');
  });

  it('verhindert den Abschluss bei fehlenden Grössenvarianten', async () => {
    artikelDaten.hatGroessen = true;
    variantenDaten = null as unknown as Record<string, unknown>;
    positionen = [position({ groesseId })];

    await fehlerErwarten('existiert nicht mehr');
  });

  it('verhindert den Abschluss bei fehlgeschlagener Bestandskorrektur', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({
      modifiedCount: name === 'artikel' ? 0 : 1
    }));

    await fehlerErwarten('Bestandskorrektur');
  });

  it('verhindert den Abschluss bei einem Versionskonflikt', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({
      modifiedCount: name === 'inventuren' ? 0 : 1
    }));

    await fehlerErwarten('konnte nicht abgeschlossen werden');
    // Das Journal wird innerhalb der Transaktion geschrieben. Bei einem
    // Versionskonflikt rollt MongoDB sowohl Journal als auch Bestand zurück.
    expect(mocks.insertOne).toHaveBeenCalledWith(
      'lagerbewegungen', expect.objectContaining({ art: 'inventur' }),
      expect.objectContaining({ session: expect.anything() })
    );
  });

  it('schliesst die Session auch bei Fehlern', async () => {
    mocks.withTransaction.mockRejectedValue(
      new Error('Transaktion fehlgeschlagen')
    );

    await fehlerErwarten('Transaktion fehlgeschlagen');
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('erkennt eine nachträglich deaktivierte Grössenverwaltung', async () => {
    artikelDaten.hatGroessen = false;

    positionen = [
      position({
        groesseId,
        sollBestand: 10,
        istBestand: 8
      })
    ];

    await fehlerErwarten('Grössenverwaltung');

    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert den Abschluss bei fehlgeschlagener Aktualisierung des Gesamtbestands', async () => {
    artikelDaten.hatGroessen = true;

    positionen = [
      position({
        groesseId,
        sollBestand: 10,
        istBestand: 12
      })
    ];

    mocks.updateOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { modifiedCount: 0 };
      }

      return { modifiedCount: 1 };
    });

    await fehlerErwarten('Gesamtbestand');

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikelvarianten',
      expect.anything(),
      { $inc: { menge: 2 } },
      expect.anything()
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({
        vereinId,
        hatGroessen: true
      }),
      { $inc: { menge: 2 } },
      expect.anything()
    );

    expect(mocks.insertOne).not.toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('schliesst Inventuren ohne gespeicherte Versionsnummer ab', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') {
        const daten = inventur();
        delete (daten as { version?: number }).version;
        return daten;
      }

      if (name === 'artikel') return artikelDaten;
      if (name === 'artikelvarianten') return variantenDaten;

      return null;
    });

    const response = await ausfuehren();
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'inventuren',
      expect.objectContaining({
        version: { $exists: false }
      }),
      expect.anything(),
      expect.anything()
    );

    expect(mocks.insertOne).toHaveBeenCalledWith(
      'inventurprotokoll',
      expect.objectContaining({
        versionVorher: 0,
        versionNachher: 1
      }),
      expect.anything()
    );
  });

  it('behandelt unerwartete Transaktionsfehler', async () => {
    mocks.withTransaction.mockRejectedValue(
      'Unbekannter Transaktionsfehler'
    );

    const daten = await fehlerErwarten(
      'Inventur konnte nicht abgeschlossen werden.'
    );

    expect(daten.fehler).toBe(
      'Inventur konnte nicht abgeschlossen werden.'
    );

    expect(mocks.endSession).toHaveBeenCalledOnce();
  });


});
