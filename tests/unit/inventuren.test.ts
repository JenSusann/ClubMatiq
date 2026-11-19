
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  insertOne: vi.fn(),
  insertMany: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      find: (...args: unknown[]) => mocks.find(name, ...args),
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
      insertOne: (...args: unknown[]) => mocks.insertOne(name, ...args),
      insertMany: (...args: unknown[]) => mocks.insertMany(name, ...args)
    }))
  },
  client: {
    startSession: () => ({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession
    })
  }
}));

import { GET, POST } from '../../src/routes/api/inventuren/+server';

const vereinId = 'verein-test';
const artikelId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const groesseId = new ObjectId().toString();

const admin = { id: 'admin', rolle: 'admin', vereinId };

function eingabe() {
  return {
    name: 'Jahresinventur 2026',
    typ: 'gesamt'
  };
}

function kontext(
  benutzer: typeof admin | null = admin,
  daten: unknown = eingabe()
) {
  return {
    locals: { benutzer },
    request: new Request('http://localhost/api/inventuren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten)
    })
  } as Parameters<typeof POST>[0];
}

function artikel(hatGroessen = false) {
  return {
    _id: new ObjectId(artikelId),
    vereinId,
    name: 'Trainingsshirt',
    lagerortId,
    hatGroessen,
    menge: 10,
    einzelwert: 25
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.find.mockImplementation((name: string) => ({
    sort: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(
        name === 'artikel' ? [artikel()] : []
      )
    }),
    toArray: vi.fn().mockResolvedValue([])
  }));

  mocks.findOne.mockResolvedValue({
    _id: new ObjectId(lagerortId),
    name: 'Materialraum'
  });

  mocks.insertOne.mockResolvedValue({
    insertedId: new ObjectId()
  });

  mocks.insertMany.mockResolvedValue({
    insertedCount: 1
  });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );

  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Inventurverwaltung', () => {

  it('lädt Inventuren des eigenen Vereins', async () => {
    const response = await GET(kontext());

    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      'inventuren',
      { vereinId }
    );
  });

  it('verweigert GET ohne Anmeldung', async () => {
    const response = await GET(kontext(null));
    expect(response.status).toBe(401);
  });

  it('verweigert POST ohne Anmeldung', async () => {
    const response = await POST(kontext(null));
    expect(response.status).toBe(401);
  });

  it('erstellt eine Gesamtinventur', async () => {
    const response = await POST(kontext());
    const daten = await response.json();

    expect(response.status).toBe(201);
    expect(daten.erfolg).toBe(true);
    expect(daten.anzahlArtikel).toBe(1);
    expect(daten.anzahlPositionen).toBe(1);
    expect(mocks.insertOne).toHaveBeenCalled();
    expect(mocks.insertMany).toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('speichert Soll-Bestände als Momentaufnahme', async () => {
    await POST(kontext());

    expect(mocks.insertMany).toHaveBeenCalledWith(
      'inventurpositionen',
      expect.arrayContaining([
        expect.objectContaining({
          artikelId,
          sollBestand: 10,
          istBestand: null,
          einzelwert: 25,
          vereinId
        })
      ]),
      expect.anything()
    );
  });

  it('erstellt eine Lagerortinventur', async () => {
    const response = await POST(kontext(admin, {
      name: 'Inventur Materialraum',
      typ: 'lagerort',
      lagerortId
    }));

    expect(response.status).toBe(201);

    expect(mocks.find).toHaveBeenCalledWith(
      'artikel',
      { vereinId, lagerortId }
    );
  });

  it('verhindert leere Inventurnamen', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(),
      name: ''
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert Inventurnamen über 150 Zeichen', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(),
      name: 'A'.repeat(151)
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert ungültige Inventurtypen', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(),
      typ: 'falsch'
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert ungültige Lagerort-IDs', async () => {
    const response = await POST(kontext(admin, {
      name: 'Lagerinventur',
      typ: 'lagerort',
      lagerortId: 'ungueltig'
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert Lagerorte anderer Vereine', async () => {
    mocks.findOne.mockResolvedValue(null);

    const response = await POST(kontext(admin, {
      name: 'Lagerinventur',
      typ: 'lagerort',
      lagerortId
    }));

    expect(response.status).toBe(404);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Inventuren ohne Artikel', async () => {
    mocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([])
      })
    });

    const response = await POST(kontext());

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('erstellt Inventurpositionen für Grössenvarianten', async () => {
    mocks.find.mockImplementation((name: string) => ({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([artikel(true)])
      }),
      toArray: vi.fn().mockResolvedValue(
        name === 'artikelvarianten'
          ? [{
              artikelId,
              groesseId,
              menge: 5,
              einzelwert: 30
            }]
          : []
      )
    }));

    const response = await POST(kontext());
    const daten = await response.json();

    expect(response.status).toBe(201);
    expect(daten.anzahlPositionen).toBe(1);

    expect(mocks.insertMany).toHaveBeenCalledWith(
      'inventurpositionen',
      expect.arrayContaining([
        expect.objectContaining({
          groesseId,
          sollBestand: 5,
          einzelwert: 30
        })
      ]),
      expect.anything()
    );
  });

  it('schliesst die Session bei Transaktionsfehlern', async () => {
    mocks.withTransaction.mockRejectedValue(
      new Error('Transaktion fehlgeschlagen')
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(500);
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Datenbankfehler beim Laden der Inventuren', async () => {
    mocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockRejectedValue(
          new Error('Datenbank nicht erreichbar')
        )
      })
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await GET(kontext());
      const daten = await response.json();

      expect(response.status).toBe(500);
      expect(daten.fehler).toBe(
        'Inventuren konnten nicht geladen werden.'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert ungültige Inventurdaten', async () => {
    for (const daten of [null, [], 'ungueltig', 123]) {
      const response = await POST(kontext(admin, daten));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Ungültige Inventurdaten.'
      );
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert fehlende oder ungültige Inventurnamen', async () => {
    for (const name of [null, 123, '   ']) {
      const response = await POST(kontext(admin, {
        ...eingabe(),
        name
      }));

      expect(response.status).toBe(400);
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Lagerortinventuren ohne Lagerort-ID', async () => {
    const response = await POST(kontext(admin, {
      name: 'Inventur Materialraum',
      typ: 'lagerort'
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe(
      'Bitte einen gültigen Lagerort auswählen.'
    );
  });

  it('verhindert Inventuren ohne aktive Grössenvarianten', async () => {
    mocks.find.mockImplementation((name: string) => ({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([artikel(true)])
      }),
      toArray: vi.fn().mockResolvedValue(
        name === 'artikelvarianten' ? [] : []
      )
    }));

    const response = await POST(kontext());
    const daten = await response.json();

    expect(response.status).toBe(400);
    expect(daten.fehler).toBe(
      'Es konnten keine Inventurpositionen erstellt werden.'
    );

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verwendet Einzelwert 0 bei fehlenden Artikelwerten', async () => {
    mocks.find.mockImplementation((name: string) => ({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(
          name === 'artikel'
            ? [{ ...artikel(), einzelwert: null }]
            : []
        )
      }),
      toArray: vi.fn().mockResolvedValue([])
    }));

    const response = await POST(kontext());

    expect(response.status).toBe(201);

    expect(mocks.insertMany).toHaveBeenCalledWith(
      'inventurpositionen',
      expect.arrayContaining([
        expect.objectContaining({
          artikelId,
          einzelwert: 0
        })
      ]),
      expect.anything()
    );
  });

  it('verwendet Einzelwert 0 bei Grössenvarianten ohne Wert', async () => {
    mocks.find.mockImplementation((name: string) => ({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(
          name === 'artikel' ? [artikel(true)] : []
        )
      }),
      toArray: vi.fn().mockResolvedValue(
        name === 'artikelvarianten'
          ? [{
              artikelId,
              groesseId,
              menge: 5,
              einzelwert: null
            }]
          : []
      )
    }));

    const response = await POST(kontext());

    expect(response.status).toBe(201);

    expect(mocks.insertMany).toHaveBeenCalledWith(
      'inventurpositionen',
      expect.arrayContaining([
        expect.objectContaining({
          groesseId,
          einzelwert: 0
        })
      ]),
      expect.anything()
    );
  });

  it('behandelt Datenbankfehler beim Erstellen einer Inventur', async () => {
    mocks.find.mockImplementation(() => {
      throw new Error('Inventar konnte nicht geladen werden');
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());
      const daten = await response.json();

      expect(response.status).toBe(500);
      expect(daten.fehler).toBe(
        'Inventur konnte nicht erstellt werden.'
      );

      expect(mocks.insertOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });


});
