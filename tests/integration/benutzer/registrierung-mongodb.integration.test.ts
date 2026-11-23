import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';
import { verify } from 'argon2';

// Diese Datei arbeitet mit einer echten MongoDB, niemals mit der Produktivdatenbank.
// Der Test benötigt MONGODB_TEST_URI und eine MongoDB-Replica-Set-/Atlas-Verbindung.
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt (nur Testdatenbank verwenden)');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';
import { POST } from '../../../src/routes/api/registrieren/+server';

const prefix = `issue13-${new ObjectId().toString()}`;
const passwort = 'Integration!Passwort2026';
const email = (suffix: string) => `${prefix}-${suffix}@example.invalid`;
const vereinsname = (suffix: string) => `${prefix}-${suffix}`;
const cookieEvents: string[] = [];

function event(suffix: string, mail = email(suffix)) {
  return {
    request: new Request('http://localhost/api/registrieren', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vereinsname: vereinsname(suffix),
        vereinskuerzel: 'I13',
        vorname: 'Integration',
        nachname: 'Test',
        email: mail,
        passwort
      })
    }),
    cookies: {
      set: (name: string, _token: string) => cookieEvents.push(name),
      get: () => undefined,
      delete: () => undefined
    }
  } as never;
}

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') {
    throw new Error('Sicherheitsabbruch: nur clubmatiq_test erlaubt');
  }
  await client.connect();
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && !hello.msg?.includes('isdbgrid')) {
    throw new Error('MongoDB-Transaktionen benötigen Replica Set oder Sharded Cluster');
  }
});

afterAll(async () => {
  if (db.databaseName === 'clubmatiq_test') {
    const vereine = await db.collection('vereine')
      .find({ name: { $regex: `^${prefix}` } }, { projection: { _id: 1 } }).toArray();
    const ids = vereine.map((v) => v._id.toString());
    await db.collection('sessions').deleteMany({ vereinId: { $in: ids } });
    await db.collection('benutzer').deleteMany({ email: { $regex: `^${prefix}` } });
    await db.collection('vereine').deleteMany({ name: { $regex: `^${prefix}` } });
  }
  await client.close();
});

describe('Issue #13 – Registrierung mit echter MongoDB', () => {
  it('legt Verein, Admin und Session an und speichert nur den Passwort-Hash', async () => {
    const response = await POST(event('erfolg'));
    expect(response.status).toBe(201);
    const result = await response.json();
    const verein = await db.collection('vereine').findOne({ _id: new ObjectId(result.vereinId) });
    const benutzer = await db.collection('benutzer').findOne({ email: email('erfolg') });
    const session = await db.collection('sessions').findOne({ benutzerId: result.benutzerId });
    expect(verein?.name).toBe(vereinsname('erfolg'));
    expect(benutzer?.vereinId).toBe(result.vereinId);
    expect(benutzer?.passwortHash).not.toBe(passwort);
    expect(await verify(benutzer!.passwortHash, passwort)).toBe(true);
    expect(session?.vereinId).toBe(result.vereinId);
    expect(cookieEvents).toContain('clubmatiq_session');
  });

  it('verhindert eine zweite Registrierung mit gleicher E-Mail', async () => {
    const mail = email('doppelt');
    expect((await POST(event('doppelt-1', mail))).status).toBe(201);
    const response = await POST(event('doppelt-2', mail));
    expect(response.status).toBe(409);
    expect(await db.collection('benutzer').countDocuments({ email: mail })).toBe(1);
    expect(await db.collection('vereine').countDocuments({ name: vereinsname('doppelt-2') })).toBe(0);
  });

  it('verhindert parallele Doppelregistrierung ohne verwaisten Verein', async () => {
    const mail = email('parallel');
    const responses = await Promise.all([
      POST(event('parallel-1', mail)),
      POST(event('parallel-2', mail))
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.collection('benutzer').countDocuments({ email: mail })).toBe(1);
    const vereine = await db.collection('vereine').find({
      name: { $in: [vereinsname('parallel-1'), vereinsname('parallel-2')] }
    }).toArray();
    expect(vereine).toHaveLength(1);
    const sessions = await db.collection('sessions').countDocuments({
      vereinId: vereine[0]._id.toString()
    });
    expect(sessions).toBe(1);
  });

  it('legt einen eindeutigen Index für E-Mail-Adressen an', async () => {
    const indexes = await db.collection('benutzer').indexes();
    expect(indexes.some((index) =>
      index.unique === true && index.key?.email === 1
    )).toBe(true);
  });
});
