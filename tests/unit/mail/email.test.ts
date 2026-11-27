import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { versendeEinladung } from '../../../src/lib/server/email';
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
  it('meldet fehlgeschlagenen HTTP-Status', async () => { globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' }) as any; await expect(versendeEinladung(daten)).rejects.toThrow('fehlgeschlagen'); expect(console.error).toHaveBeenCalledExactlyOnceWith('Resend API Fehler:', 429); expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('rate limited'); });
  it.each([null, {}, { id: 123 }, { id: null }, 'invalid'])('weist fehlende Versand-ID zurück %#', async (result) => { globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => result }) as any; await expect(versendeEinladung(daten)).rejects.toThrow('Versand-ID'); });
  it('reicht Netzwerkfehler weiter', async () => { globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as any; await expect(versendeEinladung(daten)).rejects.toThrow('network'); });
});

import { ObjectId } from 'mongodb';
import { verschluesseln, entschluesseln, ladeMailKonfiguration } from '../../../src/lib/server/mail-einstellungen';
const mailMocks = vi.hoisted(() => ({findOne:vi.fn(),sendMail:vi.fn(),createTransport:vi.fn(),m365:vi.fn()}));
vi.mock('../../../src/lib/server/mongodb',()=>({db:{collection:()=>({findOne:mailMocks.findOne})}}));
vi.mock('nodemailer',()=>({default:{createTransport:mailMocks.createTransport}}));
vi.mock('../../../src/lib/server/microsoft365',()=>({versendeMicrosoft365Mail:mailMocks.m365}));

describe('Vereinsbezogene Mail-Konfiguration und Versand',()=>{
  const vereinId='507f1f77bcf86cd799439011';
  beforeEach(()=>{
    vi.stubEnv('MAIL_ENCRYPTION_KEY','ab'.repeat(32));
    mailMocks.findOne.mockReset().mockResolvedValue(null);
    mailMocks.sendMail.mockReset().mockResolvedValue({messageId:'smtp-id'});
    mailMocks.createTransport.mockReset().mockReturnValue({sendMail:mailMocks.sendMail});
    mailMocks.m365.mockReset().mockResolvedValue(undefined);
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('verschlüsselt und entschlüsselt mit zufälligem IV',()=>{
    const a=verschluesseln('Testgeheimnis');
    const b=verschluesseln('Testgeheimnis');
    expect(a).not.toBe(b);
    expect(entschluesseln(a)).toBe('Testgeheimnis');
    expect(entschluesseln(b)).toBe('Testgeheimnis');
  });
  it.each(['','abc','zz'.repeat(32)])('verweigert ungültigen Schlüssel',key=>{
    vi.stubEnv('MAIL_ENCRYPTION_KEY',key);
    expect(()=>verschluesseln('test')).toThrow('MAIL_ENCRYPTION_KEY');
  });
  it.each(['','a','a.b','a..c'])('verweigert ungültiges Geheimnis',wert=>{
    expect(()=>entschluesseln(wert)).toThrow();
  });
  it('verweigert Entschlüsselung mit falschem Schlüssel',()=>{
    const wert=verschluesseln('test');
    vi.stubEnv('MAIL_ENCRYPTION_KEY','cd'.repeat(32));
    expect(()=>entschluesseln(wert)).toThrow();
  });
  it.each([null,{}, {mailEinstellungen:{methode:'unbekannt'}}])('verwendet Resend als Standard',async verein=>{
    mailMocks.findOne.mockResolvedValue(verein);
    expect(await ladeMailKonfiguration(vereinId)).toEqual({methode:'resend'});
    expect(mailMocks.findOne).toHaveBeenCalledWith({_id:new ObjectId(vereinId)});
  });
  it.each([true,false])('versendet SMTP mit secure=%s',async secure=>{
    mailMocks.findOne.mockResolvedValue({mailEinstellungen:{methode:'smtp',smtp:{host:'smtp.example.ch',port:587,secure,benutzername:'user',absender:'mail@example.ch',geheimnis:verschluesseln('pw')}}});
    expect(await versendeEinladung({...daten,vereinId})).toEqual({id:'smtp-id'});
    expect(mailMocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({secure,requireTLS:!secure,auth:{user:'user',pass:'pw'}}));
    expect(mailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({to:daten.email,from:'mail@example.ch'}));
  });
  it.each([undefined,{}])('verweigert unvollständiges SMTP',async smtp=>{
    mailMocks.findOne.mockResolvedValue({mailEinstellungen:{methode:'smtp',smtp}});
    await expect(versendeEinladung({...daten,vereinId})).rejects.toThrow('SMTP-Konfiguration');
    expect(mailMocks.createTransport).not.toHaveBeenCalled();
  });
  it('versendet über vereinsbezogenes Microsoft 365',async()=>{
    const microsoft365={tenantId:'tenant',clientId:'client',absender:'mail@example.ch'};
    mailMocks.findOne.mockResolvedValue({mailEinstellungen:{methode:'microsoft365',microsoft365}});
    expect((await versendeEinladung({...daten,vereinId})).id).toMatch(/^m365-/);
    expect(mailMocks.m365).toHaveBeenCalledWith(microsoft365,expect.objectContaining({an:daten.email,html:expect.any(String)}));
  });
  it('verweigert unvollständiges Microsoft 365',async()=>{
    mailMocks.findOne.mockResolvedValue({mailEinstellungen:{methode:'microsoft365'}});
    await expect(versendeEinladung({...daten,vereinId})).rejects.toThrow('Microsoft-365-Konfiguration');
    expect(mailMocks.m365).not.toHaveBeenCalled();
  });
  it('versendet über Resend bei fehlender Vereinskonfiguration',async()=>{
    globalThis.fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'resend-id'})}) as any;
    expect(await versendeEinladung({...daten,vereinId})).toEqual({id:'resend-id'});
  });
});
