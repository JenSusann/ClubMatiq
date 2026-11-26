import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pruefeBerechtigung: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  verschluesseln: vi.fn()
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.pruefeBerechtigung }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn(() => ({ findOne: mocks.findOne, updateOne: mocks.updateOne })) } }));
vi.mock('../../../src/lib/server/mail-einstellungen', () => ({ verschluesseln: mocks.verschluesseln }));

import { GET, PUT } from '../../../src/routes/api/mail-einstellungen/+server';

const admin = { id: 'admin', vereinId: '507f1f77bcf86cd799439011', email: 'admin@club.ch', rolle: 'admin' };
const kontext = (methode: string, daten?: unknown, benutzer: unknown = admin) => ({
  locals: { benutzer },
  request: new Request('http://localhost/api/mail-einstellungen', {
    method: methode, ...(daten === undefined ? {} : { body: JSON.stringify(daten), headers: { 'content-type': 'application/json' } })
  })
}) as never;

describe('E-Mail-Einstellungen API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.pruefeBerechtigung.mockReturnValue(null);
    mocks.findOne.mockResolvedValue(null);
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.verschluesseln.mockReturnValue('encrypted');
  });

  it('GET blockiert fehlende Berechtigungen vor DB-Zugriff', async () => {
    mocks.pruefeBerechtigung.mockReturnValue(new Response('Nicht erlaubt', { status: 403 }));
    expect((await GET(kontext('GET', undefined, { ...admin, rolle: 'mitglied' }))).status).toBe(403);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it('GET gibt niemals das verschlüsselte SMTP-Passwort zurück', async () => {
    mocks.findOne.mockResolvedValue({ mailEinstellungen: { methode: 'smtp', smtp: {
      host: 'smtp.example.ch', port: 587, secure: false, benutzername: 'user',
      absender: 'user@example.ch', geheimnis: 'secret-ciphertext'
    } } });
    const antwort = await GET(kontext('GET'));
    const daten = await antwort.json();
    expect(daten.smtp.passwortHinterlegt).toBe(true);
    expect(JSON.stringify(daten)).not.toContain('secret-ciphertext');
    expect(mocks.findOne.mock.calls[0][0]._id.toHexString()).toBe(admin.vereinId);
  });

  it('PUT verhindert ungültige SMTP-Eingaben', async () => {
    const antwort = await PUT(kontext('PUT', { methode: 'smtp', smtp: {
      host: 'localhost', port: -1, secure: false, benutzername: 'u', absender: 'invalid', passwort: 'pw'
    } }));
    expect(antwort.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('PUT verschlüsselt das Passwort und schreibt nur in den eigenen Verein', async () => {
    const antwort = await PUT(kontext('PUT', { methode: 'smtp', smtp: {
      host: 'smtp.example.ch', port: 587, secure: false,
      benutzername: 'user', absender: 'user@example.ch', passwort: 'mein-passwort'
    } }));
    expect(antwort.status).toBe(200);
    expect(mocks.verschluesseln).toHaveBeenCalledWith('mein-passwort');
    const [filter, update] = mocks.updateOne.mock.calls[0];
    expect(filter._id.toHexString()).toBe(admin.vereinId);
    expect(update.$set.mailEinstellungen.smtp.geheimnis).toBe('encrypted');
    expect(JSON.stringify(update)).not.toContain('mein-passwort');
  });

  it('PUT behält gespeichertes Passwort bei, wenn kein neues übergeben wird', async () => {
    mocks.findOne.mockResolvedValue({ mailEinstellungen: { smtp: { geheimnis: 'existing' } } });
    const antwort = await PUT(kontext('PUT', { methode: 'smtp', smtp: {
      host: 'smtp.example.ch', port: 587, secure: false,
      benutzername: 'user', absender: 'user@example.ch', passwort: ''
    } }));
    expect(antwort.status).toBe(200);
    expect(mocks.verschluesseln).not.toHaveBeenCalled();
    expect(mocks.updateOne.mock.calls[0][1].$set.mailEinstellungen.smtp.geheimnis).toBe('existing');
  });


  it('PUT akzeptiert gültige Microsoft-365-Einstellungen mit Vereins-Absender', async () => {
    const microsoft365 = {
      tenantId: 'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',
      clientId: 'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',
      absender: 'clubmatiq@tvweiningen.ch'
    };
    const antwort = await PUT(kontext('PUT', { methode: 'microsoft365', microsoft365 }));
    expect(antwort.status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][0]._id.toHexString()).toBe(admin.vereinId);
    expect(mocks.updateOne.mock.calls[0][1].$set.mailEinstellungen).toEqual({
      methode: 'microsoft365', microsoft365
    });
  });

  it('PUT lehnt ungültige Microsoft-365-Absenderadressen ab', async () => {
    const antwort = await PUT(kontext('PUT', { methode: 'microsoft365', microsoft365: {
      tenantId: 'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',
      clientId: 'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',
      absender: 'ungueltig'
    } }));
    expect(antwort.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('PUT Resend schreibt vereinsbezogen ohne SMTP-Geheimnis', async () => {
    const antwort = await PUT(kontext('PUT', { methode: 'resend' }));
    expect(antwort.status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][0]._id.toHexString()).toBe(admin.vereinId);
    expect(mocks.updateOne.mock.calls[0][1]).toEqual({ $set: { 'mailEinstellungen.methode': 'resend' } });
  });
  it('speichert pro Verein ein validiertes Schlüsselpaar verschlüsselt', async () => {
    // Ungültige oder nur halb übergebene Paare müssen blockiert werden.
    // Ungültige oder nur halb übergebene Paare müssen hier blockiert werden.
    const antwort = await PUT(kontext('PUT', { methode: 'microsoft365', microsoft365: {
      tenantId: 'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',
      clientId: 'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',
      absender: 'mail@verein.ch',
      zertifikatPem: '-----BEGIN CERTIFICATE-----'
    } }));
    expect(antwort.status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('meldet einen fehlenden Verschlüsselungsschlüssel verständlich vor dem Datenbank-Schreiben', async () => {
    const vorher = process.env.MAIL_ENCRYPTION_KEY;
    delete process.env.MAIL_ENCRYPTION_KEY;
    try {
      const antwort = await PUT(kontext('PUT', { methode: 'microsoft365', microsoft365: {
        tenantId: 'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',
        clientId: 'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',
        absender: 'mail@verein.ch',
        zertifikatPem: '-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----',
        privaterSchluesselPem: '-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----'
      } }));
      expect(antwort.status).toBe(503);
      expect((await antwort.json()).fehler).toContain('MAIL_ENCRYPTION_KEY');
      expect(mocks.updateOne).not.toHaveBeenCalled();
    } finally {
      if (vorher === undefined) delete process.env.MAIL_ENCRYPTION_KEY;
      else process.env.MAIL_ENCRYPTION_KEY = vorher;
    }
  });

  it('verwirft alte Zertifikate beim Wechsel zu einer anderen Entra-App', async () => {
    mocks.findOne.mockResolvedValue({ mailEinstellungen: { microsoft365: {
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      clientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      zertifikat: 'encrypted-cert', privaterSchluessel: 'encrypted-key'
    } } });
    const antwort = await PUT(kontext('PUT', { methode: 'microsoft365', microsoft365: {
      tenantId: 'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',
      clientId: 'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',
      absender: 'mail@verein.ch'
    } }));
    expect(antwort.status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][1].$set.mailEinstellungen.microsoft365).not.toHaveProperty('privaterSchluessel');
  });

  it('GET gibt verschlüsselte Zertifikate und Schlüssel nicht an den Browser aus', async () => {
    mocks.findOne.mockResolvedValue({ mailEinstellungen: { methode: 'microsoft365', microsoft365: {
      tenantId: 'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',
      clientId: 'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',
      absender: 'mail@verein.ch', zertifikat: 'cipher-cert', privaterSchluessel: 'cipher-key'
    } } });
    const antwort = await GET(kontext('GET'));
    const text = JSON.stringify(await antwort.json());
    expect(text).not.toContain('cipher-cert');
    expect(text).not.toContain('cipher-key');
    expect(text).toContain('zertifikatServerseitig');
  });

});

describe('E-Mail-Einstellungen – zusätzliche Validierungen', () => {
  const smtp = {host:'smtp.example.ch',port:587,secure:false,benutzername:'user',absender:'user@example.ch',passwort:'pw'};
  const microsoft365 = {tenantId:'f7cf9dfa-5f0d-429c-9b64-c4c7a5d66a75',clientId:'e7cd00c1-cd5d-4d3f-8a35-6324ddb026a8',absender:'mail@verein.ch'};
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.pruefeBerechtigung.mockReturnValue(null);
    mocks.findOne.mockResolvedValue(null);
    mocks.updateOne.mockResolvedValue({matchedCount:1});
    mocks.verschluesseln.mockReturnValue('encrypted');
  });
  it('liefert Standardwerte ohne Konfiguration', async () => {
    expect(await (await GET(kontext('GET'))).json()).toEqual({methode:'resend',smtp:null,microsoft365:null});
  });
  it('blockiert PUT ohne Berechtigung', async () => {
    mocks.pruefeBerechtigung.mockReturnValue(new Response(null,{status:403}));
    expect((await PUT(kontext('PUT',{methode:'resend'}))).status).toBe(403);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it.each([null,[],42,'text',{}, {methode:'falsch'}])('weist ungültige Konfiguration ab', async data => {
    expect((await PUT(kontext('PUT',data))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it.each(['smtp','microsoft365'])('weist fehlende oder ungültige %s Details ab', async methode => {
    for (const details of [null,[],42]) {
      expect((await PUT(kontext('PUT',{methode,[methode]:details}))).status).toBe(400);
    }
  });
  it.each([
    {host:42},{host:'.example.ch'},{host:'example.ch.'},{port:1.5},{port:0},{port:65536},
    {secure:42},{benutzername:42},{benutzername:'x'.repeat(255)},{absender:42},{absender:'invalid'}
  ])('weist ungültige SMTP-Felder ab', async patch => {
    expect((await PUT(kontext('PUT',{methode:'smtp',smtp:{...smtp,...patch}}))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('verlangt ein SMTP-Passwort ohne gespeichertes Geheimnis', async () => {
    expect((await PUT(kontext('PUT',{methode:'smtp',smtp:{...smtp,passwort:42}}))).status).toBe(400);
  });
  it('behandelt SMTP-Verschlüsselungsfehler', async () => {
    mocks.verschluesseln.mockImplementationOnce(()=>{throw new Error('key');});
    expect((await PUT(kontext('PUT',{methode:'smtp',smtp}))).status).toBe(500);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it.each([{tenantId:42},{clientId:42},{absender:42},{zertifikatPem:'x'.repeat(20001)},{privaterSchluesselPem:'x'.repeat(20001)}])('weist ungültige Microsoft-365-Felder ab', async patch => {
    expect((await PUT(kontext('PUT',{methode:'microsoft365',microsoft365:{...microsoft365,...patch}}))).status).toBe(400);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
  it('behält Schlüssel bei unveränderter Entra-App', async () => {
    mocks.findOne.mockResolvedValue({mailEinstellungen:{microsoft365:{...microsoft365,zertifikat:'cert',privaterSchluessel:'key'}}});
    expect((await PUT(kontext('PUT',{methode:'microsoft365',microsoft365}))).status).toBe(200);
    expect(mocks.updateOne.mock.calls[0][1].$set.mailEinstellungen.microsoft365).toEqual({...microsoft365,zertifikat:'cert',privaterSchluessel:'key'});
  });
  it.each([new Error('db'),'db'])('behandelt Microsoft-365-Datenbankfehler', async error => {
    mocks.findOne.mockRejectedValueOnce(error);
    expect((await PUT(kontext('PUT',{methode:'microsoft365',microsoft365}))).status).toBe(500);
  });
});
