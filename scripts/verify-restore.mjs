import { parse } from 'dotenv';
import { MongoClient, BSON } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
const clients = [];
try {
  for (const [file,name,user] of [['.env','clubmatiq_dev','clubmatiq_dev_user'],['.env.restore.local','clubmatiq_restore','clubmatiq_restore_user']]) {
    const c = parse(await readFile(file));
    if (c.MONGODB_DB_NAME !== name || new URL(c.MONGODB_URI).username !== user) throw new Error('Falsche Umgebung.');
    const client = new MongoClient(c.MONGODB_URI);
    clients.push(client);
    await client.connect();
  }
  const [dev,restore] = clients.map((c,i)=>c.db(i?'clubmatiq_restore':'clubmatiq_dev'));
  const names = async db => (await db.listCollections().toArray()).map(c=>c.name).sort();
  const a = await names(dev), b = await names(restore);
  if (!isDeepStrictEqual(a,b)) throw new Error('Collections unterscheiden sich.');
  const rows = [];
  for (const name of a) {
    const x = dev.collection(name), y = restore.collection(name);
    const docs = async c => (await c.find().sort({_id:1}).toArray()).map(d=>BSON.EJSON.stringify(d,{relaxed:false}));
    const indexes = async c => (await c.indexes()).map(({ns,...i})=>i).sort((a,b)=>a.name.localeCompare(b.name));
    const [xd,yd,xi,yi] = await Promise.all([docs(x),docs(y),indexes(x),indexes(y)]);
    rows.push({collection:name,dokumente:xd.length,inhalte:isDeepStrictEqual(xd,yd),indizes:isDeepStrictEqual(xi,yi)});
  }
  console.table(rows);
  if (rows.some(r=>!r.inhalte||!r.indizes)) throw new Error('Abweichungen festgestellt.');
  console.log('DEV und RESTORE stimmen überein.');
} finally { await Promise.all(clients.map(c=>c.close())); }
