import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ collections: {} as Record<string, any>, permission: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => mocks.collections[name] } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET, POST, PATCH, DELETE } from '../../../src/routes/api/lieferanten/+server';
const ID = '507f1f77bcf86cd799439011';
const benutzer = { vereinId: 'verein-a' };
const lieferanten = { find: vi.fn(), findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() };
const artikel = { findOne: vi.fn() };
const sammel = { findOne: vi.fn() };
const toArray = vi.fn();
const sort = vi.fn(() => ({ toArray }));
const daten = { name: ' Muster AG ', kontaktperson: ' Test ', email: ' info@test.ch ', telefon: ' 123 ', bemerkung: ' Notiz ' };
function event(body: unknown = daten) { return { locals: { benutzer }, request: { json: vi.fn().mockResolvedValue(body) } } as any; }
function invoke(method: 'GET'|'POST'|'PATCH'|'DELETE', body: unknown = daten): Promise<Response> {
 return ({ GET, POST, PATCH, DELETE }[method] as any)(event(body));
}
beforeEach(() => {
 vi.clearAllMocks(); mocks.permission.mockReturnValue(null);
 mocks.collections = { lieferanten, artikel, vereinskleider_sammelbestellungen: sammel };
 lieferanten.find.mockReturnValue({ sort }); toArray.mockResolvedValue([]);
 lieferanten.findOne.mockResolvedValue(null); lieferanten.insertOne.mockResolvedValue({ insertedId: { toString: () => ID } });
 lieferanten.updateOne.mockResolvedValue({ matchedCount: 1 }); lieferanten.deleteOne.mockResolvedValue({ deletedCount: 1 });
 artikel.findOne.mockResolvedValue(null); sammel.findOne.mockResolvedValue(null);
 vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('Lieferanten Berechtigungen', () => {
 it.each(['GET','POST','PATCH','DELETE'] as const)('%s benötigt Stammdatenrecht', async (method) => {
  mocks.permission.mockReturnValue(new Response('verboten',{status:403}));
  expect((await invoke(method)).status).toBe(403);
  expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten');
 });
});
describe('GET Lieferanten', () => {
 it('liest nur den eigenen Verein und sortiert', async () => {
  toArray.mockResolvedValue([{ _id: { toString: () => ID }, name:'Muster AG' }]);
  const r=await invoke('GET'); expect(r.status).toBe(200);
  expect(await r.json()).toEqual([{_id:ID,name:'Muster AG'}]);
  expect(lieferanten.find).toHaveBeenCalledWith({ vereinId:'verein-a' }); expect(sort).toHaveBeenCalledWith({ name:1 });
 });
 it('behandelt Datenbankfehler', async () => { toArray.mockRejectedValueOnce(new Error('db')); expect((await invoke('GET')).status).toBe(500); });
});
describe('POST Lieferanten', () => {
 it.each([null, 4, [], 'text'])('verweigert Eingabestruktur %s', async (body) => { expect((await invoke('POST',body)).status).toBe(400); });
 it.each(['name','kontaktperson','email','telefon','bemerkung'] as const)('verweigert nichttextuelles Feld %s', async (field) => {
  expect((await invoke('POST',{...daten,[field]:123})).status).toBe(400);
 });
 it.each([{name:''},{name:'x'.repeat(151)},{kontaktperson:'x'.repeat(151)},{email:'x'.repeat(255)},{telefon:'x'.repeat(61)},{bemerkung:'x'.repeat(2001)},{email:'ungültig'}])('verweigert ungültige Eingaben %s', async (values) => {
  expect((await invoke('POST',{...daten,...values})).status).toBe(400);
 });
 it('trimmt Felder, maskiert Regex und speichert vereinsgebunden', async () => {
  const r=await invoke('POST',{...daten,name:' Muster.* '}); expect(r.status).toBe(201);
  expect(lieferanten.findOne.mock.calls[0][0].name.$regex).toContain('\\.\\*');
  expect(lieferanten.insertOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:'verein-a',name:'Muster.*',email:'info@test.ch',erstelltAm:expect.any(Date)}));
 });
 it('verhindert Dubletten', async () => { lieferanten.findOne.mockResolvedValueOnce({name:'Muster AG'}); expect((await invoke('POST')).status).toBe(409); });
 it('behandelt Datenbankfehler', async () => { lieferanten.insertOne.mockRejectedValueOnce(new Error('db')); expect((await invoke('POST')).status).toBe(500); });
});
describe('PATCH Lieferanten', () => {
 it.each([null,[],4])('verweigert Eingabestruktur %s',async body => { expect((await invoke('PATCH',body)).status).toBe(400); });
 it.each(['falsch',null,undefined,42])('verweigert ID %s',async id => { expect((await invoke('PATCH',{...daten,id})).status).toBe(400); });
 it('verweigert ungültige Felder',async () => { expect((await invoke('PATCH',{...daten,id:ID,email:'falsch'})).status).toBe(400); });
 it('aktualisiert den Lieferanten vereinsgebunden',async () => {
  expect((await invoke('PATCH',{...daten,id:ID})).status).toBe(200);
  expect(lieferanten.updateOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:'verein-a'}),{$set:expect.objectContaining({name:'Muster AG',aktualisiertAm:expect.any(Date)})});
 });
 it('meldet fehlenden Lieferanten',async () => { lieferanten.updateOne.mockResolvedValueOnce({matchedCount:0}); expect((await invoke('PATCH',{...daten,id:ID})).status).toBe(404); });
 it('behandelt Datenbankfehler',async () => { lieferanten.updateOne.mockRejectedValueOnce(new Error('db')); expect((await invoke('PATCH',{...daten,id:ID})).status).toBe(500); });
});
describe('DELETE Lieferanten', () => {
 it.each([null,[],3])('verweigert Eingabestruktur %s',async body => { expect((await invoke('DELETE',body)).status).toBe(400); });
 it.each(['x',null,undefined,5])('verweigert ID %s',async id => { expect((await invoke('DELETE',{id})).status).toBe(400); });
 it('verweigert Löschen bei Artikelreferenz',async () => { artikel.findOne.mockResolvedValueOnce({_id:ID}); expect((await invoke('DELETE',{id:ID})).status).toBe(409); expect(lieferanten.deleteOne).not.toHaveBeenCalled(); });
 it('verweigert Löschen bei Sammelbestellungsreferenz',async () => { sammel.findOne.mockResolvedValueOnce({_id:ID}); expect((await invoke('DELETE',{id:ID})).status).toBe(409); });
 it('löscht unbenutzten Lieferanten im eigenen Verein',async () => {
  expect((await invoke('DELETE',{id:ID})).status).toBe(200);
  expect(lieferanten.deleteOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:'verein-a'}));
  expect(artikel.findOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:'verein-a'}));
 });
 it('meldet fehlenden Lieferanten',async () => { lieferanten.deleteOne.mockResolvedValueOnce({deletedCount:0}); expect((await invoke('DELETE',{id:ID})).status).toBe(404); });
 it('behandelt Datenbankfehler',async () => { artikel.findOne.mockRejectedValueOnce(new Error('db')); expect((await invoke('DELETE',{id:ID})).status).toBe(500); });
});
