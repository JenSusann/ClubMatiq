import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { command: m.command } }));
import { GET } from '../../../src/routes/api/test-db/+server';
beforeEach(() => vi.clearAllMocks());
describe('GET /api/test-db', () => {
  it('bestätigt funktionierende Verbindung', async () => { m.command.mockResolvedValue({ ok: 1 }); const r = await GET(); expect(r.status).toBe(200); expect(await r.json()).toEqual({ erfolg: true, nachricht: 'ClubMatiq ist mit MongoDB verbunden!' }); expect(m.command).toHaveBeenCalledWith({ ping: 1 }); });
  it('meldet fehlgeschlagene Verbindung', async () => { m.command.mockRejectedValue(new Error('offline')); const r = await GET(); expect(r.status).toBe(500); expect(await r.json()).toEqual({ erfolg: false, nachricht: 'MongoDB-Verbindung fehlgeschlagen.' }); });
});
