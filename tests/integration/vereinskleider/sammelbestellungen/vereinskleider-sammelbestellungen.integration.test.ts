import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mock = vi.hoisted(() => ({
  collection: vi.fn(), find: vi.fn(), findOne: vi.fn(), insertOne: vi.fn()
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: mock.collection }
}));
const artikelId = new ObjectId().toHexString();
const lieferantId = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const groesseId = new ObjectId().toHexString();
const event = (method: string, body?: unknown) => ({
  locals: { benutzer: { id: artikelId, vereinId, rolle: 'admin' } },
  url: new URL('http://localhost/api/vereinskleider/sammelbestellungen'),
  request: new Request('http://localhost/api/vereinskleider/sammelbestellungen', {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' } })
  })
});
type Seed = { sales?: unknown[]; artikel?: unknown[]; varianten?: unknown[];
  sammel?: unknown[]; lieferanten?: unknown[] };
function seed(data: Seed = {}) {
  const records: Record<string, unknown[]> = {
    vereinskleider_verkaeufe: data.sales ?? [],
    artikel: data.artikel ?? [],
    artikelvarianten: data.varianten ?? [],
    vereinskleider_sammelbestellungen: data.sammel ?? [],
    lieferanten: data.lieferanten ?? []
  };
  mock.collection.mockImplementation((name: string) => ({
    find: () => ({
      project: () => ({ toArray: async () => records[name] ?? [] }),
      sort: () => ({ toArray: async () => records[name] ?? [] }),
      toArray: async () => records[name] ?? []
    }),
    insertOne: mock.insertOne
  }));
}
const article = (overrides = {}) => ({
  _id: new ObjectId(artikelId), name: 'Vereinsjacke',
  menge: 2, hatGroessen: false, lieferantId, ...overrides
});
const supplier = () => ({ _id: new ObjectId(lieferantId), name: 'Lieferant A' });
const sale = (menge: number, uebergebenMenge = 0) => ({
  positionen: [{ artikelId, groesseId: null, artikelname: 'Vereinsjacke',
    verkaufsart: 'bestellung', menge, uebergebenMenge }]
});
const pos = (menge: number, groesse: string | null = null) =>
  ({ artikelId, groesseId: groesse, menge });
beforeEach(() => {
  vi.clearAllMocks();
  mock.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
  seed();
});
import * as route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-abgeschlossene-lieferung.integration.test.ts
describe('24-bedarf-abgeschlossene-lieferung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(5)], sammel: [{ _id: new ObjectId(), status: 'geliefert', positionen: [pos(3)], erstelltAm: new Date() }] });
    const response = await route0.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].bereitsInSammelbestellungen).toBe(0);

  });
});

import * as route1 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-ausstehende-sammelbestellung.integration.test.ts
describe('24-bedarf-ausstehende-sammelbestellung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(5)], sammel: [{ _id: new ObjectId(), status: 'bestellt', positionen: [pos(2)], erstelltAm: new Date() }] });
    const response = await route1.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].bereitsInSammelbestellungen).toBe(2);
    expect(data.bedarf[0].nachbestellen).toBe(2);

  });
});

import * as route2 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-groessenartikel.integration.test.ts
describe('24-bedarf-groessenartikel', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ hatGroessen: true })], varianten: [{ artikelId, groesseId, menge: 5 }] });
    const response = await route2.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].groesseId).toBe(groesseId);
    expect(data.bedarf[0].bestand).toBe(5);

  });
});

import * as route3 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-lieferantenname.integration.test.ts
describe('24-bedarf-lieferantenname', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], lieferanten: [supplier()] });
    const response = await route3.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].lieferantName).toBe('Lieferant A');

  });
});

import * as route4 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-mehrere-bestellungen.integration.test.ts
describe('24-bedarf-mehrere-bestellungen', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(2), sale(4)] });
    const response = await route4.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].offen).toBe(6);

  });
});

import * as route5 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-nullbestand.integration.test.ts
describe('24-bedarf-nullbestand', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ menge: 0 })], sales: [sale(5)] });
    const response = await route5.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].verfuegbar).toBe(0);
    expect(data.bedarf[0].nachbestellen).toBe(5);

  });
});

import * as route6 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-offene-kundenbestellung.integration.test.ts
describe('24-bedarf-offene-kundenbestellung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(5)] });
    const response = await route6.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].offen).toBe(5);
    expect(data.bedarf[0].nachbestellen).toBe(4);

  });
});

import * as route7 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-ohne-bestellung.integration.test.ts
describe('24-bedarf-ohne-bestellung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()] });
    const response = await route7.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].offen).toBe(0);
    expect(data.bedarf[0].nachbestellen).toBe(0);

  });
});

import * as route8 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-ohne-lieferant.integration.test.ts
describe('24-bedarf-ohne-lieferant', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ lieferantId: null })] });
    const response = await route8.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].lieferantId).toBeNull();

  });
});

import * as route9 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-reservebestand.integration.test.ts
describe('24-bedarf-reservebestand', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ menge: 10 })], sales: [sale(5)] });
    const response = await route9.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].verfuegbar).toBe(9);
    expect(data.bedarf[0].nachbestellen).toBe(0);

  });
});

import * as route10 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-teillieferung.integration.test.ts
describe('24-bedarf-teillieferung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(5)], sammel: [{ _id: new ObjectId(), status: 'bestellt', positionen: [{ ...pos(3), geliefertMenge: 2 }], erstelltAm: new Date() }] });
    const response = await route10.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].bereitsInSammelbestellungen).toBe(1);

  });
});

import * as route11 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-teiluebergabe.integration.test.ts
describe('24-bedarf-teiluebergabe', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(5, 2)] });
    const response = await route11.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].offen).toBe(3);
    expect(data.bedarf[0].nachbestellen).toBe(2);

  });
});

import * as route12 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-uebergebene-menge.integration.test.ts
describe('24-bedarf-uebergebene-menge', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(2, 3)] });
    const response = await route12.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].offen).toBe(0);

  });
});

import * as route13 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-ungueltige-verkaufsmenge.integration.test.ts
describe('24-bedarf-ungueltige-verkaufsmenge', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], sales: [sale(-3)] });
    const response = await route13.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].offen).toBe(0);

  });
});

import * as route14 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-ungueltiger-bestand.integration.test.ts
describe('24-bedarf-ungueltiger-bestand', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ menge: -1 })], sales: [sale(5)] });
    const response = await route14.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf[0].bestand).toBeNull();

  });
});

import * as route15 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-bedarf-varianten-fehlen.integration.test.ts
describe('24-bedarf-varianten-fehlen', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ hatGroessen: true })] });
    const response = await route15.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.bedarf).toHaveLength(0);

  });
});

import * as route16 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-datenbankfehler.integration.test.ts
describe('24-sammel-erstellen-datenbankfehler', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], lieferanten: [supplier()] });
    mock.insertOne.mockRejectedValueOnce(new Error('DB nicht verfügbar'));
    const response = await route16.POST(event('POST', { positionen: [pos(1)] }) as never);
    expect(response.status).toBe(500);
    expect(mock.insertOne).toHaveBeenCalledOnce();

  });
});

import * as route17 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-doppelte-position.integration.test.ts
describe('24-sammel-erstellen-doppelte-position', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route17.POST(event('POST', { positionen: [pos(1), pos(2)] }) as never);
    expect(response.status).toBe(400);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route18 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-erfolg.integration.test.ts
describe('24-sammel-erstellen-erfolg', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], lieferanten: [supplier()], sales: [sale(5)] });
    const response = await route18.POST(event('POST', { positionen: [pos(3)], bemerkung: 'Nachbestellen' }) as never);
    expect(response.status).toBe(201);
    expect(mock.insertOne).toHaveBeenCalledOnce();
    const doc = mock.insertOne.mock.calls[0][0];
    expect(doc.positionen[0].kundenbedarfMenge).toBe(3);
    expect(doc.positionen[0].lagerreserveMenge).toBe(0);

  });
});

import * as route19 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-fehlende-groesse.integration.test.ts
describe('24-sammel-erstellen-fehlende-groesse', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route19.POST(event('POST', { positionen: [{ artikelId, menge: 1 }] }) as never);
    expect(response.status).toBe(400);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route20 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-fremder-lieferant.integration.test.ts
describe('24-sammel-erstellen-fremder-lieferant', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article({ lieferantId: new ObjectId().toHexString() })], lieferanten: [supplier()] });
    const response = await route20.POST(event('POST', { positionen: [pos(1)] }) as never);
    expect(response.status).toBe(409);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route21 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-kein-artikel.integration.test.ts
describe('24-sammel-erstellen-kein-artikel', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route21.POST(event('POST', { positionen: [pos(1)] }) as never);
    expect(response.status).toBe(409);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route22 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-mischbedarf.integration.test.ts
describe('24-sammel-erstellen-mischbedarf', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], lieferanten: [supplier()], sales: [sale(3)] });
    const response = await route22.POST(event('POST', { positionen: [pos(5)] }) as never);
    expect(response.status).toBe(201);
    const doc = mock.insertOne.mock.calls[0][0];
    expect(doc.positionen[0].kundenbedarfMenge).toBe(2);
    expect(doc.positionen[0].lagerreserveMenge).toBe(3);

  });
});

import * as route23 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-ohne-lieferant.integration.test.ts
describe('24-sammel-erstellen-ohne-lieferant', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()] });
    const response = await route23.POST(event('POST', { positionen: [pos(1)] }) as never);
    expect(response.status).toBe(409);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route24 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-reserve.integration.test.ts
describe('24-sammel-erstellen-reserve', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ artikel: [article()], lieferanten: [supplier()] });
    const response = await route24.POST(event('POST', { positionen: [pos(3)] }) as never);
    expect(response.status).toBe(201);
    const doc = mock.insertOne.mock.calls[0][0];
    expect(doc.positionen[0].kundenbedarfMenge).toBe(0);
    expect(doc.positionen[0].lagerreserveMenge).toBe(3);

  });
});

import * as route25 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-ungueltige-bemerkung.integration.test.ts
describe('24-sammel-erstellen-ungueltige-bemerkung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route25.POST(event('POST', { positionen: [pos(1)], bemerkung: 42 }) as never);
    expect(response.status).toBe(400);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route26 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-ungueltige-menge.integration.test.ts
describe('24-sammel-erstellen-ungueltige-menge', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route26.POST(event('POST', { positionen: [pos(0)] }) as never);
    expect(response.status).toBe(400);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route27 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-zu-grosse-menge.integration.test.ts
describe('24-sammel-erstellen-zu-grosse-menge', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route27.POST(event('POST', { positionen: [pos(10001)] }) as never);
    expect(response.status).toBe(400);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route28 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-erstellen-zu-viele-positionen.integration.test.ts
describe('24-sammel-erstellen-zu-viele-positionen', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed();
    const response = await route28.POST(event('POST', { positionen: Array.from({ length: 101 }, () => pos(1)) }) as never);
    expect(response.status).toBe(400);
    expect(mock.insertOne).not.toHaveBeenCalled();

  });
});

import * as route29 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-uebersicht-alte-daten.integration.test.ts
describe('24-sammel-uebersicht-alte-daten', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ sammel: [{ _id: new ObjectId(), status: 'entwurf', positionen: [pos(2)], erstelltAm: new Date() }] });
    const response = await route29.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sammelbestellungen[0].positionen[0].kundenbedarfMenge).toBeNull();

  });
});

import * as route30 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-uebersicht-entwurf.integration.test.ts
describe('24-sammel-uebersicht-entwurf', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ sammel: [{ _id: new ObjectId(), status: 'entwurf', positionen: [{ ...pos(3) }], erstelltAm: new Date() }] });
    const response = await route30.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sammelbestellungen[0].positionen[0].offenMenge).toBe(3);

  });
});

import * as route31 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 24-sammel-uebersicht-teillieferung.integration.test.ts
describe('24-sammel-uebersicht-teillieferung', () => {
  it('prüft den fachlichen API-Ablauf', async () => {
    seed({ sammel: [{ _id: new ObjectId(), status: 'bestellt', positionen: [{ ...pos(3), geliefertMenge: 2 }], erstelltAm: new Date() }] });
    const response = await route31.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sammelbestellungen[0].positionen[0].offenMenge).toBe(1);

  });
});

