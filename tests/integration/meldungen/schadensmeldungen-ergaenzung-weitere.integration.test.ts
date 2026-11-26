import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';
import { GET as liste, POST as melden } from '../../../src/routes/api/meldungen/+server';
import { PATCH as bearbeiten } from '../../../src/routes/api/meldungen/[id]/+server';
const vereinId = new ObjectId().toString();
const artikelId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, id: new ObjectId().toString(), rolle: 'mitglied', vorname: 'Test', nachname: 'Mitglied' };
const fremd = { ...admin, vereinId: new ObjectId().toString() };
function ev(benutzer: unknown, id?: string, body?: unknown) {
  return { locals: { benutzer }, params: { id }, request: new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }) };
}
describe('Schadensmeldungen – echte MongoDB', () => {
  let meldungId = '';
  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank');
    await client.connect();
    await db.collection('artikel').insertOne({ _id: artikelId, vereinId, name: 'Testmaterial', menge: 2 });
  });
  afterAll(async () => {
    try {
      await db.collection('schadensmeldungen').deleteMany({ vereinId });
      await db.collection('artikel').deleteOne({ _id: artikelId, vereinId });
    } finally { await client.close(); }
  });
  it('verlangt eine Anmeldung', async () => {
    expect((await liste(ev(null) as never)).status).toBe(401);
  });
  it('verweigert leere Beschreibung', async () => {
    expect((await melden(ev(mitglied, undefined, { artikelId: artikelId.toString(), beschreibung: ' ' }) as never)).status).toBe(400);
  });
  it('verweigert Artikel anderer Vereine', async () => {
    expect((await melden(ev(fremd, undefined, { artikelId: artikelId.toString(), beschreibung: 'Defekt' }) as never)).status).toBe(404);
  });
  it('verweigert mehr als drei Fotos', async () => {
    expect((await melden(ev(mitglied, undefined, { artikelId: artikelId.toString(), beschreibung: 'Defekt', fotos: [{}, {}, {}, {}] }) as never)).status).toBe(400);
  });
  it('erstellt eine Schadensmeldung als Mitglied', async () => {
    const res = await melden(ev(mitglied, undefined, { artikelId: artikelId.toString(), beschreibung: '  Material beschädigt  ' }) as never);
    expect(res.status).toBe(201);
    meldungId = (await res.json()).meldungId;
    const dokument = await db.collection('schadensmeldungen').findOne({ _id: new ObjectId(meldungId), vereinId });
    expect(dokument).toMatchObject({ status: 'offen', beschreibung: 'Material beschädigt', gemeldetVonId: mitglied.id });
  });
  it('Mitglieder sehen nur eigene Meldungen', async () => {
    const res = await liste(ev(mitglied) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).map((x: { _id: string }) => x._id)).toContain(meldungId);
  });
  it('Admin sieht alle Meldungen des Vereins', async () => {
    const res = await liste(ev(admin) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).map((x: { _id: string }) => x._id)).toContain(meldungId);
  });
  it('Mitglied darf Meldung nicht bearbeiten', async () => {
    expect((await bearbeiten(ev(mitglied, meldungId, { status: 'erledigt', bearbeitungsnotiz: 'ok' }) as never)).status).toBe(403);
  });
  it('verweigert ungültigen Status', async () => {
    expect((await bearbeiten(ev(admin, meldungId, { status: 'unbekannt', bearbeitungsnotiz: '' }) as never)).status).toBe(400);
  });
  it('Admin bearbeitet Meldung', async () => {
    const res = await bearbeiten(ev(admin, meldungId, { status: 'erledigt', bearbeitungsnotiz: 'Repariert' }) as never);
    expect(res.status).toBe(200);
    expect((await db.collection('schadensmeldungen').findOne({ _id: new ObjectId(meldungId) }))?.status).toBe('erledigt');
  });
  it('fremder Verein darf Meldung nicht ändern', async () => {
    expect((await bearbeiten(ev(fremd, meldungId, { status: 'offen', bearbeitungsnotiz: '' }) as never)).status).toBe(404);
  });

  it('bewahrt frühere Bearbeitungsschritte und liefert sie dem meldenden Mitglied', async () => {
    const id = new ObjectId();
    const col = db.collection('schadensmeldungen');
    await col.insertOne({ _id: id, vereinId, gemeldetVonId: mitglied.id, status: 'offen', bearbeitungsnotiz: 'Alt' });
    for (const [status, notiz] of [['in_bearbeitung', 'Prüfung'], ['erledigt', '$status']]) {
      expect((await bearbeiten(ev(admin, String(id), { status, bearbeitungsnotiz: notiz }) as never)).status).toBe(200);
    }
    const doc = await col.findOne({ _id: id, vereinId });
    expect(doc?.bearbeitungsverlauf).toEqual([
      expect.objectContaining({ alterStatus: 'offen', neuerStatus: 'in_bearbeitung', alteNotiz: 'Alt', notiz: 'Prüfung', datum: expect.any(Date), bearbeitetVonId: admin.id }),
      expect.objectContaining({ alterStatus: 'in_bearbeitung', neuerStatus: 'erledigt', alteNotiz: 'Prüfung', notiz: '$status' })
    ]);
    expect(doc?.bearbeitungsnotiz).toBe('$status');
    const rows = await (await liste(ev(mitglied) as never)).json();
    expect(rows.find((x: { _id: string }) => x._id === String(id))?.bearbeitungsverlauf).toHaveLength(2);
    const fremdeRows = await (await liste(ev(fremd) as never)).json();
    expect(fremdeRows.some((x: { _id: string }) => x._id === String(id))).toBe(false);
    expect((await bearbeiten(ev(fremd, String(id), { status: 'offen', bearbeitungsnotiz: 'Fremd' }) as never)).status).toBe(404);
    expect((await bearbeiten(ev(mitglied, String(id), { status: 'offen', bearbeitungsnotiz: 'Mitglied' }) as never)).status).toBe(403);
    expect((await col.findOne({ _id: id }))?.bearbeitungsverlauf).toEqual(doc?.bearbeitungsverlauf);
  });

  it('speichert parallele Änderungen ohne verlorene Historieneinträge', async () => {
    const id = new ObjectId();
    const col = db.collection('schadensmeldungen');
    await col.insertOne({ _id: id, vereinId, status: 'offen', bearbeitungsnotiz: '' });
    const responses = await Promise.all([
      bearbeiten(ev(admin, String(id), { status: 'in_bearbeitung', bearbeitungsnotiz: 'A' }) as never),
      bearbeiten(ev({ ...admin, rolle: 'materialverantwortlich', id: mitglied.id }, String(id), { status: 'erledigt', bearbeitungsnotiz: 'B' }) as never)
    ]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const doc = await col.findOne({ _id: id, vereinId });
    const history = doc?.bearbeitungsverlauf;
    expect(history).toHaveLength(2);
    expect(history[0].alterStatus).toBe('offen');
    expect(history[1].alterStatus).toBe(history[0].neuerStatus);
    expect(history[1].alteNotiz).toBe(history[0].notiz);
    expect(doc?.status).toBe(history[1].neuerStatus);
    expect(doc?.bearbeitungsnotiz).toBe(history[1].notiz);
    expect(history.map((x: { notiz: string }) => x.notiz).sort()).toEqual(['A', 'B']);
    expect(history.map((x: { bearbeitetVonId: string }) => x.bearbeitetVonId).sort()).toEqual([admin.id, mitglied.id].sort());
  });
});
