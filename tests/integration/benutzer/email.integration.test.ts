import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { versendeEinladung } from '../../../src/lib/server/email';

const daten = { email: 'test@example.org', vorname: '<Anna & "Test">', verein: 'TV <Test>', link: 'https://example.org/?a=1&b=2', ablaufdatum: new Date('2026-12-01T12:00:00Z') };
const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'club@example.org';
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = originalFrom;
});

describe('Paket 32 – E-Mail-Einladungen', () => {
  it.each(['RESEND_API_KEY', 'RESEND_FROM_EMAIL'] as const)('verweigert Versand ohne %s', async (key) => {
    delete process.env[key];
    await expect(versendeEinladung(daten)).rejects.toThrow('fehlt');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sendet Text und escaped HTML ohne echte Netzwerkanfrage', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-123' }) } as Response);
    await expect(versendeEinladung(daten)).resolves.toEqual({ id: 'mail-123' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options?.method).toBe('POST');
    const body = JSON.parse(String(options?.body));
    expect(body.to).toEqual(['test@example.org']);
    expect(body.html).toContain('&lt;Anna &amp; &quot;Test&quot;&gt;');
    expect(body.html).toContain('TV &lt;Test&gt;');
    expect(body.html).toContain('?a=1&amp;b=2');
    expect(body.text).toContain('https://example.org/?a=1&b=2');
  });
  it('behandelt fehlgeschlagenen API-Aufruf', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429, text: async () => 'limit' } as Response);
    await expect(versendeEinladung(daten)).rejects.toThrow('fehlgeschlagen');
  });
  it.each([null, {}, { id: 12 }, { message: 'ok' }])('verweigert ungültige Versand-ID (%j)', async (result) => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result } as Response);
    await expect(versendeEinladung(daten)).rejects.toThrow('keine Versand-ID');
  });
  it('propagiert Netzwerkfehler', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await expect(versendeEinladung(daten)).rejects.toThrow('offline');
  });
});
