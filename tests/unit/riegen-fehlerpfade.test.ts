import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoServerError, ObjectId } from 'mongodb';
const m=vi.hoisted(()=>({collection:vi.fn(),permission:vi.fn(),createIndex:vi.fn(),insertOne:vi.fn(),updateOne:vi.fn()}));
vi.mock('../../src/lib/server/mongodb',()=>({db:{collection:m.collection}}));
vi.mock('../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
import { POST, PATCH } from '../../src/routes/api/riegen/+server';
const event=(method:string,body:string)=>({locals:{benutzer:{id:'admin-a',vereinId:'verein-a'}},request:new Request('http://localhost',{method,body})} as never);
beforeEach(()=>{vi.resetAllMocks();m.collection.mockReturnValue(m);m.permission.mockReturnValue(null);});
describe('Riegen – Fehlerpfade',()=>{
 it('verweigert syntaktisch ungültiges JSON bei Neuanlage',async()=>{
  expect((await POST(event('POST','{'))).status).toBe(400);
  expect(m.collection).not.toHaveBeenCalled();
 });
 it('verweigert syntaktisch ungültiges JSON bei Statusänderung',async()=>{
  expect((await PATCH(event('PATCH','{'))).status).toBe(400);
  expect(m.collection).not.toHaveBeenCalled();
 });
 it('reicht unerwartete Datenbankfehler weiter',async()=>{
  const error=new Error('Datenbank nicht verfügbar');
  m.createIndex.mockRejectedValue(error);
  await expect(POST(event('POST',JSON.stringify({name:'TV',bereich:'aktive'})))).rejects.toBe(error);
  expect(m.insertOne).not.toHaveBeenCalled();
 });
 it('behandelt einen konkurrierenden doppelten Namen als Konflikt',async()=>{
  m.insertOne.mockRejectedValue(new MongoServerError({message:'duplicate key',code:11000}));
  expect((await POST(event('POST',JSON.stringify({name:'TV',bereich:'aktive'})))).status).toBe(409);
 });
 it('normalisiert Unicode-Namen und bindet die Anlage an den eigenen Verein',async()=>{
  m.insertOne.mockResolvedValue({insertedId:new ObjectId()});
  expect((await POST(event('POST',JSON.stringify({name:' A\u0308 ',bereich:'juko',vereinId:'fremd',aktiv:false})))).status).toBe(201);
  expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({name:'A\u0308',namensschluessel:'ä',vereinId:'verein-a',aktiv:false}));
 });
});
