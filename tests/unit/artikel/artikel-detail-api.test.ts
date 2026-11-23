
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
  updateOne: vi.fn(),
  updateMany: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn()
}));

vi.mock('../../../src/lib/server/mongodb', () => ({
  db: {
    collection: vi.fn((name: string) => ({
      findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
      find: (...args: unknown[]) => mocks.find(name, ...args),
      countDocuments: mocks.countDocuments,
      updateOne: (...args: unknown[]) => mocks.updateOne(name, ...args),
      updateMany: mocks.updateMany,
      deleteOne: (...args: unknown[]) => mocks.deleteOne(name, ...args),
      deleteMany: mocks.deleteMany
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
  GET, PATCH, DELETE
} from '../../../src/routes/api/artikel/[id]/+server';

const artikelId = new ObjectId().toString();
const kategorieId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const vereinId = 'verein-test';

const admin = { id: 'admin', rolle: 'admin', vereinId };
const mitglied = { id: 'mitglied', rolle: 'mitglied', vereinId };

function artikel() {
  return {
    _id: new ObjectId(artikelId),
    vereinId,
    name: 'Trainingsball',
    hatGroessen: false,
    menge: 10
  };
}

function eingabe() {
  return {
    name: 'Trainingsball Neu',
    kategorieId,
    lagerortId,
    menge: 15,
    einzelwert: 30,
    mindestbestand: 2,
    beschreibung: 'Test',
    hatGroessen: false
  };
}

function kontext(
  rolle: typeof admin | null = admin,
  id = artikelId,
  daten: unknown = eingabe()
) {
  return {
    params: { id },
    locals: { benutzer: rolle },
    request: new Request(
      `http://localhost/api/artikel/${id}`,
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
    if (name === 'artikel') return artikel();
    if (name === 'ausleihen' || name === 'meldungen' || name === 'vereinskleider_verkaeufe') return null;
    return { _id: new ObjectId() };
  });

  mocks.find.mockReturnValue({
    toArray: vi.fn().mockResolvedValue([])
  });

  mocks.countDocuments.mockResolvedValue(1);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });

  mocks.withTransaction.mockImplementation(
    async (callback: () => Promise<void>) => callback()
  );
  mocks.endSession.mockResolvedValue(undefined);
});

describe('ClubMatiq Artikel-Detailverwaltung', () => {

  it('lädt einen einzelnen Artikel', async () => {
    const response = await GET(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.name).toBe('Trainingsball');
    expect(daten._id).toBe(artikelId);
    expect(daten.varianten).toEqual([]);
  });

  it('verweigert GET ohne Anmeldung', async () => {
    const response = await GET(kontext(null));
    expect(response.status).toBe(401);
  });

  it('verweigert PATCH für Mitglieder', async () => {
    const response = await PATCH(kontext(mitglied));
    expect(response.status).toBe(403);
  });

  it('verweigert DELETE für Mitglieder', async () => {
    const response = await DELETE(kontext(mitglied));
    expect(response.status).toBe(403);
  });

  it('verhindert ungültige Artikel-IDs', async () => {
    const response = await GET(kontext(admin, 'ungueltig'));
    expect(response.status).toBe(400);
  });

  it('liefert 404 für nicht vorhandene Artikel', async () => {
    mocks.findOne.mockResolvedValue(null);

    const response = await GET(kontext());
    expect(response.status).toBe(404);
  });

  it('bearbeitet einen Artikel erfolgreich', async () => {
    const response = await PATCH(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);
    expect(daten.gesamtmenge).toBe(15);
    expect(mocks.updateOne).toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalled();
  });

  it('verhindert negative Bestände', async () => {
    const response = await PATCH(kontext(
      admin, artikelId, { ...eingabe(), menge: -2 }
    ));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert negative Mindestbestände', async () => {
    const response = await PATCH(kontext(
      admin, artikelId, { ...eingabe(), mindestbestand: -1 }
    ));

    expect(response.status).toBe(400);
  });

  it('verhindert leere Artikelbezeichnungen', async () => {
    const response = await PATCH(kontext(
      admin, artikelId, { ...eingabe(), name: '' }
    ));

    expect(response.status).toBe(400);
  });

  it('verhindert einen Wechsel des Grössentyps', async () => {
    const response = await PATCH(kontext(
      admin, artikelId, {
        ...eingabe(),
        hatGroessen: true,
        varianten: [{
          groesseId,
          menge: 5,
          einzelwert: 20,
          mindestbestand: 1
        }]
      }
    ));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Änderungen an fremden Artikeln', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') return null;
      return { _id: new ObjectId() };
    });

    const response = await PATCH(kontext());

    expect(response.status).toBe(404);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('löscht einen Artikel erfolgreich', async () => {
    const response = await DELETE(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.erfolg).toBe(true);
    expect(mocks.deleteMany).toHaveBeenCalled();
    expect(mocks.deleteOne).toHaveBeenCalled();
    expect(mocks.endSession).toHaveBeenCalled();
  });

  it('verhindert das Löschen bei bestehender Vereinskleider-Verkaufshistorie', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') return artikel();
      if (name === 'vereinskleider_verkaeufe') return { _id: new ObjectId() };
      return null;
    });

    const response = await DELETE(kontext());
    const daten = await response.json();

    expect(response.status).toBe(409);
    expect(daten.fehler).toContain('Vereinskleiderbestellung');
    expect(mocks.findOne).toHaveBeenCalledWith(
      'vereinskleider_verkaeufe',
      { vereinId, 'positionen.artikelId': artikelId }
    );
    expect(mocks.deleteOne).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('verhindert das Löschen bei vorhandenen Ausleihen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') return artikel();
      if (name === 'ausleihen') return { _id: new ObjectId() };
      return null;
    });

    const response = await DELETE(kontext());

    expect(response.status).toBe(409);
    expect(mocks.deleteOne).not.toHaveBeenCalled();
  });

  it('verhindert das Löschen bei Schadensmeldungen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') return artikel();
      if (name === 'meldungen') return { _id: new ObjectId() };
      return null;
    });

    const response = await DELETE(kontext());

    expect(response.status).toBe(409);
    expect(mocks.deleteOne).not.toHaveBeenCalled();
  });

  it('prüft beim Löschen die Vereinszugehörigkeit', async () => {
    const response = await DELETE(kontext());

    expect(mocks.findOne).toHaveBeenCalledWith(
      'artikel',
      {
        _id: new ObjectId(artikelId),
        vereinId
      }
    );
  });


  it('lädt Artikel mit Grössenvarianten', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { ...artikel(), hatGroessen: true };
      }
      return { _id: new ObjectId() };
    });

    mocks.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{
        _id: new ObjectId(),
        artikelId,
        groesseId,
        menge: 5,
        einzelwert: 30,
        mindestbestand: 2
      }])
    });

    const response = await GET(kontext());
    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.varianten).toHaveLength(1);
    expect(daten.varianten[0].menge).toBe(5);
    expect(daten.varianten[0].aktiv).toBe(true);
  });

  it('aktualisiert Artikel mit Grössenvarianten', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { ...artikel(), hatGroessen: true };
      }
      return { _id: new ObjectId() };
    });

    const response = await PATCH(kontext(
      admin,
      artikelId,
      {
        ...eingabe(),
        hatGroessen: true,
        varianten: [{
          groesseId,
          menge: 8,
          einzelwert: 35,
          mindestbestand: 2
        }]
      }
    ));

    const daten = await response.json();

    expect(response.status).toBe(200);
    expect(daten.gesamtmenge).toBe(8);
    expect(mocks.updateMany).toHaveBeenCalled();
    expect(mocks.updateOne).toHaveBeenCalledWith(
      'artikelvarianten',
      expect.objectContaining({ artikelId, groesseId, vereinId }),
      expect.objectContaining({
        $set: expect.objectContaining({
          menge: 8,
          aktiv: true
        })
      }),
      expect.objectContaining({ upsert: true })
    );
  });

  it('verhindert das Entfernen einer Grösse mit Lagerbestand', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { ...artikel(), hatGroessen: true };
      }
      return { _id: new ObjectId() };
    });

    const andereGroesseId = new ObjectId().toString();

    mocks.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{
        groesseId: andereGroesseId,
        menge: 4
      }])
    });

    const response = await PATCH(kontext(
      admin,
      artikelId,
      {
        ...eingabe(),
        hatGroessen: true,
        varianten: [{
          groesseId,
          menge: 5,
          einzelwert: 30,
          mindestbestand: 1
        }]
      }
    ));

    expect(response.status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert doppelte Grössen beim Bearbeiten', async () => {
    const variante = {
      groesseId,
      menge: 3,
      einzelwert: 30,
      mindestbestand: 1
    };

    const response = await PATCH(kontext(
      admin,
      artikelId,
      {
        ...eingabe(),
        hatGroessen: true,
        varianten: [variante, variante]
      }
    ));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('behandelt Fehler innerhalb einer Aktualisierungstransaktion', async () => {
    mocks.withTransaction.mockRejectedValue(
      new Error('Transaktion fehlgeschlagen')
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());

      expect(response.status).toBe(500);
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Fehler beim Löschen und schliesst die Session', async () => {
    mocks.deleteOne.mockResolvedValue({ deletedCount: 0 });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await DELETE(kontext());

      expect(response.status).toBe(500);
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('verhindert ungültige JSON-Daten beim Bearbeiten', async () => {
    for (const daten of [null, [], 'ungueltig', 123]) {
      const response = await PATCH(kontext(admin, artikelId, daten));

      expect(response.status).toBe(400);
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Artikel-IDs beim Bearbeiten und Löschen', async () => {
    const patchResponse = await PATCH(kontext(admin, 'ungueltig'));
    const deleteResponse = await DELETE(kontext(admin, 'ungueltig'));

    expect(patchResponse.status).toBe(400);
    expect(deleteResponse.status).toBe(400);
  });

  it('verhindert ungültige allgemeine Artikelangaben', async () => {
    const faelle = [
      { kategorieId: 'ungueltig' },
      { lagerortId: 'ungueltig' },
      { einzelwert: -1 },
      { einzelwert: '30' },
      { istVereinskleidung: 'ja' },
      { hatGroessen: 'ja' },
      { beschreibung: 123 },
      { mindestbestand: 1.5 }
    ];

    for (const aenderung of faelle) {
      const response = await PATCH(kontext(
        admin,
        artikelId,
        { ...eingabe(), ...aenderung }
      ));

      expect(response.status).toBe(400);
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Lieferanten-IDs', async () => {
    const response = await PATCH(kontext(
      admin,
      artikelId,
      {
        ...eingabe(),
        lieferantId: 'ungueltig'
      }
    ));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Lieferanten aus anderen Vereinen', async () => {
    const lieferantId = new ObjectId().toString();

    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') return artikel();
      if (name === 'lieferanten') return null;
      return { _id: new ObjectId() };
    });

    const response = await PATCH(kontext(
      admin,
      artikelId,
      { ...eingabe(), lieferantId }
    ));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Kategorien oder Lagerorte aus anderen Vereinen', async () => {
    for (const fehlendeSammlung of ['kategorien', 'lagerorte']) {
      mocks.findOne.mockImplementation(async (name: string) => {
        if (name === 'artikel') return artikel();
        if (name === fehlendeSammlung) return null;
        return { _id: new ObjectId() };
      });

      const response = await PATCH(kontext());

      expect(response.status).toBe(400);
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert ungültige Grössenvarianten beim Bearbeiten', async () => {
    const faelle = [
      [],
      [{ groesseId: 'ungueltig', menge: 2, einzelwert: 30, mindestbestand: 1 }],
      [{ groesseId, menge: -1, einzelwert: 30, mindestbestand: 1 }],
      [{ groesseId, menge: 2.5, einzelwert: 30, mindestbestand: 1 }],
      [{ groesseId, menge: 2, einzelwert: -1, mindestbestand: 1 }],
      [{ groesseId, menge: 2, einzelwert: 30, mindestbestand: -1 }]
    ];

    for (const varianten of faelle) {
      const response = await PATCH(kontext(
        admin,
        artikelId,
        {
          ...eingabe(),
          hatGroessen: true,
          varianten
        }
      ));

      expect(response.status).toBe(400);
    }

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('verhindert Grössen aus anderen Vereinen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { ...artikel(), hatGroessen: true };
      }
      return { _id: new ObjectId() };
    });

    mocks.countDocuments.mockResolvedValue(0);

    const response = await PATCH(kontext(
      admin,
      artikelId,
      {
        ...eingabe(),
        hatGroessen: true,
        varianten: [{
          groesseId,
          menge: 5,
          einzelwert: 30,
          mindestbestand: 1
        }]
      }
    ));

    expect(response.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('erkennt Bestandsänderungen während der Transaktion', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') {
        return { ...artikel(), hatGroessen: true };
      }
      return { _id: new ObjectId() };
    });

    const andereGroesseId = new ObjectId().toString();
    let abfragen = 0;

    mocks.find.mockImplementation(() => ({
      toArray: vi.fn().mockImplementation(async () => {
        abfragen++;

        // Vor der Transaktion noch kein Konflikt.
        if (abfragen === 1) return [];

        // Während der Transaktion hat eine
        // nicht ausgewählte Grösse wieder Bestand.
        return [{
          groesseId: andereGroesseId,
          menge: 3
        }];
      })
    }));

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext(
        admin,
        artikelId,
        {
          ...eingabe(),
          hatGroessen: true,
          varianten: [{
            groesseId,
            menge: 5,
            einzelwert: 30,
            mindestbestand: 1
          }]
        }
      ));

      expect(response.status).toBe(500);
      expect(mocks.endSession).toHaveBeenCalledOnce();
      expect(mocks.updateMany).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt fehlgeschlagene Artikelaktualisierungen', async () => {
    mocks.updateOne.mockResolvedValue({
      matchedCount: 0
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await PATCH(kontext());

      expect(response.status).toBe(500);
      expect(mocks.endSession).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Datenbankfehler beim Laden eines Artikels', async () => {
    mocks.findOne.mockRejectedValue(
      new Error('Datenbank nicht erreichbar')
    );

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await GET(kontext());
      const daten = await response.json();

      expect(response.status).toBe(500);
      expect(daten.fehler).toBe('Artikel konnte nicht geladen werden.');
    } finally {
      spy.mockRestore();
    }
  });

  it('behandelt Fehler beim Laden der Löschvoraussetzungen', async () => {
    mocks.findOne.mockImplementation(async (name: string) => {
      if (name === 'artikel') return artikel();
      if (name === 'ausleihen') {
        throw new Error('Datenbankfehler bei Ausleihen');
      }
      return null;
    });

    const spy = vi.spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const response = await DELETE(kontext());
      const daten = await response.json();

      expect(response.status).toBe(500);
      expect(daten.fehler).toBe(
        'Inventarartikel konnte nicht gelöscht werden.'
      );
      expect(mocks.deleteOne).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });


});
