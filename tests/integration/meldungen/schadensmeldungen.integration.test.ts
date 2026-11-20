import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => {
  const collections: Record<string, any> = {};
  const session = { withTransaction: vi.fn(async (fn: () => Promise<unknown>) => fn()), endSession: vi.fn(async () => {}) };
  return { collections, session, check: vi.fn(() => null), startSession: vi.fn(() => session) };
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


const get=(benutzer:any=user)=>read(route0.GET({locals:{benutzer}} as never));
const post=(data:unknown,benutzer:any=user)=>read(route0.POST({request:request(data),locals:{benutzer}} as never));
const input={artikelId:AID,beschreibung:'Defekte Naht',fotos:[]};
const foto={url:'https://res.cloudinary.com/demo/image/upload/a',publicId:'clubmatiq/v1/schadensmeldungen/bild'};
function setup(){
  mocks.collections.schadensmeldungen={find:vi.fn(()=>({sort:()=>({toArray:async()=>[{_id:new ObjectId(ID),status:'offen'}]})})),insertOne:vi.fn(async()=>({insertedId:new ObjectId(ID)}))};
  mocks.collections.artikel={findOne:vi.fn(async()=>({name:'Trikot'}))};
  mocks.collections.bildUploads={find:vi.fn(()=>({toArray:async()=>[{...foto}]})),updateMany:vi.fn(async()=>({modifiedCount:1}))};
}
import * as route0 from '../../../src/routes/api/meldungen/+server';

// Ursprüngliche Datei: 38-schadensmeldungen.integration.test.ts
describe('Paket 38 – Schadensmeldungen',()=>{
  it('GET ohne Login',async()=>{expect((await get(null)).status).toBe(401)});
  it('POST ohne Login',async()=>{expect((await post(input,null)).status).toBe(401)});
  it.each(['admin','materialverantwortlich','mitglied'])('GET mit Rolle %s',async rolle=>{setup();const r=await get({...user,rolle});expect(r.status).toBe(200);expect(r.body[0]._id).toBe(ID);expect(mocks.collections.schadensmeldungen.find).toHaveBeenCalledOnce()});
  it('GET Datenbankfehler',async()=>{setup();mocks.collections.schadensmeldungen.find.mockImplementation(()=>{throw new Error('db')});expect((await get()).status).toBe(500)});
  it.each([null,[],42,'text'])('verwirft Meldungsdaten %s',async data=>{expect((await post(data)).status).toBe(400)});
  it.each(['bad',null,42])('verwirft Artikel-ID %s',async artikelId=>{expect((await post({...input,artikelId})).status).toBe(400)});
  it.each(['', '  ', null, 4])('verwirft Beschreibung %s',async beschreibung=>{expect((await post({...input,beschreibung})).status).toBe(400)});
  it('verwirft zu lange Beschreibung',async()=>{expect((await post({...input,beschreibung:'x'.repeat(2001)})).status).toBe(400)});
  it.each([{},[1,2,3,4]])('verwirft ungültige Fotoliste',async fotos=>{expect((await post({...input,fotos})).status).toBe(400)});
  it.each([null,{},'x',[]])('verwirft ungültige Bildreferenz',async f=>{expect((await post({...input,fotos:[f]})).status).toBe(400)});
  it('verwirft fremden Upload-Ordner',async()=>{expect((await post({...input,fotos:[{...foto,publicId:'fremd/bild'}]})).status).toBe(400)});
  it('verwirft fremde Foto-URL',async()=>{expect((await post({...input,fotos:[{...foto,url:'https://example.org/a'}]})).status).toBe(400)});
  it('verwirft doppelte Fotos',async()=>{expect((await post({...input,fotos:[foto,foto]})).status).toBe(400)});
  it('meldet fehlenden Artikel',async()=>{setup();mocks.collections.artikel.findOne.mockResolvedValue(null);expect((await post(input)).status).toBe(404)});
  it('speichert Meldung ohne Fotos',async()=>{setup();const r=await post(input);expect(r.status).toBe(201);expect(r.body.erfolg).toBe(true);expect(mocks.collections.schadensmeldungen.insertOne).toHaveBeenCalledOnce();expect(mocks.session.endSession).toHaveBeenCalledOnce()});
  it('speichert registriertes Foto',async()=>{setup();const r=await post({...input,fotos:[foto]});expect(r.status).toBe(201);expect(mocks.collections.bildUploads.updateMany).toHaveBeenCalledOnce()});
  it('verweigert nicht registriertes Foto',async()=>{setup();mocks.collections.bildUploads.find.mockImplementation(()=>({toArray:async()=>[]}));expect((await post({...input,fotos:[foto]})).status).toBe(400)});
  it('verweigert URL-Abweichung beim registrierten Foto',async()=>{setup();mocks.collections.bildUploads.find.mockImplementation(()=>({toArray:async()=>[{...foto,url:'https://res.cloudinary.com/andere'}]}));expect((await post({...input,fotos:[foto]})).status).toBe(400)});
  it('verweigert fehlgeschlagene Fotoreservierung',async()=>{setup();mocks.collections.bildUploads.updateMany.mockResolvedValue({modifiedCount:0});expect((await post({...input,fotos:[foto]})).status).toBe(400)});
  it('behandelt Datenbankfehler beim Speichern',async()=>{setup();mocks.collections.schadensmeldungen.insertOne.mockRejectedValue(new Error('db'));expect((await post(input)).status).toBe(500);expect(mocks.session.endSession).toHaveBeenCalledOnce()});
});

