import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  findOne: vi.fn(), insertOne: vi.fn(), deleteOne: vi.fn(), updateOne: vi.fn(),
  hash: vi.fn(), verify: vi.fn(), withTransaction: vi.fn(), endSession: vi.fn(),
  set: vi.fn(), get: vi.fn(), del: vi.fn()
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({findOne:m.findOne, insertOne:m.insertOne, deleteOne:m.deleteOne, updateOne:m.updateOne})) },
  client: { startSession: () => ({withTransaction:m.withTransaction, endSession:m.endSession}) }
}));
vi.mock('argon2', () => ({ hash:m.hash, verify:m.verify, argon2id:2 }));
const id='507f1f77bcf86cd799439011';
const id2='507f1f77bcf86cd799439012';
const cookies={get:m.get,set:m.set,delete:m.del};
const request=(data:unknown)=>new Request('http://localhost/api/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
beforeEach(()=>{
  vi.clearAllMocks();m.findOne.mockResolvedValue(null);m.insertOne.mockResolvedValue({insertedId:{toString:()=>id}});
  m.updateOne.mockResolvedValue({modifiedCount:1});m.deleteOne.mockResolvedValue({deletedCount:1});
  m.hash.mockResolvedValue('argon-hash');m.verify.mockResolvedValue(true);m.endSession.mockResolvedValue(undefined);
  m.withTransaction.mockImplementation(async (cb:()=>Promise<void>)=>cb());
});
import { GET, POST } from '../../src/routes/api/einladung/+server';
const token='a'.repeat(64);
const invite={_id:id,vereinId:id2,vorname:'Ada',nachname:'Test',email:'ada@example.ch',rolle:'mitglied'};
const get=(t:string)=>GET({url:new URL('http://localhost/api/einladung?token='+t)} as any);
const post=(data:unknown)=>POST({request:request(data)} as any);
describe('Einladung abrufen',()=>{
  it.each(['','invalid','A'.repeat(64),'a'.repeat(63)])('weist ungültigen Token ab',async t=>{expect((await get(t)).status).toBe(400)});
  it('meldet unbekannte Einladung',async()=>{expect((await get(token)).status).toBe(404)});
  it('liefert Einladungsdaten ohne geheime Werte',async()=>{m.findOne.mockResolvedValue(invite);const r=await get(token);expect(r.status).toBe(200);expect(await r.json()).toEqual({vorname:'Ada',nachname:'Test',email:'ada@example.ch'})});
});
describe('Einladung annehmen',()=>{
  it.each([null,[],42,'x'])('weist ungültige Daten ab',async d=>{expect((await post(d)).status).toBe(400)});
  it.each([{token:'x',passwort:'SicheresPasswort123!'},{token,passwort:'kurz'},{token,passwort:'x'.repeat(1025)}])('weist ungültigen Token oder Passwort ab',async d=>{expect((await post(d)).status).toBe(400)});
  it('meldet abgelaufene oder unbekannte Einladung',async()=>{expect((await post({token,passwort:'SicheresPasswort123!'})).status).toBe(410);expect(m.endSession).toHaveBeenCalled()});
  it('meldet bereits registrierte E-Mail',async()=>{m.findOne.mockResolvedValueOnce(invite).mockResolvedValueOnce({_id:id});expect((await post({token,passwort:'SicheresPasswort123!'})).status).toBe(409)});
  it('meldet gleichzeitig angenommene Einladung',async()=>{m.findOne.mockResolvedValueOnce(invite).mockResolvedValueOnce(null);m.updateOne.mockResolvedValue({modifiedCount:0});expect((await post({token,passwort:'SicheresPasswort123!'})).status).toBe(410)});
  it('erstellt Konto in Transaktion und beendet Session',async()=>{m.findOne.mockResolvedValueOnce(invite).mockResolvedValueOnce(null);const r=await post({token,passwort:'SicheresPasswort123!'});expect(r.status).toBe(200);expect(m.updateOne).toHaveBeenCalledWith(expect.any(Object),expect.objectContaining({$set:expect.objectContaining({status:'angenommen'})}),expect.any(Object));expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:id2,email:invite.email,passwortHash:'argon-hash'}),expect.any(Object));expect(m.endSession).toHaveBeenCalled()});
  it('meldet unerwartete Transaktionsfehler',async()=>{m.withTransaction.mockRejectedValue(new Error('db'));expect((await post({token,passwort:'SicheresPasswort123!'})).status).toBe(500);expect(m.endSession).toHaveBeenCalled()});
});
