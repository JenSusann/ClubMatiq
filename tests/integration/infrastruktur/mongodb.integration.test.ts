
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient } from 'mongodb';

const testUri = process.env.MONGODB_TEST_URI;

if (!testUri) {
  throw new Error(
    'MONGODB_TEST_URI fehlt. Bitte eine separate MongoDB-Testverbindung konfigurieren.'
  );
}

const client = new MongoClient(testUri);

// Ausschliesslich die Testdatenbank verwenden
const datenbankName = 'clubmatiq_test';
const db = client.db(datenbankName);

// Eigene Collection für diesen Testlauf
const collectionName = `integration_artikel_${Date.now()}_${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const artikel = db.collection<{
  name: string;
  vereinId: string;
  menge: number;
}>(collectionName);

describe('MongoDB Integration – Inventar', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    try {
      // Nur die eigene Test-Collection entfernen
      await artikel.drop().catch((error: unknown) => {
        if (
          typeof error !== 'object' ||
          error === null ||
          !('code' in error) ||
          error.code !== 26
        ) {
          throw error;
        }
      });
    } finally {
      await client.close();
    }
  });

  it('erstellt und liest einen Artikel', async () => {
    const ergebnis = await artikel.insertOne({
      name: 'Trainingsball',
      vereinId: 'testverein',
      menge: 10
    });

    const gespeichert = await artikel.findOne({
      _id: ergebnis.insertedId
    });

    expect(gespeichert?.name).toBe('Trainingsball');
    expect(gespeichert?.menge).toBe(10);
  });

  it('ändert den Bestand eines Artikels', async () => {
    const ergebnis = await artikel.insertOne({
      name: 'Sprungseil',
      vereinId: 'testverein',
      menge: 5
    });

    await artikel.updateOne(
      { _id: ergebnis.insertedId },
      { $set: { menge: 8 } }
    );

    const gespeichert = await artikel.findOne({
      _id: ergebnis.insertedId
    });

    expect(gespeichert?.menge).toBe(8);
  });

  it('löscht einen Artikel', async () => {
    const ergebnis = await artikel.insertOne({
      name: 'Testmaterial',
      vereinId: 'testverein',
      menge: 1
    });

    const geloescht = await artikel.deleteOne({
      _id: ergebnis.insertedId
    });

    expect(geloescht.deletedCount).toBe(1);

    const gespeichert = await artikel.findOne({
      _id: ergebnis.insertedId
    });

    expect(gespeichert).toBeNull();
  });
});
