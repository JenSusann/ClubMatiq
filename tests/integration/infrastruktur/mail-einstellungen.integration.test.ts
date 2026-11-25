import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hilfeArtikel } from '../../../src/lib/hilfe';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  versendeMicrosoft365Mail: vi.fn(),
  ladeMailKonfiguration: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({ findOne: mocks.findOne, updateOne: mocks.updateOne })) }
}));
vi.mock('../../../src/lib/server/microsoft365', () => ({
  versendeMicrosoft365Mail: mocks.versendeMicrosoft365Mail
}));
vi.mock('../../../src/lib/server/mail-einstellungen', () => ({
  ladeMailKonfiguration: mocks.ladeMailKonfiguration,
  verschluesseln: vi.fn((wert: string) => 'encrypted:' + wert),
  entschluesseln: vi.fn((wert: string) => wert)
}));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

import { GET, PUT } from '../../../src/routes/api/mail-einstellungen/+server';
import { POST } from '../../../src/routes/api/mail-einstellungen/test/+server';

const vereinId = '507f1f77bcf86cd799439011';
const admin = { id: 'admin', vereinId, email: 'admin@verein.ch', rolle: 'admin' };
const m365 = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  absender: 'post@verein.ch'
};
const kontext = (method: string, benutzer: unknown = admin, body?: unknown) => ({
  locals: { benutzer },
  request: new Request('http://localhost/api/mail-einstellungen', {
    method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  })
}) as never;

describe('Integration: Einstellungen speichern, laden und Testmail versenden', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.findOne.mockResolvedValue(null);
    mocks.ladeMailKonfiguration.mockResolvedValue({ methode: 'microsoft365', microsoft365: m365 });
    mocks.versendeMicrosoft365Mail.mockResolvedValue(undefined);
  });

  it('verbindet PUT, GET und Testversand mit demselben Verein', async () => {
    const gespeichert = await PUT(kontext('PUT', admin, { methode: 'microsoft365', microsoft365: m365 }));
    expect(gespeichert.status).toBe(200);
    const [filter, update] = mocks.updateOne.mock.calls[0];
    expect(filter._id.toHexString()).toBe(vereinId);
    expect(update.$set.mailEinstellungen.microsoft365).toEqual(m365);

    mocks.findOne.mockResolvedValue({ mailEinstellungen: update.$set.mailEinstellungen });
    const geladen = await GET(kontext('GET'));
    expect(geladen.status).toBe(200);
    const antwort = await geladen.json();
    expect(antwort.methode).toBe('microsoft365');
    expect(antwort.microsoft365).toEqual(expect.objectContaining(m365));
    expect(mocks.findOne.mock.calls[0][0]._id.toHexString()).toBe(vereinId);

    const test = await POST(kontext('POST'));
    expect(test.status).toBe(200);
    expect(mocks.ladeMailKonfiguration).toHaveBeenCalledWith(vereinId);
    expect(mocks.versendeMicrosoft365Mail).toHaveBeenCalledWith(m365, expect.objectContaining({ an: admin.email }));
  });

  it.each(['mitglied', 'leiter', 'materialverantwortlich'])('blockiert %s für Lesen, Schreiben und Testen', async (rolle) => {
    const person = { ...admin, rolle };
    expect((await GET(kontext('GET', person))).status).toBe(403);
    expect((await PUT(kontext('PUT', person, { methode: 'resend' }))).status).toBe(403);
    expect((await POST(kontext('POST', person))).status).toBe(403);
    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.ladeMailKonfiguration).not.toHaveBeenCalled();
    expect(mocks.versendeMicrosoft365Mail).not.toHaveBeenCalled();
  });

  it('blockiert nicht angemeldete Zugriffe auf allen drei Endpunkten', async () => {
    expect((await GET(kontext('GET', null))).status).toBe(401);
    expect((await PUT(kontext('PUT', null, { methode: 'resend' }))).status).toBe(401);
    expect((await POST(kontext('POST', null))).status).toBe(401);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it('stellt die ausführliche Einrichtungsanleitung im Hilfe-Center bereit', () => {
    const artikel = hilfeArtikel.find((eintrag) => eintrag.slug === 'e-mail-einstellungen');
    expect(artikel).toBeDefined();
    expect(artikel?.rollen).toContain('Administrator');
    const anleitung = JSON.stringify(artikel);
    for (const begriff of ['Microsoft', 'SMTP', 'Resend', 'Entra', 'Exchange', 'MAIL_ENCRYPTION_KEY', 'verschlüsselt', 'privaten PEM-Schlüssel', 'AADSTS700027']) {
      expect(anleitung).toContain(begriff);
    }
  });
  it('isoliert den Microsoft-365-Versand für zwei Vereine mit unterschiedlichen Zertifikaten', async () => {
    const andererVerein = '507f191e810c19729de860ea';
    const clubA = { ...m365, zertifikat: 'encrypted-A-cert', privaterSchluessel: 'encrypted-A-key' };
    const clubB = {
      tenantId: '33333333-3333-4333-8333-333333333333',
      clientId: '44444444-4444-4444-8444-444444444444',
      absender: 'post@anderer-verein.ch',
      zertifikat: 'encrypted-B-cert', privaterSchluessel: 'encrypted-B-key'
    };
    mocks.ladeMailKonfiguration.mockImplementation(async (id: string) =>
      id === vereinId ? { methode: 'microsoft365', microsoft365: clubA }
        : id === andererVerein ? { methode: 'microsoft365', microsoft365: clubB }
        : { methode: 'resend' }
    );
    const personB = { ...admin, vereinId: andererVerein, email: 'admin@anderer-verein.ch' };
    expect((await POST(kontext('POST', admin))).status).toBe(200);
    expect((await POST(kontext('POST', personB))).status).toBe(200);
    expect(mocks.versendeMicrosoft365Mail).toHaveBeenNthCalledWith(1, clubA, expect.objectContaining({ an: admin.email }));
    expect(mocks.versendeMicrosoft365Mail).toHaveBeenNthCalledWith(2, clubB, expect.objectContaining({ an: personB.email }));
    expect(mocks.ladeMailKonfiguration).toHaveBeenNthCalledWith(1, vereinId);
    expect(mocks.ladeMailKonfiguration).toHaveBeenNthCalledWith(2, andererVerein);
  });

});
