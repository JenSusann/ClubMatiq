import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  berechtigung: vi.fn(),
  laden: vi.fn(),
  entschluesseln: vi.fn(),
  createTransport: vi.fn(),
  verify: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn()
}));

vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.berechtigung }));
vi.mock('../../src/lib/server/mail-einstellungen', () => ({
  ladeMailKonfiguration: mocks.laden,
  entschluesseln: mocks.entschluesseln
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransport }
}));

import { POST } from '../../src/routes/api/mail-einstellungen/test/+server';

const admin = { id: 'a', vereinId: '507f1f77bcf86cd799439011', email: 'admin@verein.ch', rolle: 'admin' };
const kontext = (benutzer: unknown = admin) => ({ locals: { benutzer }, request: new Request('http://localhost/api/mail-einstellungen/test', { method: 'POST' }) }) as never;

describe('SMTP-Testversand: Berechtigungen, Isolation und Versand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.berechtigung.mockReturnValue(null);
    mocks.laden.mockResolvedValue({
      methode: 'smtp', smtp: {
        host: 'smtp.verein.ch', port: 587, secure: false, benutzername: 'konto@verein.ch',
        absender: 'konto@verein.ch', geheimnis: 'verschluesselt'
      }
    });
    mocks.entschluesseln.mockReturnValue('geheim');
    mocks.createTransport.mockReturnValue({
      verify: mocks.verify, sendMail: mocks.sendMail, close: mocks.close
    });
    mocks.verify.mockResolvedValue(true);
    mocks.sendMail.mockResolvedValue({ messageId: 'test' });
  });

  it('verweigert nicht berechtigten Benutzern den Zugriff ohne Datenbankzugriff', async () => {
    mocks.berechtigung.mockReturnValue(new Response('Keine Berechtigung', { status: 403 }));
    const antwort = await POST(kontext({ ...admin, rolle: 'mitglied' }));
    expect(antwort.status).toBe(403);
    expect(mocks.laden).not.toHaveBeenCalled();
  });

  it('verwendet nur die Konfiguration des angemeldeten Vereins und die Admin-Adresse', async () => {
    const antwort = await POST(kontext());
    expect(antwort.status).toBe(200);
    expect(mocks.laden).toHaveBeenCalledWith(admin.vereinId);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.verein.ch', requireTLS: true,
      auth: { user: 'konto@verein.ch', pass: 'geheim' }
    }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: admin.email }));
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('verhindert Versand ohne gespeicherte SMTP-Konfiguration', async () => {
    mocks.laden.mockResolvedValue({ methode: 'resend' });
    const antwort = await POST(kontext());
    expect(antwort.status).toBe(400);
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('gibt bei SMTP-Fehlern keine Zugangsdaten preis und schliesst die Verbindung', async () => {
    mocks.verify.mockRejectedValue(new Error('secret geheim'));
    const antwort = await POST(kontext());
    expect(antwort.status).toBe(502);
    expect(JSON.stringify(await antwort.json())).not.toContain('geheim');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
