import { afterEach, describe, expect, it, vi } from 'vitest';
import { versendeMicrosoft365Mail } from '../../../src/lib/server/microsoft365';

const konfiguration = {
  tenantId: '507f1f77-bcf8-4cd7-9943-901100000001',
  clientId: '507f1f77-bcf8-4cd7-9943-901100000002',
  absender: 'versand@club.ch'
};
const nachricht = { an: 'empfaenger@club.ch', betreff: 'Test', text: 'Nachricht' };
const alteWerte = {
  zertifikat: process.env.M365_CERTIFICATE_BASE64,
  schluessel: process.env.M365_PRIVATE_KEY_BASE64
};

afterEach(() => {
  if (alteWerte.zertifikat === undefined) delete process.env.M365_CERTIFICATE_BASE64;
  else process.env.M365_CERTIFICATE_BASE64 = alteWerte.zertifikat;
  if (alteWerte.schluessel === undefined) delete process.env.M365_PRIVATE_KEY_BASE64;
  else process.env.M365_PRIVATE_KEY_BASE64 = alteWerte.schluessel;
  vi.restoreAllMocks();
});

describe('Microsoft 365 Zertifikatsauthentifizierung', () => {
  it('verhindert Versand ohne serverseitiges Zertifikat und privaten Schlüssel', async () => {
    delete process.env.M365_CERTIFICATE_BASE64;
    delete process.env.M365_PRIVATE_KEY_BASE64;
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(versendeMicrosoft365Mail(konfiguration, nachricht)).rejects.toThrow('Microsoft-365-Zertifikat für diesen Verein fehlt.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verhindert Token-Anfrage mit ungültiger Tenant-ID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(versendeMicrosoft365Mail({ ...konfiguration, tenantId: 'ungültig' }, nachricht)).rejects.toThrow('Ungültige');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verhindert Versand mit ungültigem Zertifikat', async () => {
    process.env.M365_CERTIFICATE_BASE64 = Buffer.from('kein Zertifikat').toString('base64');
    process.env.M365_PRIVATE_KEY_BASE64 = Buffer.from('kein Schlüssel').toString('base64');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(versendeMicrosoft365Mail(konfiguration, nachricht)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
