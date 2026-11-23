import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ collections: {} as Record<string, any>, permission: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => mocks.collections[name] } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { PATCH as patch0, DELETE as delete0 } from '../../../src/routes/api/kategorien/[id]/+server';
import { PATCH as patch1, DELETE as delete1 } from '../../../src/routes/api/lagerorte/[id]/+server';
import { PATCH as patch2, DELETE as delete2 } from '../../../src/routes/api/groessen/[id]/+server';

{
const ID = '507f1f77bcf86cd799439011';
const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const denied = new Response(JSON.stringify({ fehler: 'Verboten' }), { status: 403 });
const collection = { findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() };
const artikel = { countDocuments: vi.fn() };
function event(body: unknown = { name: ' Neu ' }, id = ID) {
 return { params: { id }, locals: { benutzer }, request: { json: vi.fn().mockResolvedValue(body) } } as any;
}
async function call(method: 'PATCH'|'DELETE', body: unknown = { name: ' Neu ' }, id = ID) {
 return (method === 'PATCH' ? patch0(event(body,id)) : delete0(event(body,id))) as Promise<Response>;
}
describe('Kategorien – Detail-API', () => {
beforeEach(() => {
 vi.clearAllMocks(); mocks.permission.mockReturnValue(null);
 mocks.collections = { kategorien: collection, artikel: artikel };
 collection.findOne.mockResolvedValue({ _id: ID });
 collection.updateOne.mockResolvedValue({ matchedCount: 1 });
 collection.deleteOne.mockResolvedValue({ deletedCount: 1 });
 artikel.countDocuments.mockResolvedValue(0);
 vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('kategorien/[id] PATCH', () => {
 it('prüft Stammdaten-Berechtigung', async () => { await call('PATCH'); expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten'); });
 it('blockiert unberechtigte Zugriffe ohne Datenbankabfrage', async () => { mocks.permission.mockReturnValue(denied); expect((await call('PATCH')).status).toBe(403); expect(collection.updateOne).not.toHaveBeenCalled(); });
 it('verweigert ungültige IDs', async () => { expect((await call('PATCH', { name: ' Neu ' }, 'ungueltig')).status).toBe(400); });
 it.each([null, 12, {}, { name: ' ' }, { name: 123 }])('verweigert ungültige Daten %s', async (body) => { expect((await call('PATCH',body)).status).toBe(400); });
 
 it('bearbeitet nur im eigenen Verein und trimmt den Namen', async () => {
  const r=await call('PATCH'); expect(r.status).toBe(200);
  expect(collection.updateOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-a' }), { $set: { name: 'Neu' } });
 });
 
 it('liefert 404 bei nicht passender Update-ID', async () => { collection.updateOne.mockResolvedValue({ matchedCount: 0 }); expect((await call('PATCH')).status).toBe(404); });
 it('liefert 500 bei Datenbankfehler', async () => { collection.updateOne.mockRejectedValueOnce(new Error('db')); expect((await call('PATCH')).status).toBe(500); });
});
describe('kategorien/[id] DELETE', () => {
 it('prüft Berechtigung', async () => { await call('DELETE'); expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten'); });
 it('blockiert unberechtigte Zugriffe', async () => { mocks.permission.mockReturnValue(denied); expect((await call('DELETE')).status).toBe(403); });
 it('verweigert ungültige IDs', async () => { expect((await call('DELETE',null,'x')).status).toBe(400); });
 it('liefert 404, wenn Datensatz fehlt', async () => { collection.findOne.mockResolvedValueOnce(null); expect((await call('DELETE')).status).toBe(404); });
 it('verhindert Löschen referenzierter Datensätze', async () => { artikel.countDocuments.mockResolvedValueOnce(3); const r=await call('DELETE'); expect(r.status).toBe(409); expect(collection.deleteOne).not.toHaveBeenCalled(); });
 it('löscht unbenutzte Datensätze vereinsgebunden', async () => { const r=await call('DELETE'); expect(r.status).toBe(200); expect(collection.deleteOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId:'verein-a' })); expect(artikel.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ vereinId:'verein-a' })); });
 it('liefert 404, wenn der Datensatz zwischenzeitlich gelöscht wurde', async () => { collection.deleteOne.mockResolvedValueOnce({ deletedCount:0 }); expect((await call('DELETE')).status).toBe(404); });
 it('liefert 500 bei Datenbankfehler', async () => { artikel.countDocuments.mockRejectedValueOnce(new Error('db')); expect((await call('DELETE')).status).toBe(500); });
});

});
}

{
const ID = '507f1f77bcf86cd799439011';
const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const denied = new Response(JSON.stringify({ fehler: 'Verboten' }), { status: 403 });
const collection = { findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() };
const artikel = { countDocuments: vi.fn() };
function event(body: unknown = { name: ' Neu ' }, id = ID) {
 return { params: { id }, locals: { benutzer }, request: { json: vi.fn().mockResolvedValue(body) } } as any;
}
async function call(method: 'PATCH'|'DELETE', body: unknown = { name: ' Neu ' }, id = ID) {
 return (method === 'PATCH' ? patch1(event(body,id)) : delete1(event(body,id))) as Promise<Response>;
}
describe('Lagerorte – Detail-API', () => {
beforeEach(() => {
 vi.clearAllMocks(); mocks.permission.mockReturnValue(null);
 mocks.collections = { lagerorte: collection, artikel: artikel };
 collection.findOne.mockImplementation(async (filter: Record<string, unknown>) => ('name' in filter || 'bezeichnung' in filter) ? null : { _id: ID });
 collection.updateOne.mockResolvedValue({ matchedCount: 1 });
 collection.deleteOne.mockResolvedValue({ deletedCount: 1 });
 artikel.countDocuments.mockResolvedValue(0);
 vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('lagerorte/[id] PATCH', () => {
 it('prüft Stammdaten-Berechtigung', async () => { await call('PATCH'); expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten'); });
 it('blockiert unberechtigte Zugriffe ohne Datenbankabfrage', async () => { mocks.permission.mockReturnValue(denied); expect((await call('PATCH')).status).toBe(403); expect(collection.updateOne).not.toHaveBeenCalled(); });
 it('verweigert ungültige IDs', async () => { expect((await call('PATCH', { name: ' Neu ' }, 'ungueltig')).status).toBe(400); });
 it.each([null, 12, {}, { name: ' ' }, { name: 123 }])('verweigert ungültige Daten %s', async (body) => { expect((await call('PATCH',body)).status).toBe(400); });
 
 it('bearbeitet nur im eigenen Verein und trimmt den Namen', async () => {
  const r=await call('PATCH'); expect(r.status).toBe(200);
  expect(collection.updateOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-a' }), { $set: { name: 'Neu' } });
 });
 it('liefert 404 bei unbekanntem Lagerort/Grösse', async () => { collection.findOne.mockResolvedValueOnce(null); expect((await call('PATCH')).status).toBe(404); });
 it('verweigert Dubletten', async () => { collection.findOne.mockResolvedValueOnce({ _id: ID }).mockResolvedValueOnce({ _id: 'andere' }); expect((await call('PATCH')).status).toBe(409); });
 it('maskiert Regex-Sonderzeichen', async () => { await call('PATCH', { name: ' A.* ' }); expect(collection.findOne.mock.calls[1][0].name.$regex).toContain('\\.\\*'); });
 it('liefert 404 bei nicht passender Update-ID', async () => { collection.updateOne.mockResolvedValue({ matchedCount: 0 }); expect((await call('PATCH')).status).toBe(404); });
 it('liefert 500 bei Datenbankfehler', async () => { collection.findOne.mockRejectedValueOnce(new Error('db')); expect((await call('PATCH')).status).toBe(500); });
});
describe('lagerorte/[id] DELETE', () => {
 it('prüft Berechtigung', async () => { await call('DELETE'); expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten'); });
 it('blockiert unberechtigte Zugriffe', async () => { mocks.permission.mockReturnValue(denied); expect((await call('DELETE')).status).toBe(403); });
 it('verweigert ungültige IDs', async () => { expect((await call('DELETE',null,'x')).status).toBe(400); });
 it('liefert 404, wenn Datensatz fehlt', async () => { collection.findOne.mockResolvedValueOnce(null); expect((await call('DELETE')).status).toBe(404); });
 it('verhindert Löschen referenzierter Datensätze', async () => { artikel.countDocuments.mockResolvedValueOnce(3); const r=await call('DELETE'); expect(r.status).toBe(409); expect(collection.deleteOne).not.toHaveBeenCalled(); });
 it('löscht unbenutzte Datensätze vereinsgebunden', async () => { const r=await call('DELETE'); expect(r.status).toBe(200); expect(collection.deleteOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId:'verein-a' })); expect(artikel.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ vereinId:'verein-a' })); });
 it('liefert 404, wenn der Datensatz zwischenzeitlich gelöscht wurde', async () => { collection.deleteOne.mockResolvedValueOnce({ deletedCount:0 }); expect((await call('DELETE')).status).toBe(404); });
 it('liefert 500 bei Datenbankfehler', async () => { artikel.countDocuments.mockRejectedValueOnce(new Error('db')); expect((await call('DELETE')).status).toBe(500); });
});

});
}

{
const ID = '507f1f77bcf86cd799439011';
const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
const denied = new Response(JSON.stringify({ fehler: 'Verboten' }), { status: 403 });
const collection = { findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() };
const artikel = { countDocuments: vi.fn() };
function event(body: unknown = { bezeichnung: ' M ', sortierung: 2 }, id = ID) {
 return { params: { id }, locals: { benutzer }, request: { json: vi.fn().mockResolvedValue(body) } } as any;
}
async function call(method: 'PATCH'|'DELETE', body: unknown = { bezeichnung: ' M ', sortierung: 2 }, id = ID) {
 return (method === 'PATCH' ? patch2(event(body,id)) : delete2(event(body,id))) as Promise<Response>;
}
describe('Grössen – Detail-API', () => {
beforeEach(() => {
 vi.clearAllMocks(); mocks.permission.mockReturnValue(null);
 mocks.collections = { groessen: collection, artikelvarianten: artikel };
 collection.findOne.mockImplementation(async (filter: Record<string, unknown>) => ('name' in filter || 'bezeichnung' in filter) ? null : { _id: ID });
 collection.updateOne.mockResolvedValue({ matchedCount: 1 });
 collection.deleteOne.mockResolvedValue({ deletedCount: 1 });
 artikel.countDocuments.mockResolvedValue(0);
 vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('groessen/[id] PATCH', () => {
 it('prüft Stammdaten-Berechtigung', async () => { await call('PATCH'); expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten'); });
 it('blockiert unberechtigte Zugriffe ohne Datenbankabfrage', async () => { mocks.permission.mockReturnValue(denied); expect((await call('PATCH')).status).toBe(403); expect(collection.updateOne).not.toHaveBeenCalled(); });
 it('verweigert ungültige IDs', async () => { expect((await call('PATCH', { bezeichnung: ' M ', sortierung: 2 }, 'ungueltig')).status).toBe(400); });
 it.each([null, 12, {}, { bezeichnung: ' ' }, { bezeichnung: 123 }])('verweigert ungültige Daten %s', async (body) => { expect((await call('PATCH',body)).status).toBe(400); });
 it.each([-1, 1.5, '1', null, undefined])('verweigert ungültige Sortierung %s', async (sortierung) => { expect((await call('PATCH',{ bezeichnung: 'M', sortierung })).status).toBe(400); });
 it('bearbeitet nur im eigenen Verein und trimmt den Namen', async () => {
  const r=await call('PATCH'); expect(r.status).toBe(200);
  expect(collection.updateOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-a' }), { $set: { bezeichnung: 'M', sortierung: 2 } });
 });
 it('liefert 404 bei unbekanntem Lagerort/Grösse', async () => { collection.findOne.mockResolvedValueOnce(null); expect((await call('PATCH')).status).toBe(404); });
 it('verweigert Dubletten', async () => { collection.findOne.mockResolvedValueOnce({ _id: ID }).mockResolvedValueOnce({ _id: 'andere' }); expect((await call('PATCH')).status).toBe(409); });
 it('maskiert Regex-Sonderzeichen', async () => { await call('PATCH', { bezeichnung: ' M.* ', sortierung: 2 }); expect(collection.findOne.mock.calls[1][0].bezeichnung.$regex).toContain('\\.\\*'); });
 it('liefert 404 bei nicht passender Update-ID', async () => { collection.updateOne.mockResolvedValue({ matchedCount: 0 }); expect((await call('PATCH')).status).toBe(404); });
 it('liefert 500 bei Datenbankfehler', async () => { collection.findOne.mockRejectedValueOnce(new Error('db')); expect((await call('PATCH')).status).toBe(500); });
});
describe('groessen/[id] DELETE', () => {
 it('prüft Berechtigung', async () => { await call('DELETE'); expect(mocks.permission).toHaveBeenCalledWith(benutzer,'stammdaten:verwalten'); });
 it('blockiert unberechtigte Zugriffe', async () => { mocks.permission.mockReturnValue(denied); expect((await call('DELETE')).status).toBe(403); });
 it('verweigert ungültige IDs', async () => { expect((await call('DELETE',null,'x')).status).toBe(400); });
 it('liefert 404, wenn Datensatz fehlt', async () => { collection.findOne.mockResolvedValueOnce(null); expect((await call('DELETE')).status).toBe(404); });
 it('verhindert Löschen referenzierter Datensätze', async () => { artikel.countDocuments.mockResolvedValueOnce(3); const r=await call('DELETE'); expect(r.status).toBe(409); expect(collection.deleteOne).not.toHaveBeenCalled(); });
 it('löscht unbenutzte Datensätze vereinsgebunden', async () => { const r=await call('DELETE'); expect(r.status).toBe(200); expect(collection.deleteOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId:'verein-a' })); expect(artikel.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ vereinId:'verein-a' })); });
 it('liefert 404, wenn der Datensatz zwischenzeitlich gelöscht wurde', async () => { collection.deleteOne.mockResolvedValueOnce({ deletedCount:0 }); expect((await call('DELETE')).status).toBe(404); });
 it('liefert 500 bei Datenbankfehler', async () => { artikel.countDocuments.mockRejectedValueOnce(new Error('db')); expect((await call('DELETE')).status).toBe(500); });
});

});
}