import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

// Der Mock verhindert jede Verbindung zur produktiven Datenbank.
vi.mock('../../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config();
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});



const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/verrechnung/testid/pdf', { method: 'GET', ...( 'GET' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/vereinskleider/verrechnung/testid/pdf')
  } as never;
}
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: vereinskleider-rechnungs-pdf.integration.test.ts
describe('vereinskleider/verrechnung/[id]/pdf', () => {
  it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => {
    const res = await route0.GET(event({}, id, null));
    expect(res.status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verwaltungsberechtigung den Zugriff', async () => {
    const res = await route0.GET(event({}, id, { ...admin, rolle: 'mitglied' }));
    expect(res.status).toBe(403);
  });
});

