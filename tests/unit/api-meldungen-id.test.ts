import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collections: {} as Record<string, any>,
  session: { withTransaction: vi.fn(), endSession: vi.fn() }
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => m.collections[name] },
  client: { startSession: () => m.session }
}));
const oid = '507f1f77bcf86cd799439011';
const user = (rolle = 'admin') => ({ id: 'u1', vereinId: 'v1', rolle, vorname: 'Anna', nachname: 'Muster' });
const req = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
const ctx = (body: unknown, rolle = 'admin') => ({ request: req(body), locals: { benutzer: user(rolle) } }) as any;
const read = (r: Response) => r.json();
beforeEach(() => {
  vi.clearAllMocks();
  m.session.withTransaction.mockImplementation(async (fn: () => Promise<void>) => fn());
  m.session.endSession.mockResolvedValue(undefined);
  m.collections = {};
});

import { PATCH } from '../../src/routes/api/meldungen/[id]/+server';
const setup=()=>{const col={updateOne:vi.fn().mockResolvedValue({matchedCount:1})};m.collections={schadensmeldungen:col};return col};
const patch=(body:unknown,rolle='admin',id=oid)=>({...ctx(body,rolle),params:{id}});
describe('Schadensmeldung bearbeiten',()=>{
  it('verlangt Anmeldung',async()=>{setup();expect((await PATCH({...patch({}),locals:{}} as any)).status).toBe(401)});
  it.each(['mitglied','leiter','kassier'])('verweigert %s die Bearbeitung',async rolle=>{setup();expect((await PATCH(patch({},rolle))).status).toBe(403)});
  it('verwirft ungültige ID',async()=>{setup();expect((await PATCH(patch({},'admin','falsch'))).status).toBe(400)});
  it.each([null,[],3,'x'])('verwirft ungültigen Body %j',async body=>{setup();expect((await PATCH(patch(body))).status).toBe(400)});
  it.each([undefined,null,3,'fertig',''])('verwirft Status %j',async status=>{setup();expect((await PATCH(patch({status,bearbeitungsnotiz:''}))).status).toBe(400)});
  it.each([undefined,null,3,'x'.repeat(2001)])('verwirft Notiz %j',async bearbeitungsnotiz=>{setup();expect((await PATCH(patch({status:'offen',bearbeitungsnotiz}))).status).toBe(400)});
  it.each(['offen','in_bearbeitung','erledigt'])('speichert Status %s nur im eigenen Verein',async status=>{
    const col=setup();const r=await PATCH(patch({status,bearbeitungsnotiz:'  Geprüft  '},'materialverantwortlich'));
    expect(r.status).toBe(200);expect(col.updateOne.mock.calls[0][0].vereinId).toBe('v1');
    expect(col.updateOne.mock.calls[0][1].$set).toMatchObject({status,bearbeitungsnotiz:'Geprüft',bearbeitetVonId:'u1',bearbeitetVonName:'Anna Muster'});
  });
  it('liefert 404 bei fremder Meldung',async()=>{const col=setup();col.updateOne.mockResolvedValue({matchedCount:0});expect((await PATCH(patch({status:'erledigt',bearbeitungsnotiz:''}))).status).toBe(404)});
  it('liefert 500 bei Datenbankfehler',async()=>{const col=setup();col.updateOne.mockRejectedValue(Error('db'));expect((await PATCH(patch({status:'erledigt',bearbeitungsnotiz:''}))).status).toBe(500)});
});
