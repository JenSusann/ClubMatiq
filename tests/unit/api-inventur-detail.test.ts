
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  find: vi.fn(),
  updateOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
      find: (...args: unknown[]) => mocks.find(name, ...args),
      updateOne: (...args: unknown[]) => mocks.updateOne(name, ...args)
    }))
  },
  client: {
    startSession: () => ({
      withTransaction: mocks.withTransaction,
      endSession: mocks.endSession
    })
  }
}));

import {
  GET, PATCH
} from '../../src/routes/api/inventuren/[id]/+server';

const vereinId = 'verein-test';
const inventurId = new ObjectId().toString();
const positionId = new ObjectId().toString();

const admin = { id: 'admin', rolle: 'admin', vereinId };
const mitglied = { id: 'mitglied', rolle: 'mitglied', vereinId };

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
    _id: new ObjectId(positionId),
    inventurId,
    vereinId,
    artikelName: 'Trainingsball',
    sollBestand: 10,
    istBestand: null,
    bemerkung: '',
    ...aenderungen
  };
}

function kontext(
  benutzer: typeof admin | null = admin,
  daten: unknown = { positionId, istBestand: 8 },
  id = inventurId
) {
  return {
    params: { id },
    locals: { benutzer },
    request: new Request(
      `http://localhost/api/inventuren/${id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten)
      }
    )
  } as Parameters<typeof PATCH>[0];
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.findOne.mockImplementation(async (name: string) => {
    if (name === 'inventuren') return inventur();
    if (name === 'inventurpositionen') return position();
    return null;
  });

  mocks.find.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([position()])
    })
  });

  mocks.updateOne.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1
  });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );

  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Inventurzählung', () => {

  it('lädt eine Inventur mit Positionen', async () => {
    const response = await GET(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.inventur.version).toBe(2);
    expect(daten.positionen).toHaveLength(1);
  });

  it('berechnet Differenzen beim Laden', async () => {
    mocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          position({ istBestand: 7 })
        ])
      })
    });

    const response = await GET(kontext());
    const daten = await response.json();

    expect(daten.positionen[0].differenz).toBe(-3);
  });

  it('verweigert GET ohne Anmeldung', async () => {
    const response = await GET(kontext(null));
    expect(response.status).toBe(401);
  });

  it('verweigert PATCH ohne Anmeldung', async () => {
    const response = await PATCH(kontext(null));
    expect(response.status).toBe(401);
  });

  it('verhindert ungültige Inventur-IDs', async () => {
    const response = await PATCH(kontext(
      admin,
      { positionId, istBestand: 8 },
      'ungueltig'
    ));

    expect(response.status).toBe(400);
  });

  it('verhindert ungültige Positions-IDs', async () => {
    const response = await PATCH(kontext(admin, {
      positionId: 'ungueltig',
      istBestand: 8
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert negative Ist-Bestände', async () => {
    const response = await PATCH(kontext(admin, {
      positionId,
      istBestand: -1
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert Dezimalbestände', async () => {
    const response = await PATCH(kontext(admin, {
      positionId,
      istBestand: 2.5
    }));

    expect(response.status).toBe(400);
  });

  it('speichert eine Inventurzählung und berechnet die Differenz', async () => {
    const response = await PATCH(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);
    expect(daten.istBestand).toBe(8);
    expect(daten.differenz).toBe(-2);
    expect(daten.version).toBe(3);
  });

  it('erlaubt das Zurücksetzen einer Zählung auf null', async () => {
    const response = await PATCH(kontext(admin, {
      positionId,
      istBestand: null
    }));

    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.istBestand).toBeNull();
    expect(daten.differenz).toBeNull();
  });

  it('verhindert Änderungen an abgeschlossenen Inventuren', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') {
        return inventur({ status: 'abgeschlossen' });
      }
      return position();
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());

      expect(response.status).toBe(409);
      expect(mocks.updateOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Änderungen bei Versionskonflikten', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') {
        return { modifiedCount: 0 };
      }
      return { matchedCount: 1, modifiedCount: 1 };
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());

      expect(response.status).toBe(409);
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert das Speichern fremder Inventurpositionen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') return inventur();
      return null;
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());

      expect(response.status).toBe(409);
      expect(mocks.updateOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert ungültige Inventur-IDs beim Laden', async () => {
    const response = await GET(kontext(
      admin,
      undefined,
      'ungueltig'
    ));

    expect(response.status).toBe(400);
    expect((await response.json()).fehler).toBe(
      'Ungültige Inventur-ID.'
    );
  });

  it('liefert 404 für nicht vorhandene Inventuren', async () => {
    mocks.findOne.mockResolvedValue(null);

    const response = await GET(kontext());
    const daten = await response.json();

    expect(response.status).toBe(404);
    expect(daten.fehler).toBe('Inventur nicht gefunden.');
  });

  it('behandelt Datenbankfehler beim Laden einer Inventur', async () => {
    mocks.findOne.mockRejectedValue(
      new Error('Datenbank nicht erreichbar')
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await GET(kontext());

      expect(response.status).toBe(500);
      expect((await response.json()).fehler).toBe(
        'Inventur konnte nicht geladen werden.'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('verwendet Version 0 bei Inventuren ohne Versionsnummer', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') {
        return inventur({ version: null });
      }
      return position();
    });

    const response = await GET(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.inventur.version).toBe(0);
  });

  it('verhindert ungültige Eingabedaten', async () => {
    for (const daten of [null, [], 'ungueltig', 123]) {
      const response = await PATCH(kontext(admin, daten));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Ungültige Eingabedaten.'
      );
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Bemerkungen', async () => {
    const faelle = [
      { bemerkung: 123 },
      { bemerkung: null },
      { bemerkung: 'A'.repeat(1001) }
    ];

    for (const aenderung of faelle) {
      const response = await PATCH(kontext(admin, {
        positionId,
        istBestand: 8,
        ...aenderung
      }));

      expect(response.status).toBe(400);
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('speichert eine bereinigte Bemerkung', async () => {
    const response = await PATCH(kontext(admin, {
      positionId,
      istBestand: 8,
      bemerkung: '  Zwei Bälle fehlen  '
    }));

    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.bemerkung).toBe('Zwei Bälle fehlen');

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'inventurpositionen',
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          bemerkung: 'Zwei Bälle fehlen'
        })
      }),
      expect.anything()
    );
  });

  it('verhindert Änderungen an nicht vorhandenen Inventuren', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') return null;
      return position();
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());

      expect(response.status).toBe(409);
      expect((await response.json()).fehler).toBe(
        'Inventur nicht gefunden.'
      );

      expect(mocks.updateOne).not.toHaveBeenCalled();
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert das Speichern bei fehlgeschlagener Positionsaktualisierung', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => {
      if (name === 'inventurpositionen') {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      return { matchedCount: 1, modifiedCount: 1 };
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());
      const daten = await response.json();

      expect(response.status).toBe(409);
      expect(daten.fehler).toBe(
        'Inventurposition konnte nicht gespeichert werden.'
      );
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt unerwartete Transaktionsfehler', async () => {
    mocks.withTransaction.mockRejectedValue(
      'Unbekannter Transaktionsfehler'
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());
      const daten = await response.json();

      expect(response.status).toBe(409);
      expect(daten.fehler).toBe(
        'Inventurposition konnte nicht gespeichert werden.'
      );
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert eine erfolgreiche Antwort ohne gespeichertes Ergebnis', async () => {
    mocks.withTransaction.mockResolvedValue(undefined);

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());
      const daten = await response.json();

      expect(response.status).toBe(409);
      expect(daten.fehler).toBe(
        'Inventurposition konnte nicht gespeichert werden.'
      );
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verwendet Version 1 beim Speichern einer Inventur ohne Version', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'inventuren') {
        return inventur({ version: null });
      }
      return position();
    });

    const response = await PATCH(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.version).toBe(1);
  });


});
