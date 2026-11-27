import { parse } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { MongoClient, ObjectId } from 'mongodb';
import { hash, argon2id } from 'argon2';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(a => a !== '--apply')) throw new Error('Nur --apply erlaubt.');
const apply = args.includes('--apply');
const config = parse(await readFile('.env.demo.local'));
const name = 'clubmatiq_demo';
if (config.MONGODB_DB_NAME !== name || !config.MONGODB_URI ||
    !/^mongodb(?:\+srv)?:\/\/clubmatiq_demo_user:/.test(config.MONGODB_URI)) {
  throw new Error('Ausschliesslich Demo-Datenbank mit separatem Demo-Benutzer erlaubt.');
}
const id = key => new ObjectId(createHash('sha256').update('clubmatiq-demo-v1:' + key).digest('hex').slice(0, 24));
const clubId = id('verein');
const vereinId = clubId.toHexString();
const now = new Date();
const roles = ['admin', 'materialverantwortlich', 'leiter', 'mitglied'];
const plan = [];
function add(collection, key, data) {
  plan.push({ collection, document: { _id: id(collection + ':' + key), vereinId, ...data } });
}
plan.push({ collection: 'vereine', document: { _id: clubId, name: 'Turnverein Musterhausen', kuerzel: 'TVM', erstelltAm: now, integrationen: { clubdesk: { aktiviert: false, status: 'nicht_verbunden' } } } });
for (const rolle of roles) add('benutzer', rolle, { vorname: 'Demo', nachname: rolle, email: rolle + '@clubmatiq.example', rolle, aktiv: true, erstelltAm: now });
for (const name of ['Turngeräte','Kleingeräte','Bälle','Wettkampfmaterial','Trainingshilfen','Vereinskleider','Veranstaltungsmaterial','Sonstiges']) add('kategorien', name, { name });
for (const name of ['Geräteraum','Materialschrank','Vereinslager','Kleiderlager','Wettkampflager']) add('lagerorte', name, { name });
for (const [sortierung, bezeichnung] of ['104','116','128','140','152','164','XS','S','M','L','XL','XXL'].entries()) add('groessen', bezeichnung, { bezeichnung, sortierung });
for (const name of ['ELKI','KITU','JUKO','TI','TU','TV']) add('riegen', name, { name, namensschluessel: name.toLocaleLowerCase('de-CH'), bereich: ['ELKI','KITU','JUKO'].includes(name) ? 'juko' : 'aktive', aktiv: true, erstelltAm: now, aktualisiertAm: now });

const client = new MongoClient(config.MONGODB_URI);
try {
  await client.connect();
  const db = client.db(name);
  const status = await db.command({ connectionStatus: 1 });
  const auth = status.authInfo;
  if (auth.authenticatedUsers.length !== 1 || auth.authenticatedUsers[0].user !== 'clubmatiq_demo_user' ||
      auth.authenticatedUserRoles.length !== 1 || auth.authenticatedUserRoles[0].role !== 'readWrite' ||
      auth.authenticatedUserRoles[0].db !== name) throw new Error('Demo-Rollenprüfung fehlgeschlagen.');
  console.log('Zieldatenbank:', name);
  for (const collection of new Set(plan.map(p => p.collection))) {
    console.log(collection + ': ' + plan.filter(p => p.collection === collection).length + ' vorgesehene Datensätze');
  }
  if (!apply) {
    console.log('Vorschau: keine Änderungen.');
  } else {
    const passwords = roles.map(r => config['DEMO_PASSWORD_' + r.toUpperCase()]);
    if (passwords.some(p => !p || p.length < 16) || new Set(passwords).size !== roles.length) throw new Error('Vier unterschiedliche Demo-Passwörter mit mindestens 16 Zeichen in .env.demo.local erforderlich.');
    for (const p of plan.filter(p => p.collection === 'benutzer')) {
      p.document.passwortHash = await hash(passwords[roles.indexOf(p.document.rolle)], { type: argon2id });
    }
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const {collection, document} of plan) {
          const existing = await db.collection(collection).findOne({_id: document._id}, {session});
          if (existing && (collection === 'vereine' ? existing.name !== document.name : existing.vereinId !== vereinId)) throw new Error('ID-Konflikt: ' + collection);
          if (collection === 'benutzer') {
            const other = await db.collection(collection).findOne({email: document.email, _id: {$ne: document._id}}, {session});
            if (other) throw new Error('Demo-E-Mail bereits vergeben.');
          }
          const {_id, ...fields} = document;
          await db.collection(collection).updateOne({_id}, {$setOnInsert: fields}, {upsert: true, session});
        }
      });
    } finally { await session.endSession(); }
    console.log('Demo-Grundstruktur sichergestellt. Bestehende Datensätze unverändert.');
  }
} finally { await client.close(); }
