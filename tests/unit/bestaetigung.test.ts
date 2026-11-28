import { describe, it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ getContext: vi.fn(), setContext: vi.fn() }));
vi.mock('svelte', () => ({ getContext: m.getContext, setContext: m.setContext }));
import { setzeBestaetigung, verwendeBestaetigung } from '../../src/lib/bestaetigung';

describe('Bestätigungsdialog – Kontext', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([true, false])('reicht die Bestätigungsentscheidung %s unverändert weiter', async entscheidung => {
    const bestaetigen = vi.fn().mockResolvedValue(entscheidung);
    setzeBestaetigung(bestaetigen);
    expect(m.setContext).toHaveBeenCalledWith(expect.any(Symbol), bestaetigen);
    m.getContext.mockReturnValue(bestaetigen);
    const fn = verwendeBestaetigung();
    expect(m.getContext).toHaveBeenCalledWith(m.setContext.mock.calls[0][0]);
    expect(await fn('Artikel löschen?', 'Löschen', true)).toBe(entscheidung);
    expect(bestaetigen).toHaveBeenCalledWith('Artikel löschen?', 'Löschen', true);
  });
});
