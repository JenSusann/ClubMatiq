# E-Mail-Konfiguration

ClubMatiq unterstützt vereinsbezogenen Versand über Microsoft 365 und SMTP sowie serverseitig konfigurierten Resend-Versand. In der Demo ist der Versand deaktiviert.

## Microsoft 365

In der Administration die vereinsbezogene Methode Microsoft 365 wählen. Tenant-ID, Client-ID, Absender, öffentliches Zertifikat und passenden privaten Schlüssel hinterlegen. Die Anwendung nutzt OAuth2 Client Credentials mit signierter Zertifikatsassertion und Microsoft Graph sendMail. Die App-Registrierung und der Service Principal müssen eingerichtet sein; Versandberechtigungen auf das vorgesehene Postfach beschränken. Zertifikatsgültigkeit und Übereinstimmung des Schlüsselpaars werden serverseitig geprüft. Zertifikat und privater Schlüssel werden verschlüsselt vereinsbezogen gespeichert.

## SMTP

Host, Port, Benutzername, Passwort und Absender hinterlegen. Port 465 mit direktem TLS oder Port 587 mit STARTTLS entsprechend dem Anbieter konfigurieren. Der Versand erzwingt TLS bei nicht direkt verschlüsselter Verbindung. Das Passwort wird verschlüsselt gespeichert.

## Resend

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
- Nach dem Speichern wird die E-Mail versendet. Versandstatus und Versand-ID werden gespeichert.
- Bei Versandfehler bleibt die Einladung bestehen und kann erneut gesendet werden.
- Der Link ist sieben Tage gültig. Nach Annahme wird ein Benutzer im eingeladenen Verein angelegt und der Token ungültig.
- Die Einladungsübersicht zeigt den Versandstatus; erneutes Senden erzeugt einen neuen Token.

## Prüfen

`npm run check` ausführen. Anschliessend mit einer eigenen Test-E-Mail den gesamten Ablauf prüfen: Einladung, E-Mail-Eingang, Link, Passwort, Anmeldung und abgelaufenen Link.

**Hinweis:** Die Resend-API bestätigt die Annahme des Versandauftrags, nicht die tatsächliche Zustellung ins Postfach. Für Zustellstatus wie «delivered» oder «bounced» sind Resend-Webhooks erforderlich.

## Grenzen und Nachweise

Eine Versand-ID ist kein Zustellnachweis. Der aktuelle Umfang der automatisierten und manuellen Prüfungen ist im [Systemabnahmetestprotokoll](testing/System_Abnahmetestprotokoll.md) dokumentiert. Produktive Zugangsdaten niemals in Demo oder Git hinterlegen. Siehe auch [Demo-Betrieb](testing/Demo-Betrieb.md).
