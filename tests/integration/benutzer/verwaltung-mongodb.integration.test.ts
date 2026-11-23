import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';

// Nur die dedizierte Testdatenbank verwenden; niemals Produktivdaten verändern.
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt – Integrationstest abgebrochen');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';
import { GET } from '../../../src/routes/api/benutzer/+server';
import { PATCH } from '../../../src/routes/api/benutzer/[id]/+server';

const prefix = `issue15-${new ObjectId().toString()}`;
const vereinId = `${prefix}-verein`;
const fremdvereinId = `${prefix}-fremdverein`;
const adminId = new ObjectId();
const mitgliedId = new ObjectId();
const fremdId = new ObjectId();
const email = (suffix: string) => `${prefix}-${suffix}@example.invalid`;
const admin = { id: adminId.toString(), vereinId, rolle: 'admin' };
const mitglied = { id: mitgliedId.toString(), vereinId, rolle: 'mitglied' };

function patchEvent(id: string, body: unknown, localsBenutzer: unknown = admin) {
  return {
    params: { id },
    locals: { benutzer: localsBenutzer },
    request: new Request(`http://localhost/api/benutzer/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  } as never;
}

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Datenbank');
  await client.connect();
  await db.collection('benutzer').insertMany([
    { _id: adminId, vereinId, vorname: 'Admin', nachname: 'Test', email: email('admin'), rolle: 'admin', aktiv: true, passwortHash: 'test-hash' },
    { _id: mitgliedId, vereinId, vorname: 'Mit', nachname: 'Glied', email: email('mitglied'), rolle: 'mitglied', aktiv: true, passwortHash: 'test-hash' },
    { _id: fremdId, vereinId: fremdvereinId, vorname: 'Fremd', nachname: 'Person', email: email('fremd'), rolle: 'mitglied', aktiv: true, passwortHash: 'test-hash' }
  ]);
  await db.collection('sessions').insertOne({
    vereinId, benutzerId: mitgliedId.toString(), tokenHash: `${prefix}-session`,
    erstelltAm: new Date(), ablaufdatum: new Date(Date.now() + 3600000)
  });
});

afterAll(async () => {
  if (db.databaseName === 'clubmatiq_test') {
    await db.collection('sessions').deleteMany({ tokenHash: `${prefix}-session` });
    await db.collection('sessions').deleteMany({ vereinId, benutzerId: { $in: [adminId.toString(), mitgliedId.toString()] } });
    await db.collection('benutzer').deleteMany({ _id: { $in: [adminId, mitgliedId, fremdId] } });
  }
  await client.close();
});

describe('Issue #15 – Benutzerverwaltung mit echter MongoDB', () => {
  it('listet ausschliesslich Benutzer des eigenen Vereins ohne Passwort-Hashes', async () => {
    const response = await GET({ locals: { benutzer: admin } } as never);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toHaveLength(2);
    expect(result.every((person: { email: string }) => person.email.startsWith(prefix))).toBe(true);
    expect(result.every((person: { passwortHash?: string }) => person.passwortHash === undefined)).toBe(true);
  });

  it('verweigert Mitgliedern die Benutzerverwaltung', async () => {
    expect((await GET({ locals: { benutzer: mitglied } } as never)).status).toBe(403);
    expect((await PATCH(patchEvent(mitgliedId.toString(), { vorname: 'Hacker' }, mitglied))).status).toBe(403);
  });

  it('speichert Namen und normalisierte E-Mail dauerhaft', async () => {
    const response = await PATCH(patchEvent(mitgliedId.toString(), {
      vorname: ' Neuer ', nachname: 'Name', email: ` ${email('neu').toUpperCase()} `
    }));
    expect(response.status).toBe(200);
    const person = await db.collection('benutzer').findOne({ _id: mitgliedId });
    expect(person?.vorname).toBe('Neuer');
    expect(person?.nachname).toBe('Name');
    expect(person?.email).toBe(email('neu'));
  });

  it('verhindert E-Mail-Duplikate in echter MongoDB', async () => {
    const response = await PATCH(patchEvent(mitgliedId.toString(), { email: email('admin') }));
    expect(response.status).toBe(409);
    expect((await db.collection('benutzer').findOne({ _id: mitgliedId }))?.email).toBe(email('neu'));
  });

  it('verweigert Änderungen an Benutzern fremder Vereine', async () => {
    expect((await PATCH(patchEvent(fremdId.toString(), { vorname: 'Unbefugt' }))).status).toBe(404);
    expect((await db.collection('benutzer').findOne({ _id: fremdId }))?.vorname).toBe('Fremd');
  });

  it('verhindert die Deaktivierung und Herabstufung des letzten aktiven Admins', async () => {
    expect((await PATCH(patchEvent(adminId.toString(), { aktiv: false }))).status).toBe(409);
    expect((await PATCH(patchEvent(adminId.toString(), { rolle: 'mitglied' }))).status).toBe(409);
    expect((await db.collection('benutzer').findOne({ _id: adminId }))?.rolle).toBe('admin');
  });

  it('invalidiert vorhandene Sessions bei Rollenänderung', async () => {
    expect(await db.collection('sessions').countDocuments({ tokenHash: `${prefix}-session` })).toBe(1);
    const response = await PATCH(patchEvent(mitgliedId.toString(), { rolle: 'leiter' }));
    expect(response.status).toBe(200);
    expect((await db.collection('benutzer').findOne({ _id: mitgliedId }))?.rolle).toBe('leiter');
    expect(await db.collection('sessions').countDocuments({ tokenHash: `${prefix}-session` })).toBe(0);
  });
});
