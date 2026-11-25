# ClubMatiq – System- und Abnahmetestprotokoll

ZHAW · Prototyping HS2026 · Laufende Dokumentation

## 1. Ziel und Methodik

Manuelle funktionale Systemtests ergänzen die automatisierten Unit- und Integrationstests und dienen der Abnahme der GitHub-Issues. Usability-Tests mit unabhängigen Testpersonen werden separat dokumentiert.

Test-ID: ST-[Issue]-[Nummer]. Status: Offen, Bestanden, Fehler, Blockiert, Erneut bestanden. Sammelbestätigungen werden von einzeln belegten Ergebnissen und rekonstruierten Testfällen unterschieden.

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
| #35 | Inventarbewertung (Teilabnahme) | 21/21 | Einzelbestätigung und Nachprüfung |
| Gesamt | Quantifizierte manuelle Prüfungen | 119/119 | Dokumentierte Durchläufe |

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

**Teilabnahme:** Aktuelle Bewertung und manuell gespeicherte Bewertungsaufnahmen erfolgreich geprüft. Automatische Aufnahmen und frei wählbare historische Stichtage nicht umgesetzt oder abgenommen. Issue #35 bleibt offen.

## 3. Geplanter Regressionstestkatalog

Alle nachstehenden Fälle sind offen, sofern kein separater Durchführungsnachweis vorliegt. Sie werden nicht zu den bestätigten 119 Tests addiert.

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
