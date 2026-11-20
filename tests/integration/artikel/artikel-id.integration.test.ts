import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(),
  deleteOne: vi.fn(), deleteMany: vi.fn(), insertOne: vi.fn(),
  countDocuments: vi.fn(), collection: vi.fn(), startSession: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: m.collection },
  client: { startSession: m.startSession }
}));
const id = new ObjectId().toString();
const vereinId = new ObjectId().toString();
const kategorieId = new ObjectId().toString();
const lagerortId = new ObjectId().toString();
const groesseId = new ObjectId().toString();
const event = (method: string, body?: unknown, rolle = 'admin') => ({
  locals: { benutzer: { id, vereinId, rolle } }, params: { id },
  url: new URL('http://localhost/api/test'),
  request: new Request('http://localhost/api/test', { method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  })
});
const payload = () => ({
  name: 'Trainingsmaterial', kategorieId, lagerortId,
  menge: 4, einzelwert: 12.5, mindestbestand: 1,
  hatGroessen: false, beschreibung: 'Vereinsinventar'
});
beforeEach(() => {
  vi.clearAllMocks();
  m.collection.mockImplementation(() => m);
  m.findOne.mockResolvedValue(null);
  m.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  m.deleteOne.mockResolvedValue({ deletedCount: 1 });
  m.deleteMany.mockResolvedValue({ deletedCount: 0 });
  m.countDocuments.mockResolvedValue(1);
  m.find.mockReturnValue({ toArray: async () => [], sort: () => ({ toArray: async () => [] }),
    project: () => ({ toArray: async () => [] }) });
  m.startSession.mockReturnValue({ withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession: async () => {} });
});
import * as route0 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-delete-ausleihe.integration.test.ts
describe('23-artikel-delete-ausleihe', () => {
  it('Ausgeliehener Artikel wird geschützt', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
    const response = await route0.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(409);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });
});

import * as route1 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-delete-erfolg.integration.test.ts
describe('23-artikel-delete-erfolg', () => {
  it('Artikel und Varianten werden gelöscht', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    const response = await route1.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(200);
    expect(m.deleteMany).toHaveBeenCalledOnce();
    expect(m.deleteOne).toHaveBeenCalledOnce();
  });
});

import * as route2 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-delete-fehler.integration.test.ts
describe('23-artikel-delete-fehler', () => {
  it('Fehlgeschlagenes Löschen liefert Fehler', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    const response = await route2.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(500);
    expect(m.deleteOne).toHaveBeenCalledOnce();
  });
});

import * as route3 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-delete-schaden.integration.test.ts
describe('23-artikel-delete-schaden', () => {
  it('Artikel mit Schadensmeldung wird geschützt', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce(null);
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId() });
    const response = await route3.DELETE(event('DELETE', undefined) as never);
    expect(response.status).toBe(409);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });
});

import * as route4 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-lese-erfolg.integration.test.ts
describe('23-artikel-lese-erfolg', () => {
  it('Artikel ohne Grössen wird geladen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), name: 'Ball', hatGroessen: false });
    const response = await route4.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe('Ball');
  });
});

import * as route5 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-lese-varianten.integration.test.ts
describe('23-artikel-lese-varianten', () => {
  it('Varianten werden mit Beständen geladen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), name: 'Shirt', hatGroessen: true });
    m.find.mockReturnValueOnce({ toArray: async () => [{ _id: new ObjectId(), artikelId: id, groesseId, menge: 3, einzelwert: 15, mindestbestand: 1 }] });
    const response = await route5.GET(event('GET', undefined) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).varianten).toHaveLength(1);
  });
});

import * as route6 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-bestandschutz.integration.test.ts
describe('23-artikel-update-bestandschutz', () => {
  it('Nicht ausgewählte Grösse mit Bestand verhindert Änderung', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: true });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    m.find.mockReturnValueOnce({ toArray: async () => [{ groesseId: id, menge: 5 }] });
    const response = await route6.PATCH(event('PATCH', { ...payload(), hatGroessen: true, varianten: [{ groesseId, menge: 3, einzelwert: 15, mindestbestand: 1 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route7 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-erfolg.integration.test.ts
describe('23-artikel-update-erfolg', () => {
  it('Artikel wird atomar aktualisiert', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    const response = await route7.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(200);
    expect(m.updateOne).toHaveBeenCalledOnce();
    expect((await response.json()).gesamtmenge).toBe(4);
  });
});

import * as route8 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-fremde-kategorie.integration.test.ts
describe('23-artikel-update-fremde-kategorie', () => {
  it('Kategorie aus anderem Verein abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    const response = await route8.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route9 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-fremder-artikel.integration.test.ts
describe('23-artikel-update-fremder-artikel', () => {
  it('Nicht vorhandener Vereinsartikel', async () => {
    const response = await route9.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(404);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route10 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-groessentyp.integration.test.ts
describe('23-artikel-update-groessentyp', () => {
  it('Grössentyp kann nicht gewechselt werden', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: true });
    const response = await route10.PATCH(event('PATCH', payload()) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route11 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-invalid-minimum.integration.test.ts
describe('23-artikel-update-invalid-minimum', () => {
  it('23-artikel-update-invalid-minimum', async () => {
    const response = await route11.PATCH(event('PATCH', { ...payload(), mindestbestand: -1 }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

import * as route12 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-invalid-name.integration.test.ts
describe('23-artikel-update-invalid-name', () => {
  it('23-artikel-update-invalid-name', async () => {
    const response = await route12.PATCH(event('PATCH', { ...payload(), name: '' }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

import * as route13 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-invalid-price.integration.test.ts
describe('23-artikel-update-invalid-price', () => {
  it('23-artikel-update-invalid-price', async () => {
    const response = await route13.PATCH(event('PATCH', { ...payload(), einzelwert: -5 }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

import * as route14 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-invalid-stock.integration.test.ts
describe('23-artikel-update-invalid-stock', () => {
  it('23-artikel-update-invalid-stock', async () => {
    const response = await route14.PATCH(event('PATCH', { ...payload(), menge: -2 }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

import * as route15 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-invalid-supplier.integration.test.ts
describe('23-artikel-update-invalid-supplier', () => {
  it('23-artikel-update-invalid-supplier', async () => {
    const response = await route15.PATCH(event('PATCH', { ...payload(), lieferantId: 'abc' }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

import * as route16 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-invalid-variant.integration.test.ts
describe('23-artikel-update-invalid-variant', () => {
  it('23-artikel-update-invalid-variant', async () => {
    const response = await route16.PATCH(event('PATCH', { ...payload(), hatGroessen: true, varianten: [] }) as never);
    expect(response.status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

import * as route17 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-lieferant.integration.test.ts
describe('23-artikel-update-lieferant', () => {
  it('Fremder Lieferant wird abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: false });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    const response = await route17.PATCH(event('PATCH', { ...payload(), lieferantId: id }) as never);
    expect(response.status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route18 from '../../../src/routes/api/artikel/[id]/+server';

// Ursprüngliche Datei: 23-artikel-update-varianten.integration.test.ts
describe('23-artikel-update-varianten', () => {
  it('Grössenvarianten werden aktualisiert', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), hatGroessen: true });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(kategorieId) });
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(lagerortId) });
    const response = await route18.PATCH(event('PATCH', { ...payload(), hatGroessen: true, varianten: [{ groesseId, menge: 3, einzelwert: 15, mindestbestand: 1 }] }) as never);
    expect(response.status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledOnce();
    expect(m.updateOne).toHaveBeenCalledTimes(2);
  });
});

import * as route19 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-status-bereits-bestellt.integration.test.ts
describe('23-sammel-status-bereits-bestellt', () => {
  it('Bestellte Bestellung nicht erneut bestellen', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt' });
    const response = await route19.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route20 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-status-bestellen.integration.test.ts
describe('23-sammel-status-bestellen', () => {
  it('Entwurf wird bestellt', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'entwurf' });
    const response = await route20.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('bestellt');
  });
});

import * as route21 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-status-fehlt.integration.test.ts
describe('23-sammel-status-fehlt', () => {
  it('Fehlende Bestellung', async () => {
    const response = await route21.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(404);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route22 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-status-konflikt.integration.test.ts
describe('23-sammel-status-konflikt', () => {
  it('Konkurrierende Statusänderung', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'entwurf' });
    m.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    const response = await route22.PATCH(event('PATCH', { aktion: 'bestellen' }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).toHaveBeenCalledOnce();
  });
});

import * as route23 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-wareneingang-erfolg.integration.test.ts
describe('23-sammel-wareneingang-erfolg', () => {
  it('Wareneingang erhöht Bestand und schliesst Bestellung ab', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt', positionen: [{ artikelId: id, groesseId: null, menge: 2, geliefertMenge: 0, artikelname: 'Ball' }] });
    m.findOne.mockResolvedValueOnce({ menge: 5 });
    const response = await route23.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 2 }] }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('geliefert');
    expect(m.updateOne).toHaveBeenCalledTimes(2);
  });
});

import * as route24 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-wareneingang-menge.integration.test.ts
describe('23-sammel-wareneingang-menge', () => {
  it('Überlieferung wird abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt', positionen: [{ artikelId: id, groesseId: null, menge: 1, geliefertMenge: 0, artikelname: 'Ball' }] });
    const response = await route24.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 2 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route25 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-wareneingang-position.integration.test.ts
describe('23-sammel-wareneingang-position', () => {
  it('Fremde Lieferposition wird abgewiesen', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'bestellt', positionen: [] });
    const response = await route25.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 1 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

import * as route26 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 23-sammel-wareneingang-status.integration.test.ts
describe('23-sammel-wareneingang-status', () => {
  it('Wareneingang nur bei bestellt', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'entwurf' });
    const response = await route26.PATCH(event('PATCH', { aktion: 'wareneingang', positionen: [{ artikelId: id, groesseId: null, menge: 1 }] }) as never);
    expect(response.status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});

