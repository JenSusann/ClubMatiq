
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  insertOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
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

import { POST } from '../../src/routes/api/inventuren/[id]/korrigieren/+server';

const vereinId = 'verein-test';
const inventurId = new ObjectId().toString();
const positionId = new ObjectId().toString();
const artikelId = new ObjectId().toString();
const groesseId = new ObjectId().toString();

const admin = { id: 'admin', rolle: 'admin', vereinId };

const eingabe = () => ({
  positionId,
  neuerIstBestand: 12,
  begruendung: 'Nachzählung durchgeführt',
  version: 2
});

let inventurDaten: Record<string, unknown>;
let positionsDaten: Record<string, unknown>;

function kontext(
  daten: unknown = eingabe(),
  benutzer: typeof admin | null = admin,
  id = inventurId
) {
  return {
    params: { id },
    locals: { benutzer },
    request: new Request(
      `http://localhost/api/inventuren/${id}/korrigieren`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten)
      }
    )
  } as Parameters<typeof POST>[0];
}

async function fehler(daten: unknown, status: number) {
  const spy = vi.spyOn(console, 'error')
    .mockImplementation(() => {});

  try {
    const response = await POST(kontext(daten));
    expect(response.status).toBe(status);
    return response.json();
  } finally {
    spy.mockRestore();
  }
}

beforeEach(() => {
  vi.resetAllMocks();

  inventurDaten = {
    _id: new ObjectId(inventurId),
    vereinId,
    status: 'abgeschlossen',
    version: 2
  };

  positionsDaten = {
    _id: new ObjectId(positionId),
    inventurId,
    vereinId,
    artikelId,
    groesseId: null,
    istBestand: 10
  };

  mocks.findOne.mockImplementation(async (name: string) => {
    if (name === 'inventuren') return inventurDaten;
    if (name === 'inventurpositionen') return positionsDaten;
    return null;
  });

  mocks.updateOne.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1
  });

  mocks.insertOne.mockResolvedValue({
    insertedId: new ObjectId()
  });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );

  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq nachträgliche Inventurkorrektur', () => {

  it('verweigert Korrekturen ohne Anmeldung', async () => {
    const response = await POST(kontext(eingabe(), null));
    expect(response.status).toBe(401);
  });

  it('verhindert ungültige Inventur-IDs', async () => {
    const response = await POST(
      kontext(eingabe(), admin, 'ungueltig')
    );
    expect(response.status).toBe(400);
  });

  it('verhindert ungültige Positions-IDs', async () => {
    const daten = await fehler({
      ...eingabe(),
      positionId: 'ungueltig'
    }, 400);

    expect(daten.fehler).toContain('Inventurposition');
  });

  it('verhindert negative Ist-Bestände', async () => {
    await fehler({
      ...eingabe(),
      neuerIstBestand: -1
    }, 400);
  });

  it('verhindert Dezimalbestände', async () => {
    await fehler({
      ...eingabe(),
      neuerIstBestand: 2.5
    }, 400);
  });

  it('verlangt eine ausreichende Begründung', async () => {
    await fehler({
      ...eingabe(),
      begruendung: 'abc'
    }, 400);
  });

  it('verhindert Begründungen über 1000 Zeichen', async () => {
    await fehler({
      ...eingabe(),
      begruendung: 'A'.repeat(1001)
    }, 400);
  });

  it('verlangt eine gültige Inventurversion', async () => {
    await fehler({
      ...eingabe(),
      version: -1
    }, 400);
  });

  it('korrigiert den Bestand nach oben', async () => {
    const response = await POST(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);
    expect(daten.alterIstBestand).toBe(10);
    expect(daten.neuerIstBestand).toBe(12);
    expect(daten.differenz).toBe(2);
    expect(daten.version).toBe(3);
  });

  it('korrigiert den Bestand nach unten', async () => {
    const response = await POST(kontext({
      ...eingabe(),
      neuerIstBestand: 7
    }));

    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.differenz).toBe(-3);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({
        vereinId,
        menge: { $gte: 3 }
      }),
      { $inc: { menge: -3 } },
      expect.anything()
    );
  });

  it('protokolliert die nachträgliche Korrektur', async () => {
    await POST(kontext());

    expect(mocks.insertOne).toHaveBeenCalledWith(
      'inventurprotokoll',
      expect.objectContaining({
        aktion: 'nachtraeglich_korrigiert',
        alterIstBestand: 10,
        neuerIstBestand: 12,
        differenz: 2,
        versionVorher: 2,
        versionNachher: 3
      }),
      expect.anything()
    );
  });

  it('verhindert Korrekturen offener Inventuren', async () => {
    inventurDaten.status = 'offen';

    const daten = await fehler(eingabe(), 409);
    expect(daten.fehler).toContain('abgeschlossene');
  });

  it('erkennt Versionskonflikte', async () => {
    inventurDaten.version = 3;

    const daten = await fehler(eingabe(), 409);
    expect(daten.fehler).toContain('zwischenzeitlich');
  });

  it('verhindert unveränderte Ist-Bestände', async () => {
    const daten = await fehler({
      ...eingabe(),
      neuerIstBestand: 10
    }, 409);

    expect(daten.fehler).toContain('bisherigen Wert');
  });

  it('verhindert Korrekturen unbekannter Positionen', async () => {
    positionsDaten = null as unknown as Record<string, unknown>;

    const daten = await fehler(eingabe(), 409);
    expect(daten.fehler).toContain('nicht gefunden');
  });

  it('korrigiert Artikel mit Grössenvarianten', async () => {
    positionsDaten.groesseId = groesseId;

    const response = await POST(kontext());

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
  });

  it('verhindert fehlgeschlagene Variantenkorrekturen', async () => {
    positionsDaten.groesseId = groesseId;

    mocks.updateOne.mockImplementation(async (name: string) => ({
      matchedCount: name === 'artikelvarianten' ? 0 : 1
    }));

    const daten = await fehler(eingabe(), 409);
    expect(daten.fehler).toContain('Artikelvariante');
  });

  it('verhindert fehlgeschlagene Artikelkorrekturen', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({
      matchedCount: name === 'artikel' ? 0 : 1
    }));

    const daten = await fehler(eingabe(), 409);
    expect(daten.fehler).toContain('Artikel fehlt');
  });

  it('erkennt konkurrierende Positionsänderungen', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({
      matchedCount: name === 'inventurpositionen' ? 0 : 1
    }));

    const daten = await fehler(eingabe(), 409);
    expect(daten.fehler).toContain('zwischenzeitlich');
  });

  it('schliesst die Session nach erfolgreicher Korrektur', async () => {
    const response = await POST(kontext());

    expect(response.status).toBe(200);
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('schliesst die Session bei Transaktionsfehlern', async () => {
    mocks.withTransaction.mockRejectedValue(
      new Error('Transaktion fehlgeschlagen')
    );

    await fehler(eingabe(), 409);
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('verhindert ungültige Eingabedaten', async () => {
    for (const daten of [null, [], 'ungueltig', 123]) {
      const response = await POST(kontext(daten));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Ungültige Eingabedaten.'
      );
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Korrekturen nicht vorhandener Inventuren', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') return null;
      return positionsDaten;
    });

    const daten = await fehler(eingabe(), 409);

    expect(daten.fehler).toBe('Inventur nicht gefunden.');
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('verhindert Korrekturen bei ungültigem bisherigem Ist-Bestand', async () => {
    for (const bestand of [null, -1, 2.5, 'zehn']) {
      positionsDaten.istBestand = bestand;

      const daten = await fehler(eingabe(), 409);

      expect(daten.fehler).toBe(
        'Ungültiger bisheriger Ist-Bestand.'
      );
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Korrekturen bei ungültiger Artikel-ID', async () => {
    positionsDaten.artikelId = 'ungueltig';

    const daten = await fehler(eingabe(), 409);

    expect(daten.fehler).toBe(
      'Ungültige Artikel-ID in der Inventurposition.'
    );

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Korrekturen bei ungültiger Grössen-ID', async () => {
    positionsDaten.groesseId = 'ungueltig';

    const daten = await fehler(eingabe(), 409);

    expect(daten.fehler).toBe(
      'Ungültige Grösse in der Inventurposition.'
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'inventuren',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('erkennt konkurrierende Änderungen der Inventurversion', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({
      matchedCount: name === 'inventuren' ? 0 : 1
    }));

    const daten = await fehler(eingabe(), 409);

    expect(daten.fehler).toBe(
      'Die Inventur wurde zwischenzeitlich verändert.'
    );

    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('verhindert Bestandskorrekturen bei unzureichendem Artikelbestand', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      return { matchedCount: 1, modifiedCount: 1 };
    });

    const daten = await fehler({
      ...eingabe(),
      neuerIstBestand: 0
    }, 409);

    expect(daten.fehler).toBe(
      'Artikel fehlt oder hat zu wenig Bestand.'
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({
        vereinId,
        menge: { $gte: 10 }
      }),
      { $inc: { menge: -10 } },
      expect.anything()
    );

    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('behandelt unerwartete Transaktionsfehler', async () => {
    mocks.withTransaction.mockRejectedValue(
      'Unbekannter Transaktionsfehler'
    );

    const daten = await fehler(eingabe(), 409);

    expect(daten.fehler).toBe(
      'Inventurkorrektur fehlgeschlagen.'
    );

    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('verhindert eine erfolgreiche Antwort ohne gespeichertes Ergebnis', async () => {
    mocks.withTransaction.mockResolvedValue(undefined);

    const daten = await fehler(eingabe(), 409);

    expect(daten.fehler).toBe(
      'Korrektur konnte nicht gespeichert werden.'
    );

    expect(mocks.endSession).toHaveBeenCalledOnce();
  });


});
