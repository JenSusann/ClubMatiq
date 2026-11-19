
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
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

import { POST } from '../../src/routes/api/ausleihen/[id]/rueckgabe/+server';

const vereinId = 'verein-test';
const artikelId = new ObjectId().toString();
const ausleiheId = new ObjectId().toString();
const groesseId = new ObjectId().toString();

const admin = { id: 'admin', rolle: 'admin', vereinId };
const mitglied = { id: 'mitglied', rolle: 'mitglied', vereinId };

function ausleihe(
  aenderungen: Record<string, unknown> = {}
) {
  return {
    _id: new ObjectId(ausleiheId),
    vereinId,
    artikelId,
    groesseId: null,
    person: 'Max Muster',
    menge: 10,
    zurueckgegeben: 0,
    status: 'offen',
    ...aenderungen
  };
}

function kontext(
  benutzer: typeof admin | null = admin,
  menge: unknown = 3,
  id = ausleiheId
) {
  return {
    params: { id },
    locals: { benutzer },
    request: new Request(
      `http://localhost/api/ausleihen/${id}/rueckgabe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menge })
      }
    )
  } as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.findOne.mockResolvedValue(ausleihe());
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );

  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Materialrückgabe', () => {

  it('verweigert Rückgaben ohne Anmeldung', async () => {
    const response = await POST(kontext(null));
    expect(response.status).toBe(401);
  });

  it('verweigert Rückgaben ohne Verwaltungsberechtigung', async () => {
    const response = await POST(kontext(mitglied));
    expect(response.status).toBe(403);
  });

  it('verhindert ungültige Ausleihe-IDs', async () => {
    const response = await POST(kontext(admin, 3, 'ungueltig'));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Rückgabemenge 0', async () => {
    const response = await POST(kontext(admin, 0));
    expect(response.status).toBe(400);
  });

  it('verhindert negative Rückgabemengen', async () => {
    const response = await POST(kontext(admin, -2));
    expect(response.status).toBe(400);
  });

  it('verhindert Dezimalmengen', async () => {
    const response = await POST(kontext(admin, 1.5));
    expect(response.status).toBe(400);
  });

  it('erfasst eine Teilrückgabe', async () => {
    const response = await POST(kontext(admin, 3));
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);
    expect(daten.status).toBe('teilweise');
    expect(daten.zurueckgegeben).toBe(3);
    expect(daten.offen).toBe(7);
  });

  it('erfasst eine vollständige Rückgabe', async () => {
    const response = await POST(kontext(admin, 10));
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.status).toBe('abgeschlossen');
    expect(daten.zurueckgegeben).toBe(10);
    expect(daten.offen).toBe(0);
  });

  it('berücksichtigt bereits erfolgte Teilrückgaben', async () => {
    mocks.findOne.mockResolvedValue(
      ausleihe({ zurueckgegeben: 4, status: 'teilweise' })
    );

    const response = await POST(kontext(admin, 3));
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.zurueckgegeben).toBe(7);
    expect(daten.offen).toBe(3);
  });

  it('verhindert Rückgaben über die offene Menge hinaus', async () => {
    mocks.findOne.mockResolvedValue(
      ausleihe({ zurueckgegeben: 8 })
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, 3));

      expect(response.status).toBe(400);
      expect(mocks.updateOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Rückgaben abgeschlossener Ausleihen', async () => {
    mocks.findOne.mockResolvedValue(
      ausleihe({ status: 'abgeschlossen', zurueckgegeben: 10 })
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, 1));

      expect(response.status).toBe(400);
      expect(mocks.updateOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Rückgaben fremder Ausleihen', async () => {
    mocks.findOne.mockResolvedValue(null);

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);
      expect(mocks.updateOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('erhöht den Artikelbestand bei einer Rückgabe', async () => {
    const response = await POST(kontext(admin, 3));

    expect(response.status).toBe(200);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({ vereinId }),
      { $inc: { menge: 3 } },
      expect.anything()
    );
  });

  it('erhöht Variantenbestand und Gesamtbestand', async () => {
    mocks.findOne.mockResolvedValue(
      ausleihe({ groesseId })
    );

    const response = await POST(kontext(admin, 3));

    expect(response.status).toBe(200);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikelvarianten',
      expect.objectContaining({
        artikelId,
        groesseId,
        vereinId
      }),
      { $inc: { menge: 3 } },
      expect.anything()
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.objectContaining({ vereinId }),
      { $inc: { menge: 3 } },
      expect.anything()
    );
  });

  it('verhindert doppelte Rückbuchungen bei konkurrierenden Änderungen', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => {
      if (name === 'ausleihen') return { modifiedCount: 0 };
      return { modifiedCount: 1 };
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);

      expect(mocks.updateOne).not.toHaveBeenCalledWith(
        'artikel',
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('schliesst die Datenbank-Session nach erfolgreicher Rückgabe', async () => {
    const response = await POST(kontext());

    expect(response.status).toBe(200);
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('schliesst die Session auch nach einem Fehler', async () => {
    mocks.withTransaction.mockRejectedValue(
      new Error('Transaktion fehlgeschlagen')
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Rückgaben, wenn die Grössenvariante nicht aktualisiert werden kann', async () => {
    mocks.findOne.mockResolvedValue(
      ausleihe({ groesseId })
    );

    mocks.updateOne.mockImplementation(async (name: string) => ({
      modifiedCount: name === 'artikelvarianten' ? 0 : 1
    }));

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, 3));
      const daten = await response.json();

      expect(response.status).toBe(400);
      expect(daten.fehler).toBe(
        'Artikelgrösse wurde nicht gefunden.'
      );

      expect(mocks.updateOne).not.toHaveBeenCalledWith(
        'artikel',
        expect.anything(),
        expect.anything(),
        expect.anything()
      );

      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Rückgaben, wenn der Gesamtbestand nicht aktualisiert werden kann', async () => {
    mocks.findOne.mockResolvedValue(
      ausleihe({ groesseId })
    );

    mocks.updateOne.mockImplementation(async (name: string) => ({
      modifiedCount: name === 'artikel' ? 0 : 1
    }));

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, 3));
      const daten = await response.json();

      expect(response.status).toBe(400);
      expect(daten.fehler).toBe(
        'Artikel wurde nicht gefunden.'
      );

      expect(mocks.updateOne).toHaveBeenCalledWith(
        'artikelvarianten',
        expect.anything(),
        { $inc: { menge: 3 } },
        expect.anything()
      );

      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Rückgaben ohne Grössen bei fehlgeschlagener Bestandsänderung', async () => {
    mocks.updateOne.mockImplementation(async (name: string) => ({
      modifiedCount: name === 'artikel' ? 0 : 1
    }));

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, 3));
      const daten = await response.json();

      expect(response.status).toBe(400);
      expect(daten.fehler).toBe(
        'Artikel wurde nicht gefunden.'
      );

      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt unerwartete Transaktionsfehler', async () => {
    mocks.withTransaction.mockRejectedValue(
      'Unbekannter Datenbankfehler'
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, 3));
      const daten = await response.json();

      expect(response.status).toBe(400);
      expect(daten.fehler).toBe(
        'Materialrückgabe konnte nicht gespeichert werden.'
      );

      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });


});
