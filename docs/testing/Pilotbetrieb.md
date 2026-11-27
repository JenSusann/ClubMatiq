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
