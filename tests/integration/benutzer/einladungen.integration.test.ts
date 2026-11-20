import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createIndex, collection } = vi.hoisted(() => ({ createIndex: vi.fn(), collection: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection } }));
import { berechneAblaufdatum, erstelleEinladungstoken, erstelleEinladungsIndizes } from '../../../src/lib/server/einladungen';
import { createHash } from 'node:crypto';

beforeEach(() => { vi.clearAllMocks(); collection.mockReturnValue({ createIndex }); createIndex.mockResolvedValue('ok'); });

describe('Paket 32 – Einladungs-Hilfsfunktionen', () => {
  it('erzeugt einen zufälligen 64-stelligen Hex-Token und passenden SHA-256-Hash', () => {
    const a = erstelleEinladungstoken();
    const b = erstelleEinladungstoken();
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).toBe(createHash('sha256').update(a.token).digest('hex'));
    expect(b.token).not.toBe(a.token);
  });
  it('setzt Ablauf auf sieben Tage ab jetzt', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
      expect(berechneAblaufdatum().toISOString()).toBe('2026-11-26T12:00:00.000Z');
    } finally { vi.useRealTimers(); }
  });
  it('legt alle drei Datenbankindizes an', async () => {
    await erstelleEinladungsIndizes();
    expect(collection).toHaveBeenCalledWith('einladungen');
    expect(createIndex).toHaveBeenCalledTimes(3);
    expect(createIndex).toHaveBeenCalledWith({ tokenHash: 1 }, { unique: true });
    expect(createIndex).toHaveBeenCalledWith({ vereinId: 1, email: 1, status: 1 });
    expect(createIndex).toHaveBeenCalledWith({ ablaufdatum: 1 });
  });
  it('propagiert Fehler beim Indexaufbau', async () => {
    createIndex.mockRejectedValueOnce(new Error('DB offline'));
    await expect(erstelleEinladungsIndizes()).rejects.toThrow('DB offline');
  });
});
