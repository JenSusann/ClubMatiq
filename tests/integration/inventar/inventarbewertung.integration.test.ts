import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';

vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';
import { GET as uebersicht } from '../../../src/routes/api/inventar-uebersicht/+server';
import { GET as exportInventar } from '../../../src/routes/api/export/inventar/+server';

import { GET as aufnahmen, POST as speichern } from '../../../src/routes/api/inventarbewertung/stichtage/+server';
import { GET as aufnahmeDetail } from '../../../src/routes/api/inventarbewertung/stichtage/[id]/+server';

const vereinId = new ObjectId().toString();
const andererVerein = new ObjectId().toString();
const kategorieId = new ObjectId();
const lagerortId = new ObjectId();
const groesseS = new ObjectId();
const groesseM = new ObjectId();
const normal = new ObjectId();
const kleidung = new ObjectId();
const ohnePreis = new ObjectId();
const nullPreis = new ObjectId();
const fremd = new ObjectId();
const admin = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const mitglied = { ...admin, rolle: 'mitglied' };

function event(benutzer: unknown, parameter = '') {
  return { locals: { benutzer }, url: new URL(`http://localhost/api/export/inventar${parameter}`) };
}

async function csv(benutzer: unknown, parameter = '?modus=bewertung') {
  return exportInventar(event(benutzer, parameter) as never);
}

describe('ClubMatiq – Inventarbewertung mit MongoDB', () => {
  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') throw new Error('Nur clubmatiq_test erlaubt');
    await client.connect();
    await db.collection('kategorien').insertOne({ _id: kategorieId, vereinId, name: 'Sport' });
    await db.collection('lagerorte').insertOne({ _id: lagerortId, vereinId, name: 'Halle' });
    await db.collection('groessen').insertMany([
      { _id: groesseS, vereinId, bezeichnung: 'S', sortierung: 1 },
      { _id: groesseM, vereinId, bezeichnung: 'M', sortierung: 2 }
    ]);
    const basis = { vereinId, kategorieId: kategorieId.toString(), lagerortId: lagerortId.toString() };
    await db.collection('artikel').insertMany([
      { _id: normal, ...basis, name: 'Trainingsball', hatGroessen: false, menge: 4, einzelwert: 12.5 },
      { _id: kleidung, ...basis, name: 'Vereinstrikot', hatGroessen: true, menge: 5, einzelwert: 0 },
      { _id: ohnePreis, ...basis, name: 'Unbewerteter Artikel', hatGroessen: false, menge: 2 },
      { _id: nullPreis, ...basis, name: 'Gratisartikel', hatGroessen: false, menge: 1, einzelwert: 0 },
      { _id: fremd, vereinId: andererVerein, kategorieId: kategorieId.toString(), lagerortId: lagerortId.toString(), name: 'Fremdartikel', hatGroessen: false, menge: 999, einzelwert: 999 }
    ]);
    await db.collection('artikelvarianten').insertMany([
      { vereinId, artikelId: kleidung.toString(), groesseId: groesseS.toString(), menge: 3, einzelwert: 20, aktiv: true },
      { vereinId, artikelId: kleidung.toString(), groesseId: groesseM.toString(), menge: 2, aktiv: true }
    ]);
  });

  afterAll(async () => {
    try {
      await db.collection('inventarbewertung_aufnahmen').deleteMany({ vereinId });
      await db.collection('artikelvarianten').deleteMany({ vereinId, artikelId: kleidung.toString() });
      await db.collection('artikel').deleteMany({ _id: { $in: [normal, kleidung, ohnePreis, nullPreis, fremd] } });
      await db.collection('groessen').deleteMany({ _id: { $in: [groesseS, groesseM] } });
      await db.collection('kategorien').deleteOne({ _id: kategorieId });
      await db.collection('lagerorte').deleteOne({ _id: lagerortId });
    } finally { await client.close(); }
  });

  it('verweigert die Übersicht ohne Anmeldung', async () => {
    expect((await uebersicht(event(null) as never)).status).toBe(401);
  });
  it('liefert ausschliesslich Artikel des eigenen Vereins', async () => {
    const r = await uebersicht(event(admin) as never);
    expect(r.status).toBe(200);
    const daten = await r.json();
    expect(daten).toHaveLength(4);
    expect(daten.some((a: { name: string }) => a.name === 'Fremdartikel')).toBe(false);
  });
  it('berechnet den Wert eines Artikels ohne Grössen', async () => {
    const daten = await (await uebersicht(event(admin) as never)).json();
    expect(daten.find((a: { name: string }) => a.name === 'Trainingsball').inventarwert).toBe(50);
  });
  it('berechnet Grössenwerte separat und erkennt fehlende Variantenpreise', async () => {
    const daten = await (await uebersicht(event(admin) as never)).json();
    const a = daten.find((x: { name: string }) => x.name === 'Vereinstrikot');
    expect(a.gesamtmenge).toBe(5);
    expect(a.inventarwert).toBe(60);
    expect(a.preisFehlt).toBe(true);
    expect(a.varianten.find((v: { groesse: string }) => v.groesse === 'M').preisFehlt).toBe(true);
  });
  it('unterscheidet fehlenden Preis von CHF 0.00', async () => {
    const daten = await (await uebersicht(event(admin) as never)).json();
    expect(daten.find((a: { name: string }) => a.name === 'Unbewerteter Artikel').preisFehlt).toBe(true);
    expect(daten.find((a: { name: string }) => a.name === 'Gratisartikel').preisFehlt).toBe(false);
  });
  it('verweigert CSV ohne Anmeldung', async () => {
    expect((await csv(null)).status).toBe(401);
  });
  it('verweigert CSV für Mitglieder', async () => {
    expect((await csv(mitglied)).status).toBe(403);
  });
  it('verweigert einen ungültigen Exportmodus', async () => {
    expect((await csv(admin, '?modus=ungueltig')).status).toBe(400);
  });
  it('exportiert CSV mit CHF-Werten und ohne fremde Vereinsartikel', async () => {
    const r = await csv(admin);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/csv');
    const inhalt = await r.text();
    expect(inhalt).toContain('Trainingsball');
    expect(inhalt).toContain('50,00');
    expect(inhalt).not.toContain('Fremdartikel');
    expect(inhalt).toContain('Vereinstrikot');
  });
  it('filtert den CSV-Export auf Positionen ohne Preis', async () => {
    const r = await csv(admin, '?modus=bewertung&nurFehlende=true');
    expect(r.status).toBe(200);
    const inhalt = await r.text();
    expect(inhalt).toContain('Unbewerteter Artikel');
    expect(inhalt).toContain('Vereinstrikot');
    expect(inhalt).not.toContain('Trainingsball');
    expect(inhalt).not.toContain('Gratisartikel');
  });
  it('filtert den CSV-Export nach Suchbegriff', async () => {
    const r = await csv(admin, '?modus=bewertung&suche=Trainingsball');
    expect(r.status).toBe(200);
    const inhalt = await r.text();
    expect(inhalt).toContain('Trainingsball');
    expect(inhalt).not.toContain('Vereinstrikot');
  });
  function detail(benutzer: unknown, id: string, format = '') {
    return aufnahmeDetail({ ...event(benutzer, format), params: { id } } as never);
  }

  it('schützt Bewertungsaufnahmen vor unberechtigten Zugriffen', async () => {
    for (const [benutzer, status] of [[null, 401], [mitglied, 403]] as const) {
      expect((await speichern(event(benutzer) as never)).status).toBe(status);
      expect((await aufnahmen(event(benutzer) as never)).status).toBe(status);
      expect((await detail(benutzer, normal.toString())).status).toBe(status);
    }
  });

  it('speichert historische Werte dauerhaft und isoliert nach Verein', async () => {
    const r = await speichern(event(admin) as never);
    expect(r.status).toBe(201);
    const { _id } = await r.json();
    const liste = await (await aufnahmen(event(admin) as never)).json();
    expect(liste.find((a: { _id: string }) => a._id === _id)).not.toHaveProperty('zeilen');
    const fremderAdmin = { ...admin, vereinId: andererVerein };
    expect((await detail(fremderAdmin, _id)).status).toBe(404);
    expect(await (await aufnahmen(event(fremderAdmin) as never)).json()).toEqual([]);
    const vorher = await (await detail(admin, _id)).json();
    expect(vorher.zeilen).toHaveLength(5);
    expect(vorher.zeilen.find((z: { artikel: string }) => z.artikel === 'Trainingsball')).toMatchObject({ menge: 4, einzelwert: 12.5, gesamtwert: 50 });
    expect(vorher.zeilen.find((z: { artikel: string }) => z.artikel === 'Gratisartikel')).toMatchObject({ einzelwert: 0, gesamtwert: 0 });
    expect(vorher.zeilen.find((z: { artikel: string }) => z.artikel === 'Unbewerteter Artikel')).toMatchObject({ einzelwert: null, gesamtwert: null });
    expect(vorher.zeilen.find((z: { groesse: string }) => z.groesse === 'M')).toMatchObject({ einzelwert: null, menge: 2 });
    expect(vorher.zeilen.find((z: { groesse: string }) => z.groesse === 'S')).toMatchObject({ einzelwert: 20, gesamtwert: 60 });
    try {
      await db.collection('artikel').updateOne({ _id: normal, vereinId }, { $set: { name: 'Geändert', menge: 1, einzelwert: 99 } });
      await db.collection('artikelvarianten').updateOne({ vereinId, artikelId: kleidung.toString(), groesseId: groesseS.toString() }, { $set: { menge: 1, einzelwert: 99 } });
      expect(await (await detail(admin, _id)).json()).toEqual(vorher);
      const exportAntwort = await detail(admin, _id, '?format=csv');
      expect(exportAntwort.status).toBe(200);
      expect(exportAntwort.headers.get('content-type')).toContain('text/csv');
      const inhalt = await exportAntwort.text();
      expect(inhalt).toContain('Trainingsball');
      expect(inhalt).toContain('50,00');
      expect(inhalt).toContain('60,00');
      expect(inhalt).toContain('Bewertungsdatum');
      expect(inhalt).not.toContain('Geändert');
      expect(inhalt).not.toContain('Fremdartikel');
    } finally {
      await db.collection('artikel').updateOne({ _id: normal, vereinId }, { $set: { name: 'Trainingsball', menge: 4, einzelwert: 12.5 } });
      await db.collection('artikelvarianten').updateOne({ vereinId, artikelId: kleidung.toString(), groesseId: groesseS.toString() }, { $set: { menge: 3, einzelwert: 20 } });
    }
  });

  it('verweigert ungültige und unbekannte Aufnahme-IDs', async () => {
    expect((await detail(admin, 'ungueltig')).status).toBe(400);
    expect((await detail(admin, new ObjectId().toString())).status).toBe(404);
  });

});
