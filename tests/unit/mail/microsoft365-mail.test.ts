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

const cryptoMocks = vi.hoisted(()=>({ decrypt:vi.fn(), cert:vi.fn(), privateKey:vi.fn(), publicKey:vi.fn(), sign:vi.fn() }));
vi.mock('../../../src/lib/server/mail-einstellungen',()=>({entschluesseln:cryptoMocks.decrypt}));
vi.mock('node:crypto',async importOriginal=>{
  const original=await importOriginal<typeof import('node:crypto')>();
  return {...original,X509Certificate:cryptoMocks.cert,createPrivateKey:cryptoMocks.privateKey,createPublicKey:cryptoMocks.publicKey,sign:cryptoMocks.sign};
});
describe('Microsoft 365 – Token und Versand',()=>{
  const config={...konfiguration,zertifikat:'encrypted-cert',privaterSchluessel:'encrypted-key'};
  function setup(){
    vi.clearAllMocks();
    cryptoMocks.decrypt.mockImplementation((v:string)=>v==='encrypted-cert'?'cert-pem':'key-pem');
    cryptoMocks.cert.mockImplementation(function(){return {validFrom:'2000-01-01',validTo:'2099-01-01',fingerprint:'AA:BB',publicKey:{export:()=>Buffer.from('public')}};});
    cryptoMocks.privateKey.mockReturnValue({});
    cryptoMocks.publicKey.mockReturnValue({export:()=>Buffer.from('public')});
    cryptoMocks.sign.mockReturnValue(Buffer.from('signature'));
    return vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({access_token:'test-token'}))).mockResolvedValueOnce(new Response(null,{status:202}));
  }
  it.each([false,true])('sendet Nachricht mit HTML=%s',async html=>{
    const fetchMock=setup();
    await versendeMicrosoft365Mail(config,{...nachricht,...(html?{html:'<p>Test</p>'}:{})});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url,options]=fetchMock.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/'+config.tenantId+'/oauth2/v2.0/token');
    const body=options?.body as URLSearchParams;
    expect(body.get('client_id')).toBe(config.clientId);
    expect(body.get('grant_type')).toBe('client_credentials');
    const assertion=body.get('client_assertion')!;
    const payload=JSON.parse(Buffer.from(assertion.split('.')[1],'base64url').toString());
    expect(payload).toMatchObject({aud:url,iss:config.clientId,sub:config.clientId});
    const [graph,send]=fetchMock.mock.calls[1];
    expect(graph).toBe('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(config.absender)+'/sendMail');
    expect(send?.headers).toMatchObject({Authorization:'Bearer test-token'});
    expect(JSON.parse(send?.body as string)).toMatchObject({message:{subject:nachricht.betreff,body:{contentType:html?'HTML':'Text',content:html?'<p>Test</p>':nachricht.text},toRecipients:[{emailAddress:{address:nachricht.an}}]},saveToSentItems:true});
  });
  it.each([{validTo:'2000-01-01'},{validFrom:'2099-01-01'}])('verweigert zeitlich ungültiges Zertifikat',async dates=>{
    const f=setup();
    cryptoMocks.cert.mockImplementationOnce(function(){return {validFrom:'2000-01-01',validTo:'2099-01-01',...dates};});
    await expect(versendeMicrosoft365Mail(config,nachricht)).rejects.toThrow(/abgelaufen|noch nicht gültig/);
    expect(f).not.toHaveBeenCalled();
  });
  it('verweigert nicht passenden privaten Schlüssel',async()=>{
    const f=setup();
    cryptoMocks.publicKey.mockReturnValue({export:()=>Buffer.from('different')});
    await expect(versendeMicrosoft365Mail(config,nachricht)).rejects.toThrow('passen nicht zusammen');
    expect(f).not.toHaveBeenCalled();
  });
  it.each([null,42,{}, {access_token:42}])('verweigert ungültige Token-Antwort',async token=>{
    const f=setup();f.mockReset().mockResolvedValueOnce(new Response(JSON.stringify(token)));
    await expect(versendeMicrosoft365Mail(config,nachricht)).rejects.toThrow('Token fehlt');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it.each([
    {body:JSON.stringify({error:'invalid_client',error_description:'AADSTS700027 geheim'}),expected:'invalid_client, AADSTS700027'},
    {body:JSON.stringify({error:'secret!'}),expected:'unknown_error, kein AADSTS-Code'},
    {body:'not-json',expected:'unknown_error, kein AADSTS-Code'}
  ])('meldet bereinigte OAuth-Fehler',async ({body,expected})=>{
    const f=setup();f.mockReset().mockResolvedValueOnce(new Response(body,{status:401}));
    await expect(versendeMicrosoft365Mail(config,nachricht)).rejects.toThrow(expected);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('meldet Graph-Versandfehler',async()=>{
    const f=setup();f.mockReset().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'test-token'}))).mockResolvedValueOnce(new Response(null,{status:403}));
    await expect(versendeMicrosoft365Mail(config,nachricht)).rejects.toThrow('E-Mail-Versand fehlgeschlagen');
  });
  it('verweigert fehlenden privaten Schlüssel',async()=>{
    const f=setup();
    await expect(versendeMicrosoft365Mail({...config,privaterSchluessel:undefined},nachricht)).rejects.toThrow('Zertifikat für diesen Verein fehlt');
    expect(f).not.toHaveBeenCalled();
  });
});
