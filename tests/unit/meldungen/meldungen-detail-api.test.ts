import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collections: {} as Record<string, any>,
  session: { withTransaction: vi.fn(), endSession: vi.fn() }
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
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

import { PATCH } from '../../../src/routes/api/meldungen/[id]/+server';
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
    expect(col.updateOne.mock.calls[0][1][0].$set).toMatchObject({status:{$literal:status},bearbeitungsnotiz:{$literal:'Geprüft'},bearbeitetVonId:{$literal:'u1'},bearbeitetVonName:{$literal:'Anna Muster'}});
  });
  it('liefert 404 bei fremder Meldung',async()=>{const col=setup();col.updateOne.mockResolvedValue({matchedCount:0});expect((await PATCH(patch({status:'erledigt',bearbeitungsnotiz:''}))).status).toBe(404)});
  it('liefert 500 bei Datenbankfehler',async()=>{const col=setup();col.updateOne.mockRejectedValue(Error('db'));expect((await PATCH(patch({status:'erledigt',bearbeitungsnotiz:''}))).status).toBe(500)});
});

// Ergänzende Randfälle: gemeinsamer MongoDB-Mock und pro Test frische Collection.
const id = '507f1f77bcf86cd799439011';
const benutzer = { id, vereinId: 'verein-a', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const runRandfall = (body: unknown, user: unknown = benutzer, meldungId = id) => PATCH({
  params: { id: meldungId },
  locals: { benutzer: user },
  request: new Request('http://localhost/api/meldungen/' + meldungId, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
} as never);

describe('Schadensmeldung bearbeiten – Funktions- und Fehlerpfade', () => {
  let updateOne: ReturnType<typeof vi.fn>;
  beforeEach(() => { updateOne = setup().updateOne; });
  it('weist nicht angemeldete Personen zurück', async () => {
    expect((await runRandfall({ status: 'offen', bearbeitungsnotiz: '' }, null)).status).toBe(401);
  });
  it('weist unberechtigte Rollen zurück', async () => {
    expect((await runRandfall({ status: 'offen', bearbeitungsnotiz: '' }, { ...benutzer, rolle: 'mitglied' })).status).toBe(403);
  });
  it('weist ungültige IDs zurück', async () => {
    expect((await runRandfall({ status: 'offen', bearbeitungsnotiz: '' }, benutzer, 'ungueltig')).status).toBe(400);
  });
  it.each(['offen', 'in_bearbeitung', 'erledigt'])('speichert den Status %s', async (status) => {
    updateOne.mockResolvedValue({ matchedCount: 1 });
    const res = await runRandfall({ status, bearbeitungsnotiz: '  Geprüft  ' });
    expect(res.status).toBe(200);
    expect(updateOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-a' }), [expect.objectContaining({
      $set: expect.objectContaining({ status: {$literal: status}, bearbeitungsnotiz: {$literal: 'Geprüft'}, bearbeitetVonName: {$literal: 'Test Person'} })
    })]);
  });
  it('weist ungültige Statuswerte zurück', async () => {
    expect((await runRandfall({ status: 'gelöscht', bearbeitungsnotiz: '' })).status).toBe(400);
  });
  it('weist zu lange Notizen zurück', async () => {
    expect((await runRandfall({ status: 'offen', bearbeitungsnotiz: 'a'.repeat(2001) })).status).toBe(400);
  });
  it('meldet nicht gefundene Datensätze', async () => {
    updateOne.mockResolvedValue({ matchedCount: 0 });
    expect((await runRandfall({ status: 'offen', bearbeitungsnotiz: '' })).status).toBe(404);
  });
  it('behandelt Datenbankfehler', async () => {
    updateOne.mockRejectedValue(new Error('Datenbank nicht erreichbar'));
    expect((await runRandfall({ status: 'offen', bearbeitungsnotiz: '' })).status).toBe(500);
  });
});

it('protokolliert den bisherigen Status und schützt Notizen mit Dollarzeichen als Literal', async () => {
  const col = setup();
  expect((await PATCH(patch({status:'erledigt',bearbeitungsnotiz:'$status'}))).status).toBe(200);
  const set = col.updateOne.mock.calls[0][1][0].$set;
  expect(set.bearbeitungsverlauf.$concatArrays).toEqual([
    {$ifNull:['$bearbeitungsverlauf',[]]},
    [expect.objectContaining({datum:'$$NOW',alterStatus:'$status',neuerStatus:{$literal:'erledigt'},notiz:{$literal:'$status'},bearbeitetVonId:{$literal:'u1'}})]
  ]);
});
