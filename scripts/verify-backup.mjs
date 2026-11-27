import { loadKey, decrypt } from './backup-crypto.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createGunzip } from 'node:zlib';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(homedir(), 'ClubMatiq-Backups', 'prod');
const file = (await readdir(root)).filter(f => /^clubmatiq_[0-9TZ-]+\.archive\.gz\.enc$/.test(f)).sort().at(-1);
if (!file) throw new Error('Kein verschlüsseltes PROD-Backup gefunden.');
const archive = decrypt(await readFile(join(root,file)), await loadKey());
let bytes = 0;
await pipeline(Readable.from([archive]), createGunzip(), new Writable({
  write(chunk, encoding, callback) { bytes += chunk.length; callback(); }
}));
if (!bytes) throw new Error('Archiv ist leer.');
console.log('PROD-Backup: AES-GCM-Authentifizierung und GZIP-Prüfung erfolgreich:',file);
