import { entschluesseln } from './mail-einstellungen';

export type Microsoft365Konfiguration = {
  tenantId: string; clientId: string; absender: string; geheimnis?: string;
};

export async function versendeMicrosoft365Mail(
  konfiguration: Microsoft365Konfiguration,
  nachricht: { an: string; betreff: string; text: string; html?: string }
): Promise<void> {
  if (!konfiguration.geheimnis) throw new Error('Microsoft-365-Konfiguration unvollständig.');
  const { tenantId, clientId, absender } = konfiguration;
  if (![tenantId, clientId].every((wert) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wert))) {
    throw new Error('Ungültige Microsoft-365-Konfiguration.');
  }
  const tokenAntwort = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: entschluesseln(konfiguration.geheimnis),
      scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials'
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!tokenAntwort.ok) throw new Error('Microsoft-365-Authentifizierung fehlgeschlagen.');
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
