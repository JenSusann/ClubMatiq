import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  findOne: vi.fn(), insertOne: vi.fn(), deleteOne: vi.fn(), updateOne: vi.fn(),
  hash: vi.fn(), verify: vi.fn(), withTransaction: vi.fn(), endSession: vi.fn(),
  set: vi.fn(), get: vi.fn(), del: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
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
import { POST } from '../../../src/routes/api/abmelden/+server';
describe('Abmeldung',()=>{
  it('löscht Cookie auch ohne Session',async()=>{const r=await POST({cookies});expect(r.status).toBe(200);expect(m.deleteOne).not.toHaveBeenCalled();expect(m.del).toHaveBeenCalledWith('clubmatiq_session',{path:'/'})});
  it('löscht den Session-Hash und das Cookie',async()=>{m.get.mockReturnValue('token');const r=await POST({cookies});expect(r.status).toBe(200);expect(m.deleteOne).toHaveBeenCalledWith({tokenHash:expect.stringMatching(/^[a-f0-9]{64}$/)});expect(m.del).toHaveBeenCalled()});
  it('liefert 500 bei Datenbankfehler',async()=>{m.get.mockReturnValue('token');m.deleteOne.mockRejectedValue(new Error('db'));expect((await POST({cookies})).status).toBe(500)});
  it('liefert 500 bei Cookie-Fehler',async()=>{m.del.mockImplementation(()=>{throw new Error('cookie')});expect((await POST({cookies})).status).toBe(500)});
});
