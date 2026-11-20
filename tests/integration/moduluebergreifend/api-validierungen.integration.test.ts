import { describe, it, expect, vi } from 'vitest';
// Sicherheits- und Validierungstests: keine Verbindung zur Produktivdatenbank.
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('Unerwarteter Datenbankzugriff im Validierungstest'); } },
  client: { startSession: () => { throw new Error('Unerwartete Transaktion im Validierungstest'); } }
}));
const admin = { id: '507f1f77bcf86cd799439011', vereinId: '507f1f77bcf86cd799439012', rolle: 'admin', aktiv: true };
const mitglied = { ...admin, rolle: 'mitglied' };
const oid = '507f1f77bcf86cd799439013';
function ereignis(methode: string, pfad: string, daten: unknown, benutzer: unknown = admin, id = oid) {
  const url = new URL('http://localhost' + pfad);
  return { params: { id }, locals: { benutzer }, url,
    request: new Request(url, { method: methode, headers: { 'content-type': 'application/json' },
      ...(methode !== 'GET' ? { body: JSON.stringify(daten) } : {}) }) } as any;
}
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';

// Ursprüngliche Datei: inventur-korrekturhistorie-validierung.integration.test.ts
describe('inventur-korrekturhistorie-validierung', () => {
  it('Mitglied darf Historie nicht lesen', async () => {
    const antwort = await route0.GET(ereignis('GET', '/api/inventuren/' + oid + '/korrekturhistorie', null, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige Inventur-ID', async () => {
    const antwort = await route0.GET(ereignis('GET', '/api/inventuren/falsch/korrekturhistorie', null, admin, 'falsch'));
    expect(antwort.status).toBe(400);
  });
});

import * as route1 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: sammelbestellung-aendern-validierung.integration.test.ts
describe('sammelbestellung-aendern-validierung', () => {
  it('kein Zugriff fuer Mitglied', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'bestellen' }, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige ID', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/falsch', { aktion: 'bestellen' }, admin, 'falsch'));
    expect(antwort.status).toBe(400);
  });
  it('ungueltiger Body', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, []));
    expect(antwort.status).toBe(400);
  });
  it('ungueltige Aktion', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'loeschen' }));
    expect(antwort.status).toBe(400);
  });
  it('Wareneingang ohne Positionen', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'wareneingang', positionen: [] }));
    expect(antwort.status).toBe(400);
  });
  it('Wareneingang mit falscher Artikel-ID', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'wareneingang', positionen: [{ artikelId: 'falsch', groesseId: null, menge: 1 }] }));
    expect(antwort.status).toBe(400);
  });
  it('Wareneingang mit negativer Menge', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'wareneingang', positionen: [{ artikelId: oid, groesseId: null, menge: -1 }] }));
    expect(antwort.status).toBe(400);
  });
});

import * as route2 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

// Ursprüngliche Datei: sammelbestellung-einzelpdf-validierung.integration.test.ts
describe('sammelbestellung-einzelpdf-validierung', () => {
  it('Mitglied darf kein PDF erstellen', async () => {
    const antwort = await route2.GET(ereignis('GET', '/api/vereinskleider/sammelbestellungen/' + oid + '/pdf', null, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige ID wird abgelehnt', async () => {
    await expect(route2.GET(ereignis('GET', '/api/vereinskleider/sammelbestellungen/falsch/pdf', null, admin, 'falsch'))).rejects.toMatchObject({ status: 400 });
  });
});

import * as route3 from '../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

// Ursprüngliche Datei: sammelbestellung-sammelpdf-validierung.integration.test.ts
describe('sammelbestellung-sammelpdf-validierung', () => {
  it('Mitglied darf nicht exportieren', async () => {
    const antwort = await route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: [oid] }, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige Daten werden abgelehnt', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', []))).rejects.toMatchObject({ status: 400 });
  });
  it('keine IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: [] }))).rejects.toMatchObject({ status: 400 });
  });
  it('ungueltige IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: ['falsch'] }))).rejects.toMatchObject({ status: 400 });
  });
  it('doppelte IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: [oid, oid] }))).rejects.toMatchObject({ status: 400 });
  });
  it('maximal 50 IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: Array.from({length: 51}, (_,i) => i.toString(16).padStart(24,'0')) }))).rejects.toMatchObject({ status: 400 });
  });
});

import * as route4 from '../../../src/routes/api/meldungen/[id]/+server';

// Ursprüngliche Datei: schadensmeldungen-status.integration.test.ts
describe('schadensmeldungen-status', () => {
  it('nicht angemeldet', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, {}, null));
    expect(antwort.status).toBe(401);
  });
  it('Mitglied darf nicht bearbeiten', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, {}, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige Meldungs-ID', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/falsch', {}, admin, 'falsch'));
    expect(antwort.status).toBe(400);
  });
  it('ungueltige Nutzdaten', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, []));
    expect(antwort.status).toBe(400);
  });
  it('ungueltiger Status', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, { status: 'geloescht', bearbeitungsnotiz: '' }));
    expect(antwort.status).toBe(400);
  });
  it('Notiz muss String sein', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, { status: 'offen', bearbeitungsnotiz: null }));
    expect(antwort.status).toBe(400);
  });
  it('Notiz zu lang', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, { status: 'erledigt', bearbeitungsnotiz: 'x'.repeat(2001) }));
    expect(antwort.status).toBe(400);
  });
});

import * as route5 from '../../../src/routes/api/meldungen/+server';

// Ursprüngliche Datei: schadensmeldungen-validierung.integration.test.ts
describe('schadensmeldungen-validierung', () => {
  it('Anmeldung erforderlich', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', {}, null));
    expect(antwort.status).toBe(401);
  });
  it('ungueltige Nutzdaten', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', []));
    expect(antwort.status).toBe(400);
  });
  it('Artikel-ID erforderlich', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: 'falsch', beschreibung: 'Defekt' }));
    expect(antwort.status).toBe(400);
  });
  it('Beschreibung erforderlich', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: '   ' }));
    expect(antwort.status).toBe(400);
  });
  it('Beschreibung maximal 2000 Zeichen', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'x'.repeat(2001) }));
    expect(antwort.status).toBe(400);
  });
  it('hoechstens drei Fotos', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'Defekt', fotos: [1,2,3,4] }));
    expect(antwort.status).toBe(400);
  });
  it('keine fremden Cloudinary-Ordner', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'Defekt', fotos: [{ url: 'https://res.cloudinary.com/test/a.jpg', publicId: 'andererverein/schadensmeldungen/bild' }] }));
    expect(antwort.status).toBe(400);
  });
  it('keine doppelten Fotos', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'Defekt', fotos: Array(2).fill({ url: 'https://res.cloudinary.com/demo/image/upload/x', publicId: `clubmatiq/${admin.vereinId}/schadensmeldungen/bild` }) }));
    expect(antwort.status).toBe(400);
  });
});

import * as route6 from '../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: vereinskleider-export-berechtigung.integration.test.ts
describe('vereinskleider-export-berechtigung', () => {
  it('Mitglied darf Export nicht ausfuehren', async () => {
    const antwort = await route6.GET(ereignis('GET', '/api/vereinskleider/export', null, mitglied));
    expect(antwort.status).toBe(403);
  });
});

