# Pilotbetrieb – Issue #115

Termin: 28.11.2026. Status: Vorbereitung, keine Go-Live-Freigabe.

## Umgebungen

| Umgebung | Datenbank | Atlas-Benutzer |
|---|---|---|
| Produktion (main) | clubmatiq | clubmatiq_prod_user |
| Entwicklung | clubmatiq_dev | clubmatiq_dev_user |
| Lokale Integrationstests | clubmatiq_test | clubmatiq_test_user |
| Demo | clubmatiq_demo | clubmatiq_demo_user |

CI verwendet eine temporäre lokale MongoDB-Instanz. MONGODB_DB_NAME muss explizit gesetzt sein. MONGODB_TEST_URI bleibt für echte Integrationstests separat. Keine produktiven Geheimnisse in Preview-Deployments. Testdatenbereinigung ist für clubmatiq gesperrt. Produktive Journalindexänderungen erfordern --confirm-production.

## Freigabe
- [x] CI erfolgreich (Stand 3633ad09)
- [ ] Backup und Wiederherstellung geprüft
- [ ] Netlify Production und lokale Entwicklung getrennt konfiguriert
- [x] Lesende Zugriffsprüfung je Datenbank inklusive verweigerter Fremdzugriffe
- [ ] Alte Admin-Verbindung überall ersetzt und erst danach Benutzer entfernen
- [ ] Vereinsdaten, Bestände, Preise und Erstbezüge geprüft
- [ ] Generalprobe und Rückfalllösung verfügbar

## Live-Test
Ergebnisse erst nach tatsächlicher Durchführung erfassen: Verkäufe, Zahlungsarten, Übergaben, Bestandsänderungen, Fehler, Feedback und Kassenabgleich. Keine personenbezogenen Nachweise im Repository.

## Abnahmenachweis Datenbankumgebungen – 27.11.2026

Manuell lokal ausgeführt und durch die Entwicklerin bestätigt: Referenzschema exportiert; DEV und DEMO initialisiert; PROD, DEV und DEMO jeweils 28 Collections und 35 Indizes. Erneute DEMO-Initialisierung erfolgreich. Netlify-Variablen gespeichert, produktive Laufzeit noch nicht abgenommen.

| Benutzer | PROD | DEV | DEMO | TEST |
|---|---|---|---|---|
| PROD | erlaubt | verweigert | verweigert | verweigert |
| DEV | verweigert | erlaubt | verweigert | verweigert |
| DEMO | verweigert | verweigert | erlaubt | verweigert |
| TEST | verweigert | verweigert | verweigert | erlaubt |

16/16 Prüfungen mittels listCollections bestanden. Keine Schreibzugriffe getestet. Keine Zugangsdaten protokolliert. Backup, produktiver Smoke-Test und Entfernung des alten Administrators bleiben offen.

## Produktive Abnahme – 27.11.2026

Netlify Production: main@cce1443 veröffentlicht, Auto Publishing Locked aktiv (Screenshot). Manuelle Ergebnisse durch Entwicklerin bestätigt.

| Test | Prüfung | Ergebnis |
|---|---|---|
| ST-115-01 | Startseite erreichbar | Bestanden |
| ST-115-02 | Turnverein Weiningen registrieren | Bestanden |
| ST-115-03 | Abmelden und erneut anmelden | Bestanden |
| ST-115-04 | Administration öffnen | Bestanden |
| ST-115-05 | Kategorie erstellen | Bestanden |
| ST-115-06 | Lagerort erstellen | Bestanden |
| ST-115-07 | Speicherung in clubmatiq kontrollieren | Bestanden |
| ST-115-08 | Keine entsprechenden Daten in DEV und DEMO | Bestanden |
| ST-115-09 | E-Mail-Testversand | Ausstehend – Konfiguration erneut erforderlich |

8/9 bestanden, 1 ausstehend. Backup/Wiederherstellung, Ablösung des alten Atlas-Administrators und Pilotbetrieb bleiben offen.

## Backup-Abnahme – 27.11.2026

MongoDB Database Tools 100.20.1 installiert. DEV-Backup um 01:23:33 MEZ und PROD-Backup um 01:23:54 MEZ erfolgreich laut lokaler Konsolenausgabe. Archive ausserhalb des Repositorys gespeichert. Verschlüsselung und Wiederherstellung noch nicht nachgewiesen. Vor und nach der Kleiderbörse erneut sichern; Schreibvorgänge während der Sicherung pausieren.

### Wiederherstellungsprüfung

- Nicht leere Restore-Datenbank: erwarteter Abbruch vor mongorestore, bestanden.
- Isolierter Restore des DEV-Archivs vom 27.11.2026, 01:23:33 MEZ: erfolgreich.
- 28 Collections und 35 Indizes laut Konsolenausgabe wiederhergestellt; Anzahl entspricht dem bekannten Schema.
- Alle Collections enthielten 0 Dokumente. Wiederherstellung von Dokumentinhalten und exakte Indexdefinitionen noch nicht nachgewiesen.
- Verschlüsselte Ablage weiterhin offen.

- Zweiter DEV-Restore (Backup 01:33:40 MEZ): 28 Collections, 9 Dokumente, 36 Indizes erfolgreich wiederhergestellt. Exakter Vergleich noch ausstehend.

- Automatisierter Vergleich mit scripts/verify-restore.mjs: alle 28 Collections mit inhalte=true und indizes=true; 9 Dokumente und 36 Indizes. DEV-Restore-Abnahme bestanden. Kein produktiver Restore durchgeführt. Verschlüsselte Ablage weiterhin offen.

### Verschlüsselter Backup-Test

- Windows-Tool-Erkennung: DEV-Backup um 01:36:45 MEZ erfolgreich.
- AES-256-GCM DEV-Backup vom 27.11.2026, 11:41:15 MEZ erfolgreich wiederhergestellt.
- Automatisierter Datenvergleich: 28 Collections, 9 Dokumente, 36 Indizes; alle Inhalte und Indexdefinitionen stimmen überein.
- BitLocker-Status mangels Administratorrechten nicht überprüfbar. DEV-Testschlüssel nicht für PROD verwenden.
- PROD-Verschlüsselung, sichere Schlüsselablage und CI-Sicherheitstests noch offen.

- Lokale Unit-Tests zur Backup-Kryptografie laut Rückmeldung erfolgreich: Roundtrip, falscher Schlüssel, manipulierte Daten und Authentifizierungstag, abgeschnittenes Archiv, unterschiedliche Nonces. CI und produktive verschlüsselte Sicherung noch ausstehend.

- Verschlüsseltes PROD-Backup am 27.11.2026 laut Anwenderbestätigung erstellt.
- JSDoc-Typisierung korrigiert; lokale Prüfung und CI laut Anwenderbestätigung erfolgreich (Commit a148e20).
- Offline-Archivprüfung PROD und sichere Schlüsselablage noch nicht bestätigt. Kein vollständiger PROD-Restore durchgeführt.

- PROD-Offline-Archivprüfung bestanden: `clubmatiq_2026-11-27T10-46-12-010Z.archive.gz.enc` (27.11.2026, 11:46:12 MEZ). AES-GCM-Authentifizierung und GZIP-Integrität erfolgreich. Kein produktiver Restore durchgeführt. Sichere Schlüsselablage weiterhin separat zu bestätigen.

- Lokale Backup-Bereinigung bestätigt: drei unverschlüsselte DEV-Archive und ein unverschlüsseltes PROD-Archiv entfernt. Verbleibend: verschlüsseltes DEV-Archiv (2980 Bytes) und PROD-Archiv (2750 Bytes). Keine forensisch sichere Löschung nachgewiesen. Sichere separate Schlüsselaufbewahrung noch zu bestätigen.

### Ergänzende Pilotabnahme – 27.11.2026

- ST-115-09 – Microsoft-365-Testversand: Bestanden. Screenshot bestätigt Eingang der Test-E-Mail «ClubMatiq – Microsoft-365-Testversand» beim Empfänger Kasse TVW.
- Separate sichere Aufbewahrung der DEV- und PROD-Backup-Schlüssel inklusive geschützter PROD-Ersatzkopie durch Anwenderin bestätigt.
- PR #123 erfolgreich in main gemergt (d09a234); finale PR-CI: 5 erfolgreich, 3 übersprungen, 0 fehlgeschlagen.


## Produktive Abnahme v0.9.2 – 27.11.2026

Release: [v0.9.2](https://github.com/JenSusann/ClubMatiq/releases/tag/v0.9.2), Merge-Commit `0fa4d3943d222d8bb489c448278b8b1fd5dac568`, PR #131. PR-CI 46014689417, Main-CI 46015038832 und Tag-CI 46015282887 erfolgreich.

| Prüfung | Ergebnis |
|---|---|
| Footer zeigt v0.9.2 | Bestanden |
| Anmeldung beim Turnverein Weiningen | Bestanden |
| Bestehende Mitglieder und Artikel vorhanden | Bestanden |
| Kombinierbare Erstbezugsrabatte auswählbar | Bestanden |
| Gwändli und Hosen mit korrektem Gesamtpreis | Bestanden |
| Massenbearbeitung der Verkaufspreise verfügbar | Bestanden |
| Navigation bei neuer Artikelanlage korrekt | Bestanden |

Einzelbestätigung: 7/7 bestanden. Manuelle DEV-Abnahme #130: 13/13 bestanden. Produktive Kurzabnahme bestätigt die genannten Funktionen, nicht sämtliche Stornierungsvarianten. Bestehende Sperren für bezahlte Verkäufe ohne Beleg, rabattierte Teilrechnungen und zusätzliche manuelle Rabatte bei Stornierungen bleiben bestehen. Der eigentliche Pilotverkauf (#115) steht noch aus.
