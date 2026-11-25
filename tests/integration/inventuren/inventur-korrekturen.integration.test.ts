import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

// Der Mock verhindert jede Verbindung zur produktiven Datenbank.
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config();
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});




import * as suite0_route0 from '../../../src/routes/api/inventuren/[id]/korrigieren/+server';

describe('inventur-korrekturen', () => {
const route0 = suite0_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/inventuren/testid/korrigieren', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/inventuren/testid/korrigieren')
  } as never;
}


// Ursprüngliche Datei: inventur-korrekturen.integration.test.ts
describe('inventuren/[id]/korrigieren', () => {
  it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => {
    const res = await route0.POST(event({}, id, null));
    expect(res.status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verwaltungsberechtigung den Zugriff', async () => {
    const res = await route0.POST(event({}, id, { ...admin, rolle: 'mitglied' }));
    expect(res.status).toBe(403);
  });
  it('weist ungültige JSON-Eingaben zurück', async () => {
    const ev = event({});
    (ev as any).request = new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{kaputt' });
    const res = await route0.POST(ev);
    expect(res.status).toBe(400);
  });
  it('ungueltige Inventur-ID', async () => {
    const res = await route0.POST(event({"positionId": "x", "neuerIstBestand": 1, "begruendung": "Korrektur nötig", "version": 0}, 'ungueltig'));
    expect(res.status).toBe(400);
  });
  it('ungueltige Position', async () => {
    const res = await route0.POST(event({"positionId": "x", "neuerIstBestand": 1, "begruendung": "Korrektur nötig", "version": 0}, id));
    expect(res.status).toBe(400);
  });
  it('negativer Bestand', async () => {
    const res = await route0.POST(event({"positionId": id, "neuerIstBestand": -1, "begruendung": "Korrektur nötig", "version": 0}, id));
    expect(res.status).toBe(400);
  });
  it('fehlende Version', async () => {
    const res = await route0.POST(event({"positionId": id, "neuerIstBestand": 1, "begruendung": "Korrektur nötig"}, id));
    expect(res.status).toBe(400);
  });
  it('zu kurze Begründung', async () => {
    const res = await route0.POST(event({"positionId": id, "neuerIstBestand": 1, "begruendung": "abc", "version": 0}, id));
    expect(res.status).toBe(400);
  });
});


});

import * as suite1_route0 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

describe('inventur-stornierung', () => {
const route0 = suite1_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/inventuren/testid/stornieren', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/inventuren/testid/stornieren')
  } as never;
}


// Ursprüngliche Datei: inventur-stornierung.integration.test.ts
describe('inventuren/[id]/stornieren', () => {
  it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => {
    const res = await route0.POST(event({}, id, null));
    expect(res.status).toBe(401);
  });
  it('verweigert Mitgliedern ohne Verwaltungsberechtigung den Zugriff', async () => {
    const res = await route0.POST(event({}, id, { ...admin, rolle: 'mitglied' }));
    expect(res.status).toBe(403);
  });
  it('weist ungültige JSON-Eingaben zurück', async () => {
    const ev = event({});
    (ev as any).request = new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{kaputt' });
    const res = await route0.POST(ev);
    expect(res.status).toBe(400);
  });
  it('ungueltige Inventur-ID', async () => {
    const res = await route0.POST(event({}, 'ungueltig'));
    expect(res.status).toBe(400);
  });
});


});
