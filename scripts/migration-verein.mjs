
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI fehlt in der .env-Datei.');
}

const datenbankName = 'clubmatiq';

const vereinId = '6af36e9c6dc5295d2c0dce8d';

const collections = [
  'artikel',
  'artikelvarianten',
  'kategorien',
  'lagerorte',
  'groessen',
  'ausleihen'
];

const client = new MongoClient(uri);

async function migration() {
  await client.connect();

  const db = client.db(datenbankName);

  // Sicherstellen, dass der Verein existiert.
  const verein = await db.collection('vereine').findOne({
    _id: new ObjectId(vereinId)
  });

  if (!verein) {
    throw new Error(
      'Der angegebene Verein wurde nicht gefunden.'
    );
  }

  console.log(`\nVerein: ${verein.name}`);
  console.log(`Vereins-ID: ${vereinId}\n`);

  const filter = {
    $or: [
      { vereinId: { $exists: false } },
      { vereinId: null }
    ]
  };

  // Zuerst nur anzeigen, was geändert würde.
  console.log('--- Vorschau der Migration ---');

  let gesamt = 0;

  for (const name of collections) {
    const anzahl = await db
      .collection(name)
      .countDocuments(filter);

    gesamt += anzahl;

    console.log(`${name}: ${anzahl} Datensätze`);
  }

  console.log(`\nInsgesamt: ${gesamt} Datensätze`);

  if (process.argv[2] !== '--ausfuehren') {
    console.log('\nEs wurden keine Daten verändert.');
    console.log(
      'Migration ausführen mit: node scripts/migration-verein.mjs --ausfuehren'
    );
    return;
  }

  // Migration nur nach ausdrücklichem Aufruf ausführen.
  console.log('\n--- Migration wird ausgeführt ---');

  for (const name of collections) {
    const ergebnis = await db
      .collection(name)
      .updateMany(
        filter,
        {
          $set: { vereinId }
        }
      );

    console.log(
      `${name}: ${ergebnis.modifiedCount} Datensätze aktualisiert`
    );
  }

  console.log('\nMigration abgeschlossen.');
}

try {
  await migration();
} catch (error) {
  console.error('Migration fehlgeschlagen:', error);
  process.exitCode = 1;
} finally {
  await client.close();
}
