import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const m = vi.hoisted(() => ({ collection: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
import { erstelleEinladungstoken, berechneAblaufdatum, erstelleEinladungsIndizes } from '../../../src/lib/server/einladungen';
beforeEach(() => vi.clearAllMocks());
describe('Einladungshilfsfunktionen', () => {
  it('erzeugt einen zufälligen 32-Byte-Token und passenden SHA-256-Hash', () => {
    const a = erstelleEinladungstoken(); const b = erstelleEinladungstoken();
    expect(a.token).toMatch(/^[a-f0-9]{64}$/); expect(a.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.tokenHash).toBe(createHash('sha256').update(a.token).digest('hex')); expect(a.token).not.toBe(b.token);
  });
  it('setzt das Ablaufdatum sieben Tage in die Zukunft', () => { const before = Date.now(); const expiry = berechneAblaufdatum().getTime(); const after = Date.now(); expect(expiry).toBeGreaterThanOrEqual(before + 7 * 86400000); expect(expiry).toBeLessThanOrEqual(after + 7 * 86400000); });
  it('erstellt alle drei Indizes', async () => { const createIndex = vi.fn().mockResolvedValue('ok'); m.collection.mockReturnValue({ createIndex }); await erstelleEinladungsIndizes(); expect(m.collection).toHaveBeenCalledWith('einladungen'); expect(createIndex).toHaveBeenCalledTimes(3); expect(createIndex).toHaveBeenNthCalledWith(1, { tokenHash: 1 }, { unique: true }); expect(createIndex).toHaveBeenNthCalledWith(2, { vereinId: 1, email: 1, status: 1 }); expect(createIndex).toHaveBeenNthCalledWith(3, { ablaufdatum: 1 }); });
  it('reicht Datenbankfehler weiter', async () => { m.collection.mockReturnValue({ createIndex: vi.fn().mockRejectedValue(new Error('db')) }); await expect(erstelleEinladungsIndizes()).rejects.toThrow('db'); });
});
