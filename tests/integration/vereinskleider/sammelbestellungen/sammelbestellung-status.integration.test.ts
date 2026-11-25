import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { assertTestDb, event, oid, vereinId, fremderVerein } from '../../helper';
vi.mock('../../../../src/lib/server/mongodb', async () => { const { config } = await import('dotenv'); config({ path: '.env' }); const { MongoClient } = await import('mongodb'); if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt'); const client = new MongoClient(process.env.MONGODB_TEST_URI); return { client, db: client.db('clubmatiq_test') }; });
import { db, client } from '../../../../src/lib/server/mongodb';


afterAll(async () => { await client.close(); });
import * as suite0_route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

describe('sammelbestellung-status', () => {
const route0 = suite0_route0;
const ids: ObjectId[] = [];
async function fixture(status = 'entwurf', club = vereinId) { const _id = oid(); ids.push(_id); await db.collection('vereinskleider_sammelbestellungen').insertOne({ _id, vereinId: club, status, positionen: [{ artikelId: oid().toString(), groesseId: null, artikelname: 'Test', menge: 2 }], aktualisiertAm: new Date() }); return _id; }
beforeAll(async () => { assertTestDb(db); await client.connect(); });
afterAll(async () => { await db.collection('vereinskleider_sammelbestellungen').deleteMany({ _id: { $in: ids } });  });


// Ursprüngliche Datei: sammelbestellung-status.integration.test.ts
describe('Paket 8 – Sammelbestellung Statuswechsel', () => {
 it('setzt Entwurf auf bestellt', async () => { const id = await fixture(); const res = await route0.PATCH(event({ aktion: 'bestellen' }, id.toString())); expect(res.status).toBe(200); expect((await db.collection('vereinskleider_sammelbestellungen').findOne({ _id: id }))?.status).toBe('bestellt'); });
 it('verhindert doppelte Bestellung', async () => { const id = await fixture('bestellt'); expect((await route0.PATCH(event({ aktion: 'bestellen' }, id.toString()))).status).toBe(409); });
 it('verhindert Bestellung fremden Vereins', async () => { const id = await fixture('entwurf', fremderVerein); expect((await route0.PATCH(event({ aktion: 'bestellen' }, id.toString()))).status).toBe(404); });
 it('verhindert Wareneingang auf Entwurf', async () => { const id = await fixture(); const res = await route0.PATCH(event({ aktion: 'wareneingang', positionen: [{ artikelId: oid().toString(), groesseId: null, menge: 1 }] }, id.toString())); expect(res.status).toBe(409); });
});


});
import * as suite1_route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

describe('vereinskleider-sammelbestellungen-2', () => {
const route0 = suite1_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/sammelbestellungen', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/vereinskleider/sammelbestellungen')
  } as never;
}


// Ursprüngliche Datei: vereinskleider-sammelbestellungen.integration.test.ts
describe('vereinskleider/sammelbestellungen', () => {
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
});


});
import * as suite2_route0 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

describe('vereinskleider-stornierungen', () => {
const route0 = suite2_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/stornierungen', { method: 'POST', ...( 'POST' === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {} ) }),
    url: new URL('http://localhost/api/vereinskleider/stornierungen')
  } as never;
}


// Ursprüngliche Datei: vereinskleider-stornierungen.integration.test.ts
describe('vereinskleider/stornierungen', () => {
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
  it('ungueltige Verkaufs-ID', async () => {
    const res = await route0.POST(event({"verkaufId": "x", "positionsIndex": 0, "menge": 1, "grund": "Test"}, id));
    expect(res.status).toBe(400);
  });
  it('Menge Null', async () => {
    const res = await route0.POST(event({"verkaufId": id, "positionsIndex": 0, "menge": 0, "grund": "Test"}, id));
    expect(res.status).toBe(400);
  });
  it('fehlender Grund', async () => {
    const res = await route0.POST(event({"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": ""}, id));
    expect(res.status).toBe(400);
  });
  it('negativer Positionsindex', async () => {
    const res = await route0.POST(event({"verkaufId": id, "positionsIndex": -1, "menge": 1, "grund": "Test"}, id));
    expect(res.status).toBe(400);
  });
});


});
import * as suite3_route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

describe('vereinskleider-rechnungs-pdf', () => {
const route0 = suite3_route0;
const id = new ObjectId().toHexString();
const admin = { id: new ObjectId().toHexString(), vereinId: new ObjectId().toHexString(), rolle: 'admin', aktiv: true };
function event(payload: unknown, ident = id, benutzer: unknown = admin) {
  return {
    params: { id: ident },
    locals: { benutzer },
    request: new Request('http://localhost/api/vereinskleider/verrechnung/testid/pdf', { method: 'GET',  }),
    url: new URL('http://localhost/api/vereinskleider/verrechnung/testid/pdf')
  } as never;
}


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


});
