import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';



import { verify } from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
afterAll(async () => { await client.close(); });
import * as route0 from '../../../src/routes/api/benutzer/+server';

describe('benutzer-verwaltung', () => {
const vereinId = `integration-benutzer-${new ObjectId()}`;
const fremdVereinId = `integration-fremd-${new ObjectId()}`;
const id = new ObjectId();
const fremdId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const event = (benutzer: unknown) => ({ locals: { benutzer } }) as Parameters<typeof route0.GET>[0];

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank');
  await client.connect();
  await db.collection('benutzer').insertMany([
    { _id: id, vereinId, vorname: 'Anna', nachname: 'Test', email: 'anna@example.test', rolle: 'mitglied', aktiv: true, passwortHash: 'GEHEIM' },
    { _id: fremdId, vereinId: fremdVereinId, vorname: 'Fremd', nachname: 'Person', email: 'fremd@example.test', rolle: 'admin', aktiv: true, passwortHash: 'GEHEIM' }
  ]);
});
afterAll(async () => {
  await db.collection('benutzer').deleteMany({ _id: { $in: [id, fremdId] } });
  
});


// Ursprüngliche Datei: benutzer-verwaltung.integration.test.ts
describe('Benutzerverwaltung', () => {
  it('verweigert anonymen Zugriff', async () => expect((await route0.GET(event(null))).status).toBe(401));
  it('verweigert Mitgliedern die Benutzerverwaltung', async () => expect((await route0.GET(event(mitglied))).status).toBe(403));
  it('zeigt dem Admin nur Benutzer des eigenen Vereins', async () => {
    const res = await route0.GET(event(admin));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((x: { id: string }) => x.id === id.toString())).toBe(true);
    expect(data.some((x: { id: string }) => x.id === fremdId.toString())).toBe(false);
  });
  it('gibt keine Passwort-Hashes zurück', async () => {
    const res = await route0.GET(event(admin));
    const data = await res.json();
    expect(JSON.stringify(data)).not.toContain('GEHEIM');
    expect(JSON.stringify(data)).not.toContain('passwortHash');
  });
});


});
import { GET } from '../../../src/routes/api/benutzer/+server';
import { PATCH } from '../../../src/routes/api/benutzer/[id]/+server';

describe('verwaltung-mongodb', () => {
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

});
import { POST } from '../../../src/routes/api/registrieren/+server';

describe('registrierung-mongodb', () => {
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

  it('rollt bei einem erzwungenen Fehler alle Schreibvorgänge der MongoDB-Transaktion zurück', async () => {
    const suffix = 'rollback';
    const mail = email(suffix);
    const name = vereinsname(suffix);
    const session = client.startSession();
    try {
      await expect(session.withTransaction(async () => {
        const verein = await db.collection('vereine').insertOne({ name }, { session });
        await db.collection('benutzer').insertOne({
          email: mail,
          vereinId: verein.insertedId.toString(),
          rolle: 'admin'
        }, { session });
        throw new Error('Erzwungener Fehler vor dem Commit');
      })).rejects.toThrow('Erzwungener Fehler vor dem Commit');
    } finally {
      await session.endSession();
    }
    expect(await db.collection('vereine').countDocuments({ name })).toBe(0);
    expect(await db.collection('benutzer').countDocuments({ email: mail })).toBe(0);
  });

  it('legt einen eindeutigen Index für E-Mail-Adressen an', async () => {
    const indexes = await db.collection('benutzer').indexes();
    expect(indexes.some((index) =>
      index.unique === true && index.key?.email === 1
    )).toBe(true);
  });
});

});
import { GET as liste, POST as einladen } from '../../../src/routes/api/benutzer/einladen/+server';
import { GET as pruefen, POST as annehmen } from '../../../src/routes/api/einladung/+server';

describe('einladungen-erweitert', () => {
const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
function ev(user: any = admin, body: any = {}, url = 'http://localhost/api/test', method = 'POST') {
  return { locals: { benutzer: user }, request: new Request(url, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) }), url: new URL(url), params: { id: new ObjectId().toString() } } as any;
}
beforeAll(async () => { await client.connect(); });
afterAll(async () => {
  for (const name of ['einladungen','benutzer','vereine','inventuren','inventurpositionen','inventurprotokoll','vereinskleider_verkaeufe','vereinskleider_gutschriften','vereinskleider_rechnungen','sessions']) {
    await db.collection(name).deleteMany({ vereinId: { $in: [vereinId, fremdId] } });
  }
  
});



describe('Einladungen und Annahme', () => {
  it('verweigert die Einladung ohne Anmeldung', async () => { expect((await einladen(ev(null))).status).toBe(401); });
  it('verweigert Mitgliedern Einladungen', async () => { expect((await einladen(ev(mitglied))).status).toBe(403); });
  it('validiert Pflichtfelder', async () => { expect((await einladen(ev(admin, { email:'a@b.ch', rolle:'admin' }))).status).toBe(400); });
  it('validiert Rollen', async () => { expect((await einladen(ev(admin, {vorname:'A',nachname:'B',email:'a@b.ch',rolle:'superadmin'}))).status).toBe(400); });
  it('verweigert das Einladungslisting ohne Anmeldung', async () => { expect((await liste(ev(null))).status).toBe(401); });
  it('zeigt ausschliesslich eigene Einladungen', async () => {
    await db.collection('einladungen').insertMany([{vereinId,email:'own@test.ch',vorname:'A',nachname:'B',rolle:'mitglied',status:'offen',ablaufdatum:new Date(Date.now()+86400000),erstelltAm:new Date(),tokenHash:randomBytes(32).toString('hex')},{vereinId:fremdId,email:'other@test.ch',vorname:'X',nachname:'Y',rolle:'mitglied',status:'offen',ablaufdatum:new Date(Date.now()+86400000),erstelltAm:new Date(),tokenHash:randomBytes(32).toString('hex')}]);
    const res=await liste(ev()); expect(res.status).toBe(200); const data=await res.json(); expect(data.some((x:any)=>x.email==='own@test.ch')).toBe(true); expect(data.some((x:any)=>x.email==='other@test.ch')).toBe(false);
  });
  it('weist ungültigen Token zurück', async () => { expect((await pruefen({url:new URL('http://localhost/api/einladung?token=abc')} as any)).status).toBe(400); });
  it('weist unbekannten Token zurück', async () => { expect((await pruefen({url:new URL('http://localhost/api/einladung?token='+randomBytes(32).toString('hex'))} as any)).status).toBe(404); });
  it('prüft die Mindestlänge des Passworts', async () => { expect((await annehmen(ev(null,{token:randomBytes(32).toString('hex'),passwort:'kurz'}))).status).toBe(400); });
  it('liest eine gültige Einladung', async () => {
    const token=randomBytes(32).toString('hex'); await db.collection('einladungen').insertOne({vereinId,tokenHash:createHash('sha256').update(token).digest('hex'),status:'offen',ablaufdatum:new Date(Date.now()+86400000),email:'valid@test.ch',vorname:'Ada',nachname:'Test',rolle:'mitglied',erstelltAm:new Date()});
    const res=await pruefen({url:new URL('http://localhost/api/einladung?token='+token)} as any); expect(res.status).toBe(200); expect((await res.json()).email).toBe('valid@test.ch');
  });
});

});
