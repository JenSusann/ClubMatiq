/**
 * ClubMatiq – Testdaten bereinigen
 *
 * Vorschau:
 * node scripts/testdaten-bereinigen.mjs
 *
 * Verein prüfen:
 * node scripts/testdaten-bereinigen.mjs --verein=VEREINS_ID
 *
 * Verein löschen:
 * node scripts/testdaten-bereinigen.mjs --delete --verein=VEREINS_ID
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI fehlt in der .env-Datei.');
}

const dbName = process.env.MONGODB_DB_NAME;
if (!['clubmatiq_dev', 'clubmatiq_test', 'clubmatiq_demo'].includes(dbName)) throw new Error('Bereinigung nur in Entwicklungs-, Test- oder Demo-Datenbank erlaubt.');
console.log('Zieldatenbank:', dbName);
const args = process.argv.slice(2);

const deleting = args.includes('--delete');

const selected = args
  .filter((arg) => arg.startsWith('--verein='))
  .map((arg) => arg.slice(9));

const client = new MongoClient(uri);

const excluded = new Set([
  'vereine',
  'system.profile',
  'system.views'
]);

function scopedFilter(id) {
  return ObjectId.isValid(id)
    ? {
        vereinId: {
          $in: [id, new ObjectId(id)]
        }
      }
    : { vereinId: id };
}

try {
  await client.connect();

  const db = client.db(dbName);

  // Alle vorhandenen Vereine laden
  const vereine = await db
    .collection('vereine')
    .find(
      {},
      { projection: { name: 1, kuerzel: 1 } }
    )
    .sort({ name: 1 })
    .toArray();

  console.log('\nClubMatiq – vorhandene Vereine:');

  for (const v of vereine) {
    console.log(
      `  ${v._id}  ${v.name ?? '(ohne Name)'} ${
        v.kuerzel ? `(${v.kuerzel})` : ''
      }`
    );
  }

  if (!selected.length) {
    console.log('\nNoch nichts gelöscht.');

    console.log('\nVorschau für einen Verein:');
    console.log(
      'node scripts/testdaten-bereinigen.mjs --verein=VEREINS_ID'
    );

    console.log('\nLöschen nach Kontrolle und Backup:');
    console.log(
      'node scripts/testdaten-bereinigen.mjs --delete --verein=VEREINS_ID'
    );
  } else {
    const unique = [...new Set(selected)];

    const clubs = unique.map((id) =>
      vereine.find((v) => String(v._id) === id)
    );

    if (clubs.some((v) => !v)) {
      throw new Error(
        'Mindestens eine Vereins-ID existiert nicht. Abbruch ohne Löschung.'
      );
    }

    // Alle Collections ermitteln
    const collections = (
      await db.listCollections(
        {},
        { nameOnly: true }
      ).toArray()
    )
      .map((c) => c.name)
      .filter(
        (name) =>
          !excluded.has(name) &&
          !name.startsWith('system.')
      );

    const plans = [];
    let total = 0;

    // Löschvorschau erstellen
    for (const id of unique) {
      const verein = clubs.find(
        (v) => String(v._id) === id
      );

      console.log(
        `\nVerein: ${verein.name} (${id})`
      );

      for (const name of collections) {
        const filter = scopedFilter(id);

        const count = await db
          .collection(name)
          .countDocuments(filter);

        if (count > 0) {
          console.log(`  ${name}: ${count}`);

          plans.push({
            name,
            filter,
            count
          });

          total += count;
        }
      }
    }

    console.log(
      `\nBetroffen: ${unique.length} Verein(e), ` +
      `${total} zugeordnete Datensätze + ` +
      `${unique.length} Vereinsdatensatz/-sätze.`
    );

    console.log(
      'Nicht gelöscht werden: Daten ohne vereinId, ' +
      'andere Vereine und externe Cloudinary-Dateien.'
    );

    if (!deleting) {
      console.log(
        '\nVORSCHAU – es wurde nichts gelöscht.'
      );

      console.log(
        '\nNach Backup löschen mit:\n' +
        'node scripts/testdaten-bereinigen.mjs --delete ' +
        unique.map((id) => `--verein=${id}`).join(' ')
      );
    } else {
      console.log(
        '\nACHTUNG: Dauerhafte Löschung!'
      );

      console.log(
        'Vorher unbedingt ein MongoDB-Backup erstellen.'
      );

      const rl = readline.createInterface({
        input,
        output
      });

      let confirmation;

      try {
        confirmation = await rl.question(
          `Zur Bestätigung exakt "${unique.join(',')}" eingeben: `
        );
      } finally {
        rl.close();
      }

      if (confirmation !== unique.join(',')) {
        console.log(
          'Abgebrochen – nichts gelöscht.'
        );
      } else {
        // Zuerst zugeordnete Dokumente löschen
        for (const { name, filter } of plans) {
          const result = await db
            .collection(name)
            .deleteMany(filter);

          console.log(
            `${name}: ${result.deletedCount} gelöscht`
          );
        }

        // Anschliessend Vereinsdatensätze löschen
        for (const id of unique) {
          const result = await db
            .collection('vereine')
            .deleteOne({
              _id: new ObjectId(id)
            });

          console.log(
            `Verein ${id}: ${result.deletedCount} gelöscht`
          );
        }

        console.log(
          '\nBereinigung abgeschlossen.'
        );

        console.log(
          'Bitte prüfen, ob ältere verknüpfte ' +
          'Dokumente ohne vereinId übrig sind.'
        );
      }
    }
  }
} finally {
  await client.close();
}