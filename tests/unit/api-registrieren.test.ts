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
import { POST } from '../../src/routes/api/registrieren/+server';
const valid={vereinsname:'  Turnverein  ',vereinskuerzel:' TV ',vorname:' Ada ',nachname:' Test ',email:' TEST@EXAMPLE.CH ',passwort:'SicheresPasswort123!'};
const run=(data:unknown)=>POST({request:request(data),cookies} as any);
describe('Registrierung',()=>{
  it.each(['vereinsname','vorname','nachname','email','passwort'] as const)('erfordert %s',async feld=>{expect((await run({...valid,[feld]:''})).status).toBe(400)});
  it('weist ungültige E-Mail ab',async()=>{expect((await run({...valid,email:'ungültig'})).status).toBe(400)});
  it('weist kurze Passwörter ab',async()=>{expect((await run({...valid,passwort:'12345678901'})).status).toBe(400)});
  it('weist bereits registrierte E-Mail ab',async()=>{m.findOne.mockResolvedValue({_id:id});expect((await run(valid)).status).toBe(409)});
  it('erstellt Verein, Admin und Session',async()=>{const r=await run(valid);expect(r.status).toBe(201);expect((await r.json()).erfolg).toBe(true);expect(m.hash).toHaveBeenCalledWith(valid.passwort,expect.any(Object));expect(m.insertOne).toHaveBeenCalledTimes(3);expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({name:'Turnverein',kuerzel:'TV'}));expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({email:'test@example.ch',rolle:'admin',passwortHash:'argon-hash'}));expect(m.set).toHaveBeenCalledWith('clubmatiq_session',expect.any(String),expect.objectContaining({httpOnly:true}))});
  it('akzeptiert fehlendes Vereinskürzel',async()=>{expect((await run({...valid,vereinskuerzel:undefined})).status).toBe(201)});
  it('behandelt kaputtes JSON als fehlende Pflichtfelder',async()=>{const r=await POST({request:new Request('http://localhost',{method:'POST',body:'{'}),cookies} as any);expect(r.status).toBe(400)});
  it('behandelt Datenbankfehler',async()=>{m.findOne.mockRejectedValue(new Error('db'));expect((await run(valid)).status).toBe(500)});
  it('behandelt Passwort-Hash-Fehler',async()=>{m.hash.mockRejectedValue(new Error('argon'));expect((await run(valid)).status).toBe(500)});
  it('behandelt Fehler beim Anlegen des Administrators',async()=>{m.insertOne.mockResolvedValueOnce({insertedId:{toString:()=>id}}).mockRejectedValueOnce(new Error('db'));expect((await run(valid)).status).toBe(500)});
  it('behandelt Fehler beim Anlegen der Session',async()=>{m.insertOne.mockResolvedValueOnce({insertedId:{toString:()=>id}}).mockResolvedValueOnce({insertedId:{toString:()=>id2}}).mockRejectedValueOnce(new Error('db'));expect((await run(valid)).status).toBe(500)});
});
