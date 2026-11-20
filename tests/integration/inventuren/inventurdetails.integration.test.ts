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


const get = (id=ID) => read(route0.GET({ params:{id}, locals:{benutzer:user} } as never));
const patch = (data:unknown, id=ID) => read(route0.PATCH({params:{id}, locals:{benutzer:user}, request:request(data)} as never));
const input={positionId:PID,istBestand:7,bemerkung:'Gezählt'};
function setup() {
  mocks.collections.inventuren={ findOne:vi.fn(async()=>({_id:new ObjectId(ID),status:'offen',version:0})),updateOne:vi.fn(async()=>({modifiedCount:1})) };
  mocks.collections.inventurpositionen={ findOne:vi.fn(async()=>({_id:new ObjectId(PID),sollBestand:5,bemerkung:'Alt'})), updateOne:vi.fn(async()=>({matchedCount:1})), find:vi.fn(()=>({sort:()=>({toArray:async()=>[{_id:new ObjectId(PID),istBestand:7,sollBestand:5},{_id:new ObjectId(AID),istBestand:null,sollBestand:3}]})})) };
}
import * as route0 from '../../../src/routes/api/inventuren/[id]/+server';

// Ursprüngliche Datei: 37-inventurdetails.integration.test.ts
describe('Paket 37 – Inventurdetails und Zählung',()=>{
  it('verweigert GET ohne Berechtigung',async()=>{mocks.check.mockReturnValue(new Response(null,{status:403}));expect((await get()).status).toBe(403)});
  it('verweigert PATCH ohne Berechtigung',async()=>{mocks.check.mockReturnValue(new Response(null,{status:403}));expect((await patch(input)).status).toBe(403)});
  it('verwirft ungültige GET-ID',async()=>{expect((await get('x')).status).toBe(400)});
  it('verwirft ungültige PATCH-ID',async()=>{expect((await patch(input,'x')).status).toBe(400)});
  it('liefert 404 für fehlende Inventur',async()=>{setup();mocks.collections.inventuren.findOne.mockResolvedValue(null);expect((await get()).status).toBe(404)});
  it('liefert Positionen mit Differenz und null',async()=>{setup();const r=await get();expect(r.status).toBe(200);expect(r.body.positionen.map((p:any)=>p.differenz)).toEqual([2,null]);expect(r.body.inventur.version).toBe(0)});
  it('verwendet Standardversion 0',async()=>{setup();mocks.collections.inventuren.findOne.mockResolvedValue({_id:new ObjectId(ID),status:'offen'});expect((await get()).body.inventur.version).toBe(0)});
  it('behandelt GET-Datenbankfehler',async()=>{setup();mocks.collections.inventuren.findOne.mockRejectedValue(new Error('db'));expect((await get()).status).toBe(500)});
  it.each([null,[], 'x'])('verwirft ungültige PATCH-Daten %s',async data=>{expect((await patch(data)).status).toBe(400)});
  it.each(['bad',null,2])('verwirft ungültige Position %s',async positionId=>{expect((await patch({...input,positionId})).status).toBe(400)});
  it.each([-1,1.3,'5'])('verwirft ungültigen Ist-Bestand %s',async istBestand=>{expect((await patch({...input,istBestand})).status).toBe(400)});
  it.each([123,'x'.repeat(1001)])('verwirft ungültige Bemerkung',async bemerkung=>{expect((await patch({...input,bemerkung})).status).toBe(400)});
  it('meldet fehlende Inventur beim PATCH',async()=>{setup();mocks.collections.inventuren.findOne.mockResolvedValue(null);expect((await patch(input)).status).toBe(409)});
  it('verweigert abgeschlossene Inventur',async()=>{setup();mocks.collections.inventuren.findOne.mockResolvedValue({status:'abgeschlossen'});expect((await patch(input)).status).toBe(409)});
  it('meldet fehlende Position',async()=>{setup();mocks.collections.inventurpositionen.findOne.mockResolvedValue(null);expect((await patch(input)).status).toBe(409)});
  it('meldet Versionskonflikt beim Speichern',async()=>{setup();mocks.collections.inventuren.updateOne.mockResolvedValue({modifiedCount:0});expect((await patch(input)).status).toBe(409)});
  it('meldet Konflikt beim Positionsupdate',async()=>{setup();mocks.collections.inventurpositionen.updateOne.mockResolvedValue({matchedCount:0});expect((await patch(input)).status).toBe(409)});
  it('speichert Zählung mit Differenz',async()=>{setup();const r=await patch(input);expect(r.status).toBe(200);expect(r.body).toMatchObject({erfolg:true,istBestand:7,differenz:2,version:1});expect(mocks.session.endSession).toHaveBeenCalledOnce()});
  it('setzt Zählung auf null zurück',async()=>{setup();const r=await patch({...input,istBestand:null});expect(r.status).toBe(200);expect(r.body.differenz).toBeNull();expect(mocks.collections.inventurpositionen.updateOne).toHaveBeenCalledOnce()});
  it('übernimmt bisherige Bemerkung',async()=>{setup();const r=await patch({positionId:PID,istBestand:8});expect(r.status).toBe(200);expect(r.body.bemerkung).toBe('Alt')});
});

