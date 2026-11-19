
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

vi.mock('../../src/lib/server/mongodb', () => ({
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

import { GET, POST } from '../../src/routes/api/ausleihen/+server';

const vereinId = 'verein-test';
const artikelId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const ausleiheId = new ObjectId().toString();

const admin = { id: 'admin', rolle: 'admin', vereinId };
const mitglied = { id: 'mitglied', rolle: 'mitglied', vereinId };

function eingabe() {
  return {
    artikelId,
    person: 'Max Muster',
    menge: 3,
    ausleihdatum: '2026-11-19',
    rueckgabedatum: '2026-11-26',
    bemerkung: 'Für das Training'
  };
}

function kontext(
  benutzer: typeof admin | null = admin,
  daten: unknown = eingabe()
) {
  return {
    locals: { benutzer },
    request: new Request('http://localhost/api/ausleihen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten)
    })
  } as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.findOne.mockResolvedValue({
    _id: new ObjectId(artikelId),
    vereinId,
    hatGroessen: false,
    menge: 10
  });

  mocks.find.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([])
    })
  });

  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });

  mocks.insertOne.mockResolvedValue({
    insertedId: new ObjectId(ausleiheId)
  });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );

  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Ausleihverwaltung', () => {

  it('lädt die Ausleihen des eigenen Vereins', async () => {
    const response = await GET(kontext());
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      'ausleihen',
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

  it('erfasst eine gültige Ausleihe', async () => {
    const response = await POST(kontext());
    const daten = await response.json();

    expect(response.status).toBe(201);
    expect(daten.erfolg).toBe(true);
    expect(daten.ausleiheId).toBe(ausleiheId);
    expect(mocks.insertOne).toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalledOnce();
  });

  it('reduziert den Bestand um die ausgeliehene Menge', async () => {
    const response = await POST(kontext());

    expect(response.status).toBe(201);
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

  it('verhindert eine Ausleihe mit Menge 0', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(), menge: 0
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert negative Ausleihmengen', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(), menge: -2
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert fehlende Personennamen', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(), person: ''
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert ungültige Artikel-IDs', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(), artikelId: 'ungueltig'
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert ein Rückgabedatum vor dem Ausleihdatum', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(),
      rueckgabedatum: '2026-11-01'
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert ungültige Datumsangaben', async () => {
    const response = await POST(kontext(admin, {
      ...eingabe(),
      ausleihdatum: '2026-02-30'
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert Ausleihen bei zu geringem Bestand', async () => {
    mocks.updateOne.mockResolvedValue({ modifiedCount: 0 });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);
      expect(mocks.insertOne).not.toHaveBeenCalled();
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Ausleihen fremder Artikel', async () => {
    mocks.findOne.mockResolvedValue(null);

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);
      expect(mocks.insertOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('erfasst eine Ausleihe mit Grössenvariante', async () => {
    mocks.findOne.mockResolvedValue({
      _id: new ObjectId(artikelId),
      vereinId,
      hatGroessen: true,
      menge: 10
    });

    const response = await POST(kontext(admin, {
      ...eingabe(), groesseId
    }));

    expect(response.status).toBe(201);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikelvarianten',
      expect.objectContaining({
        artikelId,
        groesseId,
        vereinId
      }),
      { $inc: { menge: -3 } },
      expect.anything()
    );

    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikel',
      expect.anything(),
      { $inc: { menge: -3 } },
      expect.anything()
    );
  });

  it('verhindert fehlende Grössen bei Kleidungsartikeln', async () => {
    mocks.findOne.mockResolvedValue({
      _id: new ObjectId(artikelId),
      hatGroessen: true
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);
      expect(mocks.insertOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Datenbankfehler beim Laden der Ausleihen', async () => {
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
        'Ausleihen konnten nicht geladen werden.'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert ungültige Ausleihdaten', async () => {
    for (const daten of [null, [], 'ungueltig', 123]) {
      const response = await POST(kontext(admin, daten));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Ungültige Ausleihdaten.'
      );
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Bemerkungen und Ausleihmengen', async () => {
    const faelle = [
      { bemerkung: 123 },
      { menge: 1.5 },
      { menge: '3' },
      { person: '   ' }
    ];

    for (const aenderung of faelle) {
      const response = await POST(kontext(admin, {
        ...eingabe(),
        ...aenderung
      }));

      expect(response.status).toBe(400);
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Grössenangaben bei Artikeln ohne Grössen', async () => {
    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, {
        ...eingabe(),
        groesseId
      }));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Dieser Artikel hat keine Grössen.'
      );
      expect(mocks.insertOne).not.toHaveBeenCalled();
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert ungültige Grössen-IDs bei Kleidungsartikeln', async () => {
    mocks.findOne.mockResolvedValue({
      _id: new ObjectId(artikelId),
      vereinId,
      hatGroessen: true,
      menge: 10
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, {
        ...eingabe(),
        groesseId: 'ungueltig'
      }));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Bitte eine gültige Grösse auswählen.'
      );
      expect(mocks.insertOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert Ausleihen bei fehlgeschlagener Gesamtbestandsänderung', async () => {
    mocks.findOne.mockResolvedValue({
      _id: new ObjectId(artikelId),
      vereinId,
      hatGroessen: true,
      menge: 10
    });

    mocks.updateOne.mockImplementation(
      async (name: string) => ({
        modifiedCount: name === 'artikelvarianten' ? 1 : 0
      })
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, {
        ...eingabe(),
        groesseId
      }));

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Gesamtbestand konnte nicht aktualisiert werden.'
      );
      expect(mocks.insertOne).not.toHaveBeenCalled();
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Datenbankfehler beim Speichern einer Ausleihe', async () => {
    mocks.insertOne.mockRejectedValue(
      new Error('Speichern fehlgeschlagen')
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext());

      expect(response.status).toBe(400);
      expect((await response.json()).fehler).toBe(
        'Speichern fehlgeschlagen'
      );
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('speichert eine Ausleihe ohne optionale Bemerkung', async () => {
    const { bemerkung, ...datenOhneBemerkung } = eingabe();

    const response = await POST(kontext(
      admin,
      datenOhneBemerkung
    ));

    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledWith(
      'ausleihen',
      expect.objectContaining({
        vereinId,
        artikelId,
        bemerkung: '',
        groesseId: null,
        status: 'offen'
      }),
      expect.anything()
    );
  });

});
