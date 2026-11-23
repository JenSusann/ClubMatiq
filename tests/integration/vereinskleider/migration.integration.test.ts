import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const execFileAsync = promisify(execFile);
const vereinId = 'issue57-' + new ObjectId().toString();
const fremdvereinId = 'issue57-fremd-' + new ObjectId().toString();
const kategorieId = new ObjectId();
const andereKategorieId = new ObjectId();
const fremdKategorieId = new ObjectId();
const ids = {
  alt: new ObjectId(), markiert: new ObjectId(), ausgeschlossen: new ObjectId(),
  inventar: new ObjectId(), fremd: new ObjectId()
};
const client = new MongoClient(process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:1');
const db = client.db('clubmatiq_test');
let arbeitsordner: string;

async function migration(args: string[]) {
  return execFileAsync(process.execPath, [resolve('scripts/migrate-vereinskleider.mjs'), '--db=clubmatiq_test', ...args], {
    cwd: arbeitsordner,
    env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1' },
    timeout: 20000
  });
}
async function dokument(id: ObjectId) {
  return db.collection('artikel').findOne({ _id: id });
}

beforeAll(async () => {
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt – Integrationstest abgebrochen');
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Datenbank');
  arbeitsordner = await mkdtemp(join(tmpdir(), 'clubmatiq-issue57-'));
  await client.connect();
  await db.collection('kategorien').insertMany([
    { _id: kategorieId, vereinId, name: ' Vereinskleider ' },
    { _id: andereKategorieId, vereinId, name: 'Sportmaterial' },
    { _id: fremdKategorieId, vereinId: fremdvereinId, name: 'Vereinskleider' }
  ]);
  await db.collection('artikel').insertMany([
    { _id: ids.alt, vereinId, kategorieId: kategorieId.toString(), name: 'T-Shirt alt', menge: 12, varianten: [{ groesseId: 'M', menge: 7 }], einzelwert: 19 },
    { _id: ids.markiert, vereinId, kategorieId: kategorieId.toString(), name: 'Trainerjacke', menge: 4, istVereinskleidung: true },
    { _id: ids.ausgeschlossen, vereinId, kategorieId: kategorieId.toString(), name: 'Turnhose', menge: 6, istVereinskleidung: false },
    { _id: ids.inventar, vereinId, kategorieId: andereKategorieId.toString(), name: 'Turnmatte', menge: 2 },
    { _id: ids.fremd, vereinId: fremdvereinId, kategorieId: fremdKategorieId.toString(), name: 'Fremdshirt', menge: 5 }
  ]);
});

afterAll(async () => {
  if (db.databaseName === 'clubmatiq_test') {
    await db.collection('artikel').deleteMany({ _id: { $in: Object.values(ids) } });
    await db.collection('kategorien').deleteMany({ _id: { $in: [kategorieId, andereKategorieId, fremdKategorieId] } });
  }
  await client.close();
  if (arbeitsordner) await rm(arbeitsordner, { recursive: true, force: true });
});

describe('Issue #57 – sichere Vereinskleider-Migration mit echter MongoDB', () => {
  it('zeigt Kandidaten in der Vorschau, ohne Daten zu verändern', async () => {
    const { stdout } = await migration(['--verein=' + vereinId]);
    expect(stdout).toContain('"kandidaten": 1');
    expect(stdout).toContain('T-Shirt alt');
    expect(stdout).toContain('"bewusstAusgeschlossen": 1');
    expect(await dokument(ids.alt)).not.toHaveProperty('istVereinskleidung');
    await expect(readdir(join(arbeitsordner, 'migration-backups'))).rejects.toThrow();
  });

  it('verweigert Änderungen ohne explizite Bestätigung', async () => {
    await expect(migration(['--verein=' + vereinId, '--apply'])).rejects.toThrow();
    expect(await dokument(ids.alt)).not.toHaveProperty('istVereinskleidung');
  });

  it('migriert ausschliesslich fehlende Kennzeichnungen im gewählten Verein und erstellt ein Backup', async () => {
    const vorher = await dokument(ids.alt);
    const { stdout } = await migration(['--verein=' + vereinId, '--apply', '--confirm=' + vereinId]);
    expect(stdout).toContain('Aktualisiert: 1');
    const nachher = await dokument(ids.alt);
    expect(nachher).toMatchObject({ menge: 12, einzelwert: 19, varianten: [{ groesseId: 'M', menge: 7 }], istVereinskleidung: true });
    expect(nachher?._id).toEqual(vorher?._id);
    expect(await dokument(ids.markiert)).toHaveProperty('istVereinskleidung', true);
    expect(await dokument(ids.ausgeschlossen)).toHaveProperty('istVereinskleidung', false);
    expect(await dokument(ids.inventar)).not.toHaveProperty('istVereinskleidung');
    expect(await dokument(ids.fremd)).not.toHaveProperty('istVereinskleidung');
    const dateien = await readdir(join(arbeitsordner, 'migration-backups'));
    expect(dateien).toHaveLength(1);
    const backup = JSON.parse(await readFile(join(arbeitsordner, 'migration-backups', dateien[0]), 'utf8'));
    expect(backup.vereinId).toBe(vereinId);
    expect(backup.artikel).toHaveLength(3);
    expect(backup.artikel.find((a: { name: string }) => a.name === 'T-Shirt alt')).not.toHaveProperty('istVereinskleidung');
  });

  it('bleibt bei wiederholter Ausführung idempotent', async () => {
    const { stdout } = await migration(['--verein=' + vereinId, '--apply', '--confirm=' + vereinId]);
    expect(stdout).toContain('Aktualisiert: 0');
    expect(await dokument(ids.alt)).toHaveProperty('istVereinskleidung', true);
  });

  it('verweigert einen anderen Verein und unzulässige Datenbanknamen', async () => {
    await expect(migration(['--verein=' + fremdvereinId, '--apply', '--confirm=' + vereinId])).rejects.toThrow();
    await expect(migration(['--verein=' + vereinId, '--db=clubmatiq_prod'])).rejects.toThrow();
    expect(await dokument(ids.fremd)).not.toHaveProperty('istVereinskleidung');
  });
});
