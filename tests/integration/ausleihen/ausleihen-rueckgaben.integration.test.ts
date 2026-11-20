import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt.');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';
import { POST as ausleihen } from '../../../src/routes/api/ausleihen/+server';
import { POST as rueckgeben } from '../../../src/routes/api/ausleihen/[id]/rueckgabe/+server';

const vereinId = new ObjectId().toString();
const fremderVereinId = new ObjectId().toString();
const artikelId = new ObjectId();
const fremderArtikelId = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };

function event(benutzer: unknown, daten: unknown, id?: string) {
  return {
    locals: { benutzer },
    params: { id },
    request: new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(daten)
    })
  };
}

function ausleihdaten(menge: number, id = artikelId.toString()) {
  return {
    artikelId: id,
    person: 'Testperson',
    menge,
    ausleihdatum: '2026-11-19',
    rueckgabedatum: '2026-11-26'
  };
}

async function bestand() {
  const artikel = await db.collection('artikel').findOne({ _id: artikelId, vereinId });
  return artikel?.menge;
}

describe('ClubMatiq API – Ausleihen und Rückgaben', () => {
  let ausleiheId = '';

  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') {
      throw new Error('Tests dürfen nur clubmatiq_test verwenden.');
    }
    await client.connect();
    await db.collection('artikel').insertMany([
      { _id: artikelId, vereinId, name: 'Testball', menge: 10, hatGroessen: false },
      { _id: fremderArtikelId, vereinId: fremderVereinId, name: 'Fremder Ball', menge: 8, hatGroessen: false }
    ]);
  });

  afterAll(async () => {
    try {
      await db.collection('ausleihen').deleteMany({ vereinId });
      await db.collection('artikel').deleteMany({ _id: { $in: [artikelId, fremderArtikelId] } });
    } finally {
      await client.close();
    }
  });

  it('verweigert Ausleihen ohne Anmeldung', async () => {
    const response = await ausleihen(event(null, ausleihdaten(2)) as never);
    expect(response.status).toBe(401);
    expect(await bestand()).toBe(10);
  });

  it('verweigert Ausleihen ohne Berechtigung', async () => {
    const response = await ausleihen(event(mitglied, ausleihdaten(2)) as never);
    expect(response.status).toBe(403);
    expect(await bestand()).toBe(10);
  });

  it('verweigert Ausleihen von Artikeln fremder Vereine', async () => {
    const response = await ausleihen(event(admin, ausleihdaten(2, fremderArtikelId.toString())) as never);
    expect(response.status).toBe(400);
    const fremderArtikel = await db.collection('artikel').findOne({ _id: fremderArtikelId });
    expect(fremderArtikel?.menge).toBe(8);
  });

  it('erfasst eine Ausleihe und reduziert den Bestand', async () => {
    const response = await ausleihen(event(admin, ausleihdaten(6)) as never);
    expect(response.status).toBe(201);
    const daten = await response.json();
    ausleiheId = daten.ausleiheId;
    expect(ObjectId.isValid(ausleiheId)).toBe(true);
    expect(await bestand()).toBe(4);
  });

  it('verhindert eine zweite Ausleihe mit zu grosser Menge', async () => {
    const response = await ausleihen(event(admin, ausleihdaten(5)) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(4);
  });

  it('verweigert eine ungültige Rückgabemenge', async () => {
    const response = await rueckgeben(event(admin, { menge: 0 }, ausleiheId) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(4);
  });

  it('verweigert eine Rückgabe durch nicht berechtigte Mitglieder', async () => {
    const response = await rueckgeben(event(mitglied, { menge: 2 }, ausleiheId) as never);
    expect(response.status).toBe(403);
    expect(await bestand()).toBe(4);
  });

  it('verweigert eine Rückgabe für einen anderen Verein', async () => {
    const response = await rueckgeben(
      event({ ...admin, vereinId: fremderVereinId }, { menge: 2 }, ausleiheId) as never
    );
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(4);
  });

  it('bucht eine Teilrückgabe korrekt zurück', async () => {
    const response = await rueckgeben(event(admin, { menge: 2 }, ausleiheId) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erfolg: true, status: 'teilweise', zurueckgegeben: 2, offen: 4
    });
    expect(await bestand()).toBe(6);
    const ausleihe = await db.collection('ausleihen').findOne({ _id: new ObjectId(ausleiheId) });
    expect(ausleihe?.rueckgaben).toHaveLength(1);
  });

  it('verhindert die Rückgabe von mehr als der offenen Menge', async () => {
    const response = await rueckgeben(event(admin, { menge: 5 }, ausleiheId) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(6);
  });

  it('schliesst die Ausleihe bei vollständiger Rückgabe ab', async () => {
    const response = await rueckgeben(event(admin, { menge: 4 }, ausleiheId) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erfolg: true, status: 'abgeschlossen', zurueckgegeben: 6, offen: 0
    });
    expect(await bestand()).toBe(10);
    const ausleihe = await db.collection('ausleihen').findOne({ _id: new ObjectId(ausleiheId) });
    expect(ausleihe?.rueckgaben).toHaveLength(2);
    expect(ausleihe?.abgeschlossenAm).toBeInstanceOf(Date);
  });

  it('verhindert doppelte Rückgabe nach Abschluss', async () => {
    const response = await rueckgeben(event(admin, { menge: 1 }, ausleiheId) as never);
    expect(response.status).toBe(400);
    expect(await bestand()).toBe(10);
  });
});
