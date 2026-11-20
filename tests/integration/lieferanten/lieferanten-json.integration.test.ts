import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn(), countDocuments: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), deleteOne: vi.fn(), findOneAndUpdate: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
const id = '507f1f77bcf86cd799439011';
const benutzer = { id, vereinId: '507f1f77bcf86cd799439012', rolle: 'admin', aktiv: true };
const req = (method: string, data: unknown, raw = false) => ({ locals: { benutzer }, request: new Request('http://localhost/api/test', { method, headers: { 'content-type': 'application/json' }, body: raw ? String(data) : JSON.stringify(data) }) }) as never;
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); m.collection.mockReturnValue(m); m.find.mockReturnValue(m); m.sort.mockReturnValue(m); m.toArray.mockResolvedValue([]); m.findOne.mockResolvedValue(null); m.countDocuments.mockResolvedValue(0); m.updateOne.mockResolvedValue({matchedCount:1}); m.insertOne.mockResolvedValue({insertedId:new ObjectId(id)}); m.deleteOne.mockResolvedValue({deletedCount:1}); m.findOneAndUpdate.mockResolvedValue(null); });
import { GET, POST, PATCH, DELETE } from '../../../src/routes/api/lieferanten/+server';
const good = { name: 'Muster (AG)+', kontaktperson:'', email:'', telefon:'', bemerkung:'' };
describe('Lieferanten: fehlende JSON- und Regex-Pfade', () => {
 it.each([['POST',POST],['PATCH',PATCH],['DELETE',DELETE]] as const)('%s ungültiger JSON-Body', async (method,handler) => { const r=await handler(req(method,'{kaputt',true)); expect(r.status).toBe(400); });
 it('POST escaped Regex-Sonderzeichen und legt Lieferanten an', async () => { const r=await POST(req('POST',good)); expect(r.status).toBe(201); expect(m.findOne).toHaveBeenCalledWith(expect.objectContaining({name:expect.objectContaining({$regex: String.raw`^Muster \(AG\)\+$`})})); });
 it('GET serialisiert IDs',async()=>{m.toArray.mockResolvedValueOnce([{_id:new ObjectId(id),name:'Muster'}]);const r=await GET({locals:{benutzer}} as never);expect(r.status).toBe(200);expect((await r.json())[0]._id).toBe(id)});
 it('DELETE verweigert Artikelreferenz',async()=>{m.findOne.mockResolvedValueOnce({_id:new ObjectId(id)});expect((await DELETE(req('DELETE',{id}))).status).toBe(409)});
 it('PATCH akzeptiert gültige Eingaben',async()=>{expect((await PATCH(req('PATCH',{...good,id}))).status).toBe(200)});
});
