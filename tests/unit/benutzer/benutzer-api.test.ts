import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({ permission: vi.fn(), collection: vi.fn(), find: vi.fn(), project: vi.fn(), sort: vi.fn(), toArray: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn(), insertOne: vi.fn(), hash: vi.fn(), listCollections: vi.fn(), deleteOne: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args), listCollections: mocks.listCollections } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET } from '../../../src/routes/api/benutzer/+server';
import { PATCH } from '../../../src/routes/api/benutzer/[id]/+server';
const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const event = () => ({ locals: { benutzer } } as any);
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockReturnValue({ find: mocks.find });
  mocks.find.mockReturnValue({ project: mocks.project });
  mocks.project.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockResolvedValue([]);
});
describe('GET /api/benutzer', () => {
  it('verweigert Zugriff ohne Verwaltungsrecht', async () => {
    mocks.permission.mockReturnValue(new Response('verboten', { status: 403 }));
    const response = await GET(event());
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith(benutzer, 'benutzer:verwalten');
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it('lädt nur Benutzer des Vereins und entfernt Passwort-Hashes', async () => {
    mocks.toArray.mockResolvedValue([{ _id: { toString: () => 'id-1' }, vorname: 'Anna', nachname: 'Muster', email: 'anna@example.org', rolle: 'admin', aktiv: true, passwortHash: 'geheim' }]);
    const response = await GET(event());
    expect(response.status).toBe(200);
    expect(mocks.collection).toHaveBeenCalledWith('benutzer');
    expect(mocks.find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
    expect(mocks.project).toHaveBeenCalledWith({ passwortHash: 0 });
    expect(mocks.sort).toHaveBeenCalledWith({ nachname: 1, vorname: 1 });
    expect(await response.json()).toEqual([{ id: 'id-1', vorname: 'Anna', nachname: 'Muster', email: 'anna@example.org', rolle: 'admin', aktiv: true }]);
  });
  it('liefert eine leere Liste bei keinen Benutzern', async () => {
    const response = await GET(event());
    expect(await response.json()).toEqual([]);
  });
  it('behandelt Datenbankfehler mit 500', async () => {
    mocks.toArray.mockRejectedValue(new Error('DB'));
    const response = await GET(event());
    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toBe('Benutzer konnten nicht geladen werden.');
  });
});

const id = new ObjectId().toString();
const adminId = new ObjectId().toString();
const ziel = { _id: new ObjectId(id), vereinId: 'verein-1', rolle: 'mitglied', aktiv: true };
function eventBearbeiten(body: unknown, personId = id, rolle = 'admin') {
  return {
    params: { id: personId },
    locals: { benutzer: { id: adminId, vereinId: 'verein-1', rolle } },
    request: new Request('http://localhost/api/benutzer/' + personId, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  } as never;
}
describe('Benutzerbearbeitung – Detail-API', () => {
 beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockReturnValue({ findOne: mocks.findOne, updateOne: mocks.updateOne, countDocuments: mocks.countDocuments, deleteMany: mocks.deleteMany });
  mocks.findOne.mockResolvedValue(ziel);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.countDocuments.mockResolvedValue(1);
  mocks.deleteMany.mockResolvedValue({ deletedCount: 1 });
});

describe('Issue #15 – Benutzer bearbeiten', () => {
  it('speichert Vor- und Nachnamen', async () => {
    const response = await PATCH(eventBearbeiten({ vorname: ' Eva ', nachname: 'Muster' }));
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new ObjectId(id), vereinId: 'verein-1' },
      { $set: { vorname: 'Eva', nachname: 'Muster' } }
    );
  });
  it('normalisiert E-Mail-Adressen', async () => {
    expect((await PATCH(eventBearbeiten({ email: ' EVA@EXAMPLE.CH ' }))).status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][1].$set.email).toBe('eva@example.ch');
  });
  it('weist ungültige Rollen und unbekannte Felder zurück', async () => {
    expect((await PATCH(eventBearbeiten({ rolle: 'superadmin' }))).status).toBe(400);
    expect((await PATCH(eventBearbeiten({ passwortHash: 'hack' }))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it.each([['admin'], ['leiter'], null, 42, {}])('weist nicht-stringförmige Rollen ab: %j', async rolle => {
    expect((await PATCH(eventBearbeiten({ rolle }))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert Zugriff ohne Berechtigung', async () => {
    mocks.permission.mockReturnValue(new Response(null, { status: 403 }));
    expect((await PATCH(eventBearbeiten({ vorname: 'Eva' }))).status).toBe(403);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
  it('verhindert Änderungen an fremden Vereinsbenutzern', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await PATCH(eventBearbeiten({ vorname: 'Eva' }))).status).toBe(404);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert das Entfernen der eigenen Administratorrolle', async () => {
    mocks.findOne.mockResolvedValue({ ...ziel, rolle: 'admin' });
    expect((await PATCH(eventBearbeiten({ rolle: 'mitglied' }, adminId))).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('schützt den letzten aktiven Administrator', async () => {
    mocks.findOne.mockResolvedValue({ ...ziel, rolle: 'admin' });
    mocks.countDocuments.mockResolvedValue(0);
    expect((await PATCH(eventBearbeiten({ rolle: 'mitglied' }))).status).toBe(409);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('löscht Sessions bei Rollenwechsel', async () => {
    expect((await PATCH(eventBearbeiten({ rolle: 'leiter' }))).status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ benutzerId: id, vereinId: 'verein-1' });
  });
  it('behandelt doppelte E-Mail-Adressen als Konflikt', async () => {
    mocks.updateOne.mockRejectedValue({ code: 11000 });
    expect((await PATCH(eventBearbeiten({ email: 'eva@example.ch' }))).status).toBe(409);
  });
  it('verweigert ungültigen Aktivstatus', async () => {
    expect((await PATCH(eventBearbeiten({ aktiv: 'nein' }))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});

});

vi.mock('argon2', () => ({ hash: mocks.hash, argon2id: 2 }));
import { POST as POSTManuell } from '../../../src/routes/api/benutzer/manuell/+server';

describe('Manuelle Benutzeranlage', () => {
  const valid = { vorname: ' Ada ', nachname: ' Test ', email: ' ADA@EXAMPLE.CH ', passwort: 'Startpasswort123!', rolle: 'mitglied' };
  const run = (data: unknown = valid, locals: object = { benutzer }) => POSTManuell({
    locals, request: new Request('http://localhost/api/benutzer/manuell', { method: 'POST', body: JSON.stringify(data) })
  } as never);

  beforeEach(() => {
    mocks.collection.mockReturnValue({ findOne: mocks.findOne, insertOne: mocks.insertOne });
    mocks.findOne.mockResolvedValue(null);
    mocks.insertOne.mockResolvedValue({ insertedId: new ObjectId(id) });
    mocks.hash.mockResolvedValue('start-hash');
  });

  it.each([401, 403])('verweigert Zugriff mit Status %i', async status => {
    mocks.permission.mockReturnValue(new Response(null, { status }));
    expect((await run(valid, status === 401 ? {} : { benutzer })).status).toBe(status);
    expect(mocks.permission).toHaveBeenCalledWith(status === 401 ? undefined : benutzer, 'benutzer:verwalten');
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it.each([null, [], 42, 'text'])('weist ungültige Eingabe ab: %j', async data => {
    expect((await run(data)).status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('weist fehlerhaftes JSON ab', async () => {
    expect((await POSTManuell({ locals: { benutzer }, request: new Request('http://localhost', { method: 'POST', body: '{' }) } as never)).status).toBe(400);
  });

  it.each([
    { vorname: '' }, { vorname: 42 }, { nachname: '' }, { nachname: 42 },
    { vorname: 'x'.repeat(101) }, { nachname: 'x'.repeat(101) },
    { email: 42 }, { email: 'ungueltig' }, { email: 'x'.repeat(250) + '@a.ch' },
    { passwort: 42 }, { passwort: 'x'.repeat(11) }, { passwort: 'x'.repeat(1025) },
    { rolle: 42 }, { rolle: 'superadmin' }
  ])('weist ungültiges Feld ab: %j', async patch => {
    expect((await run({ ...valid, ...patch })).status).toBe(400);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it.each(['admin', 'materialverantwortlich', 'leiter', 'mitglied'])('erstellt Benutzer mit Rolle %s im eigenen Verein', async rolle => {
    const r = await run({ ...valid, rolle, vereinId: 'fremd', aktiv: false, passwortwechselErforderlich: false });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ erfolg: true, id });
    expect(mocks.findOne).toHaveBeenCalledWith({ email: 'ada@example.ch' });
    expect(mocks.hash).toHaveBeenCalledWith(valid.passwort, { type: 2 });
    expect(mocks.insertOne).toHaveBeenCalledWith({
      vereinId: benutzer.vereinId, vorname: 'Ada', nachname: 'Test', email: 'ada@example.ch',
      rolle, passwortHash: 'start-hash', aktiv: true, passwortwechselErforderlich: true, erstelltAm: expect.any(Date)
    });
  });

  it('verhindert global doppelte E-Mail-Adressen', async () => {
    mocks.findOne.mockResolvedValue({ vereinId: 'fremd' });
    expect((await run()).status).toBe(409);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it('behandelt konkurrierende Anlage mit Duplicate Key', async () => {
    mocks.insertOne.mockRejectedValueOnce({ code: 11000 });
    expect((await run()).status).toBe(409);
  });

  it.each(['findOne', 'hash', 'insertOne'] as const)('behandelt Fehler in %s', async method => {
    mocks[method].mockRejectedValueOnce(new Error('DB'));
    expect((await run()).status).toBe(500);
  });

  it.each([null, 'Fehler', { code: 123 }])('behandelt sonstigen Fehler: %j', async error => {
    mocks.insertOne.mockRejectedValueOnce(error);
    expect((await run()).status).toBe(500);
  });
});

import { DELETE } from '../../../src/routes/api/benutzer/[id]/+server';
describe('Benutzerverwaltung – sichere Löschung und Randfälle (#38)',()=>{
 beforeEach(()=>{
  mocks.collection.mockReturnValue({findOne:mocks.findOne,updateOne:mocks.updateOne,countDocuments:mocks.countDocuments,deleteMany:mocks.deleteMany,deleteOne:mocks.deleteOne,find:mocks.find});
  mocks.findOne.mockResolvedValue(ziel);mocks.updateOne.mockResolvedValue({matchedCount:1});mocks.countDocuments.mockResolvedValue(1);
  mocks.deleteOne.mockResolvedValue({deletedCount:1});mocks.deleteMany.mockResolvedValue({deletedCount:1});
  mocks.listCollections.mockReturnValue({toArray:async()=>[]});
 });
 it.each([{body:null},{body:[]},{body:42},{body:{}},...['vorname','nachname'].flatMap(f=>[42,' ','x'.repeat(101)].map(v=>({body:{[f]:v}}))),... [42,'bad','x'.repeat(255)+'@a.ch'].map(email=>({body:{email}}))])('verwirft ungültige Änderung %j',async({body})=>{expect((await PATCH(eventBearbeiten(body))).status).toBe(400);expect(mocks.updateOne).not.toHaveBeenCalled();});
 it('verwirft ungültige ID',async()=>{expect((await PATCH(eventBearbeiten({aktiv:true},'bad'))).status).toBe(400);});
 it('verwirft defektes JSON',async()=>{const e=eventBearbeiten({}) as any;e.request=new Request('http://localhost',{method:'PATCH',body:'{'});expect((await PATCH(e)).status).toBe(400);});
 it('verhindert eigene Deaktivierung',async()=>{expect((await PATCH(eventBearbeiten({aktiv:false},adminId))).status).toBe(409);});
 it('widerruft Sessions bei Deaktivierung',async()=>{expect((await PATCH(eventBearbeiten({aktiv:false}))).status).toBe(200);expect(mocks.deleteMany).toHaveBeenCalledWith({benutzerId:id,vereinId:'verein-1'});});
 it('behält Sessions bei unveränderter Rolle',async()=>{expect((await PATCH(eventBearbeiten({rolle:'mitglied',aktiv:true}))).status).toBe(200);expect(mocks.deleteMany).not.toHaveBeenCalled();});
 it('erkennt zwischenzeitlich entfernten Benutzer',async()=>{mocks.updateOne.mockResolvedValue({matchedCount:0});expect((await PATCH(eventBearbeiten({aktiv:true}))).status).toBe(409);});
 it.each([null,'DB',{}, {code:123}])('meldet sonstige Änderungsfehler %j',async e=>{mocks.updateOne.mockRejectedValue(e);expect((await PATCH(eventBearbeiten({aktiv:true}))).status).toBe(500);});
 const del=(person=id)=>DELETE(eventBearbeiten({},person));
 it('verweigert fehlendes Recht',async()=>{mocks.permission.mockReturnValue(new Response(null,{status:403}));expect((await del()).status).toBe(403);});
 it.each(['bad',adminId])('verweigert ungültige oder eigene ID',async person=>{expect((await del(person)).status).toBe(person==='bad'?400:409);});
 it('meldet fehlenden Benutzer',async()=>{mocks.findOne.mockResolvedValue(null);expect((await del()).status).toBe(404);});
 it('schützt letzten aktiven Administrator',async()=>{mocks.findOne.mockResolvedValue({...ziel,rolle:'admin'});mocks.countDocuments.mockResolvedValue(0);expect((await del()).status).toBe(409);});
 function refs(docs:unknown[]){mocks.listCollections.mockReturnValue({toArray:async()=>['benutzer','sessions','einladungen','system.test','artikel'].map(name=>({name}))});mocks.find.mockReturnValue({async *[Symbol.asyncIterator](){yield* docs;}});}
 it.each([{ref:id},{ref:new ObjectId(id)},{ref:[{nested:id}]}])('schützt fachliche Referenz %j',async doc=>{refs([doc]);expect((await del()).status).toBe(409);expect(mocks.deleteOne).not.toHaveBeenCalled();});
 it('löscht nur referenzfreien Benutzer und dessen Sessions',async()=>{refs([{ref:[null,42,new Date(),new ObjectId(), 'fremd']}]);expect((await del()).status).toBe(200);expect(mocks.find).toHaveBeenCalledWith({vereinId:'verein-1'});expect(mocks.deleteOne).toHaveBeenCalledWith({_id:new ObjectId(id),vereinId:'verein-1'});expect(mocks.deleteMany).toHaveBeenCalledWith({vereinId:'verein-1',benutzerId:id});});
 it('verweigert zu umfangreiche Referenzprüfung',async()=>{refs(Array(10001).fill({}));expect((await del()).status).toBe(500);expect(mocks.deleteOne).not.toHaveBeenCalled();});
 it('erkennt konkurrierende Löschung',async()=>{mocks.deleteOne.mockResolvedValue({deletedCount:0});expect((await del()).status).toBe(409);});
 it.each([Error('DB'),'DB'])('meldet Löschfehler',async e=>{mocks.deleteOne.mockRejectedValue(e);expect((await del()).status).toBe(500);});
});
