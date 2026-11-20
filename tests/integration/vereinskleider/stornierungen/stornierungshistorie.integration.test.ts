import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('../../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config();
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../../src/lib/server/mongodb';
import { GET } from '../../../../src/routes/api/vereinskleider/bestellungen/stornierungen/historie/+server';

const vereinId = new ObjectId().toString();
const fremdId = new ObjectId().toString();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const event = (benutzer: unknown = admin) => ({ locals: { benutzer } }) as any;
const verkaufId = new ObjectId();
const fremdVerkaufId = new ObjectId();

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Testdatenbank');
  await client.connect();
  await db.collection('vereinskleider_verkaeufe').insertMany([
    {
      _id: verkaufId, vereinId, kaeufer: 'Ada Muster', riegen: ['Aktive'],
      positionen: [{ artikelId: new ObjectId().toString(), artikelname: 'T-Shirt', groesseId: null, verkaufsart: 'bestellung' }],
      stornierungen: [
        { positionsIndex: 0, menge: 1, grund: 'Falsche Grösse', storniertAm: new Date('2026-11-18T12:00:00Z') },
        { positionsIndex: 0, menge: 2, grund: 'Nicht mehr benötigt', storniertAm: new Date('2026-11-20T12:00:00Z'), storniertVon: admin.id, storniertVonName: 'Test Admin' }
      ]
    },
    {
      _id: fremdVerkaufId, vereinId: fremdId, kaeufer: 'Fremdes Mitglied',
      positionen: [{ artikelname: 'Fremd', verkaufsart: 'bestellung' }],
      stornierungen: [{ positionsIndex: 0, menge: 1, grund: 'Geheim', storniertAm: new Date() }]
    }
  ]);
});
afterAll(async () => {
  await db.collection('vereinskleider_verkaeufe').deleteMany({ _id: { $in: [verkaufId, fremdVerkaufId] } });
  await client.close();
});

describe('Vereinskleider Stornierungshistorie #61', () => {
  it('verweigert nicht angemeldeten Personen den Zugriff', async () => {
    expect((await GET(event(null))).status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verkaufsberechtigung den Zugriff', async () => {
    expect((await GET(event({ ...admin, rolle: 'mitglied' }))).status).toBe(403);
  });
  it('zeigt nur eigene Stornierungen, jede Teilstornierung einzeln und neueste zuerst', async () => {
    const res = await GET(event());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.historie).toHaveLength(2);
    expect(data.historie.map((x: any) => x.menge)).toEqual([2, 1]);
    expect(data.historie.map((x: any) => x.grund)).toEqual(['Nicht mehr benötigt', 'Falsche Grösse']);
    expect(data.historie.every((x: any) => x.vorgangId === verkaufId.toString())).toBe(true);
    expect(data.historie[0]).toMatchObject({ kaeufer: 'Ada Muster', artikelname: 'T-Shirt', storniertVonName: 'Test Admin', storniertVon: admin.id });
    expect(data.historie[1]).toMatchObject({ storniertVon: null, storniertVonName: null });
  });
});
