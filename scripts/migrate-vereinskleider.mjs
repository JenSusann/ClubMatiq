/**
 * Einmalige, wiederholbar sichere Migration für Issue #57.
 * Vorschau: node scripts/migrate-vereinskleider.mjs --verein=<vereinId>
 * Ausführen: node scripts/migrate-vereinskleider.mjs --verein=<vereinId> --apply --confirm=<vereinId>
 *
 * Markiert nur Artikel in einer vorhandenen Kategorie namens "Vereinskleider".
 * Andere Artikel werden nicht verändert. Bestehende true/false-Werte bleiben erhalten.
 * Vor Änderungen wird automatisch ein lokales JSON-Backup geschrieben.
 * Zusätzlich wird ein Atlas-Snapshot empfohlen.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argumente = process.argv.slice(2);
const erlaubteArgumente = new Set(['verein', 'confirm', 'db', 'apply']);
const verwendeteArgumente = new Set();
for (const argument of argumente) {
  const treffer = /^--([a-z]+)(?:=(.*))?$/.exec(argument);
  if (!treffer || !erlaubteArgumente.has(treffer[1])) {
    throw new Error('Unbekanntes oder ungültiges Argument: ' + argument);
  }
  const [, name, wert] = treffer;
  if (verwendeteArgumente.has(name)) {
    throw new Error('Doppeltes Argument nicht erlaubt: --' + name);
  }
  if (name === 'apply' ? wert !== undefined : wert === undefined || wert.length === 0) {
    throw new Error('Ungültiger Wert für --' + name);
  }
  verwendeteArgumente.add(name);
}
const apply = process.argv.includes('--apply');
const vereinId = process.argv.find((a) => a.startsWith('--verein='))?.slice('--verein='.length);
const confirm = process.argv.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length);
const dbName = process.argv.find((a) => a.startsWith('--db='))?.slice('--db='.length) ?? process.env.MONGODB_DB_NAME;
if (!vereinId) throw new Error('Sicherheitsabbruch: --verein=<vereinId> ist erforderlich.');
if (apply && confirm !== vereinId) throw new Error('Sicherheitsabbruch: --confirm=<vereinId> muss übereinstimmen.');
if (!['clubmatiq', 'clubmatiq_test', 'clubmatiq_dev', 'clubmatiq_demo'].includes(dbName)) throw new Error('Unzulässige Datenbank.');
const uri = dbName === 'clubmatiq_test' ? process.env.MONGODB_TEST_URI : process.env.MONGODB_URI;
if (!uri) throw new Error(dbName === 'clubmatiq_test' ? 'MONGODB_TEST_URI fehlt.' : 'MONGODB_URI fehlt.');
const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const kategorien = await db.collection('kategorien').find({ vereinId }).toArray();
  const alt = kategorien.filter((k) => typeof k.name === 'string' && k.name.trim().toLowerCase() === 'vereinskleider');
  if (alt.length !== 1) throw new Error('Abbruch: Genau eine historische Kategorie «Vereinskleider» erwartet, gefunden: ' + alt.length);
  const kategorieId = alt[0]._id.toString();
  const alle = await db.collection('artikel').find({ vereinId, kategorieId }).toArray();
  const kandidaten = alle.filter((a) => !Object.hasOwn(a, 'istVereinskleidung'));
  console.log(JSON.stringify({
    modus: apply ? 'ANWENDEN' : 'VORSCHAU', dbName, vereinId, kategorieId,
    artikelInKategorie: alle.length, kandidaten: kandidaten.length,
    bereitsMarkiert: alle.filter((a) => a.istVereinskleidung === true).length,
    bewusstAusgeschlossen: alle.filter((a) => a.istVereinskleidung === false).length,
    artikel: kandidaten.map((a) => ({ id: a._id.toString(), name: a.name }))
  }, null, 2));
  if (apply) {
    const ordner = resolve('migration-backups');
    await mkdir(ordner, { recursive: true });
    const datei = resolve(ordner, 'issue57-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + vereinId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
    // Backup enthält den vollständigen Originalzustand der betroffenen Artikel.
    await writeFile(datei, JSON.stringify({ dbName, vereinId, kategorie: alt[0], artikel: alle }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log('Backup erstellt: ' + datei);
    let geaendert = 0;
    for (const artikel of kandidaten) {
      const ergebnis = await db.collection('artikel').updateOne(
        { _id: artikel._id, vereinId, kategorieId, istVereinskleidung: { $exists: false } },
        { $set: { istVereinskleidung: true } }
      );
      geaendert += ergebnis.modifiedCount;
    }
    console.log('Migration abgeschlossen. Aktualisiert: ' + geaendert);
  } else {
    console.log('Nur Vorschau: keine Daten verändert.');
  }
} finally {
  await client.close();
}
