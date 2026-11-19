import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { versendeEinladung } from '../../src/lib/server/email';
const daten = { email: 'ada@example.ch', vorname: 'Ada & <Test> "Hallo" \'', verein: 'TV <Weiningen> & Co.', link: 'https://clubmatiq.test/einladung?token=a&b="x"', ablaufdatum: new Date('2030-01-01') };
const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY; const originalFrom = process.env.RESEND_FROM_EMAIL;
beforeEach(() => { process.env.RESEND_API_KEY = 'test-key'; process.env.RESEND_FROM_EMAIL = 'noreply@example.ch'; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey; if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = originalFrom; vi.restoreAllMocks(); });
describe('Resend-Einladungsmail', () => {
  it('fordert API-Key und Absender', async () => { delete process.env.RESEND_API_KEY; await expect(versendeEinladung(daten)).rejects.toThrow('fehlt'); process.env.RESEND_API_KEY = 'test-key'; delete process.env.RESEND_FROM_EMAIL; await expect(versendeEinladung(daten)).rejects.toThrow('fehlt'); });
  it('versendet Text und korrekt HTML-escaped', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-123' }) }); globalThis.fetch = fetchMock as any;
    expect(await versendeEinladung(daten)).toEqual({ id: 'mail-123' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' } }));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.to).toEqual(['ada@example.ch']); expect(payload.from).toBe('noreply@example.ch');
    expect(payload.html).toContain('Ada &amp; &lt;Test&gt; &quot;Hallo&quot; &#39;'); expect(payload.html).toContain('TV &lt;Weiningen&gt; &amp; Co.');
    expect(payload.html).toContain('token=a&amp;b=&quot;x&quot;'); expect(payload.text).toContain(daten.link);
  });
  it('meldet fehlgeschlagenen HTTP-Status', async () => { globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' }) as any; await expect(versendeEinladung(daten)).rejects.toThrow('fehlgeschlagen'); expect(console.error).toHaveBeenCalledWith('Resend API Fehler:', 429, 'rate limited'); });
  it.each([null, {}, { id: 123 }, { id: null }, 'invalid'])('weist fehlende Versand-ID zurück %#', async (result) => { globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => result }) as any; await expect(versendeEinladung(daten)).rejects.toThrow('Versand-ID'); });
  it('reicht Netzwerkfehler weiter', async () => { globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as any; await expect(versendeEinladung(daten)).rejects.toThrow('network'); });
});
