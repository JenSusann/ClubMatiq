import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ entschluesseln: vi.fn() }));
vi.mock('../../src/lib/server/mail-einstellungen', () => ({ entschluesseln: mocks.entschluesseln }));
import { versendeMicrosoft365Mail } from '../../src/lib/server/microsoft365';

const konfiguration = {
  tenantId: '507f1f77-bcf8-4cd7-9943-901100000001',
  clientId: '507f1f77-bcf8-4cd7-9943-901100000002',
  absender: 'versand@club.ch',
  geheimnis: 'ciphertext'
};
const nachricht = { an: 'empfaenger@club.ch', betreff: 'Test', text: 'Nachricht' };
const originalFetch = globalThis.fetch;

describe('Microsoft 365 Graph OAuth2 Mailversand', () => {
  beforeEach(() => { mocks.entschluesseln.mockReturnValue('client-secret'); });
  afterEach(() => { globalThis.fetch = originalFetch; vi.clearAllMocks(); });

  it('fordert Token an und versendet über das konfigurierte Postfach', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({ ok: true });
    globalThis.fetch = fetchMock;
    await versendeMicrosoft365Mail(konfiguration, nachricht);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(konfiguration.tenantId);
    expect(fetchMock.mock.calls[0][1].body.toString()).toContain('grant_type=client_credentials');
    expect(fetchMock.mock.calls[1][0]).toContain(encodeURIComponent(konfiguration.absender));
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer access-token');
  });

  it('verhindert Versand ohne Secret', async () => {
    const fetchMock = vi.fn(); globalThis.fetch = fetchMock;
    await expect(versendeMicrosoft365Mail({ ...konfiguration, geheimnis: undefined }, nachricht)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sendet keine E-Mail, wenn die OAuth2-Authentifizierung scheitert', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    globalThis.fetch = fetchMock;
    await expect(versendeMicrosoft365Mail(konfiguration, nachricht)).rejects.toThrow('Authentifizierung');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('meldet Graph-Versandfehler ohne Token oder Client-Secret auszugeben', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({ ok: false });
    globalThis.fetch = fetchMock;
    await expect(versendeMicrosoft365Mail(konfiguration, nachricht)).rejects.toThrow('E-Mail-Versand fehlgeschlagen');
  });
});
