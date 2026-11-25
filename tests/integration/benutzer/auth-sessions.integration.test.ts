import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { hash } from 'argon2';
import { createHash } from 'node:crypto';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});
import { db, client } from '../../../src/lib/server/mongodb';
import { POST as login } from '../../../src/routes/api/anmelden/+server';
import { POST as logout } from '../../../src/routes/api/abmelden/+server';
import { handle } from '../../../src/hooks.server';
async function geschuetzterZugriff(sessionToken: string) {
  const cookies = { get: () => sessionToken, delete: vi.fn() };
  const event = { url: new URL('http://localhost/api/artikel'), cookies, locals: { benutzer: null, sessionId: null } };
  const resolve = vi.fn(async () => new Response('OK'));
  const response = await handle({ event, resolve } as never);
  return { response, cookies, resolve };
}
const vereinId = new ObjectId().toString();
const id = new ObjectId();
const email = `test-${id.toString()}@example.invalid`;
let token: string | undefined;
const cookie = { set: (_name: string, value: string) => { token = value; }, get: () => token, delete: () => { token = undefined; } };
function loginEvent(passwort: unknown, adresse: unknown = email) { return { request: new Request('http://localhost/api/anmelden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: adresse, passwort }) }), cookies: cookie }; }
beforeAll(async () => { if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank'); await client.connect(); await db.collection('benutzer').insertOne({ _id: id, vereinId, email, vorname: 'Test', nachname: 'Login', rolle: 'admin', aktiv: true, passwortHash: await hash('Testpasswort!123') }); });
afterAll(async () => { await db.collection('sessions').deleteMany({ vereinId }); await db.collection('benutzer').deleteOne({ _id: id }); await client.close(); });
describe('Anmeldung und Session', () => {
  it('verweigert leere Anmeldedaten', async () => { expect((await login(loginEvent('') as never)).status).toBe(400); });
  it('verweigert unbekannte E-Mail', async () => { expect((await login(loginEvent('Testpasswort!123', 'unbekannt@example.invalid') as never)).status).toBe(401); });
  it('verweigert falsches Passwort', async () => { expect((await login(loginEvent('falsch') as never)).status).toBe(401); });
  it('erstellt Session mit gehashtem Token', async () => { const r = await login(loginEvent('Testpasswort!123') as never); expect(r.status).toBe(200); expect(token).toBeTruthy(); const s = await db.collection('sessions').findOne({ tokenHash: createHash('sha256').update(token!).digest('hex') }); expect(s?.vereinId).toBe(vereinId); expect(s?.tokenHash).not.toBe(token); });
  it('löscht Session beim Abmelden', async () => { const old = token!; const r = await logout({ cookies: cookie }); expect(r.status).toBe(200); expect(token).toBeUndefined(); expect(await db.collection('sessions').countDocuments({ tokenHash: createHash('sha256').update(old).digest('hex') })).toBe(0); });
  it('verweigert wiederverwendete Tokens nach Abmeldung', async () => {
    expect((await login(loginEvent('Testpasswort!123') as never)).status).toBe(200);
    const old = token!;
    expect((await geschuetzterZugriff(old)).response.status).toBe(200);
    expect((await logout({ cookies: cookie })).status).toBe(200);
    const result = await geschuetzterZugriff(old);
    expect(result.response.status).toBe(401);
    expect(result.resolve).not.toHaveBeenCalled();
    expect(result.cookies.delete).toHaveBeenCalled();
  });
  it('verweigert abgelaufene Sessions trotz vorhandenem Datenbankeintrag', async () => {
    expect((await login(loginEvent('Testpasswort!123') as never)).status).toBe(200);
    const old = token!;
    await db.collection('sessions').updateOne({ tokenHash: createHash('sha256').update(old).digest('hex') }, { $set: { ablaufdatum: new Date(Date.now() - 60000) } });
    const result = await geschuetzterZugriff(old);
    expect(result.response.status).toBe(401);
    expect(result.resolve).not.toHaveBeenCalled();
    expect(result.cookies.delete).toHaveBeenCalled();
    await logout({ cookies: cookie });
  });
  it('begrenzt neue Sessions auf zwei Stunden', async () => {
    expect((await login(loginEvent('Testpasswort!123') as never)).status).toBe(200);
    const s = await db.collection('sessions').findOne({ tokenHash: createHash('sha256').update(token!).digest('hex') });
    expect(s!.ablaufdatum.getTime() - s!.erstelltAm.getTime()).toBeGreaterThan(7199000);
    expect(s!.ablaufdatum.getTime() - s!.erstelltAm.getTime()).toBeLessThanOrEqual(7200000);
    await logout({ cookies: cookie });
  });
  it('verweigert Zugriff nach 30 Minuten Inaktivität', async () => {
    expect((await login(loginEvent('Testpasswort!123') as never)).status).toBe(200);
    await db.collection('sessions').updateOne({ tokenHash: createHash('sha256').update(token!).digest('hex') }, { $set: { letzteAktivitaet: new Date(Date.now() - 31 * 60000) } });
    expect((await geschuetzterZugriff(token!)).response.status).toBe(401);
    await logout({ cookies: cookie });
  });
  it('verweigert alte Sessions trotz neuer Aktivität und späterem Ablaufdatum', async () => {
    expect((await login(loginEvent('Testpasswort!123') as never)).status).toBe(200);
    await db.collection('sessions').updateOne({ tokenHash: createHash('sha256').update(token!).digest('hex') }, { $set: { erstelltAm: new Date(Date.now() - 121 * 60000) } });
    expect((await geschuetzterZugriff(token!)).response.status).toBe(401);
    await logout({ cookies: cookie });
  });
  it('erlaubt Abmeldung ohne bestehende Session', async () => { expect((await logout({ cookies: cookie })).status).toBe(200); });
});
