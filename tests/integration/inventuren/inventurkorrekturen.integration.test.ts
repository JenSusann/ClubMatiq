import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => {
  const collections: Record<string, any> = {};
  const session = { withTransaction: vi.fn(async (fn: () => Promise<unknown>) => fn()), endSession: vi.fn(async () => {}) };
  return { collections, session, check: vi.fn<() => Response | null>(() => null), startSession: vi.fn(() => session) };
});
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => mocks.collections[name] },
  client: { startSession: mocks.startSession }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.check }));
const ID = '507f1f77bcf86cd799439011';
const PID = '507f1f77bcf86cd799439012';
const AID = '507f1f77bcf86cd799439013';
const SID = '507f1f77bcf86cd799439014';
const user = { id: 'u1', vereinId: 'v1', rolle: 'admin', vorname: 'Ada', nachname: 'Test' };
const request = (value: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
async function read(responsePromise: Response | Promise<Response>) { const response = await responsePromise; const raw = await response.text(); return { status: response.status, body: raw ? JSON.parse(raw) : null }; }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.check.mockReturnValue(null);
  for (const name of Object.keys(mocks.collections)) delete mocks.collections[name];
});


const input = { positionId: PID, neuerIstBestand: 7, begruendung: 'Zählfehler korrigiert', version: 0 };
const call = (data: unknown = input, id = ID) => read(route0.POST({ params: { id }, request: request(data), locals: { benutzer: user } } as never));
function setup(status = 'abgeschlossen', position: Record<string,unknown> = {}) {
  const update = vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1 }));
  mocks.collections.inventuren = { findOne: vi.fn(async () => ({ status, version: 0 })), updateOne: update };
  mocks.collections.inventurpositionen = { findOne: vi.fn(async () => ({ istBestand: 5, artikelId: AID, groesseId: null, ...position })), updateOne: vi.fn(async () => ({ matchedCount: 1 })) };
  mocks.collections.artikel = { updateOne: vi.fn(async () => ({ matchedCount: 1 })) };
  mocks.collections.artikelvarianten = { updateOne: vi.fn(async () => ({ matchedCount: 1 })) };
  mocks.collections.inventurprotokoll = { insertOne: vi.fn(async () => ({ insertedId: new ObjectId() })) };
}
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrigieren/+server';

// Ursprüngliche Datei: 36-inventurkorrekturen.integration.test.ts
describe('Paket 36 – nachträgliche Inventurkorrekturen', () => {
  it('verweigert fehlende Berechtigung', async () => { mocks.check.mockReturnValue(new Response(null, {status:403})); expect((await call()).status).toBe(403); });
  it('verwirft ungültige Inventur-ID', async () => { expect((await call(input,'falsch')).status).toBe(400); });
  it.each([null, [], 'x', 4])('verwirft ungültige Eingabedaten %s', async data => { expect((await call(data)).status).toBe(400); });
  it.each([null, 'x', 4, 'bad'])('verwirft ungültige Position %s', async positionId => { expect((await call({...input,positionId})).status).toBe(400); });
  it.each([-1, 1.5, '7', null, Number.MAX_SAFE_INTEGER+1])('verwirft Ist-Bestand %s', async neuerIstBestand => { expect((await call({...input,neuerIstBestand})).status).toBe(400); });
  it.each(['', 'kurz', 'a'.repeat(1001), null])('verwirft Begründung %s', async begruendung => { expect((await call({...input,begruendung})).status).toBe(400); });
  it.each([-1, 1.5, '0', null])('verwirft Version %s', async version => { expect((await call({...input,version})).status).toBe(400); });
  it('meldet fehlende Inventur', async () => { setup(); mocks.collections.inventuren.findOne.mockResolvedValue(null); expect((await call()).status).toBe(409); });
  it('verweigert offene Inventur', async () => { setup('offen'); expect((await call()).status).toBe(409); });
  it('verweigert veraltete Version', async () => { setup(); expect((await call({...input,version:2})).status).toBe(409); });
  it('meldet fehlende Position', async () => { setup(); mocks.collections.inventurpositionen.findOne.mockResolvedValue(null); expect((await call()).status).toBe(409); });
  it.each([-1, 1.2, '5'])('verweigert bisherigen Bestand %s', async istBestand => { setup('abgeschlossen',{istBestand}); expect((await call()).status).toBe(409); });
  it('verweigert ungültige Artikel-ID', async () => { setup('abgeschlossen',{artikelId:'bad'}); expect((await call()).status).toBe(409); });
  it('verweigert unveränderten Bestand', async () => { setup(); expect((await call({...input,neuerIstBestand:5})).status).toBe(409); });
  it('erkennt Konflikt beim Inventur-Update', async () => { setup(); mocks.collections.inventuren.updateOne.mockResolvedValue({matchedCount:0}); expect((await call()).status).toBe(409); });
  it('erkennt ungültige Grössen-ID', async () => { setup('abgeschlossen',{groesseId:'bad'}); expect((await call()).status).toBe(409); });
  it('erkennt fehlende Variante', async () => { setup('abgeschlossen',{groesseId:SID}); mocks.collections.artikelvarianten.updateOne.mockResolvedValue({matchedCount:0}); expect((await call()).status).toBe(409); });
  it('erkennt fehlenden Artikelbestand', async () => { setup(); mocks.collections.artikel.updateOne.mockResolvedValue({matchedCount:0}); expect((await call()).status).toBe(409); });
  it('erkennt konkurrierende Positionsänderung', async () => { setup(); mocks.collections.inventurpositionen.updateOne.mockResolvedValue({matchedCount:0}); expect((await call()).status).toBe(409); });
  it('speichert erfolgreiche Korrektur mit Protokoll', async () => { setup(); const result=await call(); expect(result.status).toBe(200); expect(result.body).toMatchObject({erfolg:true,alterIstBestand:5,neuerIstBestand:7,differenz:2,version:1}); expect(mocks.collections.inventurprotokoll.insertOne).toHaveBeenCalledOnce(); expect(mocks.session.endSession).toHaveBeenCalledOnce(); });
  it('speichert negative Differenz für Grössenvariante', async () => { setup('abgeschlossen',{groesseId:SID}); const result=await call({...input,neuerIstBestand:3}); expect(result.status).toBe(200); expect(result.body.differenz).toBe(-2); expect(mocks.collections.artikelvarianten.updateOne).toHaveBeenCalledOnce(); });
  it('behandelt Datenbankausfall und beendet Session', async () => { setup(); mocks.collections.inventurprotokoll.insertOne.mockRejectedValue(new Error('db down')); expect((await call()).status).toBe(409); expect(mocks.session.endSession).toHaveBeenCalledOnce(); });
});

