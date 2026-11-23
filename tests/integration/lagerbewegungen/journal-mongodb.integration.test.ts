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
  await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as Parameters<typeof wb.xlsx.load>[0]);
  return wb.getWorksheet('Lagerbewegungen')!;
}

beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Sicherheitsabbruch: falsche Datenbank');
  await client.connect();
  await db.collection('artikel').insertMany([
    { _id: artikelId, vereinId, name: 'Testshirt ÄÖÜ' },
    { _id: fremdArtikelId, vereinId: fremdvereinId, name: 'Geheimes Shirt' }
  ]);
  await db.collection('benutzer').insertOne({ _id: benutzerId, vereinId, vorname: 'Test', nachname: 'Person' });
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
});
