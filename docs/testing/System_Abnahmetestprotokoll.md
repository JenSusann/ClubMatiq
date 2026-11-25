# ClubMatiq – System- und Abnahmetestprotokoll

ZHAW · Prototyping HS2026 · Laufende Dokumentation

## 1. Ziel und Methodik

Manuelle funktionale Systemtests ergänzen die automatisierten Unit- und Integrationstests und dienen der Abnahme der GitHub-Issues. Usability-Tests mit unabhängigen Testpersonen werden separat dokumentiert.

Test-ID: ST-[Issue]-[Nummer]. Status: Offen, Bestanden, Fehler, Blockiert, Erneut bestanden. Sammelbestätigungen werden von einzeln belegten Ergebnissen und rekonstruierten Testfällen unterschieden.

## 2. Bisherige Abnahmen

| Issue | Bereich | Bestanden | Nachweis |
|---|---|---:|---|
| #14 | Session-Verwaltung | 8/8 | Original-Screenshot |
| #15 | Benutzerverwaltung | Nicht quantifiziert | Browser-Abnahme laut bisherigem Protokoll |
| #16 | Rollenbasierte Berechtigungen | 10/10 | Original-Screenshot |
| #21 | Inventur | 9/9 | Sammelbestätigung laut bisherigem Protokoll |
| #22 | Bestandskonsistenz | 10/10 | Screenshot |
| Gesamt | Quantifizierte Abnahmen | 37/37 | Historische Abschlussstände |

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

### Issue #15

Browser-Abnahme laut bisherigem Protokoll bestätigt. Einzelbeschreibungen und Anzahl nachzutragen.

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

## 3. Geplanter Regressionstestkatalog

Alle nachstehenden Fälle sind offen, sofern kein separater Durchführungsnachweis vorliegt. Sie werden nicht zu den bestätigten 37 Tests addiert.

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
