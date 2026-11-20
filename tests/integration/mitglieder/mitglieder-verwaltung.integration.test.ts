import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';


const vereinId = `integration-mitglieder-${new ObjectId()}`;
const fremdVereinId = `integration-fremd-${new ObjectId()}`;
const prefix = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const event = (benutzer: unknown, suche = '') => ({ locals: { benutzer }, url: new URL(`http://localhost/api/mitglieder?suche=${encodeURIComponent(suche)}`) }) as Parameters<typeof GET>[0];
const upload = (csv: string, benutzer: unknown = admin) => {
  const form = new FormData();
  form.set('datei', new File([csv], 'mitglieder.csv', { type: 'text/csv' }));
  return { locals: { benutzer }, request: new Request('http://localhost/api/mitglieder', { method: 'POST', body: form }) } as Parameters<typeof POST>[0];
};
const csv = (rows: string[]) => ['[Id];Vorname;Nachname;Status', ...rows].join('\r\n');

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Unsichere Testdatenbank');
  await client.connect();
  await db.collection('clubdesk_mitglieder').insertOne({ vereinId: fremdVereinId, clubdeskId: `${prefix}-fremd`, vorname: 'Fremd', nachname: 'Mitglied', aktiv: true });
});
afterAll(async () => {
  await db.collection('clubdesk_mitglieder').deleteMany({ $or: [{ vereinId }, { vereinId: fremdVereinId, clubdeskId: `${prefix}-fremd` }] });
  await client.close();
});
import * as route0 from '../../../src/routes/api/mitglieder/+server';

// Ursprüngliche Datei: mitglieder-verwaltung.integration.test.ts
describe('ClubDesk-Mitglieder', () => {
  it('verweigert anonymen Lesezugriff', async () => expect((await route0.GET(event(null))).status).toBe(401));
  it('verweigert normalen Mitgliedern den Lesezugriff', async () => expect((await route0.GET(event(mitglied))).status).toBe(403));
  it('verweigert Mitgliedern den Import', async () => expect((await route0.POST(upload(csv([`${prefix}-1;Anna;Muster;Aktiv`]), mitglied))).status).toBe(403));
  it('importiert ClubDesk-Mitglieder', async () => {
    const res = await route0.POST(upload(csv([`${prefix}-1;Anna;Muster;Aktiv`, `${prefix}-2;Bea;Beispiel;Aktiv`])));
    expect(res.status).toBe(200);
    expect((await res.json()).eingelesen).toBe(2);
  });
  it('filtert die Mitglieder nach Namen', async () => {
    const res = await route0.GET(event(admin, 'Anna Muster'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((x: { clubdeskId: string }) => x.clubdeskId === `${prefix}-1`)).toBe(true);
  });
  it('trennt fremde Vereine', async () => {
    const data = await (await route0.GET(event(admin))).json();
    expect(data.some((x: { clubdeskId: string }) => x.clubdeskId === `${prefix}-fremd`)).toBe(false);
  });
  it('aktualisiert vorhandene ClubDesk-Datensätze beim erneuten Import', async () => {
    const res = await route0.POST(upload(csv([`${prefix}-1;Anna;Aktualisiert;Aktiv`])));
    expect(res.status).toBe(200);
    expect(await db.collection('clubdesk_mitglieder').countDocuments({ vereinId, clubdeskId: `${prefix}-1` })).toBe(1);
    expect((await db.collection('clubdesk_mitglieder').findOne({ vereinId, clubdeskId: `${prefix}-1` }))?.nachname).toBe('Aktualisiert');
  });
  it('weist CSV mit doppelten ClubDesk-IDs zurück', async () => {
    await expect(route0.POST(upload(csv([`${prefix}-3;A;B;Aktiv`, `${prefix}-3;C;D;Aktiv`])))).rejects.toMatchObject({ status: 400 });
  });
  it('weist CSV ohne Pflichtspalten zurück', async () => {
    await expect(route0.POST(upload('Vorname;Nachname\nAnna;Test'))).rejects.toMatchObject({ status: 400 });
  });
});

