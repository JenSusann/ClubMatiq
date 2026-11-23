import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../src/lib/server/mongodb';

const berechtigung = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: berechtigung }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn() },
  client: { startSession: vi.fn() }
}));

import { GET as einladenGET, POST as einladenPOST } from '../../../src/routes/api/benutzer/einladen/+server';
import { POST as erneutPOST } from '../../../src/routes/api/benutzer/einladen/[id]/erneut/+server';
import { GET as mitgliederGET, POST as mitgliederPOST } from '../../../src/routes/api/mitglieder/+server';
import { GET as rabatteGET, POST as rabattePOST, PUT as rabattePUT } from '../../../src/routes/api/rabatte/+server';

describe('API benutzer/einladen: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen', { method: 'GET' });
    const antwort = await einladenGET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await einladenPOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});

describe('API benutzer/einladen/[id]/erneut: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen/507f1f77bcf86cd799439011/erneut', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await erneutPOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API mitglieder: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/mitglieder', { method: 'GET' });
    const antwort = await mitgliederGET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/mitglieder', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await mitgliederPOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API rabatte: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/rabatte', { method: 'GET' });
    const antwort = await rabatteGET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/rabatte', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await rabattePOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('PUT: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/rabatte', { method: 'PUT', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await rabattePUT({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});

let rabattCollections: Record<string, any> = {};
const rabattId = '507f1f77bcf86cd799439011';
const rabattLocals = { benutzer: { vereinId: 'verein-1' } } as any;
const rabattValid = { name: ' Aktion ', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb' };
function rabattReq(method: string, body: unknown): Request { return new Request('http://localhost/api/rabatte', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
async function rabattCall(method: 'POST' | 'PUT', body: unknown): Promise<Response> { return (method === 'POST' ? rabattePOST : rabattePUT)({ request: rabattReq(method, body), locals: rabattLocals } as any) as Promise<Response>; }
let rabattRules: any;
describe('Rabatte – Validierung und Randfälle', () => {
 beforeEach(() => {
 vi.clearAllMocks(); berechtigung.mockReturnValue(null);
 rabattRules = { find: vi.fn().mockReturnValue({ sort: () => ({ toArray: async () => [{ _id: { toString: () => rabattId }, ...rabattValid }] }) }), insertOne: vi.fn().mockResolvedValue({ insertedId: { toString: () => rabattId } }), findOneAndUpdate: vi.fn().mockResolvedValue({ _id: { toString: () => rabattId }, ...rabattValid }) };
 rabattCollections = { rabattregeln: rabattRules, artikel: { countDocuments: vi.fn().mockResolvedValue(1) }, kategorien: { countDocuments: vi.fn().mockResolvedValue(1) } };
 vi.mocked(db.collection).mockImplementation(((name: string) => rabattCollections[name]) as any);
});
describe('Rabatte lesen', () => {
 it('liefert vereinsbezogene Regeln', async () => { const r = await rabatteGET({ locals: rabattLocals } as any) as Response; expect(r.status).toBe(200); expect((await r.json())[0]).toMatchObject({ _id: rabattId, name: rabattValid.name, aktiv: true, kombinierbar: false }); expect(rabattRules.find).toHaveBeenCalledWith({ vereinId: 'verein-1' }); });
 it('blockiert unberechtigte Zugriffe', async () => { berechtigung.mockReturnValue(new Response(null, { status: 403 })); expect((await rabatteGET({ locals: rabattLocals } as any) as Response).status).toBe(403); });
 it('liefert 500 bei Datenbankfehler', async () => { rabattRules.find.mockImplementation(() => { throw Error('db'); }); expect((await rabatteGET({ locals: rabattLocals } as any) as Response).status).toBe(500); });
});
describe('Rabatte validieren und speichern', () => {
 it('speichert eine gültige Warenkorbregel', async () => { const r = await rabattCall('POST', rabattValid); expect(r.status).toBe(201); expect((await r.json()).name).toBe('Aktion'); expect(rabattRules.insertOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-1', name: 'Aktion', aktiv: true })); });
 it.each([null, [], 'text', 3, {}, { ...rabattValid, name: '' }, { ...rabattValid, name: 'x'.repeat(121) }, { ...rabattValid, rabattart: 'falsch' }, { ...rabattValid, geltungsbereich: 'falsch' }, { ...rabattValid, wert: -1 }, { ...rabattValid, wert: 101 }, { ...rabattValid, wert: 1.123 }, { ...rabattValid, wert: '10' }, { ...rabattValid, wert: null }, { ...rabattValid, wert: 'NaN' }, { ...rabattValid, artikelIds: ['falsch'] }, { ...rabattValid, artikelIds: 'falsch' }, { ...rabattValid, kategorieIds: [123] }, { ...rabattValid, riegen: 'aktiv' }, { ...rabattValid, riegen: [''] }, { ...rabattValid, riegen: ['x'.repeat(101)] }, { ...rabattValid, maximaleMenge: 0 }, { ...rabattValid, maximaleMenge: 1.5 }, { ...rabattValid, gueltigAb: '2026-02-30' }, { ...rabattValid, gueltigBis: 'morgen' }, { ...rabattValid, gueltigAb: '2026-12-31', gueltigBis: '2026-01-01' }, { ...rabattValid, kombinierbar: 'ja' }, { ...rabattValid, aktiv: 1 }, { ...rabattValid, geltungsbereich: 'artikel', artikelIds: [] }, { ...rabattValid, geltungsbereich: 'kategorie', kategorieIds: [] }])('verweigert ungültige rabattePOST-Eingabe %#', async (body) => { expect((await rabattCall('POST', body)).status).toBe(400); });
 it.each(['betrag', 'fixpreis', 'prozent'])('akzeptiert Rabattart %s', async (rabattart) => { expect((await rabattCall('POST', { ...rabattValid, rabattart })).status).toBe(201); });
 it('entfernt doppelte IDs und Riegen', async () => { const r = await rabattCall('POST', { ...rabattValid, geltungsbereich: 'artikel', artikelIds: [rabattId, rabattId], riegen: [' Aktiv ', 'Aktiv'] }); expect(r.status).toBe(201); expect(rabattRules.insertOne.mock.calls[0][0]).toMatchObject({ artikelIds: [rabattId], riegen: ['Aktiv'] }); });
 it('prüft Artikelzuordnung zum Verein', async () => { rabattCollections.artikel.countDocuments.mockResolvedValue(0); expect((await rabattCall('POST', { ...rabattValid, geltungsbereich: 'artikel', artikelIds: [rabattId] })).status).toBe(400); });
 it('prüft Kategoriezuordnung zum Verein', async () => { rabattCollections.kategorien.countDocuments.mockResolvedValue(0); expect((await rabattCall('POST', { ...rabattValid, geltungsbereich: 'kategorie', kategorieIds: [rabattId] })).status).toBe(400); });
 it('akzeptiert Kategoriezuordnung zum Verein', async () => { expect((await rabattCall('POST', { ...rabattValid, geltungsbereich: 'kategorie', kategorieIds: [rabattId] })).status).toBe(201); });
 it('akzeptiert Datumsbereich und optionale Felder', async () => { const r = await rabattCall('POST', { ...rabattValid, gueltigAb: '2026-01-01', gueltigBis: '2026-12-31', maximaleMenge: 3, kombinierbar: true, aktiv: false }); expect(r.status).toBe(201); expect(await r.json()).toMatchObject({ gueltigAb: '2026-01-01', maximaleMenge: 3, kombinierbar: true, aktiv: false }); });
 it('liefert 500 bei DB-Fehler', async () => { rabattRules.insertOne.mockRejectedValue(Error('db')); expect((await rabattCall('POST', rabattValid)).status).toBe(500); });
 it('blockiert unberechtigte Schreibzugriffe', async () => { berechtigung.mockReturnValue(new Response(null, { status: 403 })); expect((await rabattCall('POST', rabattValid)).status).toBe(403); expect((await rabattCall('PUT', { ...rabattValid, _id: rabattId })).status).toBe(403); });
});
describe('Rabatte bearbeiten', () => {
 it('aktualisiert nur Regeln des Vereins', async () => { const r = await rabattCall('PUT', { ...rabattValid, _id: rabattId }); expect(r.status).toBe(200); expect(rabattRules.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-1' }), expect.anything(), { returnDocument: 'after' }); });
 it.each([null, [], {}, { ...rabattValid, _id: 'falsch' }, { ...rabattValid, _id: rabattId, name: '' }])('verweigert ungültige rabattePUT-Daten %#', async (body) => { expect((await rabattCall('PUT', body)).status).toBe(400); });
 it('liefert 404 für unbekannte Regel', async () => { rabattRules.findOneAndUpdate.mockResolvedValue(null); expect((await rabattCall('PUT', { ...rabattValid, _id: rabattId })).status).toBe(404); });
 it('verweigert fremde Artikel', async () => { rabattCollections.artikel.countDocuments.mockResolvedValue(0); expect((await rabattCall('PUT', { ...rabattValid, _id: rabattId, geltungsbereich: 'artikel', artikelIds: [rabattId] })).status).toBe(400); });
 it('liefert 500 bei DB-Fehler', async () => { rabattRules.findOneAndUpdate.mockRejectedValue(Error('db')); expect((await rabattCall('PUT', { ...rabattValid, _id: rabattId })).status).toBe(500); });
});

});
