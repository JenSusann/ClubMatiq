import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt.');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';
import { POST as ausleihen } from '../../../src/routes/api/ausleihen/+server';
import { POST as rueckgeben } from '../../../src/routes/api/ausleihen/[id]/rueckgabe/+server';

describe('Ausleihen und Rückgaben',()=>{
const vereinId = new ObjectId().toString();
const fremderVereinId = new ObjectId().toString();
const artikelId = new ObjectId();
const fremderArtikelId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };

function event(benutzer: unknown, daten: unknown, id?: string) {
  return {
    locals: { benutzer },
    params: { id },
    request: new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(daten)
    })
  };
}

function ausleihdaten(menge: number, id = artikelId.toString()) {
  return {
    artikelId: id,
    person: 'Testperson',
    menge,
    ausleihdatum: '2026-11-19',
    rueckgabedatum: '2026-11-26'
  };
}

async function bestand() {
  const artikel = await db.collection('artikel').findOne({ _id: artikelId, vereinId });
  return artikel?.menge;
}

describe('ClubMatiq API – Ausleihen und Rückgaben', () => {
  let ausleiheId = '';

  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') {
      throw new Error('Tests dürfen nur clubmatiq_test verwenden.');
    }
    await client.connect();
    await db.collection('artikel').insertMany([
      { _id: artikelId, vereinId, name: 'Testball', menge: 10, hatGroessen: false },
      { _id: fremderArtikelId, vereinId: fremderVereinId, name: 'Fremder Ball', menge: 8, hatGroessen: false }
    ]);
  });

  afterAll(async () => {
    try {
      await db.collection('ausleihen').deleteMany({ vereinId });
      await db.collection('artikel').deleteMany({ _id: { $in: [artikelId, fremderArtikelId] } });
    } finally {
      
    }
  });

  it('verweigert Ausleihen ohne Anmeldung', async () => {
    const response = await ausleihen(event(null, ausleihdaten(2)) as never);
    expect(response.status).toBe(401);
    expect(await bestand()).toBe(10);
  });

  it('verweigert Ausleihen ohne Berechtigung', async () => {
    const response = await ausleihen(event(mitglied, ausleihdaten(2)) as never);
    expect(response.status).toBe(403);
    expect(await bestand()).toBe(10);
  });

  it('verweigert Ausleihen von Artikeln fremder Vereine', async () => {
    const response = await ausleihen(event(admin, ausleihdaten(2, fremderArtikelId.toString())) as never);
    expect(response.status).toBe(400);
    const fremderArtikel = await db.collection('artikel').findOne({ _id: fremderArtikelId });
    expect(fremderArtikel?.menge).toBe(8);
  });

  it('erfasst eine Ausleihe und reduziert den Bestand', async () => {
    const response = await ausleihen(event(admin, ausleihdaten(6)) as never);
    expect(response.status).toBe(201);
    const daten = await response.json();
    ausleiheId = daten.ausleiheId;
    expect(ObjectId.isValid(ausleiheId)).toBe(true);
    expect(await bestand()).toBe(4);
  });

  it('verhindert eine zweite Ausleihe mit zu grosser Menge', async () => {
    const response = await ausleihen(event(admin, ausleihdaten(5)) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(4);
  });

  it('verweigert eine ungültige Rückgabemenge', async () => {
    const response = await rueckgeben(event(admin, { menge: 0 }, ausleiheId) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(4);
  });

  it('verweigert eine Rückgabe durch nicht berechtigte Mitglieder', async () => {
    const response = await rueckgeben(event(mitglied, { menge: 2 }, ausleiheId) as never);
    expect(response.status).toBe(403);
    expect(await bestand()).toBe(4);
  });

  it('verweigert eine Rückgabe für einen anderen Verein', async () => {
    const response = await rueckgeben(
      event({ ...admin, vereinId: fremderVereinId }, { menge: 2 }, ausleiheId) as never
    );
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(4);
  });

  it('bucht eine Teilrückgabe korrekt zurück', async () => {
    const response = await rueckgeben(event(admin, { menge: 2 }, ausleiheId) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erfolg: true, status: 'teilweise', zurueckgegeben: 2, offen: 4
    });
    expect(await bestand()).toBe(6);
    const ausleihe = await db.collection('ausleihen').findOne({ _id: new ObjectId(ausleiheId) });
    expect(ausleihe?.rueckgaben).toHaveLength(1);
  });

  it('verhindert die Rückgabe von mehr als der offenen Menge', async () => {
    const response = await rueckgeben(event(admin, { menge: 5 }, ausleiheId) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(6);
  });

  it('schliesst die Ausleihe bei vollständiger Rückgabe ab', async () => {
    const response = await rueckgeben(event(admin, { menge: 4 }, ausleiheId) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erfolg: true, status: 'abgeschlossen', zurueckgegeben: 6, offen: 0
    });
    expect(await bestand()).toBe(10);
    const ausleihe = await db.collection('ausleihen').findOne({ _id: new ObjectId(ausleiheId) });
    expect(ausleihe?.rueckgaben).toHaveLength(2);
    expect(ausleihe?.abgeschlossenAm).toBeInstanceOf(Date);
  });

  it('verhindert doppelte Rückgabe nach Abschluss', async () => {
    const response = await rueckgeben(event(admin, { menge: 1 }, ausleiheId) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(10);
  });
});


});
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
afterAll(async()=>{await client.close();});

describe('Inventar und Ausleihen',()=>{
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

});
