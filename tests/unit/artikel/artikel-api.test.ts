
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  insertOne: vi.fn(),
  journal: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  insertMany: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn()
}));

vi.mock('../../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      find: mocks.find,
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
      countDocuments: mocks.countDocuments,
      insertOne: name === 'lagerbewegungen' ? mocks.journal : mocks.insertOne,
      insertMany: mocks.insertMany,
      deleteOne: mocks.deleteOne,
      deleteMany: mocks.deleteMany
    }))
  },
  client: { startSession: () => ({ withTransaction: mocks.withTransaction, endSession: mocks.endSession }) }
}));

import { GET, POST } from '../../../src/routes/api/artikel/+server';

const vereinId = 'verein-test';
const kategorieId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const artikelId = new ObjectId().toString();
const groesseId = new ObjectId().toString();

const admin = {
  id: 'admin-test',
  rolle: 'admin',
  vereinId
};

const mitglied = {
  id: 'mitglied-test',
  rolle: 'mitglied',
  vereinId
};

function kontext(
  benutzer: typeof admin | null,
  daten?: unknown
) {
  return {
    locals: { benutzer },
    request: new Request('http://localhost/api/artikel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten)
    })
  } as Parameters<typeof POST>[0];
}

function gueltigerArtikel() {
  return {
    name: 'Trainingsball',
    kategorieId,
    lagerortId,
    menge: 10,
    einzelwert: 25,
    mindestbestand: 2,
    beschreibung: 'Testartikel',
    hatGroessen: false,
    istVereinskleidung: false
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.withTransaction.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  mocks.endSession.mockResolvedValue(undefined);
  mocks.journal.mockResolvedValue({ acknowledged: true });

  mocks.findOne.mockResolvedValue({ _id: new ObjectId() });
  mocks.countDocuments.mockResolvedValue(1);
  mocks.insertOne.mockResolvedValue({
    insertedId: new ObjectId(artikelId)
  });
  mocks.insertMany.mockResolvedValue({ acknowledged: true });
});

describe('ClubMatiq Inventarverwaltung', () => {

  it('verweigert nicht angemeldeten Benutzern das Lesen', async () => {
    const response = await GET(kontext(null));
    expect(response.status).toBe(401);
  });

  it('verweigert Mitgliedern das Erstellen von Artikeln', async () => {
    const response = await POST(
      kontext(mitglied, gueltigerArtikel())
    );
    expect(response.status).toBe(403);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('lädt nur Inventarartikel des eigenen Vereins', async () => {
    const toArray = vi.fn().mockResolvedValue([
      { _id: new ObjectId(artikelId), name: 'Trainingsball' }
    ]);
    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    const response = await GET(kontext(admin));
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({ vereinId });
    expect(sort).toHaveBeenCalledWith({ name: 1 });
    expect(daten[0]._id).toBe(artikelId);
    expect(daten[0].lieferantId).toBeNull();
  });

  it('erstellt einen gültigen Inventarartikel', async () => {
    const response = await POST(
      kontext(admin, gueltigerArtikel())
    );
    const daten = await response.json();

    expect(response.status).toBe(201);
    expect(daten.erfolg).toBe(true);
    expect(daten.gesamtmenge).toBe(10);

    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        vereinId,
        name: 'Trainingsball',
        menge: 10,
        einzelwert: 25,
        mindestbestand: 2
      }), expect.objectContaining({ session: expect.anything() })
    );
    expect(mocks.journal).toHaveBeenCalledWith(expect.objectContaining({ artikelId, vereinId, art: 'anlage', mengeDelta: 10, groesseId: null }), expect.objectContaining({ session: expect.anything() }));
  });

  it('verhindert Artikel ohne Namen', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      name: ''
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert negative Bestände', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      menge: -5
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert negative Einzelwerte', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      einzelwert: -20
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert negative Mindestbestände', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      mindestbestand: -1
    }));

    expect(response.status).toBe(400);
  });

  it('verhindert doppelte Grössenvarianten', async () => {
    const variante = {
      groesseId,
      menge: 5,
      einzelwert: 30,
      mindestbestand: 1
    };

    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      hatGroessen: true,
      varianten: [variante, variante]
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('speichert Artikel mit Grössenvarianten', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      hatGroessen: true,
      varianten: [{
        groesseId,
        menge: 7,
        einzelwert: 35,
        mindestbestand: 2
      }]
    }));

    const daten = await response.json();

    expect(response.status).toBe(201);
    expect(daten.gesamtmenge).toBe(7);
    expect(mocks.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        artikelId,
        groesseId,
        menge: 7
      })
    ], expect.objectContaining({ session: expect.anything() }));
    expect(mocks.journal).toHaveBeenCalledWith(expect.objectContaining({ artikelId, groesseId, mengeDelta: 7 }), expect.objectContaining({ session: expect.anything() }));
  });

  it('verhindert Kategorien aus anderen Vereinen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'kategorien') return null;
      return { _id: new ObjectId() };
    });

    const response = await POST(
      kontext(admin, gueltigerArtikel())
    );

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('liefert HTTP 500 bei Datenbankfehlern', async () => {
    mocks.findOne.mockRejectedValue(new Error('DB nicht erreichbar'));

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(
        kontext(admin, gueltigerArtikel())
      );

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });


  it('verhindert ungültige Lieferanten-IDs', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      lieferantId: 'ungueltig'
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Lieferanten aus anderen Vereinen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'lieferanten') return null;
      return { _id: new ObjectId() };
    });

    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      lieferantId: new ObjectId().toString()
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Artikel mit ungültigen Grössen', async () => {
    mocks.countDocuments.mockResolvedValue(0);

    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      hatGroessen: true,
      varianten: [{
        groesseId,
        menge: 5,
        einzelwert: 30,
        mindestbestand: 1
      }]
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Grössenvarianten mit negativem Bestand', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      hatGroessen: true,
      varianten: [{
        groesseId,
        menge: -3,
        einzelwert: 30,
        mindestbestand: 1
      }]
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertMany).not.toHaveBeenCalled();
  });

  it('verhindert Artikel mit fehlenden Grössenvarianten', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      hatGroessen: true,
      varianten: []
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Vereinskleider-Kennzeichnungen', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      istVereinskleidung: 'ja'
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Beschreibungen', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      beschreibung: 123
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('bricht die Anlagetransaktion bei Variantenfehlern ab', async () => {
    mocks.insertMany.mockRejectedValue(
      new Error('Varianten konnten nicht gespeichert werden')
    );

    mocks.deleteMany.mockResolvedValue({ deletedCount: 1 });
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await POST(kontext(admin, {
        ...gueltigerArtikel(),
        hatGroessen: true,
        varianten: [{
          groesseId,
          menge: 5,
          einzelwert: 30,
          mindestbestand: 1
        }]
      }));

      expect(response.status).toBe(500);

      expect(mocks.withTransaction).toHaveBeenCalledOnce();
      expect(mocks.insertMany).toHaveBeenCalledOnce();
      expect(mocks.journal).not.toHaveBeenCalled();
      expect(mocks.deleteMany).not.toHaveBeenCalled();
      expect(mocks.deleteOne).not.toHaveBeenCalled();
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Datenbankfehler beim Laden von Artikeln', async () => {
    const toArray = vi.fn().mockRejectedValue(
      new Error('Datenbank nicht erreichbar')
    );

    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await GET(kontext(admin));
      const daten = await response.json();

      expect(response.status).toBe(500);
      expect(daten.fehler).toBe(
        'Inventarartikel konnten nicht geladen werden.'
      );
    } finally {
      spy.mockRestore();
    }
  });


  it('verhindert ungültige JSON-Artikeldaten', async () => {
    const ungueltigeEingaben = [
      null,
      [],
      'ungueltig',
      123
    ];

    for (const eingabe of ungueltigeEingaben) {
      const response = await POST(kontext(admin, eingabe));
      const daten = await response.json();

      expect(response.status).toBe(400);
      expect(daten.fehler).toBe('Ungültige Artikeldaten.');
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });


  it('verhindert ungültige Artikeldaten', async () => {
    for (const eingabe of [null, [], 'ungueltig', 123]) {
      const response = await POST(kontext(admin, eingabe));
      const daten = await response.json();

      expect(response.status).toBe(400);
      expect(daten.fehler).toBe('Ungültige Artikeldaten.');
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Artikelnamen, die nur aus Leerzeichen bestehen', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      name: '   '
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert Artikel ohne gültige Kategorie oder Lagerort', async () => {
    for (const aenderung of [
      { kategorieId: 'ungueltig' },
      { lagerortId: 'ungueltig' },
      { kategorieId: null },
      { lagerortId: null }
    ]) {
      const response = await POST(kontext(admin, {
        ...gueltigerArtikel(),
        ...aenderung
      }));

      expect(response.status).toBe(400);
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Angaben zu Grössenvarianten', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      hatGroessen: 'ja'
    }));

    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Einzelwerte und Mindestbestände', async () => {
    for (const aenderung of [
      { einzelwert: '25' },
      { einzelwert: -1 },
      { mindestbestand: 1.5 },
      { mindestbestand: null }
    ]) {
      const response = await POST(kontext(admin, {
        ...gueltigerArtikel(),
        ...aenderung
      }));

      expect(response.status).toBe(400);
    }

    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('erlaubt Artikel ohne bekannten Einzelwert', async () => {
    const response = await POST(kontext(admin, {
      ...gueltigerArtikel(),
      einzelwert: null
    }));

    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ einzelwert: null }), expect.objectContaining({ session: expect.anything() })
    );
  });

  it('lädt Artikel mit hinterlegter Lieferanten-ID', async () => {
    const lieferantId = new ObjectId().toString();

    const toArray = vi.fn().mockResolvedValue([
      {
        _id: new ObjectId(artikelId),
        name: 'Trainingsshirt',
        lieferantId
      }
    ]);

    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    const response = await GET(kontext(admin));
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten[0].lieferantId).toBe(lieferantId);
  });


});
