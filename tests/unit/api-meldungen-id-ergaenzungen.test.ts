import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateOne } = vi.hoisted(() => ({ updateOne: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({ updateOne })) }
}));
import { PATCH } from '../../src/routes/api/meldungen/[id]/+server';

const id = '507f1f77bcf86cd799439011';
const benutzer = { id, vereinId: 'verein-a', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const run = (body: unknown, user: unknown = benutzer, meldungId = id) => PATCH({
  params: { id: meldungId },
  locals: { benutzer: user },
  request: new Request('http://localhost/api/meldungen/' + meldungId, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
} as never);

describe('Schadensmeldung bearbeiten – Funktions- und Fehlerpfade', () => {
  beforeEach(() => vi.clearAllMocks());
  it('weist nicht angemeldete Personen zurück', async () => {
    expect((await run({ status: 'offen', bearbeitungsnotiz: '' }, null)).status).toBe(401);
  });
  it('weist unberechtigte Rollen zurück', async () => {
    expect((await run({ status: 'offen', bearbeitungsnotiz: '' }, { ...benutzer, rolle: 'mitglied' })).status).toBe(403);
  });
  it('weist ungültige IDs zurück', async () => {
    expect((await run({ status: 'offen', bearbeitungsnotiz: '' }, benutzer, 'ungueltig')).status).toBe(400);
  });
  it.each(['offen', 'in_bearbeitung', 'erledigt'])('speichert den Status %s', async (status) => {
    updateOne.mockResolvedValue({ matchedCount: 1 });
    const res = await run({ status, bearbeitungsnotiz: '  Geprüft  ' });
    expect(res.status).toBe(200);
    expect(updateOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-a' }), expect.objectContaining({
      $set: expect.objectContaining({ status, bearbeitungsnotiz: 'Geprüft', bearbeitetVonName: 'Test Person' })
    }));
  });
  it('weist ungültige Statuswerte zurück', async () => {
    expect((await run({ status: 'gelöscht', bearbeitungsnotiz: '' })).status).toBe(400);
  });
  it('weist zu lange Notizen zurück', async () => {
    expect((await run({ status: 'offen', bearbeitungsnotiz: 'a'.repeat(2001) })).status).toBe(400);
  });
  it('meldet nicht gefundene Datensätze', async () => {
    updateOne.mockResolvedValue({ matchedCount: 0 });
    expect((await run({ status: 'offen', bearbeitungsnotiz: '' })).status).toBe(404);
  });
  it('behandelt Datenbankfehler', async () => {
    updateOne.mockRejectedValue(new Error('Datenbank nicht erreichbar'));
    expect((await run({ status: 'offen', bearbeitungsnotiz: '' })).status).toBe(500);
  });
});
