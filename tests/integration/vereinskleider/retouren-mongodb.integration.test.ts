import 'dotenv/config';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';

const { testClient, testDb } = vi.hoisted(() => {
  // Dynamischer Import erfolgt ausserhalb von vi.hoisted; die echten Objekte
  // werden über eine Factory erst beim Modulimport initialisiert.
  return { testClient: null, testDb: null };
});
void testClient; void testDb;

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt: niemals produktive Datenbank verwenden.');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';
import { GET, POST } from '../../../src/routes/api/vereinskleider/retouren/+server';

const vereinId = 'issue69-' + new ObjectId().toString();
const fremdvereinId = 'issue69-fremd-' + new ObjectId().toString();
const artikelId = new ObjectId();
const verkaufId = new ObjectId();
const rechnungId = new ObjectId();
const benutzer = { id: 'issue69-tester', rolle: 'admin', vereinId };

function request(ueberschreiben: Record<string, unknown> = {}, user: unknown = benutzer) {
  return {
    locals: { benutzer: user },
    request: new Request('http://localhost/api/vereinskleider/retouren', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verkaufId: verkaufId.toString(), positionsIndex: 0, menge: 1,
        grund: 'falsche_groesse', wiederverkaufbar: true,
        bemerkung: 'Integrationstest', datum: '2026-11-23', ...ueberschreiben
      })
    })
  } as never;
}
async function post(a: Record<string, unknown> = {}, user: unknown = benutzer) {
  const antwort = await POST(request(a, user));
  return { status: antwort.status, body: await antwort.json() };
}
async function zustand() {
  const [artikel, verkauf, rechnung, gutschriften, bewegungen] = await Promise.all([
    db.collection('artikel').findOne({ _id: artikelId }),
    db.collection('vereinskleider_verkaeufe').findOne({ _id: verkaufId }),
    db.collection('vereinskleider_rechnungen').findOne({ _id: rechnungId }),
    db.collection('vereinskleider_gutschriften').find({ vereinId }).toArray(),
    db.collection('lagerbewegungen').find({ vereinId }).toArray()
  ]);
  return { artikel, verkauf, rechnung, gutschriften, bewegungen };
}
async function bereinigen() {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Testdatenbank');
  for (const collection of ['artikel', 'vereinskleider_verkaeufe', 'vereinskleider_rechnungen',
    'vereinskleider_gutschriften', 'lagerbewegungen']) {
    await db.collection(collection).deleteMany({ vereinId: { $in: [vereinId, fremdvereinId] } });
  }
}
beforeAll(async () => {
  if (!process.env.MONGODB_TEST_URI || db.databaseName !== 'clubmatiq_test') {
    throw new Error('Echte MongoDB-Tests dürfen nur mit MONGODB_TEST_URI auf clubmatiq_test laufen.');
  }
  await client.connect();
  // Transaktionen benötigen einen Replica Set (Atlas-Cluster).
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error('MongoDB-Transaktionen benötigen einen Replica Set oder Sharded Cluster.');
  }
});
beforeEach(async () => {
  await bereinigen();
  await db.collection('artikel').insertOne({ _id: artikelId, vereinId, name: 'Testshirt', menge: 5 });
  await db.collection('vereinskleider_verkaeufe').insertOne({
    _id: verkaufId, vereinId, kaeufer: 'Testmitglied',
    positionen: [{ artikelId: artikelId.toString(), groesseId: null, artikelname: 'Testshirt',
      menge: 3, einzelpreis: 28, verkaufsart: 'direkt' }],
    retouren: [], rabatte: [], rabattTotal: 0
  });
  await db.collection('vereinskleider_rechnungen').insertOne({
    _id: rechnungId, vereinId, verkaufId: verkaufId.toString(),
    rechnungsnummer: 'TEST-69', positionen: [{ positionsIndex: 0,
      artikelId: artikelId.toString(), groesseId: null, menge: 3, einzelpreis: 28 }],
    gesamtbetrag: 84, bezahltBetrag: 84, gutgeschriebenBetrag: 0, rueckerstattungOffen: 0
  });
});
afterEach(bereinigen);
afterAll(async () => { await bereinigen(); await client.close(); });

describe('Issue #69 – echte MongoDB-Transaktionen für Retouren', () => {
  it('erstellt Teilretoure mit Lagerzugang, Gutschrift, Referenzen und offenem Rückerstattungsbetrag', async () => {
    const antwort = await post();
    expect(antwort.status).toBe(201);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(6);
    expect(z.verkauf?.retouren).toHaveLength(1);
    expect(z.verkauf?.retouren[0]).toMatchObject({ menge: 1, betrag: 28, wiederverkaufbar: true,
      rechnungId: rechnungId.toString(), erfasstVon: benutzer.id });
    expect(z.rechnung).toMatchObject({ gutgeschriebenBetrag: 28, rueckerstattungOffen: 28 });
    expect(z.gutschriften).toHaveLength(1);
    expect(z.gutschriften[0]).toMatchObject({ betrag: 28, rechnungId: rechnungId.toString(),
      retourId: antwort.body.retourId, clubdeskExportStatus: 'nicht_exportiert' });
    expect(z.bewegungen).toHaveLength(1);
    expect(z.bewegungen[0]).toMatchObject({ art: 'rueckgabe', mengeDelta: 1,
      referenzId: antwort.body.retourId });
  });

  it('retourniert defekte Ware ohne verfügbaren Lagerbestand zu erhöhen', async () => {
    const antwort = await post({ grund: 'defekt', wiederverkaufbar: false });
    expect(antwort.status).toBe(201);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(5);
    expect(z.bewegungen).toHaveLength(0);
    expect(z.gutschriften).toHaveLength(1);
    expect(z.rechnung?.rueckerstattungOffen).toBe(28);
  });

  it('erlaubt zwei Teilretouren, blockiert aber die vierte Rückgabe und Doppelgutschrift', async () => {
    expect((await post({ menge: 2 })).status).toBe(201);
    expect((await post({ menge: 1 })).status).toBe(201);
    expect((await post({ menge: 1 })).status).toBe(409);
    const z = await zustand();
    expect(z.verkauf?.retouren).toHaveLength(2);
    expect(z.gutschriften).toHaveLength(2);
    expect(z.artikel?.menge).toBe(8);
    expect(z.rechnung?.gutgeschriebenBetrag).toBe(84);
  });

  it('blockiert unklare Rechnungstranchen und lässt sämtliche Daten unverändert', async () => {
    await db.collection('vereinskleider_rechnungen').insertOne({
      vereinId, verkaufId: verkaufId.toString(), rechnungsnummer: 'TEST-69-ZWEI',
      positionen: [{ positionsIndex: 0, artikelId: artikelId.toString(), groesseId: null,
        menge: 1, einzelpreis: 28 }], gesamtbetrag: 28, bezahltBetrag: 0,
      gutgeschriebenBetrag: 0, rueckerstattungOffen: 0
    });
    const antwort = await post();
    expect(antwort.status).toBe(409);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(5);
    expect(z.rechnung?.gutgeschriebenBetrag).toBe(0);
    expect(z.verkauf?.retouren).toHaveLength(0);
    expect(z.gutschriften).toHaveLength(0);
    expect(z.bewegungen).toHaveLength(0);
  });

  it('weist fremde Vereine und fehlende Berechtigungen ohne Buchungen zurück', async () => {
    expect((await post({}, { ...benutzer, vereinId: fremdvereinId })).status).toBe(404);
    expect((await post({}, { ...benutzer, rolle: 'mitglied' })).status).toBe(403);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(5);
    expect(z.gutschriften).toHaveLength(0);
  });

  it('verarbeitet zwei gleichzeitig eintreffende Retouren höchstens einmal', async () => {
    const antworten = await Promise.all([post({ menge: 2 }), post({ menge: 2 })]);
    expect(antworten.filter((a) => a.status === 201)).toHaveLength(1);
    expect(antworten.filter((a) => a.status !== 201)).toHaveLength(1);
    const z = await zustand();
    expect(z.artikel?.menge).toBe(7);
    expect(z.verkauf?.retouren).toHaveLength(1);
    expect(z.gutschriften).toHaveLength(1);
    expect(z.bewegungen).toHaveLength(1);
  });

  it('liefert Retourenübersicht mit verbleibender Rückgabemenge', async () => {
    expect((await post({ menge: 1 })).status).toBe(201);
    const response = await GET({ locals: { benutzer },
      url: new URL('http://localhost/api/vereinskleider/retouren?verkaufId=' + verkaufId) } as never);
    expect(response.status).toBe(200);
    const daten = await response.json();
    expect(daten.positionen[0]).toMatchObject({ uebergeben: 3, retourniert: 1, maximal: 2 });
  });
});
