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
import { POST } from '../../src/routes/api/anmelden/+server';
const run=(data:unknown)=>POST({request:request(data),cookies} as any);
describe('Anmeldung',()=>{
  it.each([{}, {email:'a@b.ch'}, {passwort:'abc'}, {email:4,passwort:4}])('weist fehlende Zugangsdaten ab: %j',async d=>{expect((await run(d)).status).toBe(400)});
  it('normalisiert E-Mail-Adressen',async()=>{await run({email:'  TEST@EXAMPLE.CH  ',passwort:'pass'});expect(m.findOne).toHaveBeenCalledWith({email:'test@example.ch',aktiv:true})});
  it('weist unbekannte Benutzer ab',async()=>{expect((await run({email:'a@b.ch',passwort:'pass'})).status).toBe(401)});
  it('weist Benutzer ohne Passwort-Hash ab',async()=>{m.findOne.mockResolvedValue({passwortHash:null});expect((await run({email:'a@b.ch',passwort:'pass'})).status).toBe(401)});
  it('weist falsches Passwort ab',async()=>{m.findOne.mockResolvedValue({passwortHash:'hash'});m.verify.mockResolvedValue(false);expect((await run({email:'a@b.ch',passwort:'pass'})).status).toBe(401)});
  it('legt Session an und setzt Cookie',async()=>{m.findOne.mockResolvedValue({_id:{toString:()=>id},vereinId:id2,passwortHash:'hash',email:'a@b.ch',vorname:'Ada',nachname:'Test',rolle:'admin'});const r=await run({email:'a@b.ch',passwort:'pass'});expect(r.status).toBe(200);expect((await r.json()).erfolg).toBe(true);expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:id2,tokenHash:expect.stringMatching(/^[a-f0-9]{64}$/)}));expect(m.set).toHaveBeenCalledWith('clubmatiq_session',expect.stringMatching(/^[a-f0-9]{64}$/),expect.objectContaining({httpOnly:true,path:'/',sameSite:'lax'}))});
  it('behandelt ungültiges JSON',async()=>{const r=await POST({request:new Request('http://localhost',{method:'POST',body:'{'}),cookies} as any);expect(r.status).toBe(500)});
  it('behandelt Datenbankfehler',async()=>{m.findOne.mockRejectedValue(new Error('db'));expect((await run({email:'a@b.ch',passwort:'pass'})).status).toBe(500)});
  it('behandelt Fehler beim Passwortvergleich',async()=>{m.findOne.mockResolvedValue({passwortHash:'hash'});m.verify.mockRejectedValue(new Error('argon'));expect((await run({email:'a@b.ch',passwort:'pass'})).status).toBe(500)});
});
