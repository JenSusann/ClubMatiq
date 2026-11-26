import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI fehlt.');
const client = new MongoClient(uri);
const definitionen = [
  { name: 'journal_verein_zeit', key: { vereinId: 1, zeitpunkt: -1, _id: -1 } },
  { name: 'journal_verein_artikel_zeit', key: { vereinId: 1, artikelId: 1, zeitpunkt: -1, _id: -1 } }
];
try {
  await client.connect();
  const collection = client.db('clubmatiq').collection('lagerbewegungen');
  if (process.argv.includes('--apply')) {
    await collection.createIndexes(definitionen);
  }
  const vorhanden = await collection.indexes();
  for (const soll of definitionen) {
    const ist = vorhanden.find(i => JSON.stringify(i.key) === JSON.stringify(soll.key) && !i.partialFilterExpression && !i.sparse && !i.hidden);
    console.log(soll.name + ': ' + (ist ? 'OK (' + ist.name + ')' : 'FEHLT'));
    if (!ist) process.exitCode = 1;
  }
} finally {
  await client.close();
}
