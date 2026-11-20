import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), aggregate: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), startSession: vi.fn(), endSession: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: m.startSession } }));
const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const groesseId = '507f1f77bcf86cd799439012';
const position = (overrides = {}) => ({ artikelId: id, groesseId: null, menge: 2, ...overrides });
const input = (overrides = {}) => ({ verkaufsart: 'direkt', kaeufer: 'Test Mitglied', zahlungsart: 'twint', zahlungErhalten: true, riegen: ['Aktive'], positionen: [position()], ...overrides });
const event = (method: string, body?: unknown, search = '') => ({ locals: { benutzer: { id, vereinId, rolle: 'admin' } }, url: new URL('http://localhost/api/vereinskleider' + search), request: new Request('http://localhost/api/vereinskleider', { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) }) });
const article = (overrides = {}) => ({ _id: new ObjectId(id), vereinId, name: 'Vereinsjacke', kategorieId: id, istVereinskleidung: true, hatGroessen: false, menge: 10, ...overrides });
const price = (overrides = {}) => ({ preistyp: 'fix', verkaufspreis: 20, ...overrides });
function setup(data: { artikel?: unknown; variante?: unknown; preis?: unknown; rabattregeln?: unknown[]; bestand?: unknown; aggregate?: unknown[]; invoices?: unknown[] } = {}) {
 const collections: Record<string, any> = {};
 for (const name of ['artikel','artikelvarianten','vereinskleider_preise','rabattregeln','vereinskleider_verkaeufe','vereinskleider_rechnungen']) collections[name] = {
  findOne: vi.fn(async () => name === 'artikel' ? (data.artikel === undefined ? article() : data.artikel) : name === 'artikelvarianten' ? (data.variante ?? null) : name === 'vereinskleider_preise' ? (data.preis === undefined ? price() : data.preis) : null),
  find: vi.fn(() => ({ project: () => ({ toArray: async () => data.invoices ?? [] }) })),
  aggregate: vi.fn(() => ({ toArray: async () => data.aggregate ?? [{ eintraege: [], zaehler: [] }] })),
  updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  insertOne: vi.fn(async () => ({ insertedId: new ObjectId() }))
 };
 collections.rabattregeln.find = vi.fn(() => ({ toArray: async () => data.rabattregeln ?? [] }));
 m.collection.mockImplementation((name: string) => collections[name]);
 m.startSession.mockReturnValue({ withTransaction: async (cb: () => Promise<unknown>) => cb(), endSession: m.endSession });
 return collections;
}
beforeEach(() => { vi.clearAllMocks(); });
import * as route0 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-aggregation-fehler.integration.test.ts
describe('27-historie-aggregation-fehler', () => { it('prüft die Historie', async () => {
const c = setup(); c.vereinskleider_verkaeufe.aggregate.mockImplementationOnce(() => { throw new Error('DB'); });
const response = await route0.GET(event('GET', undefined, '') as never);
expect(response.status).toBe(500);

}); });

import * as route1 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-art-direkt.integration.test.ts
describe('27-historie-art-direkt', () => { it('prüft die Historie', async () => {
setup();
const response = await route1.GET(event('GET', undefined, '?art=direkt') as never);
expect(response.status).toBe(200);

}); });

import * as route2 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-art-ungueltig.integration.test.ts
describe('27-historie-art-ungueltig', () => { it('prüft die Historie', async () => {
setup();
const response = await route2.GET(event('GET', undefined, '?art=anderes') as never);
expect(response.status).toBe(400);

}); });

import * as route3 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-bis.integration.test.ts
describe('27-historie-bis', () => { it('prüft die Historie', async () => {
setup();
const response = await route3.GET(event('GET', undefined, '?bis=2026-12-31') as never);
expect(response.status).toBe(200);

}); });

import * as route4 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-datum-umgekehrt.integration.test.ts
describe('27-historie-datum-umgekehrt', () => { it('prüft die Historie', async () => {
setup();
const response = await route4.GET(event('GET', undefined, '?von=2026-12-31&bis=2026-01-01') as never);
expect(response.status).toBe(400);

}); });

import * as route5 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-datum-ungueltig.integration.test.ts
describe('27-historie-datum-ungueltig', () => { it('prüft die Historie', async () => {
setup();
const response = await route5.GET(event('GET', undefined, '?von=2026-02-30') as never);
expect(response.status).toBe(400);

}); });

import * as route6 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-leer.integration.test.ts
describe('27-historie-leer', () => { it('prüft die Historie', async () => {
setup();
const response = await route6.GET(event('GET', undefined, '') as never);
expect(response.status).toBe(200);
expect((await response.json()).gesamt).toBe(0);
}); });

import * as route7 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-mit-rechnung.integration.test.ts
describe('27-historie-mit-rechnung', () => { it('prüft die Historie', async () => {
setup({ aggregate: [{ eintraege: [{ _id: new ObjectId(id), rechnung: { _id: new ObjectId(), status: 'offen' } }], zaehler: [{ anzahl: 1 }] }] });
const response = await route7.GET(event('GET', undefined, '') as never);
expect(response.status).toBe(200);
expect((await response.json()).verkaeufe[0].rechnung.status).toBe('offen');
}); });

import * as route8 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-riege.integration.test.ts
describe('27-historie-riege', () => { it('prüft die Historie', async () => {
setup();
const response = await route8.GET(event('GET', undefined, '?riege=Aktive') as never);
expect(response.status).toBe(200);

}); });

import * as route9 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-seite-null.integration.test.ts
describe('27-historie-seite-null', () => { it('prüft die Historie', async () => {
setup();
const response = await route9.GET(event('GET', undefined, '?seite=0') as never);
expect(response.status).toBe(400);

}); });

import * as route10 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-seite-zu-gross.integration.test.ts
describe('27-historie-seite-zu-gross', () => { it('prüft die Historie', async () => {
setup();
const response = await route10.GET(event('GET', undefined, '?seite=10001') as never);
expect(response.status).toBe(400);

}); });

import * as route11 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-seite-zwei.integration.test.ts
describe('27-historie-seite-zwei', () => { it('prüft die Historie', async () => {
setup();
const response = await route11.GET(event('GET', undefined, '?seite=2') as never);
expect(response.status).toBe(200);
expect((await response.json()).seite).toBe(2);
}); });

import * as route12 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-suche-artikel.integration.test.ts
describe('27-historie-suche-artikel', () => { it('prüft die Historie', async () => {
setup();
const response = await route12.GET(event('GET', undefined, '?suche=Jacke') as never);
expect(response.status).toBe(200);

}); });

import * as route13 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-suche-objectid.integration.test.ts
describe('27-historie-suche-objectid', () => { it('prüft die Historie', async () => {
setup();
const response = await route13.GET(event('GET', undefined, '?suche=507f1f77bcf86cd799439011') as never);
expect(response.status).toBe(200);

}); });

import * as route14 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-suche-regex.integration.test.ts
describe('27-historie-suche-regex', () => { it('prüft die Historie', async () => {
setup();
const response = await route14.GET(event('GET', undefined, '?suche=Jacke%28') as never);
expect(response.status).toBe(200);

}); });

import * as route15 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-von.integration.test.ts
describe('27-historie-von', () => { it('prüft die Historie', async () => {
setup();
const response = await route15.GET(event('GET', undefined, '?von=2026-01-01') as never);
expect(response.status).toBe(200);

}); });

import * as route16 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-zahlung-bezahlt.integration.test.ts
describe('27-historie-zahlung-bezahlt', () => { it('prüft die Historie', async () => {
setup();
const response = await route16.GET(event('GET', undefined, '?zahlung=bezahlt') as never);
expect(response.status).toBe(200);

}); });

import * as route17 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-zahlung-gutschrift.integration.test.ts
describe('27-historie-zahlung-gutschrift', () => { it('prüft die Historie', async () => {
setup();
const response = await route17.GET(event('GET', undefined, '?zahlung=gutschrift') as never);
expect(response.status).toBe(200);

}); });

import * as route18 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-zahlung-offen.integration.test.ts
describe('27-historie-zahlung-offen', () => { it('prüft die Historie', async () => {
setup();
const response = await route18.GET(event('GET', undefined, '?zahlung=offen') as never);
expect(response.status).toBe(200);

}); });

import * as route19 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-historie-zahlung-ungueltig.integration.test.ts
describe('27-historie-zahlung-ungueltig', () => { it('prüft die Historie', async () => {
setup();
const response = await route19.GET(event('GET', undefined, '?zahlung=invalid') as never);
expect(response.status).toBe(400);

}); });

import * as route20 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-artikel-fehlt.integration.test.ts
describe('27-verkauf-artikel-fehlt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: null });
 const response = await route20.POST(event('POST', input()) as never);
 expect(response.status).toBe(404);

 }); });

import * as route21 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-automatisch-bestellung.integration.test.ts
describe('27-verkauf-automatisch-bestellung', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: article({ menge: 1 }) });
 const response = await route21.POST(event('POST', input({ verkaufsart: 'automatisch' })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.verkaufsart).toBe('bestellung');
 }); });

import * as route22 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-automatisch-gemischt.integration.test.ts
describe('27-verkauf-automatisch-gemischt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: article({ menge: 2 }) });
 const response = await route22.POST(event('POST', input({ verkaufsart: 'automatisch' })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.verkaufsart).toBe('gemischt');
 }); });

import * as route23 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-bestellung-offen.integration.test.ts
describe('27-verkauf-bestellung-offen', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route23.POST(event('POST', input({ verkaufsart: 'bestellung', zahlungErhalten: false })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.bestellMenge).toBe(2);
 }); });

import * as route24 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-direkt-bezahlt.integration.test.ts
describe('27-verkauf-direkt-bezahlt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route24.POST(event('POST', input()) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.status).toBe('abgeschlossen');
 }); });

import * as route25 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-direkt-unbezahlt.integration.test.ts
describe('27-verkauf-direkt-unbezahlt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route25.POST(event('POST', input({ zahlungErhalten: false })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.zahlungsstatus).toBe('offen');
 }); });

import * as route26 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-fehlender-preis.integration.test.ts
describe('27-verkauf-fehlender-preis', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ preis: null });
 const response = await route26.POST(event('POST', input()) as never);
 expect(response.status).toBe(400);

 }); });

import * as route27 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-fixpreis-veraendert.integration.test.ts
describe('27-verkauf-fixpreis-veraendert', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route27.POST(event('POST', input({ positionen: [position({ einzelpreis: 10 })] })) as never);
 expect(response.status).toBe(409);

 }); });

import * as route28 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-groesse-falsch.integration.test.ts
describe('27-verkauf-groesse-falsch', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route28.POST(event('POST', input({ positionen: [position({ groesseId })] })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route29 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-kein-vereinskleid.integration.test.ts
describe('27-verkauf-kein-vereinskleid', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: article({ istVereinskleidung: false }) });
 const response = await route29.POST(event('POST', input()) as never);
 expect(response.status).toBe(400);

 }); });

import * as route30 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-lager-update-konflikt.integration.test.ts
describe('27-verkauf-lager-update-konflikt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
const c = setup(); c.artikel.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
 const response = await route30.POST(event('POST', input()) as never);
 expect(response.status).toBe(409);

 }); });

import * as route31 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-lager-zu-klein.integration.test.ts
describe('27-verkauf-lager-zu-klein', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: article({ menge: 2 }) });
 const response = await route31.POST(event('POST', input()) as never);
 expect(response.status).toBe(409);

 }); });

import * as route32 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-leere-riegen.integration.test.ts
describe('27-verkauf-leere-riegen', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route32.POST(event('POST', input({ riegen: [] })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route33 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-leerer-warenkorb.integration.test.ts
describe('27-verkauf-leerer-warenkorb', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route33.POST(event('POST', input({ positionen: [] })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route34 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-mehrere-gleiche-positionen.integration.test.ts
describe('27-verkauf-mehrere-gleiche-positionen', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route34.POST(event('POST', input({ positionen: [position({ menge: 1 }), position({ menge: 1 })] })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.positionen).toHaveLength(2);
 }); });

import * as route35 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-rabatt-ueber-total.integration.test.ts
describe('27-verkauf-rabatt-ueber-total', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route35.POST(event('POST', input({ zusaetzlicherRabatt: 50 })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route36 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-rechnung-zahlung-verboten.integration.test.ts
describe('27-verkauf-rechnung-zahlung-verboten', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route36.POST(event('POST', input({ zahlungsart: 'rechnung', zahlungErhalten: true })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route37 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-unbekannte-verkaufsart.integration.test.ts
describe('27-verkauf-unbekannte-verkaufsart', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route37.POST(event('POST', input({ verkaufsart: 'tausch' })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route38 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-unbekannter-preistyp.integration.test.ts
describe('27-verkauf-unbekannter-preistyp', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ preis: price({ preistyp: 'anders' }) });
 const response = await route38.POST(event('POST', input()) as never);
 expect(response.status).toBe(400);

 }); });

import * as route39 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-variabler-preis-fehlt.integration.test.ts
describe('27-verkauf-variabler-preis-fehlt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ preis: price({ preistyp: 'variabel', verkaufspreis: null }) });
 const response = await route39.POST(event('POST', input()) as never);
 expect(response.status).toBe(400);

 }); });

import * as route40 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-variabler-preis.integration.test.ts
describe('27-verkauf-variabler-preis', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ preis: price({ preistyp: 'variabel', verkaufspreis: null }) });
 const response = await route40.POST(event('POST', input({ positionen: [position({ einzelpreis: 12 })] })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.endbetrag).toBe(24);
 }); });

import * as route41 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-variante-direkt.integration.test.ts
describe('27-verkauf-variante-direkt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: article({ hatGroessen: true }), variante: { menge: 5 } });
 const response = await route41.POST(event('POST', input({ positionen: [position({ groesseId })] })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.direktMenge).toBe(2);
 }); });

import * as route42 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-variante-fehlt.integration.test.ts
describe('27-verkauf-variante-fehlt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup({ artikel: article({ hatGroessen: true }) });
 const response = await route42.POST(event('POST', input({ positionen: [position({ groesseId })] })) as never);
 expect(response.status).toBe(400);

 }); });

import * as route43 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-verkauf-insert-fehler.integration.test.ts
describe('27-verkauf-verkauf-insert-fehler', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
const c = setup(); c.vereinskleider_verkaeufe.insertOne.mockRejectedValueOnce(new Error('DB'));
 const response = await route43.POST(event('POST', input()) as never);
 expect(response.status).toBe(500);

 }); });

import * as route44 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 27-verkauf-zusaetzlicher-rabatt.integration.test.ts
describe('27-verkauf-zusaetzlicher-rabatt', () => { it('testet API-Antwort und Geschäftsvorgang', async () => {
setup();
 const response = await route44.POST(event('POST', input({ zusaetzlicherRabatt: 5 })) as never);
 expect(response.status).toBe(201);
expect((await response.json()).verkauf.endbetrag).toBe(35);
 }); });


describe('Issue #68 – keine Ersatzpreis-Verrechnung bei explizit offenem Preis', () => {
  it('sperrt den Verkauf auch dann, wenn der Client einen Preis übermittelt', async () => {
    setup({ preis: price({ preistyp: 'variabel', verkaufspreis: null, preisOffen: true }) });
    const response = await route40.POST(event('POST', input({
      positionen: [position({ einzelpreis: 12 })]
    })) as never);
    expect(response.status).toBe(409);
    expect((await response.json()).fehler).toContain('Ersatzpreis');
  });
});
