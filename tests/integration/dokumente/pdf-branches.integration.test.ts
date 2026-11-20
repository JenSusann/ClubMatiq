import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const ID = '507f1f77bcf86cd799439011';
const ART = '507f191e810c19729de860ea';
const SIZE = '507f1f77bcf86cd799439012';
const OTHER = '507f1f77bcf86cd799439013';
const mocks = vi.hoisted(() => ({ collection: vi.fn(), permission: vi.fn(() => null) }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.permission }));

import { GET as inventurPdf } from '../../../src/routes/api/inventuren/[id]/pdf/+server';
import { GET as einzelPdf } from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import { POST as gesamtPdf } from '../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

type CollectionName = 'inventuren' | 'inventurpositionen' | 'inventurprotokoll' | 'benutzer' | 'vereinskleider_sammelbestellungen' | 'lieferanten' | 'vereine' | 'groessen';
const data: Record<CollectionName, any[]> = {
  inventuren: [], inventurpositionen: [], inventurprotokoll: [], benutzer: [],
  vereinskleider_sammelbestellungen: [], lieferanten: [], vereine: [], groessen: []
};
let broken: string | null = null;
const oid = (id = ID) => new ObjectId(id);
const position = (extra: Record<string, unknown> = {}) => ({ artikelId: ART, groesseId: null, artikelname: 'Vereinsjacke', menge: 2, ...extra });
const bestellung = (extra: Record<string, unknown> = {}) => ({
  _id: oid(), vereinId: ID, lieferantId: OTHER, status: 'bestellt',
  positionen: [position()], erstelltAm: new Date('2026-10-01T12:00:00Z'), ...extra
});
function setup() {
  vi.clearAllMocks(); broken = null;
  for (const key of Object.keys(data) as CollectionName[]) data[key] = [];
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockImplementation((name: CollectionName) => ({
    findOne: vi.fn(async (filter: any) => {
      if (broken === name) throw new Error('simulierter Datenbankfehler');
      return data[name]?.find((d) => !filter?._id || String(d._id) === String(filter._id)) ?? null;
    }),
    find: vi.fn((_filter: any) => {
      if (broken === name) throw new Error('simulierter Datenbankfehler');
      const query = { toArray: async () => data[name] ?? [], project: (_p: any) => query, sort: (_s: any) => query };
      return query;
    })
  }));
}
function event(method: 'GET' | 'POST', body?: unknown, id = ID) {
  const url = new URL('http://localhost/api/test');
  return {
    params: { id }, locals: { benutzer: { id: ID, vereinId: ID, rolle: 'admin' } }, url,
    request: new Request(url, method === 'GET' ? { method } : {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    })
  } as any;
}
async function status(promise: Promise<unknown>, expected: number) {
  try {
    const response = await promise as Response;
    expect(response.status).toBe(expected);
  } catch (e: any) {
    expect(e.status).toBe(expected);
  }
}
async function pdf(promise: Promise<unknown>) {
  const response = await promise as Response;
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/pdf');
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(bytes.length).toBeGreaterThan(100);
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
}

beforeEach(setup);

describe('Paket 31 – Inventurbericht PDF', () => {
  it.each(['', 'keine-id', '123'])('verwirft ungültige Inventur-ID %s', async (id) => {
    await status(inventurPdf(event('GET', undefined, id)), 400);
  });
  it('meldet fehlende Inventur', async () => { await status(inventurPdf(event('GET')), 404); });
  it('respektiert Berechtigungen', async () => {
    mocks.permission.mockReturnValueOnce(new Response('verboten', { status: 403 }));
    await status(inventurPdf(event('GET')), 403);
  });
  it('erstellt PDF ohne Positionen oder Protokoll', async () => {
    data.inventuren = [{ _id: oid(), name: 'Jahresinventur', status: 'offen', typ: 'gesamt' }];
    await pdf(inventurPdf(event('GET')));
  });
  it('erstellt stornierten Bericht mit Abweichungen, Abschluss und Korrekturprotokoll', async () => {
    data.inventuren = [{ _id: oid(), name: 'Jahresinventur', status: 'storniert', typ: 'gesamt',
      erstelltVon: ID, abgeschlossenVon: ID, storniertVon: ID,
      erstelltAm: new Date('2026-01-01'), abgeschlossenAm: new Date('2026-01-02'),
      storniertAm: new Date('2026-01-03'), stornierungsgrund: 'Test' }];
    data.inventurpositionen = [
      { _id: oid(SIZE), artikelName: 'T-Shirt', groesseId: SIZE, sollBestand: 10, istBestand: 8, bemerkung: 'Gezählt' },
      { _id: oid(OTHER), artikelName: 'Ball', groesseId: null, sollBestand: 2, istBestand: null }
    ];
    data.inventurprotokoll = [
      { aktion: 'abgeschlossen', ausgefuehrtVon: ID, ausgefuehrtAm: new Date(), anzahlKorrekturen: 1,
        positionen: [{ positionId: SIZE, istBestand: 9 }] },
      { aktion: 'nachtraeglich_korrigiert', ausgefuehrtVon: ID, ausgefuehrtAm: new Date(),
        positionId: SIZE, alterIstBestand: 9, neuerIstBestand: 8, differenz: -1, begruendung: 'Nachzählung' },
      { aktion: 'storniert', ausgefuehrtVon: ID, ausgefuehrtAm: new Date(), statusVorher: 'abgeschlossen', anzahlRueckbuchungen: 1 }
    ];
    data.benutzer = [{ _id: oid(), vorname: 'Test', nachname: 'Person' }];
    await pdf(inventurPdf(event('GET')));
  });
  it('erstellt mehrseitigen Bericht mit langen Artikelnamen', async () => {
    data.inventuren = [{ _id: oid(), name: 'Inventur', status: 'abgeschlossen' }];
    data.inventurpositionen = Array.from({ length: 70 }, (_, i) => ({
      _id: new ObjectId(), artikelName: `Artikel ${i} ${'L'.repeat(180)}`, sollBestand: 4, istBestand: 4
    }));
    await pdf(inventurPdf(event('GET')));
  });
  it('behandelt Datenbankfehler als 500', async () => {
    broken = 'inventuren'; await status(inventurPdf(event('GET')), 500);
  });
});

describe('Paket 31 – Einzelbestellung PDF', () => {
  it.each(['', 'abc', '123'])('verwirft ungültige ID %s', async (id) => {
    await status(einzelPdf(event('GET', undefined, id)), 400);
  });
  it('meldet fehlende Bestellung', async () => { await status(einzelPdf(event('GET')), 404); });
  it('verwirft leere Positionen', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({ positionen: [] })];
    await status(einzelPdf(event('GET')), 409);
  });
  it.each([0, -1, 1.5, 'x'])('verwirft ungültige Bestellmenge %s', async (menge) => {
    data.vereinskleider_sammelbestellungen = [bestellung({ positionen: [position({ menge })] })];
    await status(einzelPdf(event('GET')), 409);
  });
  it('erstellt PDF ohne Lieferanten- und Vereinsstammdaten', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({ lieferantId: null, bemerkung: 'Testbestellung' })];
    await pdf(einzelPdf(event('GET')));
  });
  it('erstellt PDF mit Lieferant, Grösse, Bemerkung und Vereinsnamen', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({
      bestelltAm: new Date('2026-10-03'), bemerkung: 'Bitte zusammen liefern',
      positionen: [position({ groesseId: SIZE }), position({ artikelname: 'Mütze' })]
    })];
    data.lieferanten = [{ _id: oid(OTHER), name: 'Lieferant AG' }];
    data.vereine = [{ _id: oid(), name: 'Turnverein' }];
    data.groessen = [{ _id: oid(SIZE), bezeichnung: 'M' }];
    await pdf(einzelPdf(event('GET')));
  });
  it('erstellt mehrseitige PDF mit langen Bezeichnungen', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({
      positionen: Array.from({ length: 65 }, (_, i) => position({ artikelname: `Jacke ${i} ${'X'.repeat(130)}` }))
    })];
    await pdf(einzelPdf(event('GET')));
  });
  it('behandelt Datenbankfehler als 500', async () => {
    broken = 'vereinskleider_sammelbestellungen'; await status(einzelPdf(event('GET')), 500);
  });
});

describe('Paket 31 – Gesamtbestellungen PDF', () => {
  it.each([null, [], {}, { bestellungIds: [] }, { bestellungIds: ['falsch'] },
    { bestellungIds: [ID, ID] }, { bestellungIds: Array(51).fill(ID) }])(
    'verwirft ungültige Auswahl %#', async (body) => { await status(gesamtPdf(event('POST', body)), 400); }
  );
  it('respektiert Berechtigungen', async () => {
    mocks.permission.mockReturnValueOnce(new Response('verboten', { status: 403 }));
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 403);
  });
  it('meldet fehlende Bestellung', async () => {
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 404);
  });
  it('verwirft fehlenden Lieferanten', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({ lieferantId: null })];
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 409);
  });
  it('verwirft nicht verfügbaren Lieferanten', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung()];
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 409);
  });
  it('verwirft leere Positionen', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({ positionen: [] })];
    data.lieferanten = [{ _id: oid(OTHER), name: 'Lieferant AG' }];
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 409);
  });
  it.each([0, -2, 1.5, 'abc'])('verwirft ungültige Menge %s', async (menge) => {
    data.vereinskleider_sammelbestellungen = [bestellung({ positionen: [position({ menge })] })];
    data.lieferanten = [{ _id: oid(OTHER), name: 'Lieferant AG' }];
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 409);
  });
  it('erstellt Gesamt-PDF mit mehreren Bestellungen, zusammengefassten Positionen und Grössen', async () => {
    data.vereinskleider_sammelbestellungen = [
      bestellung({ positionen: [position({ groesseId: SIZE, menge: 3 }), position({ artikelname: 'Mütze' })] }),
      bestellung({ _id: oid(SIZE), positionen: [position({ groesseId: SIZE, menge: 4 })] })
    ];
    data.lieferanten = [{ _id: oid(OTHER), name: 'Lieferant AG' }];
    data.vereine = [{ _id: oid(), vereinsname: 'Turnverein' }];
    data.groessen = [{ _id: oid(SIZE), bezeichnung: 'XL' }];
    await pdf(gesamtPdf(event('POST', { bestellungIds: [ID, SIZE] })));
  });
  it('erstellt mehrseitige Gesamt-PDF', async () => {
    data.vereinskleider_sammelbestellungen = [bestellung({
      positionen: Array.from({ length: 70 }, (_, i) => position({ artikelId: new ObjectId().toString(), artikelname: `Jacke ${i} ${'X'.repeat(100)}` }))
    })];
    data.lieferanten = [{ _id: oid(OTHER), name: 'Lieferant AG' }];
    await pdf(gesamtPdf(event('POST', { bestellungIds: [ID] })));
  });
  it('behandelt Datenbankfehler als 500', async () => {
    broken = 'vereinskleider_sammelbestellungen';
    await status(gesamtPdf(event('POST', { bestellungIds: [ID] })), 500);
  });
});
