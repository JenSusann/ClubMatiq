# E-Mail-Versand mit Resend

ClubMatiq versendet Einladungen über die Resend HTTP-API.

## Einrichtung

1. Resend-Konto erstellen und eine eigene Absenderdomain verifizieren.
2. In der lokalen `.env` und in den Netlify-Umgebungsvariablen setzen:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=ClubMatiq <einladungen@deine-domain.ch>
PUBLIC_APP_URL=https://clubmatiq.netlify.app
```

`PUBLIC_APP_URL` ist die vollständige öffentliche URL ohne abschliessenden Schrägstrich. Bei lokalen Tests kann sie auf `http://localhost:5173` gesetzt werden.

**Sicherheit:** API-Key niemals ins Git-Repository committen. Nur eine verifizierte Absenderdomain verwenden. Resend-Testdomains können den Versand an beliebige Empfänger einschränken.

## Ablauf

- Administrator erstellt eine Einladung mit Name, E-Mail und Rolle.
- Ein einmaliger Token wird generiert; in MongoDB liegt ausschliesslich dessen SHA-256-Hash.
- Nach dem Speichern wird die E-Mail versendet. Versandstatus und Resend-ID werden gespeichert.
- Bei Versandfehler bleibt die Einladung bestehen und kann erneut gesendet werden.
- Der Link ist sieben Tage gültig. Nach Annahme wird ein Benutzer im eingeladenen Verein angelegt und der Token ungültig.
- Die Einladungsübersicht zeigt den Versandstatus; erneutes Senden erzeugt einen neuen Token.

## Prüfen

`npm run check` ausführen. Anschliessend mit einer eigenen Test-E-Mail den gesamten Ablauf prüfen: Einladung, E-Mail-Eingang, Link, Passwort, Anmeldung und abgelaufenen Link.

**Hinweis:** Die Resend-API bestätigt die Annahme des Versandauftrags, nicht die tatsächliche Zustellung ins Postfach. Für Zustellstatus wie «delivered» oder «bounced» sind Resend-Webhooks erforderlich.

## Offene Punkte

- Resend-Webhooks für tatsächliche Zustellung und Bounces
- automatisierte Integrationstests und Missbrauchsschutz (Rate Limiting)
- Einladungswiderruf in der Benutzeroberfläche
