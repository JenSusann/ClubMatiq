# ClubMatiq – Demo-Betrieb

## Zweck und Zugang

Separate Umgebung für die ZHAW-Zwischen- und Schlussabgabe: https://clubmatiq-demo.netlify.app. Ausschliesslich fiktive Daten des Turnvereins Musterhausen. Zugangsdaten separat über Moodle, niemals im Repository.

## Umgebungen

| Umgebung | Datenbank | Start |
|---|---|---|
| Development | clubmatiq_dev | npm run dev |
| Demo | clubmatiq_demo | npm run dev:demo (Port 5174) |
| Integrationstests | clubmatiq_test | npm run test:integration |
| Production | clubmatiq | bestehendes Netlify-Projekt |

Die CI nutzt gemäss [Pilotbetrieb](../testing/Pilotbetrieb.md) eine temporäre lokale MongoDB-Instanz. Demo verwendet einen eigenen MongoDB-Benutzer mit readWrite ausschliesslich auf clubmatiq_demo. Lokale Konfiguration in .env.demo.local, nicht committen.

## Initialisierung und Reset

```powershell
npm run db:init:demo
npm run db:init:demo -- --apply
npm run db:seed:demo
npm run db:seed:demo -- --apply
```

Vor Reset Demo-Zugriffe und parallele Schreibvorgänge unterbinden. Reset löscht Demo-Daten und erstellt den Seed innerhalb einer Transaktion neu; bestehende Indizes bleiben erhalten. Manuell erzeugte Testfälle gehen verloren; insbesondere werden manuelle Teilzahlungen und Retouren nicht automatisch wiederhergestellt.

```powershell
npm run db:reset:demo
npm run db:reset:demo -- --apply --confirm=clubmatiq_demo
```

Anschliessend Anmeldung und Datenbestand prüfen. Keine produktiven Zugangsdaten verwenden.

## Netlify

Eigenes Projekt clubmatiq-demo, Repository JenSusann/ClubMatiq, Branch main, Build npm run build. Publish-Verzeichnis anhand erfolgreicher Projektkonfiguration beibehalten. MONGODB_URI nur mit Demo-Benutzer, MONGODB_DB_NAME=clubmatiq_demo, PUBLIC_APP_URL=https://clubmatiq-demo.netlify.app, SECRETS_SCAN_OMIT_KEYS=MONGODB_DB_NAME. Secrets Scanner nicht vollständig deaktivieren. Keine produktiven Mail-, Cloudinary- oder Verschlüsselungszugangsdaten hinterlegen.

## Abnahme und Freigabe

Lokale Abnahme 10/10, Online-Abnahme 15/15 gemäss Anwenderbestätigung am 27.11.2026, siehe [Systemabnahmetestprotokoll](../testing/System-Abnahmetestprotokoll.md). Foto-Upload und E-Mail-Einstellungen gesperrt; vorgesehene Isolationsprüfungen gemäss Anwenderbestätigung bestanden; kein unabhängiger Penetrationstest.

- [x] Automatische Builds gestoppt (Screenshot 27.11.2026).
- [x] Stand d2c2d1e am 27.11.2026 um 16:45 Uhr veröffentlicht (Netlify-Screenshot); interne Deployment-ID nicht erfasst.
- [x] Demo-Banner, Foto-Hinweis und Schadensmeldung ohne Foto nachgeprüft.
- [x] Vorgesehene Prüfungen externer Schnittstellen und Datenbanktrennung bestanden (Anwenderbestätigung 27.11.2026; finale Nachprüfung 7/7).
- [x] Finaler Demo-Reset durchgeführt und erwarteter Datenbestand gemäss Anwenderbestätigung am 27.11.2026 geprüft.
- [ ] Demo-Link, Repository-Link und Zugangsdaten über Moodle bereitstellen.
