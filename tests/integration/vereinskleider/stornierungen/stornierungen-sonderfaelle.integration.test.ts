import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn(),
  updateMany: vi.fn(), deleteOne: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn(),
  collection: vi.fn(), startSession: vi.fn(), journal: vi.fn()
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: mocks.collection },
  client: { startSession: mocks.startSession }
}));
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const event = (method: string, body?: unknown, role: string | null = 'admin') => ({
  locals: { benutzer: role ? { id, vereinId, rolle: role } : null },
  params: { id },
  url: new URL('http://localhost/api/test'),
  request: new Request('http://localhost/api/test', {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  })
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockImplementation((name: string) => name === 'lagerbewegungen' ? { insertOne: mocks.journal } : mocks);
  mocks.findOne.mockResolvedValue(null);
  mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
  mocks.find.mockReturnValue({ toArray: async () => [], sort: () => ({ toArray: async () => [], limit: () => ({ toArray: async () => [] }) }) });
  mocks.startSession.mockReturnValue({
    withTransaction: async (fn: () => Promise<unknown>) => fn(),
    endSession: async () => {}
  });
});
import * as route0 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 21-stornierung-bereits-storniert.integration.test.ts
describe('21-stornierung-bereits-storniert', () => {
  it('21-stornierung-bereits-storniert', async () => {
    mocks.findOne.mockResolvedValueOnce({"status": "storniert"});
    const response = await route0.POST(event('POST', {"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": "Falsche Bestellung"}) as never);
    expect(response.status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
import * as route1 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 21-stornierung-bezahlter-verkauf.integration.test.ts
describe('21-stornierung-bezahlter-verkauf', () => {
  it('21-stornierung-bezahlter-verkauf', async () => {
    mocks.findOne.mockResolvedValueOnce({"status": "offen", "bezahltBetrag": 25});
    const response = await route1.POST(event('POST', {"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": "Falsche Bestellung"}) as never);
    expect(response.status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
import * as route2 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 21-stornierung-erfolgreich.integration.test.ts
describe('21-stornierung-erfolgreich', () => {
  it('Bestellmenge wird storniert', async () => {
    mocks.findOne.mockResolvedValueOnce({
      status: 'offen', rabattTotal: 0, bezahltBetrag: 0,
      endbetrag: 50, zwischentotal: 50,
      positionen: [{ artikelId: id, groesseId: null, verkaufsart: 'bestellung',
        menge: 2, einzelpreis: 25, positionsbetrag: 50, uebergebenMenge: 0, reserviertMenge: 0 }]
    });
    const response = await route2.POST(event('POST', {"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": "Falsche Bestellung"}) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.erfolg).toBe(true);
    expect(data.stornierung.storniert).toBe(1);
    expect(mocks.updateOne).toHaveBeenCalledOnce();
  });
});
import * as route3 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 21-stornierung-fehlender-verkauf.integration.test.ts
describe('21-stornierung-fehlender-verkauf', () => {
  it('21-stornierung-fehlender-verkauf', async () => {
    const response = await route3.POST(event('POST', {"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": "Falsche Bestellung"}) as never);
    expect(response.status).toBe(404);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
import * as route4 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 21-stornierung-ohne-positionen.integration.test.ts
describe('21-stornierung-ohne-positionen', () => {
  it('21-stornierung-ohne-positionen', async () => {
    mocks.findOne.mockResolvedValueOnce({"status": "offen", "rabattTotal": 0});
    const response = await route4.POST(event('POST', {"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": "Falsche Bestellung"}) as never);
    expect(response.status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
import * as route5 from '../../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 21-stornierung-rabatt-gesperrt.integration.test.ts
describe('21-stornierung-rabatt-gesperrt', () => {
  it('21-stornierung-rabatt-gesperrt', async () => {
    mocks.findOne.mockResolvedValueOnce({"status": "offen", "rabattTotal": 5});
    const response = await route5.POST(event('POST', {"verkaufId": id, "positionsIndex": 0, "menge": 1, "grund": "Falsche Bestellung"}) as never);
    expect(response.status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
import * as route6 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-artikel-nicht-gefunden.integration.test.ts
describe('21-verkauf-artikel-nicht-gefunden', () => {
  it('21-verkauf-artikel-nicht-gefunden', async () => {
    const response = await route6.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(404);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route7 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-automatisch-erfolgreich.integration.test.ts
describe('21-verkauf-automatisch-erfolgreich', () => {
  it('21-verkauf-automatisch-erfolgreich', async () => {
    mocks.collection.mockImplementation((name: string) => ({
      ...mocks,
      insertOne: name === 'lagerbewegungen' ? mocks.journal : mocks.insertOne,
      findOne: vi.fn(async () => name === 'artikel'
        ? { _id: new ObjectId(id), name: 'Trainerjacke', kategorieId: id, istVereinskleidung: true, hatGroessen: false, menge: 10 }
        : name === 'vereinskleider_preise' ? { preistyp: 'fix', verkaufspreis: 25 } : null)
    }));
    const response = await route7.POST(event('POST', {"verkaufsart": "automatisch", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledOnce();
    expect(mocks.journal).toHaveBeenCalledOnce();
    expect(mocks.journal).toHaveBeenCalledWith(expect.objectContaining({ art: 'verkauf', mengeDelta: -2, artikelId: id, vereinId }), expect.objectContaining({ session: expect.anything() }));
    const data = await response.json();
    expect(data.erfolg).toBe(true);
    expect(data.verkauf.positionen.length).toBeGreaterThan(0);
  });
});
import * as route8 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-bemerkung.integration.test.ts
describe('21-verkauf-bemerkung', () => {
  it('Bemerkung falscher Typ', async () => {
    const response = await route8.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "bemerkung": 123}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Bemerkung zu lang', async () => {
    const response = await route8.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "bemerkung": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route9 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-bestellung-erfolgreich.integration.test.ts
describe('21-verkauf-bestellung-erfolgreich', () => {
  it('21-verkauf-bestellung-erfolgreich', async () => {
    mocks.collection.mockImplementation((name: string) => ({
      ...mocks,
      insertOne: name === 'lagerbewegungen' ? mocks.journal : mocks.insertOne,
      findOne: vi.fn(async () => name === 'artikel'
        ? { _id: new ObjectId(id), name: 'Trainerjacke', kategorieId: id, istVereinskleidung: true, hatGroessen: false, menge: 10 }
        : name === 'vereinskleider_preise' ? { preistyp: 'fix', verkaufspreis: 25 } : null)
    }));
    const response = await route9.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledOnce();
    const data = await response.json();
    expect(data.erfolg).toBe(true);
    expect(data.verkauf.positionen.length).toBeGreaterThan(0);
  });
});
import * as route10 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-direkt-erfolgreich.integration.test.ts
describe('21-verkauf-direkt-erfolgreich', () => {
  it('21-verkauf-direkt-erfolgreich', async () => {
    mocks.collection.mockImplementation((name: string) => ({
      ...mocks,
      insertOne: name === 'lagerbewegungen' ? mocks.journal : mocks.insertOne,
      findOne: vi.fn(async () => name === 'artikel'
        ? { _id: new ObjectId(id), name: 'Trainerjacke', kategorieId: id, istVereinskleidung: true, hatGroessen: false, menge: 10 }
        : name === 'vereinskleider_preise' ? { preistyp: 'fix', verkaufspreis: 25 } : null)
    }));
    const response = await route10.POST(event('POST', {"verkaufsart": "direkt", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(201);
    expect(mocks.insertOne).toHaveBeenCalledOnce();
    expect(mocks.journal).toHaveBeenCalledOnce();
    expect(mocks.journal).toHaveBeenCalledWith(expect.objectContaining({ art: 'verkauf', mengeDelta: -2, artikelId: id, vereinId }), expect.objectContaining({ session: expect.anything() }));
    const data = await response.json();
    expect(data.erfolg).toBe(true);
    expect(data.verkauf.positionen.length).toBeGreaterThan(0);
  });
});
import * as route11 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-fremder-artikel.integration.test.ts
describe('21-verkauf-fremder-artikel', () => {
  it('21-verkauf-fremder-artikel', async () => {
    mocks.findOne.mockResolvedValueOnce({"name": "Shirt", "istVereinskleidung": false, "hatGroessen": false});
    const response = await route11.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route12 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-groessenzuordnung.integration.test.ts
describe('21-verkauf-groessenzuordnung', () => {
  it('21-verkauf-groessenzuordnung', async () => {
    mocks.findOne.mockResolvedValueOnce({"name": "Shirt", "istVereinskleidung": true, "hatGroessen": true});
    const response = await route12.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route13 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-kaeufer.integration.test.ts
describe('21-verkauf-kaeufer', () => {
  it('Käufer fehlt', async () => {
    const response = await route13.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Käufer zu lang', async () => {
    const response = await route13.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Käufer falscher Typ', async () => {
    const response = await route13.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": 23, "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route14 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-positionen.integration.test.ts
describe('21-verkauf-positionen', () => {
  it('Warenkorb leer', async () => {
    const response = await route14.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": []}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Menge null', async () => {
    const response = await route14.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 0}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Menge gebrochen', async () => {
    const response = await route14.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 1.5}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route15 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-preis-fehlt.integration.test.ts
describe('21-verkauf-preis-fehlt', () => {
  it('21-verkauf-preis-fehlt', async () => {
    mocks.findOne.mockResolvedValueOnce({"name": "Shirt", "istVereinskleidung": true, "hatGroessen": false});
    const response = await route15.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route16 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-preiseingabe.integration.test.ts
describe('21-verkauf-preiseingabe', () => {
  it('Einzelpreis negativ', async () => {
    const response = await route16.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 1, "einzelpreis": -1}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Einzelpreis zu viele Nachkommastellen', async () => {
    const response = await route16.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 1, "einzelpreis": 2.123}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route17 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-rabatte.integration.test.ts
describe('21-verkauf-rabatte', () => {
  it('Zusatzrabatt negativ', async () => {
    const response = await route17.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "zusaetzlicherRabatt": -1}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Rabattliste falscher Typ', async () => {
    const response = await route17.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "rabattIds": "abc"}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Rabatt-ID ungültig', async () => {
    const response = await route17.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "rabattIds": ["falsch"]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route18 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-riegen.integration.test.ts
describe('21-verkauf-riegen', () => {
  it('Riegen fehlen', async () => {
    const response = await route18.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": [], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Riege leer', async () => {
    const response = await route18.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": [""], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Riege falscher Typ', async () => {
    const response = await route18.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": [123], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route19 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-verkaufsart.integration.test.ts
describe('21-verkauf-verkaufsart', () => {
  it('Verkaufsart unbekannt', async () => {
    const response = await route19.POST(event('POST', {"verkaufsart": "reservierung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Verkaufsart fehlt', async () => {
    const response = await route19.POST(event('POST', {"kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
import * as route20 from '../../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 21-verkauf-zahlungsarten.integration.test.ts
describe('21-verkauf-zahlungsarten', () => {
  it('Zahlungsart unbekannt', async () => {
    const response = await route20.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "karte", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}]}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Zahlungsbestätigung falscher Typ', async () => {
    const response = await route20.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "zahlungErhalten": "ja"}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('Rechnung sofort bezahlt', async () => {
    const response = await route20.POST(event('POST', {"verkaufsart": "bestellung", "kaeufer": "Vereinsmitglied", "zahlungsart": "rechnung", "riegen": ["Aktive"], "positionen": [{"artikelId": id, "groesseId": null, "menge": 2}], "zahlungErhalten": true}) as never);
    expect(response.status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});

describe('Stornierung – Integrität der Teilrechnungen', () => {
  const trancheId = new ObjectId().toHexString();
  const position = {artikelId:id,groesseId:null,verkaufsart:'bestellung',menge:2,einzelpreis:25,positionsbetrag:50};
  const verkauf = {status:'offen',trancheRechnungIds:[trancheId],positionen:[position],rabattTotal:0,endbetrag:50,zwischentotal:50};
  const eingabe = {verkaufId:id,positionsIndex:0,menge:1,grund:'Korrektur'};
  it.each([{preisOffen:true},{menge:1.5},{einzelpreis:0.001},{positionsbetrag:-1},{uebergebenMenge:-1},{uebergebenMenge:1.5},{reserviertMenge:-1},{reserviertMenge:0.5},{reserviertMenge:3}])('verweigert inkonsistente Teilrechnungsposition %#',async patch=>{
    mocks.findOne.mockResolvedValueOnce({...verkauf,positionen:[{...position,...patch}]});
    expect((await route0.POST(event('POST',eingabe) as never)).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it.each([{rabatte:[{betrag:5}]},{zusaetzlicherRabatt:5},{rechnungId:trancheId}])('verweigert zusätzliche Rabatte oder Belege %#',async patch=>{
    mocks.findOne.mockResolvedValueOnce({...verkauf,...patch});
    expect((await route0.POST(event('POST',eingabe) as never)).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert fehlende Teilrechnung',async()=>{
    mocks.findOne.mockResolvedValueOnce(verkauf);
    expect((await route0.POST(event('POST',eingabe) as never)).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert Teilrechnung mit fremder Referenz',async()=>{
    mocks.findOne.mockResolvedValueOnce(verkauf);
    mocks.find.mockReturnValueOnce({toArray:async()=>[{_id:new ObjectId()}]});
    expect((await route0.POST(event('POST',eingabe) as never)).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});

describe('Stornierung – finanzielle Konsistenz der Teilrechnung', () => {
  const rid = new ObjectId();
  const p = {artikelId:id,groesseId:null,verkaufsart:'bestellung',menge:2,einzelpreis:25,positionsbetrag:50,positionsIndex:0};
  const sale = {status:'offen',trancheRechnungIds:[rid.toHexString()],positionen:[p],rabattTotal:0,endbetrag:50,zwischentotal:50};
  const invoice = {_id:rid,status:'offen',gesamtbetrag:50,bezahltBetrag:0,positionen:[p]};
  const input = {verkaufId:id,positionsIndex:0,menge:1,grund:'Korrektur'};
  async function reject(invoicePatch: Record<string,unknown>, salePatch: Record<string,unknown> = {}) {
    mocks.findOne.mockResolvedValueOnce({...sale,...salePatch});
    mocks.find.mockReturnValueOnce({toArray:async()=>[{...invoice,...invoicePatch}]});
    expect((await route0.POST(event('POST',input) as never)).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.insertOne).not.toHaveBeenCalled();
    expect(mocks.journal).not.toHaveBeenCalled();
  }
  it.each([{status:'storniert'},{gesamtbetrag:-1},{bezahltBetrag:0.001},{gutgeschriebenBetrag:-1},{bezahltBetrag:51},{gutgeschriebenBetrag:51},{gutgeschriebenBetrag:30}])('verweigert inkonsistente Rechnungsbeträge oder Status %#',async patch=>{await reject(patch);});
  it.each([{artikelId:new ObjectId().toHexString()},{groesseId:new ObjectId().toHexString()},{einzelpreis:24},{menge:1.5},{menge:0}])('verweigert abweichende Belegposition %#',async patch=>{await reject({positionen:[{...p,...patch}]});});
  it('verweigert doppelte Positionszuordnung',async()=>{await reject({positionen:[p,p]});});
  it('verweigert fehlende Positionszuordnung',async()=>{await reject({positionen:[]});});
  it('verweigert Gutschrift oberhalb des Verkaufsendbetrags',async()=>{await reject({}, {endbetrag:20});});
  it('verweigert Gutschrift oberhalb des Zwischentotals',async()=>{await reject({}, {zwischentotal:20});});
  it('verweigert widersprüchlichen Positionsbetrag',async()=>{await reject({}, {positionen:[{...p,positionsbetrag:49}]});});
});


describe('Teilrechnungsstornierung – Status und historische Belege',()=>{
 const rid=new ObjectId();
 const p={artikelId:id,groesseId:null,verkaufsart:'bestellung',menge:2,einzelpreis:25,positionsbetrag:50,positionsIndex:0,reserviertMenge:1};
 const input={verkaufId:id,positionsIndex:0,menge:1,grund:' Korrektur '};
 const aussteller={name:'Historischer Verein'};
 const invoice={_id:rid,status:'offen',gesamtbetrag:50,bezahltBetrag:0,positionen:[p],aussteller};
 const sale={status:'offen',trancheRechnungIds:[rid.toHexString()],positionen:[p],rabattTotal:0,endbetrag:50,zwischentotal:50};
 function setup(s:Record<string,unknown>={},b:Record<string,unknown>={}){
  mocks.findOne.mockResolvedValueOnce({...sale,...s});
  mocks.find.mockReturnValueOnce({toArray:async()=>[{...invoice,...b}]});
 }
 it.each([{bezahlt:10,status:'teilweise_bezahlt',refund:0},{bezahlt:25,status:'bezahlt',refund:0},{bezahlt:40,status:'bezahlt',refund:15}])('berechnet Rechnungsstatus und Rückerstattung %#',async({bezahlt,status,refund})=>{
  setup({}, {bezahltBetrag:bezahlt});
  const res=await route0.POST(event('POST',input) as never);
  expect(res.status).toBe(200);
  expect(mocks.updateOne).toHaveBeenNthCalledWith(1,expect.objectContaining({vereinId}),expect.objectContaining({$set:expect.objectContaining({status,rueckerstattungOffen:refund,gutgeschriebenBetrag:25})}),expect.anything());
  expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({aussteller,betrag:25,grund:'Korrektur',rechnungId:rid.toHexString()}),expect.anything());
  expect((await res.json()).stornierung.freigegebeneReserve).toBe(1);
 });
 it('behält andere Positionen unverändert und schliesst vollständig übergebene Restmengen ab',async()=>{
  const other={...p,artikelId:new ObjectId().toHexString(),verkaufsart:'direkt',menge:1,positionsbetrag:25,positionsIndex:1};
  setup({positionen:[{...p,uebergebenMenge:1},other],endbetrag:75,zwischentotal:75});
  const res=await route0.POST(event('POST',input) as never);
  expect(res.status).toBe(200);
  expect(mocks.updateOne).toHaveBeenNthCalledWith(2,expect.objectContaining({vereinId}),expect.objectContaining({$set:expect.objectContaining({status:'abgeschlossen',positionen:[expect.objectContaining({menge:1,reserviertMenge:0}),other],endbetrag:50})}),expect.anything());
 });
 it('berücksichtigt bereits gutgeschriebene und stornierte Mengen',async()=>{
  setup({positionen:[{...p,menge:1,positionsbetrag:25,storniertMenge:1}],endbetrag:25,zwischentotal:25,stornierungen:[{positionsIndex:0,menge:1}]},{gutgeschriebenBetrag:25,bezahltBetrag:50});
  const res=await route0.POST(event('POST',input) as never);
  expect(res.status).toBe(200);
  expect(mocks.updateOne).toHaveBeenNthCalledWith(1,expect.objectContaining({gutgeschriebenBetrag:25}),expect.objectContaining({$set:expect.objectContaining({status:'storniert',gutgeschriebenBetrag:50,rueckerstattungOffen:50})}),expect.anything());
  expect((await res.json()).stornierung.status).toBe('storniert');
 });
 it('erstellt keine Gutschrift bei konkurrierender Verkaufsänderung',async()=>{
  setup();
  mocks.updateOne.mockResolvedValueOnce({modifiedCount:1}).mockResolvedValueOnce({modifiedCount:0});
  expect((await route0.POST(event('POST',input) as never)).status).toBe(409);
  expect(mocks.insertOne).not.toHaveBeenCalled();
 });
 it('verweigert fehlende historische Verkaufspositionen',async()=>{
  setup({positionen:undefined});
  expect((await route0.POST(event('POST',input) as never)).status).toBe(409);
  expect(mocks.updateOne).not.toHaveBeenCalled();
 });
});
