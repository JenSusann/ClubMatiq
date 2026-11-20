
import 'dotenv/config';

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { MongoClient, ObjectId } from 'mongodb';

// Die produktive MongoDB-Verbindung wird für diese
// Testdatei durch eine echte Testverbindung ersetzt.
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');

  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error('MONGODB_TEST_URI fehlt.');
  }

  const client = new MongoClient(uri);

  return {
    client,
    db: client.db('clubmatiq_test')
  };
});

import {
  client,
  db
} from '../../../src/lib/server/mongodb';

import {
  GET as artikelListe,
  POST as artikelErstellen
} from '../../../src/routes/api/artikel/+server';

import {
  GET as artikelDetails
} from '../../../src/routes/api/artikel/[id]/+server';

import {
  GET as ausleihenListe,
  POST as ausleiheErstellen
} from '../../../src/routes/api/ausleihen/+server';

// Jeder Testlauf erhält einen eigenen Verein.
// So werden keine fremden Datensätze verändert.
const vereinId = new ObjectId().toString();
const fremderVereinId = new ObjectId().toString();

const kategorieId = new ObjectId();
const lagerortId = new ObjectId();

let artikelId = '';

const admin = {
  id: new ObjectId().toString(),
  vereinId,
  rolle: 'admin'
};

const mitglied = {
  ...admin,
  rolle: 'mitglied'
};

function ereignis(
  benutzer: unknown,
  daten?: unknown,
  id?: string
) {
  return {
    locals: { benutzer },
    params: { id },
    request: new Request(
      'http://localhost/api/test',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(daten ?? {})
      }
    )
  };
}

describe('ClubMatiq API – echte MongoDB', () => {
  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') {
      throw new Error(
        'Integrationstests dürfen nur clubmatiq_test verwenden.'
      );
    }

    await client.connect();

    // Benötigte Stammdaten anlegen
    await db.collection('kategorien').insertOne({
      _id: kategorieId,
      vereinId,
      name: 'Testkategorie'
    });

    await db.collection('lagerorte').insertOne({
      _id: lagerortId,
      vereinId,
      name: 'Testlager'
    });
  });

  afterAll(async () => {
    try {
      // Nur Datensätze dieses Testvereins entfernen.
      for (const name of [
        'ausleihen',
        'artikelvarianten',
        'artikel',
        'kategorien',
        'lagerorte'
      ]) {
        await db.collection(name).deleteMany({
          vereinId
        });
      }
    } finally {
      await client.close();
    }
  });

  it('erstellt einen Inventarartikel über die API', async () => {
    const antwort = await artikelErstellen(
      ereignis(admin, {
        name: 'Integrationstest Trainingsball',
        kategorieId: kategorieId.toString(),
        lagerortId: lagerortId.toString(),
        menge: 10,
        mindestbestand: 2,
        einzelwert: 25,
        beschreibung: 'Automatischer Integrationstest',
        hatGroessen: false,
        istVereinskleidung: false
      }) as never
    );

    expect(antwort.status).toBe(201);

    const ergebnis = await antwort.json();
    artikelId = ergebnis.artikelId;

    expect(ergebnis.erfolg).toBe(true);
    expect(ergebnis.gesamtmenge).toBe(10);

    const gespeichert = await db
      .collection('artikel')
      .findOne({
        _id: new ObjectId(artikelId),
        vereinId
      });

    expect(gespeichert?.name).toBe(
      'Integrationstest Trainingsball'
    );
    expect(gespeichert?.menge).toBe(10);
  });

  it('liest die Inventarliste des Vereins', async () => {
    const antwort = await artikelListe(
      ereignis(admin) as never
    );

    expect(antwort.status).toBe(200);

    const daten = await antwort.json();

    expect(Array.isArray(daten)).toBe(true);
    expect(
      daten.some(
        (artikel: { _id: string }) =>
          artikel._id === artikelId
      )
    ).toBe(true);
  });

  it('liest einen einzelnen Artikel', async () => {
    const antwort = await artikelDetails(
      ereignis(admin, undefined, artikelId) as never
    );

    expect(antwort.status).toBe(200);

    const daten = await antwort.json();

    expect(daten._id).toBe(artikelId);
    expect(daten.menge).toBe(10);
  });

  it('verhindert Zugriff auf Artikel anderer Vereine', async () => {
    const fremderBenutzer = {
      ...admin,
      vereinId: fremderVereinId
    };

    const antwort = await artikelDetails(
      ereignis(
        fremderBenutzer,
        undefined,
        artikelId
      ) as never
    );

    expect(antwort.status).toBe(404);
  });

  it('verhindert das Erstellen durch Mitglieder', async () => {
    const antwort = await artikelErstellen(
      ereignis(mitglied, {
        name: 'Nicht erlaubter Artikel'
      }) as never
    );

    expect(antwort.status).toBe(403);
  });

  it('verhindert Zugriff ohne Anmeldung', async () => {
    const antwort = await artikelListe(
      ereignis(null) as never
    );

    expect(antwort.status).toBe(401);
  });

  it('verweigert Artikel ohne gültigen Namen', async () => {
    const antwort = await artikelErstellen(
      ereignis(admin, {
        name: '',
        kategorieId: kategorieId.toString(),
        lagerortId: lagerortId.toString(),
        menge: 10,
        einzelwert: 25,
        mindestbestand: 0,
        hatGroessen: false
      }) as never
    );

    expect(antwort.status).toBe(400);
  });

  it('erfasst eine Ausleihe und reduziert den Bestand', async () => {
    const antwort = await ausleiheErstellen(
      ereignis(admin, {
        artikelId,
        person: 'Testperson',
        menge: 3,
        ausleihdatum: '2026-11-19',
        rueckgabedatum: '2026-11-26',
        bemerkung: 'Integrationstest'
      }) as never
    );

    expect(antwort.status).toBe(201);

    const ergebnis = await antwort.json();
    expect(ergebnis.erfolg).toBe(true);

    const gespeichert = await db
      .collection('artikel')
      .findOne({
        _id: new ObjectId(artikelId),
        vereinId
      });

    expect(gespeichert?.menge).toBe(7);

    const ausleihe = await db
      .collection('ausleihen')
      .findOne({
        _id: new ObjectId(ergebnis.ausleiheId),
        vereinId
      });

    expect(ausleihe?.menge).toBe(3);
    expect(ausleihe?.status).toBe('offen');
  });

  it('verhindert eine Ausleihe bei zu wenig Bestand', async () => {
    const antwort = await ausleiheErstellen(
      ereignis(admin, {
        artikelId,
        person: 'Testperson',
        menge: 100,
        ausleihdatum: '2026-11-19',
        rueckgabedatum: '2026-11-26'
      }) as never
    );

    expect(antwort.status).toBe(400);

    const gespeichert = await db
      .collection('artikel')
      .findOne({
        _id: new ObjectId(artikelId),
        vereinId
      });

    expect(gespeichert?.menge).toBe(7);
  });

  it('liest die Ausleihen des Vereins', async () => {
    const antwort = await ausleihenListe(
      ereignis(admin) as never
    );

    expect(antwort.status).toBe(200);

    const daten = await antwort.json();

    expect(
      daten.some(
        (ausleihe: { artikelId: string }) =>
          ausleihe.artikelId === artikelId
      )
    ).toBe(true);
  });
});
