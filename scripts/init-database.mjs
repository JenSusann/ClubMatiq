import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { readFile, writeFile } from 'node:fs/promises';

const names = ['clubmatiq', 'clubmatiq_dev', 'clubmatiq_test', 'clubmatiq_demo'];
const name = process.env.MONGODB_DB_NAME;
const uri = process.env.MONGODB_URI;
if (!uri || !names.includes(name)) throw new Error('Datenbankkonfiguration fehlt oder ist unzulässig.');
const args = process.argv.slice(2);
const exporting = args.includes('--export');
const apply = args.includes('--apply');
if (args.some(a => !['--export', '--apply', '--confirm-production'].includes(a)) || (exporting && apply)) throw new Error('Ungültige Argumente.');
if (apply && name === 'clubmatiq' && !args.includes('--confirm-production')) throw new Error('Produktivänderung erfordert --confirm-production.');
const file = 'database-schema.json';
const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(name);
  console.log('Zieldatenbank:', name);
  if (exporting) {
    const schema = [];
    for (const c of await db.listCollections().toArray()) {
      if (c.name.startsWith('system.')) continue;
      if (c.type !== 'collection' || Object.keys(c.options ?? {}).length) throw new Error('Spezielle Collection manuell prüfen: ' + c.name);
      const indexes = (await db.collection(c.name).indexes()).filter(i => i.name !== '_id_').map(({v, ns, ...i}) => i);
      schema.push({name: c.name, indexes});
    }
    await writeFile(file, JSON.stringify(schema, null, 2), {flag:'wx'});
    console.log('Nur Struktur exportiert:', file);
  } else {
    const schema = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(schema) || !schema.length) throw new Error('Leeres oder ungültiges Schema.');
    const existing = new Set((await db.listCollections().toArray()).map(c => c.name));
    for (const c of schema) {
      if (typeof c.name !== 'string' || c.name.startsWith('system.') || !Array.isArray(c.indexes)) throw new Error('Ungültige Collection im Schema.');
      console.log(existing.has(c.name) ? 'Vorhanden:' : 'Fehlt:', c.name, '| Soll-Indizes:', c.indexes.map(i => i.name).join(', '));
      if (!apply) continue;
      if (!existing.has(c.name)) await db.createCollection(c.name);
      for (const {key, ...options} of c.indexes) await db.collection(c.name).createIndex(key, options);
    }
    console.log(apply ? 'Initialisierung abgeschlossen.' : 'Vorschau: keine Änderungen.');
  }
} finally {
  await client.close();
}
