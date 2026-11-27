import { parse } from 'dotenv';
import { readFile, mkdir, mkdtemp, writeFile, rm, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const targets = {prod:['.env.production.local','clubmatiq'],dev:['.env','clubmatiq_dev'],demo:['.env.demo.local','clubmatiq_demo']};
const env = process.argv[2];
if (!Object.hasOwn(targets, env) || process.argv.length !== 3) throw new Error('Umgebung prod, dev oder demo erforderlich.');
const [file, db] = targets[env];
const config = parse(await readFile(file));
if (!config.MONGODB_URI || config.MONGODB_DB_NAME !== db) throw new Error('Falsche Datenbankkonfiguration.');
const root = resolve(homedir(), 'ClubMatiq-Backups', env);
await mkdir(root, {recursive:true, mode:0o700});
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const archive = join(root, db+'_'+stamp+'.archive.gz');
const temp = await mkdtemp(join(tmpdir(),'clubmatiq-backup-'));
try {
  const credentials = join(temp,'mongo.yml');
  await writeFile(credentials, 'uri: '+JSON.stringify(config.MONGODB_URI)+'\n', {mode:0o600,flag:'wx'});
  const result = spawnSync('mongodump',['--config='+credentials,'--db='+db,'--archive='+archive+'.partial','--gzip'],{stdio:'ignore',windowsHide:true});
  if (result.error || result.status !== 0) throw new Error('mongodump fehlgeschlagen; Installation und Verbindung prüfen.');
  await rename(archive+'.partial',archive);
  console.log('Backup erstellt:',archive);
} finally {
  await rm(archive+'.partial',{force:true});
  await rm(temp,{recursive:true,force:true});
}
