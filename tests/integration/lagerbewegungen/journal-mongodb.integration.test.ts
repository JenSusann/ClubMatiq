import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';
import ExcelJS from 'exceljs';

// Niemals Produktionsdaten verwenden. Alle Testdaten erhalten einen eindeutigen Prefix.
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI fehlt – Test abgebrochen');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});

import { client, db } from '../../../src/lib/server/mongodb';
import { GET as journalGET } from '../../../src/routes/api/lagerbewegungen/gesamt/+server';
import { GET as exportGET } from '../../../src/routes/api/export/lagerbewegungen/+server';

const prefix = 'issue66-' + new ObjectId().toString();
const vereinId = prefix + '-verein';
const fremdvereinId = prefix + '-fremd';
const artikelId = new ObjectId();
const fremdArtikelId = new ObjectId();
const benutzerId = new ObjectId();
const admin = { id: benutzerId.toString(), vereinId, rolle: 'admin' };
const fremdAdmin = { id: new ObjectId().toString(), vereinId: fremdvereinId, rolle: 'admin' };
const mitglied = { id: new ObjectId().toString(), vereinId, rolle: 'mitglied' };

function event(path: string, benutzer: unknown = admin) {
  return { locals: { benutzer }, url: new URL('http://localhost' + path) } as never;
}
function bewegung(i: number, verein: string, artikel: ObjectId, referenz: string) {
  return {
    _id: new ObjectId(), vereinId: verein, artikelId: artikel.toString(),
    zeitpunkt: new Date(Date.UTC(2026, 10, 23, 12, 0, 0) - i * 1000),
    art: 'rueckgabe', mengeDelta: 1, benutzerId: benutzerId.toString(),
    referenzTyp: 'test', referenzId: referenz
  };
}
async function workbook(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  return wb.getWorksheet('Lagerbewegungen')!;
}

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Datenbank');
  await client.connect();
  await db.collection('artikel').insertMany([
    { _id: artikelId, vereinId, name: 'Testshirt ÄÖÜ' },
    { _id: fremdArtikelId, vereinId: fremdvereinId, name: 'Geheimes Shirt' }
  ]);
  await db.collection('benutzer').insertOne({ _id: benutzerId, vereinId, vorname: 'Test', nachname: 'Person', email: prefix + '@example.invalid' });
  await db.collection('lagerbewegungen').insertMany([
    ...Array.from({ length: 200 }, (_, i) => bewegung(i, vereinId, artikelId, prefix + '-normal-' + i)),
    bewegung(200, vereinId, artikelId, prefix + '-gesucht'),
    bewegung(0, fremdvereinId, fremdArtikelId, prefix + '-fremd')
  ]);
});

afterAll(async () => {
  if (db.databaseName === 'clubmatiq_test') {
    await db.collection('lagerbewegungen').deleteMany({ referenzId: { $regex: '^' + prefix } });
    await db.collection('artikel').deleteMany({ _id: { $in: [artikelId, fremdArtikelId] } });
    await db.collection('benutzer').deleteOne({ _id: benutzerId });
  }
  await client.close();
});

describe('Issue #66 – Lagerjournal mit echter MongoDB', () => {
  it('isoliert die Vorschau zwischen Vereinen und begrenzt sie auf 200', async () => {
    const res = await journalGET(event('/api/lagerbewegungen/gesamt'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bewegungen).toHaveLength(200);
    expect(data.bewegungen.every((b: { referenzId: string }) => b.referenzId.startsWith(prefix + '-normal-'))).toBe(true);
    const fremd = await journalGET(event('/api/lagerbewegungen/gesamt', fremdAdmin));
    expect((await fremd.json()).bewegungen.map((b: { referenzId: string }) => b.referenzId)).toContain(prefix + '-fremd');
  });

  it('findet in echter MongoDB einen Treffer jenseits der 200 jüngsten Einträge', async () => {
    const res = await journalGET(event('/api/lagerbewegungen/gesamt?suche=' + encodeURIComponent(prefix + '-gesucht')));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bewegungen).toHaveLength(1);
    expect(data.bewegungen[0].referenzId).toBe(prefix + '-gesucht');
  });

  it('exportiert alle 201 Bewegungen des Vereins als gültiges XLSX mit Namen und Umlauten', async () => {
    const sheet = await workbook(await exportGET(event('/api/export/lagerbewegungen')));
    expect(sheet.getRow(4).getCell(2).value).toBe('Artikel');
    expect(sheet.rowCount).toBe(205);
    expect(sheet.getRow(5).getCell(2).value).toBe('Testshirt ÄÖÜ');
    expect(sheet.getRow(205).getCell(9).value).toBe(prefix + '-gesucht');
    for (let row = 5; row <= 205; row++) {
      expect(String(sheet.getRow(row).getCell(9).value)).not.toContain('-fremd');
    }
  });

  it('filtert Excel-Export und Vorschau gleich nach Referenz und Bewegungstyp', async () => {
    const query = '?art=rueckgabe&suche=' + encodeURIComponent(prefix + '-gesucht');
    const preview = await journalGET(event('/api/lagerbewegungen/gesamt' + query));
    expect((await preview.json()).bewegungen).toHaveLength(1);
    const sheet = await workbook(await exportGET(event('/api/export/lagerbewegungen' + query)));
    expect(sheet.rowCount).toBe(5);
    expect(sheet.getRow(5).getCell(9).value).toBe(prefix + '-gesucht');
  });

  it('verhindert Fremdartikel-Zugriff und ungültige Filter', async () => {
    const url = '/api/export/lagerbewegungen?artikelId=' + fremdArtikelId.toString();
    expect((await exportGET(event(url))).status).toBe(404);
    expect((await journalGET(event('/api/lagerbewegungen/gesamt?artikelId=' + fremdArtikelId.toString()))).status).toBe(404);
    expect((await exportGET(event('/api/export/lagerbewegungen?art=ungueltig'))).status).toBe(400);
  });

  it('verlangt für beide Endpunkte eine gültige Anmeldung', async () => {
    expect((await journalGET(event('/api/lagerbewegungen/gesamt', null))).status).toBe(401);
    expect((await exportGET(event('/api/export/lagerbewegungen', null))).status).toBe(401);
    // Mitglieder haben im Rollenmodell Leserechte; dieser Fall darf nicht pauschal 403 liefern.
    expect((await journalGET(event('/api/lagerbewegungen/gesamt', mitglied))).status).toBe(200);
  });

  it('misst Vorschau, Tiefensuche und XLSX-Export mit 2500 zusätzlichen Bewegungen', async () => {
    // Performance-Messung mit echter Testdatenbank; keine starre SLA, da Atlas/Netzwerk schwanken.
    const anzahl = 2500;
    const marker = prefix + '-lasttest-';
    const daten = Array.from({ length: anzahl }, (_, i) => bewegung(i + 300, vereinId, artikelId, marker + i));
    await db.collection('lagerbewegungen').insertMany(daten, { ordered: false });
    try {
      const startVorschau = performance.now();
      const vorschau = await journalGET(event('/api/lagerbewegungen/gesamt'));
      const vorschauMs = Math.round(performance.now() - startVorschau);
      expect(vorschau.status).toBe(200);
      expect((await vorschau.json()).bewegungen).toHaveLength(200);

      const startSuche = performance.now();
      const suche = await journalGET(event('/api/lagerbewegungen/gesamt?suche=' + encodeURIComponent(marker + '2499')));
      const sucheMs = Math.round(performance.now() - startSuche);
      expect(suche.status).toBe(200);
      const treffer = (await suche.json()).bewegungen;
      expect(treffer).toHaveLength(1);
      expect(treffer[0].referenzId).toBe(marker + '2499');

      const startExport = performance.now();
      const excel = await exportGET(event('/api/export/lagerbewegungen'));
      const exportMs = Math.round(performance.now() - startExport);
      const sheet = await workbook(excel);
      expect(sheet.rowCount).toBe(4 + 201 + anzahl);
      console.info('[Issue #66 Performance]', JSON.stringify({
        bewegungen: 201 + anzahl, vorschauMs, tiefensucheMs: sucheMs, xlsxExportMs: exportMs
      }));
    } finally {
      await db.collection('lagerbewegungen').deleteMany({ vereinId, referenzId: { $regex: '^' + marker } });
    }
  }, 60000);
});

describe('Issue #51 – atomare Bestandsbewegung', () => {
  it('rollt Bestand und Journal gemeinsam zurück', async () => {
    const { protokolliereLagerbewegung } = await import('../../../src/lib/server/lagerbewegungen');
    const id=new ObjectId(), referenzId=prefix+'-rollback';
    const session=client.startSession();
    try {
      await db.collection('artikel').insertOne({_id:id,vereinId,menge:5});
      await expect(session.withTransaction(async()=>{
        await db.collection('artikel').updateOne({_id:id,vereinId},{$inc:{menge:-2}},{session});
        await protokolliereLagerbewegung({vereinId,artikelId:id.toString(),groesseId:null,art:'ausleihe',mengeDelta:-2,benutzerId:admin.id,referenzId,referenzTyp:'test'},session);
        throw new Error('Erzwungener Rollback');
      })).rejects.toThrow('Erzwungener Rollback');
      expect((await db.collection('artikel').findOne({_id:id,vereinId}))?.menge).toBe(5);
      expect(await db.collection('lagerbewegungen').countDocuments({vereinId,referenzId})).toBe(0);
    } finally {
      await session.endSession();
      await db.collection('artikel').deleteOne({_id:id,vereinId});
      await db.collection('lagerbewegungen').deleteMany({vereinId,referenzId});
    }
  });
});

describe('Issue #51 – historische Journalnamen', () => {
  it('behält Namen nach Umbenennung und Löschung in Vorschau und Excel', async () => {
    const { protokolliereLagerbewegung } = await import('../../../src/lib/server/lagerbewegungen');
    const id = new ObjectId(), groesseId = new ObjectId(), personId = new ObjectId();
    const referenzId = prefix + '-snapshot';
    const session = client.startSession();
    try {
      await db.collection('artikel').insertOne({ _id: id, vereinId, name: 'Historisches Shirt', menge: 2 });
      await db.collection('groessen').insertOne({ _id: groesseId, vereinId, bezeichnung: 'Historische Grösse' });
      await db.collection('benutzer').insertOne({ _id: personId, vereinId, vorname: 'Historische', nachname: 'Person', email: prefix + '-snapshot@example.invalid' });
      await session.withTransaction(async () => {
        await db.collection('artikel').updateOne({ _id: id, vereinId }, { $inc: { menge: -1 } }, { session });
        await protokolliereLagerbewegung({ vereinId, artikelId: id.toString(), groesseId: groesseId.toString(), art: 'verkauf', mengeDelta: -1, benutzerId: personId.toString(), referenzId, referenzTyp: 'test' }, session);
      });
      await db.collection('artikel').deleteOne({ _id: id, vereinId });
      await db.collection('groessen').updateOne({ _id: groesseId, vereinId }, { $set: { bezeichnung: 'Neu' } });
      await db.collection('benutzer').deleteOne({ _id: personId, vereinId });
      const query = '?suche=' + encodeURIComponent(referenzId);
      const res = await journalGET(event('/api/lagerbewegungen/gesamt' + query));
      expect(res.status).toBe(200);
      expect((await res.json()).bewegungen).toEqual([expect.objectContaining({ artikel: 'Historisches Shirt', groesse: 'Historische Grösse', benutzer: 'Historische Person' })]);
      const sheet = await workbook(await exportGET(event('/api/export/lagerbewegungen' + query)));
      expect(sheet.getRow(5).getCell(2).value).toBe('Historisches Shirt');
      expect(sheet.getRow(5).getCell(4).value).toBe('Historische Grösse');
      expect(sheet.getRow(5).getCell(7).value).toBe('Historische Person');
    } finally {
      await session.endSession();
      await db.collection('artikel').deleteOne({ _id: id, vereinId });
      await db.collection('groessen').deleteOne({ _id: groesseId, vereinId });
      await db.collection('benutzer').deleteOne({ _id: personId, vereinId });
      await db.collection('lagerbewegungen').deleteMany({ vereinId, referenzId });
    }
  });
});
