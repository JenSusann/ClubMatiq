# ClubMatiq – System- und Abnahmetestprotokoll

ZHAW · Prototyping HS2026 · Laufende Dokumentation

## 1. Ziel und Methodik

Manuelle funktionale Systemtests ergänzen die automatisierten Unit- und Integrationstests und dienen der Abnahme der GitHub-Issues. Usability-Tests mit unabhängigen Testpersonen werden separat dokumentiert.

Test-ID: ST-[Issue]-[Nummer]. Status: Offen, Bestanden, Fehler, Blockiert, Erneut bestanden. Sammelbestätigungen werden von einzeln belegten Ergebnissen und rekonstruierten Testfällen unterschieden.

## Automatisierter Testnachweis – Issue #38 (26.11.2026)

Separater Nachweis, nicht Bestandteil der manuellen Abnahmequote.

[Erfolgreicher CI-Lauf 45735645776](https://github.com/JenSusann/ClubMatiq/actions/runs/45735645776), [Commit 2767612](https://github.com/JenSusann/ClubMatiq/commit/27676128d882fe431967ece1eca8dd3aa92d143b), Version 0.9.0.

| Testart | Dateien | Bestanden | Fehlgeschlagen |
|---|---:|---:|---:|
| Unit | 59 | 2'423 | 0 |
| Integration | 100 | 2'590 | 0 |
| Gesamt | 159 | 5'013 | 0 |

| Kombinierte Coverage | Ergebnis | Ziel |
|---|---:|---:|
| Statements | 98,22 % | ≥ 95 % |
| Branches | 95,05 % | ≥ 95 % |
| Functions | 96,42 % | ≥ 95 % |
| Lines | 98,94 % | ≥ 95 % |

Quality Gate bestanden. Nachweis anhand der CI-Ausgabe und des erfolgreichen Workflow-Status. Ausführung lokal mit `npm run test:all`; kombinierter Bericht unter `coverage/combined/`. Details und Messumfang: [README, Kapitel 9.4](../../README.md#94-code-coverage-und-qualitätsziel). Keine zusätzliche manuelle Abnahme oder vollständige UI-Abdeckung daraus ableitbar.

## 2. Bisherige Abnahmen

| Issue | Bereich | Bestanden | Nachweis |
|---|---|---:|---|
| #14 | Session-Verwaltung | 8/8 | Original-Screenshot |
| #15 | Benutzerverwaltung | 21/21 | Erneute manuelle Abnahme, Einzelbestätigung 25.11.2026 |
| #16 | Rollenbasierte Berechtigungen | 10/10 | Original-Screenshot |
| #21 | Inventur | 9/9 | Sammelbestätigung laut bisherigem Protokoll |
| #22 | Bestandskonsistenz | 10/10 | Screenshot |
| #71 | ClubDesk-Gruppenzuordnung und Riegenverwaltung | 20/20 | Screenshot und Einzelbestätigung 25.11.2026 |
| #34 | Vereinskleider und Erstbezüge | 20/20 | Einzelbestätigung 25.11.2026 |
| #35 | Inventarbewertung (Teilabnahme) | 27/27 | Einzelbestätigung, Stichtagsfilter und Netlify-Funktionstest |
| #36 | Schadensmeldungen und Bearbeitungshistorie | 8/8 | Manuelle Sammelbestätigung 26.11.2026 |
| #37 | Materialsuche, Filter und Weiterleitung | 11/11 | Manuelle Sammelbestätigung 26.11.2026 |
| #44 | Materialausleihe und Rückgabe | 18/18 | Nach Korrektur ffbed03 |
| #39 | Benutzerfeedback und Datenaktualisierung | 26/26 | Sammelbestätigung nach Korrektur |
| #46 | Lieferantenverwaltung und Sammelbestellungen | 16/16 | Einzelbestätigung 26.11.2026 |
| #47 | Bestell-PDF inkl. #116/#117 | 20/20 | Nachprüfung 26.11.2026 |
| #48 | Stornierungen und Gutschriften inkl. #118 | 20/20 | Nachprüfung 26.11.2026 |
| #49 | Verkaufshistorie inkl. #119 | 38/38 | Nachprüfung 26.11.2026 |
| #32 | Admin-Dashboard | 10/10 | Sammelbestätigung 26.11.2026 |
| #62 | Manuelle Benutzeranlage | 20/20 | Sammelbestätigung 26.11.2026 |
| #64 | Benutzerlöschung und Einladungswiderruf | 15/15 | Einzelbestätigung 26.11.2026 |
| #68 | Offene Preise und gemischte Teilzahlungen | 25/25 | Einzelbestätigung 26.11.2026 |
| Gesamt | Quantifizierte manuelle Prüfungen | 352/352 | Dokumentierte Durchläufe |

Die Übersicht übernimmt die bisherige Chat-Dokumentation; fehlende Originalprotokolle und genaue Testdaten sind nachzutragen. Die Quote bezieht sich nicht auf die gesamte Anwendung.

### Issue #14 – Session-Verwaltung

Nachweis: Original-Screenshot der manuellen Session-Abnahme, 8/8 bestanden.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-14-01 | Anmeldung | Erneut anmelden | Dashboard erscheint | Bestanden |
| ST-14-02 | Inaktivitätswarnung | 90 Sekunden nichts machen | Warnungsdialog erscheint | Bestanden |
| ST-14-03 | Countdown | Countdown im Warnungsdialog beobachten | Countdown läuft von 30 Sekunden herunter | Bestanden |
| ST-14-04 | Session verlängern | «Angemeldet bleiben» anklicken | Dialog verschwindet | Bestanden |
| ST-14-05 | Automatische Abmeldung | Zwei Minuten inaktiv bleiben und Warnung ignorieren | Automatische Abmeldung | Bestanden |
| ST-14-06 | Mehrere Tabs | In einem Tab aktiv bleiben | Zweiter Tab berücksichtigt die Aktivität | Bestanden |
| ST-14-07 | Maximale Sitzungsdauer | Fünf Minuten aktiv bleiben | Trotzdem erfolgt die Abmeldung | Bestanden |
| ST-14-08 | Erneute Anmeldung | Nach automatischer Abmeldung wieder anmelden | Anmeldung erfolgreich | Bestanden |

Abnahme: 8/8 bestanden. Zeitgrenzen entsprechen der getesteten Konfiguration.

### Issue #15 – Benutzerverwaltung

- Testdatum: 25.11.2026
- Testart: Erneute manuelle funktionale Abnahme im Browser
- Nachweis: Rückmeldung der Testperson mit allen 21 einzeln bestätigten Testfällen
- Testumgebung und getesteter Commit: nicht separat angegeben
- Historische Browser-Abnahme: bereits bestätigt; ursprüngliche Einzeltestliste nicht verfügbar und nicht zusätzlich gezählt.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-15-01 | Benutzerübersicht | Als Administrator die Benutzerverwaltung öffnen. | Alle Benutzer des eigenen Vereins werden übersichtlich angezeigt. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-02 | Benutzerdaten bearbeiten | Vorname, Nachname und E-Mail-Adresse eines Testbenutzers ändern und speichern. | Änderungen werden erfolgreich übernommen. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-03 | Dauerhafte Speicherung | Nach der Bearbeitung die Seite neu laden. | Die geänderten Benutzerdaten bleiben erhalten. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-04 | Ungültige E-Mail-Adresse | Eine ungültige E-Mail-Adresse eingeben und speichern. | Speicherung wird verhindert und eine Fehlermeldung erscheint. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-05 | Doppelte E-Mail-Adresse | Einem Benutzer die E-Mail-Adresse eines bereits vorhandenen Kontos zuweisen. | Änderung wird abgewiesen. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-06 | Rollenänderung | Die Rolle eines Testbenutzers ändern und speichern. | Die neue Rolle wird korrekt angezeigt und gespeichert. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-07 | Session bei Rollenänderung | Testbenutzer in einem zweiten Browser anmelden. Anschliessend als Administrator dessen Rolle ändern. | Die bestehende Session des Testbenutzers wird ungültig. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-08 | Benutzer deaktivieren – Abbrechen | Deaktivierung eines Testbenutzers auslösen und den Dialog abbrechen. | ClubMatiq-interner Bestätigungsdialog erscheint. Benutzer bleibt aktiv. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-09 | Benutzer deaktivieren – Bestätigen | Deaktivierung erneut auslösen und bestätigen. | Benutzer wird deaktiviert, das Konto bleibt erhalten. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-10 | Session bei Deaktivierung | Einen angemeldeten Testbenutzer deaktivieren und im zweiten Browser eine geschützte Seite aufrufen. | Bestehende Session wird ungültig. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-11 | Anmeldung deaktivierter Benutzer | Mit einem deaktivierten Benutzer eine neue Anmeldung versuchen. | Anmeldung wird verhindert. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-12 | Benutzer reaktivieren – Abbrechen | Reaktivierung auslösen und den Bestätigungsdialog abbrechen. | Benutzer bleibt deaktiviert. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-13 | Benutzer reaktivieren – Bestätigen | Reaktivierung bestätigen und mit dem Testbenutzer anmelden. | Benutzer ist wieder aktiv und kann sich anmelden. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-14 | Selbstdeaktivierung | Als Administrator versuchen, das eigene Konto zu deaktivieren. | Aktion wird verhindert oder steht nicht zur Verfügung. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-15 | Eigene Administratorrolle | Versuchen, die eigene Administratorrolle zu entfernen. | Änderung wird verhindert. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-16 | Letzter aktiver Administrator | In einem separaten Testverein mit nur einem aktiven Administrator versuchen, diesen zu deaktivieren oder herabzustufen. | Mindestens ein aktiver Administrator bleibt erhalten. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-17 | Unberechtigter Zugriff | Als Mitglied oder Leiter/in die Benutzerverwaltung direkt über die URL aufrufen. | Zugriff wird verweigert. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-18 | Benutzer löschen – Abbrechen | Löschung eines entbehrlichen Testkontos auslösen und abbrechen. | Interner Bestätigungsdialog erscheint. Konto bleibt erhalten. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-19 | Benutzer löschen – Bestätigen | Löschung des entbehrlichen Testkontos bestätigen. | Konto wird gelöscht und erscheint nicht mehr in der Übersicht. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-20 | Einladung widerrufen – Abbrechen | Widerruf einer offenen Einladung auslösen und abbrechen. | Interner Bestätigungsdialog erscheint. Einladung bleibt bestehen. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |
| ST-15-21 | Einladung widerrufen – Bestätigen | Widerruf der offenen Testeinladung bestätigen. | Einladung ist nicht mehr gültig. | Bestanden – Erwartung gemäss Rückmeldung erfüllt |

**Auswertung:** 21/21 bestanden, 0 fehlgeschlagen, 0 blockiert, 0 offen. Keine Bemerkungen oder Abweichungen gemeldet. Keine Fehlerkorrektur oder weitere Nachprüfung aufgrund dieses Durchlaufs erforderlich.

**Automatisierte Begleitnachweise:** Laut [Issue #15](https://github.com/JenSusann/ClubMatiq/issues/15) sind 41 relevante automatisierte Tests (21 Unit, 20 Integration) dokumentiert. Diese wurden nicht im Rahmen dieser manuellen Nachprüfung erneut ausgeführt oder unabhängig verifiziert. Vereinsübergreifende API-Zugriffe und Passwort-Hash-Ausschluss sind automatisierte Nachweise, keine zusätzlichen manuellen Tests. Gleichzeitige Administratoränderungen und atomare Kopplung von Rollenänderung und Session-Invalidierung bleiben gesondert nicht nachgewiesen.

**Abnahmeentscheidung:** Erneute manuelle Abnahme erfolgreich; bestehender Completed-Status bleibt bestehen.

### Issue #16 – Rollenbasierte Berechtigungen

Nachweis: Original-Screenshot der manuellen Abnahme, 10/10 bestanden.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-16-01 | Administrator | Als Administrator vorgesehene Module aufrufen | Alle vorgesehenen Module zugänglich | Bestanden |
| ST-16-02 | Materialverantwortliche | Inventar bearbeiten und Vereinskleider verwalten | Beide Funktionen möglich | Bestanden |
| ST-16-03 | Materialverantwortliche | Benutzerverwaltung aufrufen | Benutzerverwaltung nicht zugänglich | Bestanden |
| ST-16-04 | Leiter/in | Ausleihen und Rückgaben durchführen | Beide Funktionen möglich | Bestanden |
| ST-16-05 | Leiter/in | Inventar bearbeiten versuchen | Bearbeitung nicht möglich | Bestanden |
| ST-16-06 | Mitglied | Inventar lesen und bearbeiten versuchen | Lesen möglich, Bearbeiten nicht | Bestanden |
| ST-16-07 | Direkter Seitenzugriff | Geschützte Funktionen über direkte URL aufrufen und Zugriff kontrollieren | Zugriff entsprechend Berechtigungen beschränkt | Bestanden |
| ST-16-08 | Rollenänderung | Administrator ändert Rolle eines angemeldeten Testbenutzers | Dessen Session wird ungültig | Bestanden |
| ST-16-09 | Erneute Anmeldung | Nach Rollenänderung erneut anmelden | Neue Berechtigungen gelten | Bestanden |
| ST-16-10 | Rollenvorschau | Administrator wechselt Rollenansicht | Tatsächliche Rolle bleibt unverändert | Bestanden |

Abnahme: 10/10 bestanden. Unit- und Integrationstests ebenfalls erfolgreich gemeldet.

### Issue #21 – PDF-Inventurbericht

Quelle: [Testabschluss im Issue #21](https://github.com/JenSusann/ClubMatiq/issues/21), 25.11.2026. Aufgaben und Erwartungen redaktionell aus den bestätigten Prüfgegenständen rekonstruiert. Einzelnummern ausser ST-21-05 nicht gesichert.

| Prüfgegenstand | Aufgabe | Erwartung | Ergebnis gemäss Sammelbestätigung |
|---|---|---|---|
| PDF-Download | Inventurbericht herunterladen | PDF wird bereitgestellt | Bestanden |
| PDF öffnen | Bericht öffnen | PDF ist lesbar | Bestanden |
| Stammdaten | Stammdaten im Bericht vergleichen | Angaben stimmen überein | Bestanden |
| Mengen | Soll-, Ist- und Differenzmengen vergleichen | Mengen stimmen überein | Bestanden |
| ST-21-05 – Grössen | Bericht mit Kleidungsgrössen prüfen | Bezeichnungen statt MongoDB-IDs | Erneut bestanden |
| Korrekturprotokoll | Bericht nach Korrektur prüfen | Korrekturen nachvollziehbar | Bestanden |
| Stornierung | Bericht einer stornierten Inventur prüfen | Stornierung dargestellt | Bestanden |
| Layout | PDF visuell kontrollieren | Inhalte lesbar | Bestanden |
| Wiederholter Export | Bericht erneut exportieren | Export funktioniert erneut | Bestanden |

Fehler: Grössen-IDs statt Bezeichnungen. Vereinsbezogene Grössenauflösung korrigiert, auch im Korrekturprotokoll. Vier manuelle Nachprüfungen erfolgreich bestätigt. Zwei parametrisierte Regressionstestfälle ergänzt. Bestehende Unit- und Integrationstests erfolgreich gemeldet. Commits: 04f2ab3, 31e7750, 3d0771b. Abnahme: 9/9 bestanden.

### Issue #22 – Bestandskonsistenz

Quelle: [Testabschluss im Issue #22](https://github.com/JenSusann/ClubMatiq/issues/22), 25.11.2026. Testfallnamen und Ergebnisse bestätigt; Aufgaben und Erwartungen ab ST-22-04 rekonstruiert.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-22-01 | Inventurabschluss | Soll 10, Ist 8 erfassen und abschliessen | Bestand 8 | Bestanden |
| ST-22-02 | Doppelter Inventurabschluss | Dieselbe Inventur erneut abschliessen | Keine zweite Bestandsbuchung | Bestanden |
| ST-22-03 | Nachträgliche Korrektur | Abgeschlossene Inventur von 8 auf 9 korrigieren | Bestand 9, Korrektur protokolliert | Bestanden |
| ST-22-04 | Versionskonflikt | Konkurrierende Änderungen einer Inventurposition in zwei Tabs speichern | Veraltete Änderung überschreibt aktuellen Stand nicht | Bestanden |
| ST-22-05 | Gleichzeitige Ausleihe | Ausleihe bei begrenztem Bestand in zwei Tabs auslösen | Kein unzulässiger negativer Bestand | Bestanden |
| ST-22-06 | Doppelte Rückgabe | Dieselbe Rückgabe mehrfach auslösen | Keine doppelte Bestandsgutschrift | Bestanden |
| ST-22-07 | Gleichzeitiger Verkauf | Verkauf bei begrenztem Bestand in zwei Tabs auslösen | Kein unzulässiger Lagerabgang | Bestanden |
| ST-22-08 | Doppelte Stornierung | Dieselbe Stornierung mehrfach auslösen | Keine doppelte Verarbeitung | Bestanden |
| ST-22-09 | Inventurstornierung | Abgeschlossene Inventur stornieren | Bestandskorrektur gemäss Stornierungslogik | Bestanden |
| ST-22-10 | Erneute Inventurstornierung | Stornierte Inventur erneut stornieren | Keine erneute Bestandskorrektur | Bestanden |

Abnahme: 10/10 bestanden. Zusätzlich 10 Unit- und 4 Integrationstests dokumentiert. Keine produktive Codeänderung erforderlich. Zwei-Tab-Szenarien sind keine echten Lasttests; Rollback wurde automatisiert geprüft.

### Issue #71 – ClubDesk-Gruppenzuordnung und Riegenverwaltung

- Nachweis: Screenshot der manuellen Abnahme, eingereicht am 25.11.2026.
- Testbereich: Stammdaten → Mitglieder.
- Voraussetzungen: Importierte ClubDesk-Gruppen und konfigurierte Riegenzuordnungen.
- Testumgebung, genauer Durchführungszeitpunkt und getesteter Commit: nicht separat angegeben.
- Testfallnamen und Ergebnisse gemäss Screenshot; Aufgaben und Erwartungen redaktionell konkretisiert.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-71-01 | Mitgliederübersicht | Stammdaten → Mitglieder öffnen | Mitgliederübersicht öffnet sich fehlerfrei | Bestanden |
| ST-71-02 | ClubDesk-Gruppen | Importierte Mitglieder mit Gruppenzugehörigkeiten ansehen | Importierte ClubDesk-Gruppen werden angezeigt | Bestanden |
| ST-71-03 | Gruppenfunktionen | Funktionen innerhalb der importierten Gruppen kontrollieren | Funktionen innerhalb der Gruppen sind sichtbar | Bestanden |
| ST-71-04 | Riegenzuordnung | Mitglieder mit zugeordneten Riegen kontrollieren | Zugeordnete Riegen werden angezeigt | Bestanden |
| ST-71-05 | Mehrfachmitgliedschaften | Mitglied mit mehreren Zugehörigkeiten ansehen | Mehrfachmitgliedschaften werden korrekt angezeigt | Bestanden |
| ST-71-06 | Riegenfilter | Nach einer Riege filtern | Filter nach Riege funktioniert | Bestanden |
| ST-71-07 | JUKO-Filter | Filter JUKO auswählen | Filter nach JUKO funktioniert | Bestanden |
| ST-71-08 | Aktivriegenfilter | Filter Aktivriege auswählen | Filter nach Aktivriege funktioniert | Bestanden |
| ST-71-09 | Nicht zugeordnet | Filter «Nicht zugeordnet» auswählen | Filter «Nicht zugeordnet» funktioniert | Bestanden |
| ST-71-10 | Aktualisierte Gruppenzuordnung | Gruppenzuordnung ändern und Mitgliederübersicht aktualisieren | Geänderte Gruppenzuordnung wird nach Aktualisierung angezeigt | Bestanden |

**Teilabnahme 1:** 10/10 bestanden, 0 fehlgeschlagen, 0 blockiert.

#### Teilabnahme 2 – Rabattstammdaten und Verkauf

- Testdatum: 25.11.2026
- Nachweis: Einzelbestätigung aller zehn Testfälle durch die Entwicklerin im Chat; [GitHub-Abnahme](https://github.com/JenSusann/ClubMatiq/issues/71#issuecomment-7170658320).
- Testumgebung: lokale Browseranwendung; exakter getesteter Commit nicht separat protokolliert.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-71-11 | Dynamische Rabattstammdaten | Stammdaten → Rabatte öffnen | Selbst angelegte aktive Riegen werden angezeigt | Bestanden |
| ST-71-12 | Automatische Riegenauswahl | JUKO-Mitglied im Verkaufsformular auswählen | Zugeordnete Riegen werden automatisch markiert | Bestanden |
| ST-71-13 | Mehrfachmitgliedschaft | Mitglied mit mehreren Riegen auswählen | Alle zugeordneten Riegen werden markiert | Bestanden |
| ST-71-14 | Mitglied wechseln | Anderes Mitglied auswählen | Vorherige Riegen und Rabatte werden zurückgesetzt | Bestanden |
| ST-71-15 | Berechtigter Erstbezug | JUKO-Mitglied auswählen und Erstbezug aktivieren | Passende Rabattregel ist verfügbar | Bestanden |
| ST-71-16 | Unberechtigter Erstbezug | Aktivmitglied auswählen | JUKO-Erstbezugsrabatt ist nicht verfügbar | Bestanden |
| ST-71-17 | Mitglied ohne Riege | Mitglied ohne Zuordnung auswählen | Entsprechender Hinweis erscheint | Bestanden |
| ST-71-18 | Deaktivierte Riege | Riege deaktivieren | Bei neuen Verkäufen nicht mehr auswählbar | Bestanden |
| ST-71-19 | Materialverantwortliche | Mitgliedersuche im Verkauf und Mitgliederverwaltung prüfen | Suche funktioniert, Mitgliederverwaltung bleibt gesperrt | Bestanden |
| ST-71-20 | Manueller Verkauf | Käufer ohne ClubDesk-Mitgliedschaft eingeben und Riege manuell auswählen | Normaler Verkauf funktioniert | Bestanden |

**Fehler und Korrekturen:** Die Deklarationsreihenfolge im Rabattformular verursachte zwei TypeScript-Fehler (Korrektur: 9199584). Die Bedienung des einmaligen Bezugs wurde durch automatische Vorkonfiguration und Validierungshinweise verbessert (03fedd9). Gemeinsame Erstbezugsansprüche werden über eine verständliche Auswahl statt eines technischen Schlüssels konfiguriert (ae5ebcd).

**Automatisierte Prüfungen:** Erfolgreiche lokale Prüfungen durch die Entwicklerin bestätigt, zuletzt auch nach der Formularänderung. Erwarteter Gesamtumfang gemäss vorherigem Teststand: 2’561 Tests in 100 Dateien; kein separater abschliessender Konsolenauszug vorgelegt. Neue Tests umfassen Riegenzuordnung, CSV-Duplikate, serverseitige Erstbezugsberechtigung und eingeschränkte Mitgliedersuche. Datenbankzugriffe in den neuen Integrationstests sind simuliert.

**Auswertung und Abnahmeentscheidung:** Beide manuellen Durchläufe zusammen 20/20 bestanden, 0 fehlgeschlagen, 0 blockiert. Die dokumentierte funktionale Abnahme ist erfolgreich. Nicht separat belegte Randfälle, reale Parallelzugriffe und unabhängige Usability-Tests sind dadurch nicht nachgewiesen.

### Issue #34 – Vereinskleiderverwaltung und Erstbezüge

Testdatum: 25.11.2026. Einzelbestätigung durch die Entwicklerin; genauer Commit nicht separat angegeben.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-34-01 | Kostenloses T-Shirt | JUKO-Mitglied und Erstbezug auswählen | CHF 0.00 | Bestanden |
| ST-34-02 | Lagerbestand | Kostenloses T-Shirt direkt übergeben | Bestand minus ein Stück | Bestanden |
| ST-34-03 | Kostenlose Verrechnung | Verrechnung öffnen | Keine offene CHF-0-Rechnung | Bestanden |
| ST-34-04 | Gwändli-Erstbezug | Gwändli für dasselbe Mitglied bestellen | CHF 50.00 | Bestanden |
| ST-34-05 | Rechnungsstellung | Gwändli-Rechnung erstellen | CHF 50.00 | Bestanden |
| ST-34-06 | Erneuter T-Shirt-Bezug | Erneut T-Shirt verkaufen | Normalpreis, kein Erstbezugsrabatt | Bestanden |
| ST-34-07 | Artikelvarianten | Alternative mit gemeinsamem Anspruch wählen | Kein erneuter Erstbezug | Bestanden |
| ST-34-08 | Verkaufshistorie | Erstbezüge kontrollieren | Mitglied, Preis und Vergünstigung nachvollziehbar | Bestanden |
| ST-34-09 | Mehrere Stück | Zwei T-Shirts für neues berechtigtes Mitglied verkaufen | Ein Stück kostenlos, eines zum Normalpreis | Bestanden |
| ST-34-10 | Stornierung | Nicht übergebenen und unverrechneten Erstbezug vollständig stornieren | Anspruch wieder verfügbar | Bestanden |

| ST-34-11 | Unverrechnete Teilstornierung | Zwei T-Shirts, eines kostenlos; ein Stück stornieren | Rest CHF 0; Anspruch bleibt | Bestanden |
| ST-34-12 | Letztes Stück | Reststück stornieren | Anspruch erneut verfügbar | Bestanden |
| ST-34-13 | Verrechnete Teilstornierung | Zwei Gwändli à CHF 80, Erstbezug CHF 50; eines stornieren | Gutschrift CHF 80; Rest CHF 50 | Bestanden |
| ST-34-14 | Zweite Gutschrift | Restliches Gwändli stornieren | Gutschrift CHF 50; Anspruch frei | Bestanden |
| ST-34-15 | Gutschriften-PDF | Beide Gutschriften öffnen | Preise, Rabatte und Endbeträge korrekt | Bestanden |
| ST-34-16 | Vollzahlung | CHF 130 bezahlt; beide Stücke stornieren | Rückerstattung insgesamt CHF 130 | Bestanden |
| ST-34-17 | Teilzahlung | CHF 70 bezahlt; beide Stücke stornieren | Rückerstattung insgesamt CHF 70 | Bestanden |
| ST-34-18 | Kostenloses Reststück | Verrechnete Bestellung mit kostenlosem Reststück stornieren | Keine CHF-0-Gutschrift | Bestanden |
| ST-34-19 | Bereits übergeben | Rabattiertes Stück übergeben; anderes stornieren | Anspruch bleibt | Bestanden |
| ST-34-20 | Stornierungshistorie | Historie kontrollieren | Mengen, Gründe, Datum und Person korrekt | Bestanden |

**Auswertung:** 20/20 bestanden, 0 fehlgeschlagen, 0 blockiert; Einzelbestätigung vom 25.11.2026. `npm run check` und Vitest lokal ohne Fehler bestätigt; erwarteter Umfang 2’584 Tests, kein abschliessender Konsolenauszug. Teststand: `dd14731`. Integrationstests mit simulierten Datenbankzugriffen; keine echte Parallelitätsprüfung. Rückerstattungen werden vorgemerkt, nicht automatisch ausgezahlt. Rabattierte Verkäufe mit mehreren Teilrechnungen bleiben geschützt.

### Issue #35 – Inventarbewertung für die Buchhaltung

Nachweis: manuelle Browser-Abnahme mit einzeln markierten Ergebnissen im Chat; Screenshot zum Fehler ST-35-04 und Sammelbestätigung aller sieben Nachprüfungen. Exakter Testzeitpunkt und getesteter Commit nicht separat angegeben.

| ID | Testfall | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|---|
| ST-35-01 | Einzelwert erfassen | 10 Stück à CHF 25 | CHF 250 | Bestanden |
| ST-35-02 | Grössenbewertung | 5 Stück à CHF 20 und 3 à CHF 30 | CHF 190 | Bestanden |
| ST-35-03 | Gesamtwert | Positionen summieren | Total stimmt | Bestanden |
| ST-35-04 | Fehlende Preise | Artikel ohne Einzelwert erfassen | Preis fehlt | Zunächst Fehler; erneut bestanden gemäss Nachprüfung |
| ST-35-05 | Nullpreis | CHF 0 erfassen | Preis vorhanden | Bestanden |
| ST-35-06 | Filter | Suche, Kategorie, Lagerort, fehlende Preise prüfen | Filter korrekt | Bestanden |
| ST-35-07 | Aktueller CSV-Export | CSV öffnen | Mengen, Preise, Filter und Datum korrekt | Bestanden |
| ST-35-08 | Bewertungsaufnahme | Aktuellen Stand speichern | Aufnahme auswählbar | Bestanden |
| ST-35-09 | Historischer Bestand | Bestand ändern | Alter Bestand bleibt | Bestanden |
| ST-35-10 | Historischer Einzelwert | Preis ändern | Alter Preis bleibt | Bestanden |
| ST-35-11 | Mehrere Aufnahmen | Weitere Aufnahme erstellen und wechseln | Beide abrufbar | Bestanden |
| ST-35-12 | Dauerhafte Speicherung | Seite neu laden | Aufnahmen bleiben | Bestanden |
| ST-35-13 | Historischer CSV | Alte Aufnahme exportieren | Ursprüngliche Werte und Datum | Bestanden |
| ST-35-14 | Berechtigungen | Als Mitglied Aufnahmen prüfen | Kein Erstellen oder Abrufen | Bestanden |

#### Fehlerkorrektur und Nachprüfung

ST-35-04: Die Erfassungsmaske setzte fehlende Einzelwerte automatisch auf CHF 0.00. POST/PATCH akzeptierten keine expliziten Nullwerte. Korrektur in Artikel-APIs und Erfassungs-, Bearbeitungs- und Detailansicht (2492546, 69aa3b2, eb3a44a, 1cb15bb, f5e53c1). Bestehende Nullpreise und gespeicherte Aufnahmen bleiben unverändert.

| ID | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|
| ST-35-04a | Artikel ohne Einzelwert erstellen | Preis fehlt | Bestanden |
| ST-35-04b | Artikel mit CHF 0 erstellen | Nullpreis vorhanden | Bestanden |
| ST-35-04c | Grössen mit unterschiedlichen und fehlenden Preisen erstellen | Preise getrennt | Bestanden |
| ST-35-04d | Fehlenden Einzelwert nachtragen | Preis gespeichert | Bestanden |
| ST-35-04e | Einzelwert entfernen | Preis fehlt | Bestanden |
| ST-35-04f | Inventarbewertung und CSV kontrollieren | Fehlende Preise gekennzeichnet | Bestanden |
| ST-35-04g | Aufnahme mit fehlenden Preisen erstellen | Fehlende Preise erhalten | Bestanden |

**Auswertung:** Erstlauf 13/14 bestanden, ein Fehler. Nachprüfung 7/7 bestanden; ursprünglicher Fehler behoben. Final 21/21 dokumentierte Testfälle erfolgreich (14 ursprüngliche und 7 zusätzliche; kein zusätzlicher Zähler für den fehlgeschlagenen Erstversuch).

**Automatisierte Nachweise:** Drei neue MongoDB-Integrationstests (f97af77) ohne Fehler gemeldet. Weiterer Regressionstest für explizite Nullwerte (114f82b) ergänzt, Ausführung noch nicht bestätigt. Erwarteter Gesamtumfang 2’588 Tests; kein abschliessender Konsolenauszug. Direkte POST/PATCH-Regressionstests noch offen.

#### Nachprüfung Stichtagsfilter (26.11.2026)

Implementierung: Commit [5ab1618](https://github.com/JenSusann/ClubMatiq/commit/5ab1618a523ebb17740851f077e7db91f93311ac). Ergebnis gemäss Sammelbestätigung der Entwicklerin: alle fünf Fälle bestanden.

| ID | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|
| ST-35-15 | Datum mit vorhandener Aufnahme auswählen | Passende Aufnahmen erscheinen | Bestanden |
| ST-35-16 | Datum ohne Aufnahme auswählen | Entsprechender Hinweis erscheint | Bestanden |
| ST-35-17 | Datumsfilter entfernen | Alle Aufnahmen erscheinen | Bestanden |
| ST-35-18 | Historische Aufnahme exportieren | Ursprüngliche Bewertungsdaten bleiben erhalten | Bestanden |
| ST-35-19 | Bei aktivem Filter eine neue Aufnahme erstellen | Neue Aufnahme wird angezeigt | Bestanden |

#### Automatische Bewertungsaufnahme (26.11.2026)

| ID | Aufgabe | Erwartung | Ergebnis |
|---|---|---|---|
| ST-35-20 | Netlify-Funktion manuell auslösen und Bewertungsübersicht kontrollieren | Neue Aufnahme sichtbar | Bestanden gemäss Bestätigung der Entwicklerin |

Netlify erkannte den Zeitplan `55 21,22 * * *`; Screenshot zeigt einen Funktionsaufruf ohne sichtbaren Fehler. Die Entwicklerin bestätigt eine neue Aufnahme. Die Zuordnung zum konkreten Aufruf ist nicht unabhängig verifiziert; der Aufruf ausserhalb des vorgesehenen Schweizer Zeitfensters steht im Widerspruch zur Zeitprüfung im Code. Reguläre zeitgesteuerte Ausführung um 23:55 Uhr bleibt separat zu bestätigen.

Automatisierte Nachweise: lokaler TypeScript-Check und erweiterte Integrationstests erfolgreich gemäss Entwicklerin; [CI-Lauf 45736896601](https://github.com/JenSusann/ClubMatiq/actions/runs/45736896601) erfolgreich inklusive kombiniertem Quality Gate. Netlify-Deployment erfolgreich gemäss Entwicklerin.

**Gesamtergebnis #35:** 27/27 dokumentierte manuelle Testfälle gemäss Bestätigungen bestanden. Historische Auswertung nur für tatsächlich gespeicherte Aufnahmen; keine rückwirkende Rekonstruktion. Jahresendaufnahme geplant um 23:55 Uhr, nicht exakt Mitternacht. Regulärer Zeitlauf noch nicht nachgewiesen.

### Issue #36 – Schadensmeldungen und Materialbedarf

Testdatum: 26.11.2026. Manuelle Abnahme gemäss Sammelbestätigung der Entwicklerin. Implementierungscommits: 0d1447c, 59b5f58, aa12e58.

| ID | Testfall | Erwartung | Ergebnis |
|---|---|---|---|
| ST-36-01 | Schadensmeldung erstellen | Status Offen, Beschreibung und meldende Person korrekt | Bestanden |
| ST-36-02 | Status auf In Bearbeitung ändern und Notiz erfassen | Erster Historieneintrag vorhanden | Bestanden |
| ST-36-03 | Status auf Erledigt ändern | Zweiter Eintrag, erster bleibt erhalten | Bestanden |
| ST-36-04 | Nur Bearbeitungsnotiz ändern | Zusätzlicher Historieneintrag | Bestanden |
| ST-36-05 | Seite neu laden | Vollständige Historie bleibt erhalten | Bestanden |
| ST-36-06 | Statusfilter prüfen | Nur passende Meldungen erscheinen | Bestanden |
| ST-36-07 | Als Mitglied eigene Meldung öffnen | Historie sichtbar, Bearbeitung nicht möglich | Bestanden |
| ST-36-08 | Ältere Meldung ohne Historie bearbeiten | Neuer Historieneintrag wird korrekt angelegt | Bestanden |

**Manuelle Abnahme:** 8/8 bestanden. Unit- und Integrationstests für Schadensmeldungen gemäss Bestätigung der Entwicklerin am 26.11.2026 ohne Fehler. TypeScript-Check und alle 13 Integrationstests der erweiterten Testdatei mit echter MongoDB gemäss Bestätigung der Entwicklerin erfolgreich (Commit 1fad565). Die zwei zusätzlichen Tests prüfen Historienpersistenz, Vereinsisolation, Berechtigungen und parallele Änderungen ohne verlorene Einträge. Funktionale Abnahme abgeschlossen. Bereits überschriebene historische Schritte können nicht rekonstruiert werden.

### Issue #37 – Materialsuche mit Filtern und Lagerorten

Testdatum: 26.11.2026. Manuelle Sammelbestätigung der Entwicklerin. Implementierungscommits: e72bc6f, 9f78592.

| ID | Testfall | Erwartung | Ergebnis |
|---|---|---|---|
| ST-37-01 | Artikelsuche | Name, Kategorie, Lagerort und Lieferant durchsuchbar | Bestanden |
| ST-37-02 | Kategorienfilter | Nur passende Kategorie | Bestanden |
| ST-37-03 | Lagerortfilter | Nur passender Lagerort | Bestanden |
| ST-37-04 | Kombinierte Filter | Suchtext, Kategorie und Lagerort gemeinsam wirksam | Bestanden |
| ST-37-05 | Keine Treffer | Verständliche Leermeldung | Bestanden |
| ST-37-06 | Artikeldetails | Details aufklappbar und korrekt | Bestanden |
| ST-37-07 | Kennzahlen | Anzahl, Bestand und Wert entsprechen Filterung | Bestanden |
| ST-37-08 | Navigation | Kein doppelter Materialsuche-Eintrag | Bestanden |
| ST-37-09 | Weiterleitung | /materialsuche führt zu /inventar | Bestanden |
| ST-37-10 | Berechtigungen | Mitglied kann suchen, nicht unberechtigt bearbeiten | Bestanden |
| ST-37-11 | Mobile Ansicht | Filter bleiben bedienbar | Bestanden |

**Manuelle Abnahme:** 11/11 bestanden. TypeScript-Check und Unit-Tests einschliesslich der fünf zusätzlichen Tests zur Weiterleitung und Authentifizierung gemäss Bestätigung der Entwicklerin am 26.11.2026 ohne Fehler. Funktionale Abnahme abgeschlossen.

### Issue #44 – Materialausleihe und Rückgabe

Testdatum: 26.11.2026. Manuelle Sammelbestätigung der Entwicklerin.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-44-01 | Material ausleihen | Bestanden |
| ST-44-02 | Bestandsänderung 10 auf 7 | Bestanden |
| ST-44-03 | Ausleihübersicht | Bestanden |
| ST-44-04 | Ungültige Ausleihmenge | Bestanden |
| ST-44-05 | Ungültiges Rückgabedatum | Bestanden |
| ST-44-06 | Teilrückgabe | Bestanden |
| ST-44-07 | Zu hohe Rückgabemenge | Bestanden nach Korrektur |
| ST-44-08 | Vollständige Rückgabe | Bestanden |
| ST-44-09 | Ausleihstatus | Bestanden |
| ST-44-10 | Doppelte Rückgabe | Bestanden |
| ST-44-11 | Artikel mit Grössen | Bestanden |
| ST-44-12 | Berechtigungen | Bestanden |
| ST-44-13 | Vereinsisolation | Bestanden |
| ST-44-14 | Datenpersistenz | Bestanden |

Erstprüfung: 13/14 bestanden. ST-44-07: Validierung wirksam, Fehlermeldung jedoch hinter dem Rückgabedialog. Korrektur in `src/lib/AusleihenUebersicht.svelte`, Commit ffbed03.

| ID | Nachprüfung | Ergebnis |
|---|---|---|
| ST-44-07a | Fehlermeldung im Dialog sichtbar | Bestanden |
| ST-44-07b | Meldung verschwindet bei Mengenkorrektur | Bestanden |
| ST-44-07c | Gültige Rückgabe weiterhin möglich | Bestanden |
| ST-44-07d | Dialog erneut öffnen ohne alte Meldung | Bestanden |

**Manuelle Abnahme:** 18/18 nach Korrektur bestanden. Unit- und Integrationstests nach der UI-Korrektur gemäss Bestätigung der Entwicklerin ohne Fehler. TypeScript-Check nicht separat bestätigt. Übergreifende UX-Beobachtungen werden in Issue #39 weiterverfolgt.

### Issue #39 – Fehlerbehandlung und Benutzerfeedback

Testdatum: 26.11.2026. Manuelle Sammelbestätigung der Entwicklerin nach Korrektur: alle OK. Ursprüngliche Löschtests wurden durch Archivierung und Reaktivierung ersetzt, da Löschen im getesteten Ablauf nicht möglich ist. Screenshot zeigte doppelte Erfolgsmeldung; redundante Seitenmeldungen wurden in zehn Dateien entfernt (u.a. ed41620). Die übrigen Seiten wurden nicht vollständig auf doppelte Meldungen geprüft; die Sammelbestätigung ist kein unabhängiger Nachweis für jede Seite. Automatisierte Prüfungen vor der letzten Korrektur gemäss Rückmeldung ohne Fehler; erneuter Check nach Korrektur nicht separat belegt.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-39-01 | Artikel erstellen | Bestanden gemäss Sammelbestätigung |
| ST-39-02 | Artikel bearbeiten | Bestanden gemäss Sammelbestätigung |
| ST-39-03 | Archivierung abbrechen | Bestanden gemäss Sammelbestätigung |
| ST-39-04 | Archivierung bestätigen | Bestanden gemäss Sammelbestätigung |
| ST-39-05 | Artikel reaktivieren | Bestanden gemäss Sammelbestätigung |
| ST-39-06 | Stammdaten bearbeiten | Bestanden gemäss Sammelbestätigung |
| ST-39-07 | Material ausleihen | Bestanden gemäss Sammelbestätigung |
| ST-39-08 | Material zurückgeben | Bestanden gemäss Sammelbestätigung |
| ST-39-09 | Ungültige Rückgabemenge | Bestanden gemäss Sammelbestätigung |
| ST-39-10 | Vereinskleider verkaufen | Bestanden gemäss Sammelbestätigung |
| ST-39-11 | Bestellung bearbeiten | Bestanden gemäss Sammelbestätigung |
| ST-39-12 | Zahlung erfassen | Bestanden gemäss Sammelbestätigung |
| ST-39-13 | Retoure erfassen | Bestanden gemäss Sammelbestätigung |
| ST-39-14 | Verkaufspreis ändern | Bestanden gemäss Sammelbestätigung |
| ST-39-15 | Ungültiger Preis | Bestanden gemäss Sammelbestätigung |
| ST-39-16 | Inventurposition speichern | Bestanden gemäss Sammelbestätigung |
| ST-39-17 | Bewertungsaufnahme erstellen | Bestanden gemäss Sammelbestätigung |
| ST-39-18 | Schadensmeldung bearbeiten | Bestanden gemäss Sammelbestätigung |
| ST-39-19 | Benutzerverwaltung | Bestanden gemäss Sammelbestätigung |
| ST-39-20 | Mail-Einstellungen | Bestanden gemäss Sammelbestätigung |
| ST-39-21 | Doppelklick beim Speichern | Bestanden gemäss Sammelbestätigung |
| ST-39-22 | Meldung schliessen | Bestanden gemäss Sammelbestätigung |
| ST-39-23 | Mobile Ansicht | Bestanden gemäss Sammelbestätigung |
| ST-39-24 | Lange Seite mit Filtern | Bestanden gemäss Sammelbestätigung |
| ST-39-25 | Erfolgsmeldung nur einmal | Bestanden gemäss Sammelbestätigung |
| ST-39-26 | Fehlermeldung nur einmal | Bestanden gemäss Sammelbestätigung |

**Abnahme:** 26/26 gemäss Sammelbestätigung; ursprüngliche Löschfälle nicht als bestanden gezählt. Nach der Abnahme wurden die restlichen identifizierten redundanten allgemeinen Meldungsboxen bereinigt (u.a. 8184e23, 837f219). Abschliessender npm run check gemäss Entwicklerin ohne Fehler. Keine erneute vollständige Browser- oder Coverage-Prüfung nach der letzten Bereinigung belegt.

### Issue #46 – Lieferantenverwaltung und Sammelbestellungen

Testdatum: 26.11.2026. Manuelle Browser-Abnahme, alle 16 Fälle einzeln durch die Entwicklerin bestätigt. Testdaten und getesteter Commit nicht separat angegeben.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-46-01 | Lieferant erstellen | Bestanden |
| ST-46-02 | Lieferant bearbeiten | Bestanden |
| ST-46-03 | Unbenutzten Lieferanten löschen | Bestanden |
| ST-46-04 | Verwendeten Lieferanten löschen | Bestanden |
| ST-46-05 | Standardlieferant zuordnen | Bestanden |
| ST-46-06 | Artikel ohne Lieferant | Bestanden |
| ST-46-07 | Nachbestellbedarf | Bestanden |
| ST-46-08 | Sammelbestellung erstellen | Bestanden |
| ST-46-09 | Bestellung auslösen | Bestanden |
| ST-46-10 | Erneuter Nachbestellbedarf | Bestanden |
| ST-46-11 | Teilwareneingang | Bestanden |
| ST-46-12 | Offene Liefermenge | Bestanden |
| ST-46-13 | Vollständiger Wareneingang | Bestanden |
| ST-46-14 | Doppelter Wareneingang | Bestanden |
| ST-46-15 | Wareneingangshistorie | Bestanden |
| ST-46-16 | Bestehende Verkaufsprozesse | Bestanden |

**Abnahme:** 16/16 bestanden. Keine Fehler gemeldet. Bestehende automatisierte Nachweise siehe Issue #46; kein neuer isolierter Testlauf bestätigt. Letzter allgemeiner technischer Check gemäss Rückmeldung zu #39 ohne Fehler; Warnungszahl nicht separat angegeben.

### Issue #47 – Bestell-PDF für Sammelbestellungen

26.11.2026, manuelle Rückmeldung der Entwicklerin. ST-47-08 zunächst fehlerhaft (überlagernde Linien), nach Korrektur bestanden. Bugs #116 und #117 nachträglich erfasst.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-47-01 | Einzel-PDF herunterladen | Bestanden |
| ST-47-02 | Bestellinformationen | Bestanden |
| ST-47-03 | Artikelpositionen | Bestanden |
| ST-47-04 | Kundenbedarf und Lagerreserve | Bestanden |
| ST-47-05 | Gesamt-PDF | Bestanden |
| ST-47-06 | Unterschiedliche Lieferanten | Bestanden |
| ST-47-07 | Datenschutz | Bestanden |
| ST-47-08 | PDF-Layout (nach Korrektur) | Bestanden |
| ST-47-09 | Mehrseitige Bestellung | Bestanden |
| ST-47-10 | Vereinsisolation | Bestanden |
| ST-47-11 | E-Mail-Anhang | Bestanden |
| ST-47-12 | Gelieferte Bestellung gesperrt | Bestanden |
| ST-47-13 | Gruppenauswahl überspringt gelieferte | Bestanden |
| ST-47-14 | Gelieferte Gruppe gesperrt | Bestanden |
| ST-47-15 | Historisches Einzel-PDF | Bestanden |
| ST-47-16 | Gesamt-PDF offene Bestellungen | Bestanden |
| ST-47-08a | Einzel-PDF Linien | Bestanden |
| ST-47-08b | Gesamt-PDF Linien | Bestanden |
| ST-47-08c | Total Abstand | Bestanden |
| ST-47-08d | Umlaute | Bestanden |

**Ergebnis:** 20/20 nach Korrektur. Drei zusätzliche Unit-Regressionstests (#117, 63bedd3) und npm run check gemäss Rückmeldung ohne Fehler. Keine neue Gesamtsuite oder Coverage-Messung belegt. Teilgelieferte Bestellungen enthalten weiterhin ursprüngliche Mengen.

### Issue #48 – Stornierungen und Gutschriften

26.11.2026: ST-48-01 zunächst fehlerhaft, Bug #118 erfasst und mit 162d361 korrigiert. Alle übrigen Fälle und fünf Nachprüfungen gemäss Entwicklerin bestanden.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-48-01 | Unverrechnete Teilstornierung (nach Korrektur) | Bestanden |
| ST-48-02 | Vollständige Stornierung | Bestanden |
| ST-48-03 | Stornierungsbegründung | Bestanden |
| ST-48-04 | Verrechnete Teilstornierung | Bestanden |
| ST-48-05 | Offene Rechnung | Bestanden |
| ST-48-06 | Teilweise bezahlte Rechnung | Bestanden |
| ST-48-07 | Vollständig bezahlte Rechnung | Bestanden |
| ST-48-08 | Mehrere Teilrechnungen | Bestanden |
| ST-48-09 | Mehrfache Stornierungen | Bestanden |
| ST-48-10 | Ungültige Stornierungsmenge | Bestanden |
| ST-48-11 | Bereits übergebene Artikel | Bestanden |
| ST-48-12 | Lagerbestand und Reservierungen | Bestanden |
| ST-48-13 | Stornierungshistorie | Bestanden |
| ST-48-14 | Gutschriftenübersicht | Bestanden |
| ST-48-15 | Gutschrift-PDF | Bestanden |
| ST-48-01a | Vollstornierung nicht in Verrechnung | Bestanden |
| ST-48-01b | Rechnung nach Teilstornierung | Bestanden |
| ST-48-01c | Rechnungsbetrag und PDF | Bestanden |
| ST-48-01d | Gutschrift nach weiterer Stornierung | Bestanden |
| ST-48-01e | Historie erhalten | Bestanden |

20/20 nach Korrektur. Fünf Unit-Regressionstests (c54f8cf) und npm run check gemäss Rückmeldung ohne Fehler. Keine neue Gesamtcoverage oder vollständiger Integrationslauf bestätigt.

### Issue #49 – Verkaufshistorie inkl. #119

26.11.2026: 18/20 initial bestanden; ST-49-14 und ST-49-15 (Rechnungs- und Gutschriften-PDF) nach Korrektur bestanden. ST-49-21 bis 25 (Belegverknüpfungen, Teilrechnungen, Zuordnung und fehlende Belege) gemäss Sammelbestätigung bestanden. Originaldetails der übrigen initialen Fälle hier nicht einzeln rekonstruiert.

| ID | Nachprüfung | Ergebnis |
|---|---|---|
| ST-49-26 | Einzelrechnung | Bestanden |
| ST-49-27 | Mehrere Teilrechnungen | Bestanden |
| ST-49-28 | Gutschriften auf verschiedenen Teilrechnungen | Bestanden |
| ST-49-29 | Offene Forderungen und Rückerstattungen getrennt | Bestanden |
| ST-49-30 | Verkauf ohne Rechnung | Bestanden |
| ST-49-31 | PDF-Verknüpfungen | Bestanden |
| ST-49-32 | Bezahlt-Filter bei offener Teilrechnung | Bestanden |
| ST-49-33 | Offen-Filter | Bestanden |
| ST-49-34 | Gutschrift auf zweiter Teilrechnung | Bestanden |
| ST-49-35 | Excel: Rechnungsnummern | Bestanden |
| ST-49-36 | Excel: Finanzbeträge | Bestanden |
| ST-49-37 | Excel: Forderungen und Rückerstattungen | Bestanden |
| ST-49-38 | Excel: Filterübernahme | Bestanden |

38/38 nach Korrekturen. Belegverknüpfungen: c4bc3a8, 81d2cc7, 5d103c2; Finanzberechnung: be5e287; Filter: 2c8d536; Export: 69095d6. Drei Beleg-Regressionstests (17f465d) bestanden. Vollständiger Integrationslauf: 2594/2599 bestanden; fünf veraltete Abfrageerwartungen korrigiert (9c7b4b8, 96fbde9, 20badc0), anschliessender gezielter Nachtest und npm run check gemäss Rückmeldung ohne Fehler. Vollständiger erneuter [CI-Lauf 45816880404](https://github.com/JenSusann/ClubMatiq/actions/runs/45816880404) erfolgreich (eec4def): 2437 Unit- und 2599 Integrationstests, 5036/5036, 159 Dateien. Kombinierte Coverage: Statements 98,17 %, Branches 95,01 %, Functions 96,18 %, Lines 98,88 %. Quality Gate bestanden.

Ergänzung #49: Mobile Darstellung und Benutzerberechtigungen ebenfalls erfolgreich geprüft (Sammelbestätigung, ohne zusätzliche nummerierte Fälle).

### Issue #32 – Admin-Dashboard

26.11.2026: Alle zehn manuellen Tests gemäss Sammelbestätigung bestanden.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-32-01 | Administratoransicht | Bestanden |
| ST-32-02 | Thematische Gruppierung | Bestanden |
| ST-32-03 | Materialverantwortliche | Bestanden |
| ST-32-04 | Leiter/in | Bestanden |
| ST-32-05 | Mitglied | Bestanden |
| ST-32-06 | Rollenvorschau | Bestanden |
| ST-32-07 | Vorschau beenden | Bestanden |
| ST-32-08 | Direkter Seitenaufruf mit Nicht-Admin-Konto | Bestanden |
| ST-32-09 | Administrative API: HTTP 403 | Bestanden |
| ST-32-10 | Mobile Darstellung | Bestanden |

Keine Codeänderung erforderlich. Automatisierter Nachweis: bestehender erfolgreicher CI-Lauf 45816880404; keine neue isolierte Ausführung.

### Issue #62 – Manuelle Benutzeranlage

26.11.2026: 15/15 gemäss Sammelbestätigung bestanden.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-62-01 | Manuelle Anlage | Bestanden |
| ST-62-02 | Pflichtfelder | Bestanden |
| ST-62-03 | Startpasswort | Bestanden |
| ST-62-04 | Doppelte E-Mail | Bestanden |
| ST-62-05 | Vereinsübergreifendes Duplikat | Bestanden |
| ST-62-06 | Erster Login | Bestanden |
| ST-62-07 | Geschützte Seiten | Bestanden |
| ST-62-08 | Falsches bisheriges Passwort | Bestanden |
| ST-62-09 | Identisches Passwort | Bestanden |
| ST-62-10 | Passwortbestätigung | Bestanden |
| ST-62-11 | Erfolgreicher Passwortwechsel | Bestanden |
| ST-62-12 | Erneuter Login | Bestanden |
| ST-62-13 | Altes Passwort | Bestanden |
| ST-62-14 | Deaktivierung und Reaktivierung | Bestanden |
| ST-62-15 | Berechtigungsschutz | Bestanden |

Automatisierte Tests für manuelle Anlage, Duplicate Key und Passwortwechsel-Sperren in Hooks vorhanden. Vollständiger CI-Lauf 45816880404 erfolgreich; spezifische Coverage und Sitzungswiderruf nach Passwortwechsel noch zu prüfen.

#### Nachprüfung Sitzungswiderruf (#62)

Commit 4bdb41f, Nachprüfung gemäss Sammelbestätigung bestanden.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-62-16 | Zwei aktive Sitzungen | Bestanden |
| ST-62-17 | Aktuelle Sitzung bleibt erhalten | Bestanden |
| ST-62-18 | Andere Sitzung widerrufen | Bestanden |
| ST-62-19 | Fehlgeschlagener Wechsel erhält Sitzungen | Bestanden |
| ST-62-20 | Fremde Benutzersitzung unverändert | Bestanden |

Gezielter Integrationstest (5c7cef3) und npm run check gemäss Rückmeldung erfolgreich. CI-Lauf 45821258149 (3fe6cbc) erfolgreich: 2441 Unit- und 2600 Integrationstests, 5041/5041; kombinierte Coverage 98,18 % Statements, 95,01 % Branches, 96,19 % Functions, 98,88 % Lines. Quality Gate bestanden. 19 veraltete Unit-Test-Fixtures korrigiert, vier zusätzliche Unit-Tests.

### Issue #64 – Benutzer löschen und Einladungen widerrufen

26.11.2026: Alle 15 manuellen Fälle gemäss Einzelbestätigung bestanden; vor technischer Nachabsicherung.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-64-01 | Einladung widerrufen | Bestanden |
| ST-64-02 | Widerrufener Link ungültig | Bestanden |
| ST-64-03 | Anzeige widerrufener Einladung | Bestanden |
| ST-64-04 | Erneute Einladung | Bestanden |
| ST-64-05 | Angenommene Einladung geschützt | Bestanden |
| ST-64-06 | Widerruf abbrechen | Bestanden |
| ST-64-07 | Unreferenzierten Benutzer löschen | Bestanden |
| ST-64-08 | Anmeldung nach Löschung verweigert | Bestanden |
| ST-64-09 | Selbstlöschung geschützt | Bestanden |
| ST-64-10 | Löschung abbrechen | Bestanden |
| ST-64-11 | Referenzierte Ausleihe schützt Benutzer | Bestanden |
| ST-64-12 | Deaktivierung erhält Historie | Bestanden |
| ST-64-13 | Sitzung nach Löschung ungültig | Bestanden |
| ST-64-14 | Nicht-Admin verweigert | Bestanden |
| ST-64-15 | Dialoge und Meldungen | Bestanden |

Technische Nachabsicherung: Benutzer- und Session-Löschung in gemeinsamer Transaktion (2aef97bf), sieben zusätzliche Unit-Tests (f6c54ac), drei MongoDB-Integrationstests (2fed46d), zwei bestehende Unit-Mocks korrigiert (305d4e8). Gezielte Tests und vollständiger Unit-Lauf gemäss Entwicklerin erfolgreich. [CI-Lauf 45824480865](https://github.com/JenSusann/ClubMatiq/actions/runs/45824480865) erfolgreich; kombinierte Coverage 98,19 % Statements, 95,04 % Branches, 96,20 % Functions, 98,90 % Lines. Quality Gate bestanden. Manuelle Abnahme vor Transaktionsänderung; parallele neu entstehende Referenzen und erzwungener Rollback nicht vollständig abgesichert.

### Issue #68 – Offene Preise und gemischte Teilzahlungen

26.11.2026: Alle 25 Fälle gemäss Einzelbestätigung der Entwicklerin bestanden.

| ID | Testfall | Ergebnis |
|---|---|---|
| ST-68-01 | Preis-offen-Checkbox speichern | Bestanden |
| ST-68-02 | Offener Preis nicht CHF 0 | Bestanden |
| ST-68-03 | Gemischter Warenkorb | Bestanden |
| ST-68-04 | Bekannter Teilbetrag CHF 55 | Bestanden |
| ST-68-05 | TWINT nur CHF 55 | Bestanden |
| ST-68-06 | Gemeinsame Bestell-ID | Bestanden |
| ST-68-07 | Preisfestlegung CHF 48 | Bestanden |
| ST-68-08 | Bezahlte Positionen unverändert | Bestanden |
| ST-68-09 | Restforderung CHF 48 | Bestanden |
| ST-68-10 | Rechnung und PDF CHF 48 | Bestanden |
| ST-68-11 | Teilzahlung CHF 20 | Bestanden |
| ST-68-12 | Restzahlung CHF 28 | Bestanden |
| ST-68-13 | Doppelverrechnung und Überzahlung blockiert | Bestanden |
| ST-68-14 | Verrechneten Preis schützen | Bestanden |
| ST-68-15 | Gemischter Barverkauf | Bestanden |
| ST-68-16 | Nur offene Preise ohne Zahlung | Bestanden |
| ST-68-17 | Storno offener Preis ohne Gutschrift | Bestanden |
| ST-68-18 | Storno bezahlter Position mit Gutschrift | Bestanden |
| ST-68-19 | Rabattkombination | Bestanden |
| ST-68-20 | Sammelbestellung | Bestanden |
| ST-68-21 | Wareneingang und Übergabe | Bestanden |
| ST-68-22 | Historie und Belege | Bestanden |
| ST-68-23 | Excel und PDF | Bestanden |
| ST-68-24 | Bestehende Verkäufe | Bestanden |
| ST-68-25 | Berechtigungen | Bestanden |

Keine Fehler gemeldet; keine Codeänderung für diese Abnahme erforderlich. Bestehender CI-Lauf 45824480865 erfolgreich; spezifische automatisierte Testzuordnung noch zu prüfen.

## 3. Geplanter Regressionstestkatalog

Alle nachstehenden Fälle sind offen, sofern kein separater Durchführungsnachweis vorliegt. Sie werden nicht zu den bestätigten 352 Tests addiert.

| Bereich | Geplante Testfälle |
|---|---|
| Inventar (5) | Artikel erstellen; bearbeiten; negativen Bestand verhindern; referenzierten Artikel löschen; Mindestbestandswarnung |
| Ausleihen (5) | Ausleihe; zu hohe Menge; Teilrückgabe; vollständige Rückgabe; Rückgabe über offene Menge |
| Vereinskleider (5) | Verkauf; Grössenbestand; Rabatt; TWINT; unzureichender Bestand |
| Bestellungen (8) | Fehlbestand; Sammelbestellung; Teilwareneingang; vollständiger Wareneingang; Teilübergabe; Stornierung; Übergabehistorie; Stornierungshistorie |
| Rechnungen (8) | Rechnung; doppelte Verrechnung; Teilrechnung; Teilzahlung; vollständige Zahlung; Überzahlung; Gutschrift zur richtigen Teilrechnung; CSV-Export |
| Retouren (10) | Vollretoure; Teilretoure; wiederverkaufbar; nicht wiederverkaufbar; ungültige Menge; Gutschrift; Teilrückerstattung; vollständige Rückerstattung; doppelte Rückerstattung; Historie |
| Lagerjournal (7) | Ausleihe; Rückgabe; Verkauf; Inventur; Retoure; Filter; Export |
| Berechtigungen (8) | Admin; Materialverantwortliche; Leitende; Mitglieder; unangemeldet; Vereinsisolation; letzter Admin; Sitzungsinvalidierung |
| Gesamt | 56 geplante Fälle |

## 4. Vorlage für weitere Issue-Abnahmen

### Issue #XX – Titel

- Testdatum:
- Testperson:
- Commit:
- Umgebung:
- Automatisierte Prüfungen:

| ID | Testfall | Voraussetzung / Aufgabe | Erwartung | Tatsächliches Ergebnis | Status |
|---|---|---|---|---|---|
| ST-XX-01 | | | | | Offen |

**Fehler und Korrekturen:** 

**Abnahmeentscheidung:** Offen

## 5. Pflegeprozess

1. Anforderungen und Akzeptanzkriterien prüfen.
2. Automatisierte Prüfungen ausführen (npm run check, npx vitest run).
3. Manuelle Testfälle definieren und durchführen.
4. Tatsächliche Ergebnisse und Fehlerkorrekturen dokumentieren.
5. Dieses Protokoll beim Issue-Abschluss aktualisieren und versionieren.
6. Vor Abgabe aus Markdown ein Word-Dokument erstellen und als PDF exportieren.

Historische Ergebnisse nicht ohne Nachweis ergänzen. Bei Regressionen frühere Ergebnisse erhalten und neue Durchläufe separat erfassen. Die funktionale Abnahme durch die Entwicklerin ersetzt keine unabhängige Usability-Evaluation.
