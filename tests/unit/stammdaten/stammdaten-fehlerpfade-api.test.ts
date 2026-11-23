import { beforeEach, describe, expect, it, vi } from 'vitest';
const { findOne, updateOne, deleteOne, countDocuments, collection, permission } = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn(), countDocuments: vi.fn(), collection: vi.fn(), permission: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: permission }));
import { PATCH as katPatch, DELETE as katDelete } from '../../../src/routes/api/kategorien/[id]/+server';
import { PATCH as lagPatch, DELETE as lagDelete } from '../../../src/routes/api/lagerorte/[id]/+server';
import { PATCH as groPatch, DELETE as groDelete } from '../../../src/routes/api/groessen/[id]/+server';
const id = '507f1f77bcf86cd799439011';
const locals = { benutzer: { vereinId: 'verein-a', rolle: 'admin' } };
const defs = [
  { name: 'Kategorie', patch: katPatch, del: katDelete, body: { name: '  Test  ' }, field: 'name' },
  { name: 'Lagerort', patch: lagPatch, del: lagDelete, body: { name: '  Test  ' }, field: 'name' },
  { name: 'Grösse', patch: groPatch, del: groDelete, body: { bezeichnung: '  Test  ', sortierung: 1 }, field: 'bezeichnung' }
];
const call = (fn: any, method: string, body?: unknown, itemId = id) => fn({
  params: { id: itemId }, locals,
  request: new Request('http://localhost/api/stammdaten/' + itemId, { method, headers: { 'content-type': 'application/json' }, body: method === 'PATCH' ? JSON.stringify(body) : undefined })
} as never);
describe.each(defs)('$name – zusätzliche Fehler- und Funktionspfade', d => {
  beforeEach(() => {
    vi.clearAllMocks(); collection.mockReturnValue({ findOne, updateOne, deleteOne, countDocuments });
    permission.mockReturnValue(null); findOne.mockResolvedValue({ _id: id }); updateOne.mockResolvedValue({ matchedCount: 1 });
    deleteOne.mockResolvedValue({ deletedCount: 1 }); countDocuments.mockResolvedValue(0);
  });
  it('verweigert PATCH ohne Berechtigung', async () => { permission.mockReturnValue(new Response('Nein', { status: 403 })); expect((await call(d.patch, 'PATCH', d.body)).status).toBe(403); });
  it('verweigert DELETE ohne Berechtigung', async () => { permission.mockReturnValue(new Response('Nein', { status: 403 })); expect((await call(d.del, 'DELETE')).status).toBe(403); });
  it('verwirft ungültige ID beim PATCH', async () => { expect((await call(d.patch, 'PATCH', d.body, 'falsch')).status).toBe(400); });
  it('verwirft ungültige ID beim DELETE', async () => { expect((await call(d.del, 'DELETE', undefined, 'falsch')).status).toBe(400); });
  it('verwirft fehlende Bezeichnung', async () => { expect((await call(d.patch, 'PATCH', { ...d.body, [d.field]: '   ' })).status).toBe(400); });
  it('meldet PATCH auf nicht mehr vorhandenen Datensatz', async () => {
    if (d.name !== 'Kategorie') findOne.mockResolvedValueOnce({ _id: id }).mockResolvedValueOnce(null);
    updateOne.mockResolvedValue({ matchedCount: 0 }); expect((await call(d.patch, 'PATCH', d.body)).status).toBe(404);
  });
  it('meldet DELETE auf nicht vorhandenen Datensatz', async () => {
    findOne.mockResolvedValue(null); expect((await call(d.del, 'DELETE')).status).toBe(404);
  });
  it('verhindert DELETE bei vorhandenen Referenzen', async () => {
    countDocuments.mockResolvedValue(2); expect((await call(d.del, 'DELETE')).status).toBe(409);
  });
  it('meldet fehlgeschlagenes DELETE', async () => {
    deleteOne.mockResolvedValue({ deletedCount: 0 }); expect((await call(d.del, 'DELETE')).status).toBe(404);
  });
  it('behandelt Datenbankfehler bei PATCH', async () => {
    findOne.mockRejectedValue(new Error('DB')); updateOne.mockRejectedValue(new Error('DB'));
    expect((await call(d.patch, 'PATCH', d.body)).status).toBe(500);
  });
  it('behandelt Datenbankfehler bei DELETE', async () => {
    findOne.mockRejectedValue(new Error('DB')); expect((await call(d.del, 'DELETE')).status).toBe(500);
  });
  it('löscht unbenutzte Stammdaten erfolgreich', async () => { expect((await call(d.del, 'DELETE')).status).toBe(200); });
  it('bearbeitet Stammdaten erfolgreich', async () => {
    if (d.name !== 'Kategorie') findOne.mockResolvedValueOnce({ _id: id }).mockResolvedValueOnce(null);
    expect((await call(d.patch, 'PATCH', d.body)).status).toBe(200);
  });
});
