import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), aggregate: vi.fn(), insertOne: vi.fn(),
  updateOne: vi.fn(), deleteOne: vi.fn(), countDocuments: vi.fn(), createIndex: vi.fn(),
  startSession: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => mocks) },
  client: { startSession: mocks.startSession }
}));
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const locals = (rolle: string | null = 'admin') => ({
  benutzer: rolle ? { id, vereinId, rolle } : null
});
const event = (method: string, body?: unknown, rolle: string | null = 'admin', targetId = id) => ({
  locals: locals(rolle),
  params: { id: targetId },
  url: new URL('http://localhost/api/vereinskleider'),
  request: new Request('http://localhost/api/vereinskleider', {
    method,
    ...(body === undefined ? {} : {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  })
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockResolvedValue(null);
  mocks.find.mockReturnValue({
    sort: () => ({ limit: () => ({ toArray: async () => [] }) }),
    toArray: async () => [],
    project: () => ({ toArray: async () => [] })
  });
  mocks.startSession.mockReturnValue({
    withTransaction: async (fn: () => Promise<unknown>) => fn(),
    endSession: async () => {}
  });
});
import * as route0 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 19-artikel-bearbeitungsrechte.integration.test.ts
describe('Integration: 19-artikel-bearbeitungsrechte', () => {
  it('Mitglied darf Artikel nicht ändern', async () => {
    const response = await route0.PATCH(event('PATCH', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Ungültige Artikel-ID', async () => {
    const response = await route0.PATCH(event('PATCH', {}, 'admin', 'falsch') as never);
    expect(response.status).toBe(400);
  });
});

import * as route1 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 19-artikel-einzelrechte.integration.test.ts
describe('Integration: 19-artikel-einzelrechte', () => {
  it('Nicht angemeldete dürfen Artikel nicht lesen', async () => {
    const response = await route1.GET(event('GET', undefined, null) as never);
    expect(response.status).toBe(401);
  });
  it('Ungültige Artikel-ID', async () => {
    const response = await route1.GET(event('GET', undefined, 'admin', 'falsch') as never);
    expect(response.status).toBe(400);
  });
  it('Fremder oder fehlender Artikel', async () => {
    const response = await route1.GET(event('GET', undefined, 'admin') as never);
    expect(response.status).toBe(404);
  });
});

import * as route2 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 19-gutschriften-liste.integration.test.ts
describe('Integration: 19-gutschriften-liste', () => {
  it('Gutschriften benötigen Verkaufsrecht', async () => {
    const response = await route2.GET(event('GET', undefined, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Anonyme dürfen Gutschriften nicht lesen', async () => {
    const response = await route2.GET(event('GET', undefined, null) as never);
    expect(response.status).toBe(401);
  });
});

import * as route3 from '../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 19-sammelbestellungen-erstellen.integration.test.ts
describe('Integration: 19-sammelbestellungen-erstellen', () => {
  it('Mitglied darf keine Sammelbestellung erstellen', async () => {
    const response = await route3.POST(event('POST', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Leere Positionen werden abgelehnt', async () => {
    const response = await route3.POST(event('POST', {'positionen': []}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Ungültige Bestellposition wird abgelehnt', async () => {
    const response = await route3.POST(event('POST', {'positionen': [{'artikelId': 'falsch', 'groesseId': null, 'menge': 1}]}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Doppelte Bestellpositionen werden abgelehnt', async () => {
    const response = await route3.POST(event('POST', {'positionen': [{'artikelId': 'aaaaaaaaaaaaaaaaaaaaaaaa', 'groesseId': null, 'menge': 1}, {'artikelId': 'aaaaaaaaaaaaaaaaaaaaaaaa', 'groesseId': null, 'menge': 2}]}, 'admin') as never);
    expect(response.status).toBe(400);
  });
});

import * as route4 from '../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: 19-sammelbestellungen-liste.integration.test.ts
describe('Integration: 19-sammelbestellungen-liste', () => {
  it('Mitglied darf Sammelbestellungen nicht lesen', async () => {
    const response = await route4.GET(event('GET', undefined, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Anonyme dürfen Sammelbestellungen nicht lesen', async () => {
    const response = await route4.GET(event('GET', undefined, null) as never);
    expect(response.status).toBe(401);
  });
});

import * as route5 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 19-sammelbestellungen-status.integration.test.ts
describe('Integration: 19-sammelbestellungen-status', () => {
  it('Mitglied darf Bestellung nicht ändern', async () => {
    const response = await route5.PATCH(event('PATCH', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Ungültige Bestellungs-ID', async () => {
    const response = await route5.PATCH(event('PATCH', {'aktion': 'bestellen'}, 'admin', 'falsch') as never);
    expect(response.status).toBe(400);
  });
  it('Ungültige Aktion', async () => {
    const response = await route5.PATCH(event('PATCH', {'aktion': 'falsch'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Wareneingang ohne Positionen', async () => {
    const response = await route5.PATCH(event('PATCH', {'aktion': 'wareneingang', 'positionen': []}, 'admin') as never);
    expect(response.status).toBe(400);
  });
});

import * as route6 from '../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 19-verkauf-export.integration.test.ts
describe('Integration: 19-verkauf-export', () => {
  it('Export benötigt Berechtigung', async () => {
    const response = await route6.GET(event('GET', undefined, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Export ohne Anmeldung gesperrt', async () => {
    const response = await route6.GET(event('GET', undefined, null) as never);
    expect(response.status).toBe(401);
  });
});

import * as route7 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 19-verkauf-historie.integration.test.ts
describe('Integration: 19-verkauf-historie', () => {
  it('Mitglied darf Verkaufshistorie nicht lesen', async () => {
    const response = await route7.GET(event('GET', undefined, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Anonyme dürfen Historie nicht lesen', async () => {
    const response = await route7.GET(event('GET', undefined, null) as never);
    expect(response.status).toBe(401);
  });
});

import * as route8 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 19-verkauf-stornierungen.integration.test.ts
describe('Integration: 19-verkauf-stornierungen', () => {
  it('Mitglied darf nicht stornieren', async () => {
    const response = await route8.POST(event('POST', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Leere Stornierung wird abgelehnt', async () => {
    const response = await route8.POST(event('POST', {}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Stornierung benötigt gültigen Verkauf', async () => {
    const response = await route8.POST(event('POST', {'verkaufId': 'falsch', 'positionsIndex': 0, 'menge': 1, 'grund': 'Fehler'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Stornierung benötigt Grund', async () => {
    const response = await route8.POST(event('POST', {'verkaufId': 'aaaaaaaaaaaaaaaaaaaaaaaa', 'positionsIndex': 0, 'menge': 1, 'grund': ''}, 'admin') as never);
    expect(response.status).toBe(400);
  });
});

import * as route9 from '../../../src/routes/api/vereinskleider/+server';

// Ursprüngliche Datei: 19-verkauf-validierung.integration.test.ts
describe('Integration: 19-verkauf-validierung', () => {
  it('Mitglied darf nicht verkaufen', async () => {
    const response = await route9.POST(event('POST', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Anmeldung ist erforderlich', async () => {
    const response = await route9.POST(event('POST', {}, null) as never);
    expect(response.status).toBe(401);
  });
  it('Verkaufsdaten müssen Objekt sein', async () => {
    const response = await route9.POST(event('POST', [], 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Verkaufsart muss gültig sein', async () => {
    const response = await route9.POST(event('POST', {'verkaufsart': 'falsch'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Warenkorb ist erforderlich', async () => {
    const response = await route9.POST(event('POST', {'verkaufsart': 'direkt', 'kaeufer': 'A', 'zahlungsart': 'bar', 'riegen': ['Aktive'], 'positionen': []}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Rechnung darf nicht sofort bezahlt markiert werden', async () => {
    const response = await route9.POST(event('POST', {'verkaufsart': 'direkt', 'kaeufer': 'A', 'zahlungsart': 'rechnung', 'zahlungErhalten': true, 'riegen': ['Aktive'], 'positionen': [{'artikelId': '123', 'groesseId': null, 'menge': 1}]}, 'admin') as never);
    expect(response.status).toBe(400);
  });
});

import * as route10 from '../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: 19-verrechnung-erstellen.integration.test.ts
describe('Integration: 19-verrechnung-erstellen', () => {
  it('Mitglied darf keine Rechnung erstellen', async () => {
    const response = await route10.POST(event('POST', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Rechnungsdaten müssen gültig sein', async () => {
    const response = await route10.POST(event('POST', [], 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Verkaufs-ID muss gültig sein', async () => {
    const response = await route10.POST(event('POST', {'verkaufId': 'ungueltig'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Fehlender Verkauf gibt 404', async () => {
    const response = await route10.POST(event('POST', {'verkaufId': 'aaaaaaaaaaaaaaaaaaaaaaaa'}, 'admin') as never);
    expect(response.status).toBe(404);
  });
});

import * as route11 from '../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: 19-verrechnung-liste.integration.test.ts
describe('Integration: 19-verrechnung-liste', () => {
  it('Mitglied darf Rechnungen nicht lesen', async () => {
    const response = await route11.GET(event('GET', undefined, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Anonyme dürfen Rechnungen nicht lesen', async () => {
    const response = await route11.GET(event('GET', undefined, null) as never);
    expect(response.status).toBe(401);
  });
});

import * as route12 from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

// Ursprüngliche Datei: 19-zahlung-erfassen.integration.test.ts
describe('Integration: 19-zahlung-erfassen', () => {
  it('Mitglied darf keine Zahlung erfassen', async () => {
    const response = await route12.PATCH(event('PATCH', {}, 'mitglied') as never);
    expect(response.status).toBe(403);
  });
  it('Ungültige Rechnungs-ID', async () => {
    const response = await route12.PATCH(event('PATCH', {}, 'admin', 'falsch') as never);
    expect(response.status).toBe(400);
  });
  it('Zahlungsbetrag muss positiv sein', async () => {
    const response = await route12.PATCH(event('PATCH', {'betrag': 0, 'datum': '2026-11-19', 'zahlungsart': 'twint', 'zahlungId': '12345678-1234-1234-1234-123456789abc'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Ungültiges Datum wird abgelehnt', async () => {
    const response = await route12.PATCH(event('PATCH', {'betrag': 5, 'datum': '2026-02-30', 'zahlungsart': 'twint', 'zahlungId': '12345678-1234-1234-1234-123456789abc'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Zahlungsart muss gültig sein', async () => {
    const response = await route12.PATCH(event('PATCH', {'betrag': 5, 'datum': '2026-11-19', 'zahlungsart': 'karte', 'zahlungId': '12345678-1234-1234-1234-123456789abc'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
  it('Zahlungs-ID ist Pflicht', async () => {
    const response = await route12.PATCH(event('PATCH', {'betrag': 5, 'datum': '2026-11-19', 'zahlungsart': 'twint'}, 'admin') as never);
    expect(response.status).toBe(400);
  });
});


import * as preisOffenRoute from '../../../src/routes/api/vereinskleider/preise/+server';

// Issue #68: Preis-offen-Konfiguration über die echte Preis-Route mit Rollenprüfung.
describe('Integration: Preis-offen-Einstellung Vereinskleider', () => {
  it('speichert eine verbindlich bestellbare Position ohne definitiven Verkaufspreis', async () => {
    mocks.findOne.mockResolvedValue({ istVereinskleidung: true, hatGroessen: false });
    mocks.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
    const response = await preisOffenRoute.PUT(event('PUT', {
      artikelId: id, groesseId: null, preistyp: 'fix',
      druckkosten: 0, verkaufspreis: null, preisOffen: true
    }) as never);
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, artikelId: id }),
      expect.objectContaining({ $set: expect.objectContaining({ preisOffen: true, verkaufspreis: null }) }),
      { upsert: true }
    );
  });

  it('verhindert Preisänderungen durch Mitglieder', async () => {
    const response = await preisOffenRoute.PUT(event('PUT', {
      artikelId: id, groesseId: null, preistyp: 'fix',
      druckkosten: 0, verkaufspreis: null, preisOffen: true
    }, 'mitglied') as never);
    expect(response.status).toBe(403);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});


describe('Issue #34 – Stornierung von Erstbezügen', () => {
  const mitgliedId = new ObjectId().toHexString();
  const artikelId = new ObjectId().toHexString();
  const session = { withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {} };
  const verkauf = (overrides: Record<string, unknown> = {}) => ({
    _id: new ObjectId(id), vereinId, mitgliedId, erstbezugsIds: [artikelId],
    status: 'offen', endbetrag: 0, zwischentotal: 25, rabattTotal: 25,
    bezahltBetrag: 0, zahlungen: [], aktualisiertAm: new Date(),
    rabatte: [{ betrag: 25 }], positionen: [{
      artikelId, groesseId: null, verkaufsart: 'bestellung', menge: 1,
      einzelpreis: 25, positionsbetrag: 25, uebergebenMenge: 0, reserviertMenge: 0
    }], ...overrides
  });
  const stornieren = () => route8.POST(event('POST', {
    verkaufId: id, positionsIndex: 0, menge: 1, grund: 'Fehlbestellung'
  }) as never);
  beforeEach(() => {
    mocks.startSession.mockReturnValue(session);
    mocks.findOne.mockResolvedValue(verkauf());
    mocks.updateOne.mockReset().mockResolvedValue({ modifiedCount: 1 });
  });
  it.each([0, 50])('gibt vollständigen unbezahlten Erstbezug mit CHF %s frei', async (betrag) => {
    const v = verkauf({ endbetrag: betrag, zwischentotal: betrag + 25 });
    v.positionen[0].einzelpreis = betrag + 25;
    v.positionen[0].positionsbetrag = betrag + 25;
    mocks.findOne.mockResolvedValue(v);
    const response = await stornieren();
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId, _id: new ObjectId(id) }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'storniert', endbetrag: 0, erstbezugsFreigegebenAm: expect.any(Date) }) }),
      { session });
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(mitgliedId), vereinId, erstbezugsRabattIds: { $all: [artikelId] } },
      { $pullAll: { erstbezugsRabattIds: [artikelId] } }, { session });
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
  it('verweigert die Freigabe nach Übergabe', async () => {
    const v = verkauf();
    v.positionen[0].uebergebenMenge = 1;
    mocks.findOne.mockResolvedValue(v);
    expect((await stornieren()).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert wiederholte Stornierung', async () => {
    mocks.findOne.mockResolvedValue(verkauf({ status: 'storniert' }));
    expect((await stornieren()).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('meldet fehlgeschlagene Anspruchsfreigabe', async () => {
    mocks.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await stornieren()).status).toBe(409);
    expect(mocks.updateOne).toHaveBeenCalledTimes(2);
  });
  it('verweigert Freigabe bei konkurrierender Verkaufsänderung', async () => {
    mocks.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect((await stornieren()).status).toBe(409);
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
  });
  it('verweigert fehlenden oder fremden Verkauf', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await stornieren()).status).toBe(404);
    expect(mocks.findOne).toHaveBeenCalledWith({ _id: new ObjectId(id), vereinId }, { session });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
