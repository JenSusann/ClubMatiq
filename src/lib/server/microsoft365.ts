import { randomUUID, sign, X509Certificate } from 'node:crypto';

export type Microsoft365Konfiguration = {
  tenantId: string; clientId: string; absender: string; geheimnis?: string;
};

export async function versendeMicrosoft365Mail(
  konfiguration: Microsoft365Konfiguration,
  nachricht: { an: string; betreff: string; text: string; html?: string }
): Promise<void> {

  const { tenantId, clientId, absender } = konfiguration;
  if (![tenantId, clientId].every((wert) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wert))) {
    throw new Error('Ungültige Microsoft-365-Konfiguration.');
  }
  const certBase64 = process.env.M365_CERTIFICATE_BASE64;
  const privateKeyBase64 = process.env.M365_PRIVATE_KEY_BASE64;
  if (!certBase64 || !privateKeyBase64) throw new Error('Microsoft-365-Zertifikat ist serverseitig nicht konfiguriert.');
  const zertifikat = new X509Certificate(Buffer.from(certBase64, 'base64'));
  if (Date.now() >= new Date(zertifikat.validTo).getTime()) throw new Error('Microsoft-365-Zertifikat ist abgelaufen.');
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
  const jetzt = Math.floor(Date.now() / 1000);
  const audience = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256', typ: 'JWT',
    x5t: Buffer.from(zertifikat.fingerprint.replace(/:/g, ''), 'hex').toString('base64url')
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: audience, iss: clientId, sub: clientId,
    jti: randomUUID(), nbf: jetzt - 30, iat: jetzt, exp: jetzt + 300
  })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  const tokenAntwort = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
      scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials'
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!tokenAntwort.ok) {
    // Microsoft liefert bei OAuth-Fehlern einen AADSTS-Code und einen Fehlernamen.
    // Keine Tokens, Assertions oder Zertifikatsdaten protokollieren.
    const oauthAntwort: unknown = await tokenAntwort.json().catch(() => null);
    const oauth = oauthAntwort && typeof oauthAntwort === 'object'
      ? oauthAntwort as Record<string, unknown> : {};
    const fehlercode = typeof oauth.error === 'string' && /^[a-z_]{1,80}$/i.test(oauth.error)
      ? oauth.error : 'unknown_error';
    const beschreibung = typeof oauth.error_description === 'string' ? oauth.error_description : '';
    const aadsts = beschreibung.match(/AADSTS\d{5,8}/)?.[0] ?? 'kein AADSTS-Code';
    throw new Error(`Microsoft-365-Authentifizierung fehlgeschlagen (HTTP ${tokenAntwort.status}, ${fehlercode}, ${aadsts}).`);
  }
  const tokenDaten: unknown = await tokenAntwort.json();
  if (!tokenDaten || typeof tokenDaten !== 'object' || !('access_token' in tokenDaten) ||
      typeof tokenDaten.access_token !== 'string') throw new Error('Microsoft-365-Token fehlt.');

  const antwort = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(absender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDaten.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: nachricht.betreff,
        body: { contentType: nachricht.html ? 'HTML' : 'Text', content: nachricht.html ?? nachricht.text },
        toRecipients: [{ emailAddress: { address: nachricht.an } }]
      },
      saveToSentItems: true
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!antwort.ok) throw new Error('Microsoft-365-E-Mail-Versand fehlgeschlagen.');
}
