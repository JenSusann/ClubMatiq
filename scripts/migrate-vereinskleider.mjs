/**
 * Einmalige, wiederholbar sichere Migration für Issue #57.
 * Vorschau: node scripts/migrate-vereinskleider.mjs
 * Ausführen: node scripts/migrate-vereinskleider.mjs --apply
 *
 * Markiert nur Artikel in einer vorhandenen Kategorie namens "Vereinskleider".
 * Andere Artikel werden nicht verändert. Bestehende true/false-Werte bleiben erhalten.
 * Vor Ausführung ein Atlas-Backup anlegen.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI fehlt.');
const apply = process.argv.includes('--apply');
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const db = client.db('clubmatiq');
  const kategorien = await db.collection('kategorien')
    .find({ name: { $regex: /^\\s*vereinskleider\\s*$/i } })
    .project({ _id: 1, vereinId: 1, name: 1 }).toArray();
  let gesamt = 0;
  for (const kategorie of kategorien) {
    const filter = {
      vereinId: kategorie.vereinId,
      kategorieId: kategorie._id.toString(),
      istVereinskleidung: { $exists: false }
    };
    const anzahl = await db.collection('artikel').countDocuments(filter);
    console.log(`Verein ${kategorie.vereinId}: ${anzahl} Artikel zu markieren`);
    gesamt += anzahl;
    if (apply && anzahl > 0) {
      const result = await db.collection('artikel').updateMany(filter, {
        $set: { istVereinskleidung: true }
      });
      console.log(`  Aktualisiert: ${result.modifiedCount}`);
    }
  }
  console.log(`${apply ? 'Migration abgeschlossen' : 'Nur Vorschau'}: ${gesamt} Artikel`);
} finally {
  await client.close();
}
