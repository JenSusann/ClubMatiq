import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn(), countDocuments: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));

import { PATCH as PATCH0, DELETE as DELETE0 } from '../../../src/routes/api/groessen/[id]/+server';
describe('groessen-id-coverage', () => {
const PATCH = PATCH0;
const DELETE = DELETE0;
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const ctx = (method: 'PATCH'|'DELETE', data: unknown, itemId=id) => ({
 params: { id: itemId }, locals: { benutzer },
 request: new Request('http://localhost/api/groessen/'+itemId, {method, ...(method==='PATCH' ? {headers:{'content-type':'application/json'},body:JSON.stringify(data)} : {})})
}) as never;
const patch=(data:unknown,itemId=id)=>PATCH(ctx('PATCH',data,itemId));
const del=(itemId=id)=>DELETE(ctx('DELETE',null,itemId));
const good={ bezeichnung:'M', sortierung:2 };
beforeEach(()=>{
 vi.clearAllMocks(); vi.spyOn(console,'error').mockImplementation(()=>{});
 m.collection.mockReturnValue(m);m.findOne.mockResolvedValue({_id:new ObjectId(id)});
 m.updateOne.mockResolvedValue({matchedCount:1});m.deleteOne.mockResolvedValue({deletedCount:1});m.countDocuments.mockResolvedValue(0);
});
describe('groessen: PATCH und DELETE Zusatzfälle',()=>{
 it('PATCH ungültige ID',async()=>{expect((await patch(good,'falsch')).status).toBe(400)});
 it('DELETE ungültige ID',async()=>{expect((await del('falsch')).status).toBe(400)});
 it.each([null,[],{}, {bezeichnung:''},{bezeichnung:'  '},{bezeichnung:123}])('PATCH ungültige Eingabe %j',async data=>{expect((await patch(data)).status).toBe(400)});
 it('PATCH Update ohne Treffer',async()=>{m.findOne.mockReset().mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null);m.updateOne.mockResolvedValueOnce({matchedCount:0});expect((await patch(good)).status).toBe(404)});
 it('PATCH Datenbankfehler',async()=>{m.findOne.mockReset().mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null);m.updateOne.mockRejectedValueOnce(new Error('DB'));expect((await patch(good)).status).toBe(500)});
 it('PATCH erfolgreich',async()=>{m.findOne.mockReset().mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null);expect((await patch({ bezeichnung:' XL ', sortierung:3 })).status).toBe(200);expect(m.updateOne).toHaveBeenCalledWith(expect.objectContaining({vereinId}),expect.objectContaining({$set:expect.objectContaining({bezeichnung:'XL'})}))});
 it('DELETE fehlender Datensatz',async()=>{m.findOne.mockResolvedValueOnce(null);expect((await del()).status).toBe(404)});
 it('DELETE verweigert bei Referenzen',async()=>{m.countDocuments.mockResolvedValueOnce(2);expect((await del()).status).toBe(409);expect(m.deleteOne).not.toHaveBeenCalled()});
 it('DELETE kein Treffer',async()=>{m.deleteOne.mockResolvedValueOnce({deletedCount:0});expect((await del()).status).toBe(404)});
 it('DELETE erfolgreich',async()=>{expect((await del()).status).toBe(200)});
 it('DELETE Referenzprüfung Fehler',async()=>{m.countDocuments.mockRejectedValueOnce(new Error('DB'));expect((await del()).status).toBe(500)});
 it('DELETE Datenbankfehler',async()=>{m.deleteOne.mockRejectedValueOnce(new Error('DB'));expect((await del()).status).toBe(500)});
});
describe('groessen: weitere PATCH-Zweige',()=>{
 it('PATCH fehlender Datensatz',async()=>{m.findOne.mockResolvedValueOnce(null);expect((await patch(good)).status).toBe(404)});
 it('PATCH doppelte Bezeichnung',async()=>{m.findOne.mockResolvedValueOnce({_id:id}).mockResolvedValueOnce({_id:'anderer'});expect((await patch(good)).status).toBe(409)});
 it('PATCH Datenbankfehler bei Prüfung',async()=>{m.findOne.mockRejectedValueOnce(new Error('DB'));expect((await patch(good)).status).toBe(500)});
});
describe('Grössensortierung',()=>{it.each([null,undefined,-1,1.5,'2'])('weist Sortierung %j zurück',async sortierung=>{expect((await patch({bezeichnung:'M',sortierung})).status).toBe(400)})});

});

import { PATCH as PATCH1, DELETE as DELETE1 } from '../../../src/routes/api/kategorien/[id]/+server';
describe('kategorien-id-coverage', () => {
const PATCH = PATCH1;
const DELETE = DELETE1;
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const ctx = (method: 'PATCH'|'DELETE', data: unknown, itemId=id) => ({
 params: { id: itemId }, locals: { benutzer },
 request: new Request('http://localhost/api/kategorien/'+itemId, {method, ...(method==='PATCH' ? {headers:{'content-type':'application/json'},body:JSON.stringify(data)} : {})})
}) as never;
const patch=(data:unknown,itemId=id)=>PATCH(ctx('PATCH',data,itemId));
const del=(itemId=id)=>DELETE(ctx('DELETE',null,itemId));
const good={ name:'Neu' };
beforeEach(()=>{
 vi.clearAllMocks(); vi.spyOn(console,'error').mockImplementation(()=>{});
 m.collection.mockReturnValue(m);m.findOne.mockResolvedValue({_id:new ObjectId(id)});
 m.updateOne.mockResolvedValue({matchedCount:1});m.deleteOne.mockResolvedValue({deletedCount:1});m.countDocuments.mockResolvedValue(0);
});
describe('kategorien: PATCH und DELETE Zusatzfälle',()=>{
 it('PATCH ungültige ID',async()=>{expect((await patch(good,'falsch')).status).toBe(400)});
 it('DELETE ungültige ID',async()=>{expect((await del('falsch')).status).toBe(400)});
 it.each([null,[],{}, {name:''},{name:'  '},{name:123}])('PATCH ungültige Eingabe %j',async data=>{expect((await patch(data)).status).toBe(400)});
 it('PATCH Update ohne Treffer',async()=>{m.updateOne.mockResolvedValueOnce({matchedCount:0});expect((await patch(good)).status).toBe(404)});
 it('PATCH Datenbankfehler',async()=>{m.updateOne.mockRejectedValueOnce(new Error('DB'));expect((await patch(good)).status).toBe(500)});
 it('PATCH erfolgreich',async()=>{expect((await patch({ name:' Neu ' })).status).toBe(200);expect(m.updateOne).toHaveBeenCalledWith(expect.objectContaining({vereinId}),expect.objectContaining({$set:expect.objectContaining({name:'Neu'})}))});
 it('DELETE fehlender Datensatz',async()=>{m.findOne.mockResolvedValueOnce(null);expect((await del()).status).toBe(404)});
 it('DELETE verweigert bei Referenzen',async()=>{m.countDocuments.mockResolvedValueOnce(2);expect((await del()).status).toBe(409);expect(m.deleteOne).not.toHaveBeenCalled()});
 it('DELETE kein Treffer',async()=>{m.deleteOne.mockResolvedValueOnce({deletedCount:0});expect((await del()).status).toBe(404)});
 it('DELETE erfolgreich',async()=>{expect((await del()).status).toBe(200)});
 it('DELETE Referenzprüfung Fehler',async()=>{m.countDocuments.mockRejectedValueOnce(new Error('DB'));expect((await del()).status).toBe(500)});
 it('DELETE Datenbankfehler',async()=>{m.deleteOne.mockRejectedValueOnce(new Error('DB'));expect((await del()).status).toBe(500)});
});

});

import { PATCH as PATCH2, DELETE as DELETE2 } from '../../../src/routes/api/lagerorte/[id]/+server';
describe('lagerorte-id-coverage', () => {
const PATCH = PATCH2;
const DELETE = DELETE2;
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const benutzer = { id: new ObjectId().toHexString(), vereinId, rolle: 'admin' };
const ctx = (method: 'PATCH'|'DELETE', data: unknown, itemId=id) => ({
 params: { id: itemId }, locals: { benutzer },
 request: new Request('http://localhost/api/lagerorte/'+itemId, {method, ...(method==='PATCH' ? {headers:{'content-type':'application/json'},body:JSON.stringify(data)} : {})})
}) as never;
const patch=(data:unknown,itemId=id)=>PATCH(ctx('PATCH',data,itemId));
const del=(itemId=id)=>DELETE(ctx('DELETE',null,itemId));
const good={ name:'Neu' };
beforeEach(()=>{
 vi.clearAllMocks(); vi.spyOn(console,'error').mockImplementation(()=>{});
 m.collection.mockReturnValue(m);m.findOne.mockResolvedValue({_id:new ObjectId(id)});
 m.updateOne.mockResolvedValue({matchedCount:1});m.deleteOne.mockResolvedValue({deletedCount:1});m.countDocuments.mockResolvedValue(0);
});
describe('lagerorte: PATCH und DELETE Zusatzfälle',()=>{
 it('PATCH ungültige ID',async()=>{expect((await patch(good,'falsch')).status).toBe(400)});
 it('DELETE ungültige ID',async()=>{expect((await del('falsch')).status).toBe(400)});
 it.each([null,[],{}, {name:''},{name:'  '},{name:123}])('PATCH ungültige Eingabe %j',async data=>{expect((await patch(data)).status).toBe(400)});
 it('PATCH Update ohne Treffer',async()=>{m.findOne.mockReset().mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null);m.updateOne.mockResolvedValueOnce({matchedCount:0});expect((await patch(good)).status).toBe(404)});
 it('PATCH Datenbankfehler',async()=>{m.findOne.mockReset().mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null);m.updateOne.mockRejectedValueOnce(new Error('DB'));expect((await patch(good)).status).toBe(500)});
 it('PATCH erfolgreich',async()=>{m.findOne.mockReset().mockResolvedValueOnce({_id:new ObjectId(id)}).mockResolvedValueOnce(null);expect((await patch({ name:' Neu ' })).status).toBe(200);expect(m.updateOne).toHaveBeenCalledWith(expect.objectContaining({vereinId}),expect.objectContaining({$set:expect.objectContaining({name:'Neu'})}))});
 it('DELETE fehlender Datensatz',async()=>{m.findOne.mockResolvedValueOnce(null);expect((await del()).status).toBe(404)});
 it('DELETE verweigert bei Referenzen',async()=>{m.countDocuments.mockResolvedValueOnce(2);expect((await del()).status).toBe(409);expect(m.deleteOne).not.toHaveBeenCalled()});
 it('DELETE kein Treffer',async()=>{m.deleteOne.mockResolvedValueOnce({deletedCount:0});expect((await del()).status).toBe(404)});
 it('DELETE erfolgreich',async()=>{expect((await del()).status).toBe(200)});
 it('DELETE Referenzprüfung Fehler',async()=>{m.countDocuments.mockRejectedValueOnce(new Error('DB'));expect((await del()).status).toBe(500)});
 it('DELETE Datenbankfehler',async()=>{m.deleteOne.mockRejectedValueOnce(new Error('DB'));expect((await del()).status).toBe(500)});
});
describe('lagerorte: weitere PATCH-Zweige',()=>{
 it('PATCH fehlender Datensatz',async()=>{m.findOne.mockResolvedValueOnce(null);expect((await patch(good)).status).toBe(404)});
 it('PATCH doppelte Bezeichnung',async()=>{m.findOne.mockResolvedValueOnce({_id:id}).mockResolvedValueOnce({_id:'anderer'});expect((await patch(good)).status).toBe(409)});
 it('PATCH Datenbankfehler bei Prüfung',async()=>{m.findOne.mockRejectedValueOnce(new Error('DB'));expect((await patch(good)).status).toBe(500)});
});

});

import * as route0 from '../../../src/routes/api/groessen/[id]/+server';
import * as route1 from '../../../src/routes/api/lagerorte/[id]/+server';
describe('Stammdaten Detail-API', () => {
const mocks = m;
beforeEach(() => { m.collection.mockReturnValue(m); });
const id = new ObjectId().toHexString();
const vereinId = new ObjectId().toHexString();
const locals = (rolle = 'admin') => ({
  benutzer: { id: new ObjectId().toHexString(), vereinId, rolle }
});
const event = (method: string, body?: unknown, rolle = 'admin', targetId = id) => ({
  params: { id: targetId },
  locals: locals(rolle),
  request: new Request('http://localhost/api/test', {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  })
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockResolvedValue(null);
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.countDocuments.mockResolvedValue(0);
});


// Ursprüngliche Datei: paket18-groessen-id.integration.test.ts
describe('Integration: Grössen ändern und löschen', () => {
  it('verbietet Änderungen ohne Stammdatenrecht', async () => {
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: 2 }, 'mitglied') as never)).status).toBe(403);
  });
  it('weist ungültige IDs zurück', async () => {
    expect((await route0.DELETE(event('DELETE', undefined, 'admin', 'ungueltig') as never)).status).toBe(400);
  });
  it('validiert Sortierung', async () => {
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: -1 }) as never)).status).toBe(400);
  });
  it('meldet fremde oder fehlende Grösse', async () => {
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: 2 }) as never)).status).toBe(404);
  });
  it('verhindert doppelte Grössen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce({ _id: new ObjectId(), vereinId });
    expect((await route0.PATCH(event('PATCH', { bezeichnung: 'M', sortierung: 2 }) as never)).status).toBe(409);
  });
  it('ändert die Grösse erfolgreich', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce(null);
    const response = await route0.PATCH(event('PATCH', { bezeichnung: '  M  ', sortierung: 2 }) as never);
    expect(response.status).toBe(200);
    expect(mocks.updateOne).toHaveBeenCalled();
  });
  it('verhindert Löschen referenzierter Grössen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    mocks.countDocuments.mockResolvedValueOnce(2);
    expect((await route0.DELETE(event('DELETE') as never)).status).toBe(409);
  });
  it('löscht unbenutzte Grösse', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    expect((await route0.DELETE(event('DELETE') as never)).status).toBe(200);
    expect(mocks.deleteOne).toHaveBeenCalled();
  });
});



// Ursprüngliche Datei: paket18-lagerorte-id.integration.test.ts
describe('Integration: Lagerorte ändern und löschen', () => {
  it('verweigert Mitgliedern die Bearbeitung', async () => {
    expect((await route1.PATCH(event('PATCH', { name: 'Halle' }, 'mitglied') as never)).status).toBe(403);
  });
  it('weist ungültige ID zurück', async () => {
    expect((await route1.DELETE(event('DELETE', undefined, 'admin', 'falsch') as never)).status).toBe(400);
  });
  it('verlangt einen Namen', async () => {
    expect((await route1.PATCH(event('PATCH', { name: ' ' }) as never)).status).toBe(400);
  });
  it('meldet fehlenden Lagerort', async () => {
    expect((await route1.DELETE(event('DELETE') as never)).status).toBe(404);
  });
  it('verhindert doppelte Lagerortnamen', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce({ _id: new ObjectId(), vereinId });
    expect((await route1.PATCH(event('PATCH', { name: 'Halle' }) as never)).status).toBe(409);
  });
  it('ändert Lagerort erfolgreich', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId }).mockResolvedValueOnce(null);
    const response = await route1.PATCH(event('PATCH', { name: '  Halle  ' }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe('Halle');
  });
  it('verhindert Löschen zugeordneter Artikel', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    mocks.countDocuments.mockResolvedValueOnce(3);
    expect((await route1.DELETE(event('DELETE') as never)).status).toBe(409);
  });
  it('löscht leeren Lagerort', async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: new ObjectId(id), vereinId });
    expect((await route1.DELETE(event('DELETE') as never)).status).toBe(200);
    expect(mocks.deleteOne).toHaveBeenCalled();
  });
});


});
