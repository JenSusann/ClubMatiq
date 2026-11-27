import { parse } from 'dotenv';
import { MongoClient } from 'mongodb';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const windowsTool = join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Tools', '100', 'bin', 'mongorestore.exe');
const executable = process.platform === 'win32' && existsSync(windowsTool) ? windowsTool : 'mongorestore';

const config = parse(await readFile('.env.restore.local'));
if (config.MONGODB_DB_NAME !== 'clubmatiq_restore' || !config.MONGODB_URI) throw new Error('Restore-Konfiguration ungültig.');
const uri = new URL(config.MONGODB_URI);
if (uri.username !== 'clubmatiq_restore_user') throw new Error('Nur der isolierte Restore-Benutzer ist zulässig.');
const root = join(homedir(),'ClubMatiq-Backups','dev');
const files = (await readdir(root)).filter(f => /^clubmatiq_dev_[0-9TZ-]+\.archive\.gz$/.test(f)).sort();
const file = files.at(-1);
if (!file) throw new Error('Kein DEV-Backup gefunden.');
const client = new MongoClient(config.MONGODB_URI);
let temp;
try {
  await client.connect();
  const db = client.db('clubmatiq_restore');
  if ((await db.listCollections().toArray()).length) throw new Error('Restore-Datenbank ist nicht leer. Abbruch.');
  temp = await mkdtemp(join(tmpdir(),'clubmatiq-restore-'));
  const credentials = join(temp,'mongo.yml');
  await writeFile(credentials,'uri: '+JSON.stringify(config.MONGODB_URI)+'\n',{mode:0o600,flag:'wx'});
  const result = spawnSync(executable,['--config='+credentials,'--archive='+join(root,file),'--gzip','--nsInclude=clubmatiq_dev.*','--nsFrom=clubmatiq_dev.*','--nsTo=clubmatiq_restore.*','--stopOnError'],{stdio:'ignore',windowsHide:true});
  if (result.error) throw new Error('MongoDB Tool konnte nicht gestartet werden: '+(result.error.code || 'unbekannt'));
  if (result.status !== 0) throw new Error('Restore fehlgeschlagen. Ziel kann teilweise befüllt sein.');
  const rows = [];
  for (const c of await db.listCollections().toArray()) {
    if (c.type !== 'collection') continue;
    const col = db.collection(c.name);
    rows.push({collection:c.name,dokumente:await col.countDocuments(),indizes:(await col.indexes()).length});
  }
  if (!rows.length) throw new Error('Keine Collections wiederhergestellt.');
  console.table(rows);
  console.log('Restore erfolgreich:',file);
} finally {
  await client.close();
  if (temp) await rm(temp,{recursive:true,force:true});
}
