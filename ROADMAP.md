# ClubMatiq – Produkt-Roadmap

Stand: 26.11.2026. Zielversionen sind Planungswerte, keine Lieferzusagen. GitHub-Issues sind führend für den Umsetzungsstatus. Die technische Umsetzung und Veröffentlichung richten sich nach der [Entwicklungs- und Release-Strategie](docs/releases/Release_Management.md).

## Evaluation und Abgabe

- v0.9.x: Pilot- und Evaluationsphase. Produktive Abnahme v0.9.2 und separater Demo-Stand sind im [Pilotbetrieb](docs/testing/Pilotbetrieb.md) und [Demo-Betrieb](docs/testing/Demo-Betrieb.md) dokumentiert.
- v1.0.0: ZHAW-Abgabe; Issues #1–71 als vorläufiger Abgabekandidatenpool, nicht als pauschale Freigabezusage. Offene Kriterien und Umfang vor Freeze prüfen.

## Entwicklungsreihenfolge und Veröffentlichung

Die Roadmap beschreibt den geplanten Funktionsumfang der Releases, nicht die Reihenfolge der Implementierung. Issues dürfen versionsübergreifend vorgezogen werden, sofern ihre fachlichen und technischen Abhängigkeiten erfüllt sind. Beispielsweise kann #104 für v3.0.0 bereits vor Abschluss von v1.1.0 entwickelt werden, ohne den Zielmeilenstein zu ändern.

- `main` bleibt der stabile Stand; die ZHAW-Abgabe und der Evaluationsstand werden nicht durch vorgezogene Funktionen erweitert.
- Versionsbranches folgen dem Muster `develop/vX.Y.Z` und werden bei Bedarf erstellt. `develop/v2.0.0` und `develop/v3.0.0` sind bereits eingerichtet.
- Einzelne Issues werden in Feature Branches umgesetzt, getestet und nach manueller Abnahme in den vorgesehenen Versionsbranch integriert.
- Die Statuslabels `In Development`, `Ready for Testing`, `Ready for Release` und `Released` bilden den Fortschritt ab. Ein abgenommenes, aber noch nicht veröffentlichtes Issue bleibt offen und behält seinen Zielmeilenstein.
- Vor der Veröffentlichung werden freigegebene Vorgängerversionen und Hotfixes integriert und Regressionstests durchgeführt. Erst nach Freigabe erfolgt die Übernahme in `main`, das Tagging und der Abschluss der zugehörigen Issues.
- Eine frühere Veröffentlichung einer Funktion erfordert eine bewusste Anpassung ihres Zielmeilensteins und der Roadmap.

## Versionsmeilensteine

| Zielversion | GitHub-Meilenstein | Optionale Issues |
| --- | --- | ---: |
| v1.0.0 | [Initial Release](https://github.com/JenSusann/ClubMatiq/milestone/6) | 0 |
| v1.1.0 | [Usability & Customization](https://github.com/JenSusann/ClubMatiq/milestone/7) | 16 |
| v1.2.0 | [Advanced Inventory](https://github.com/JenSusann/ClubMatiq/milestone/8) | 12 |
| v2.0.0 | [Member Experience](https://github.com/JenSusann/ClubMatiq/milestone/9) | 9 |
| v2.1.0 | [Finance & Automation](https://github.com/JenSusann/ClubMatiq/milestone/10) | 4 |
| v3.0.0 | [ClubMatiq Business](https://github.com/JenSusann/ClubMatiq/milestone/11) | 2 |

Alle 43 optionalen Issues sind zugeordnet. v1.0.0 bleibt ohne eigene Issues, da der Abgabeumfang über M1–M5 verfolgt wird. Veröffentlichungstermine sind nicht festgelegt.

## v1.1.0 – Usability & Customization

| Issue | Funktion | Status am Planungsstichtag |
| --- | --- | --- |
| [#76](https://github.com/JenSusann/ClubMatiq/issues/76) | Vereinsbezogene Einstellungen und Vereinslogo verwalten | Offen |
| [#77](https://github.com/JenSusann/ClubMatiq/issues/77) | Bestellbestätigung für Vereinskleider | Offen |
| [#79](https://github.com/JenSusann/ClubMatiq/issues/79) | Benutzerrolle Kassier/in und finanzbezogene Berechtigungen | Offen |
| [#82](https://github.com/JenSusann/ClubMatiq/issues/82) | Inventarartikel duplizieren | Offen |
| [#84](https://github.com/JenSusann/ClubMatiq/issues/84) | QR-Code-Etikettenbogen als PDF | Offen |
| [#85](https://github.com/JenSusann/ClubMatiq/issues/85) | Artikelbilder und Bildergalerie im Inventar | Offen |
| [#88](https://github.com/JenSusann/ClubMatiq/issues/88) | Passwort vergessen und selbstständige Passwortzurücksetzung per E-Mail | Offen |
| [#89](https://github.com/JenSusann/ClubMatiq/issues/89) | Massenbearbeitung von Inventarartikeln | Offen |
| [#95](https://github.com/JenSusann/ClubMatiq/issues/95) | Individuelle Rechnungs- und Gutschriftsnummernkreise pro Verein | Offen |
| [#99](https://github.com/JenSusann/ClubMatiq/issues/99) | Benutzerdefinierte Rollen und vereinsbezogene Berechtigungsprofile | Offen |
| [#100](https://github.com/JenSusann/ClubMatiq/issues/100) | Zwei-Faktor-Authentifizierung (2FA) für Benutzerkonten | Offen |
| [#101](https://github.com/JenSusann/ClubMatiq/issues/101) | Mehrere Rollen pro Benutzer und kombinierte Berechtigungen | Offen |
| [#102](https://github.com/JenSusann/ClubMatiq/issues/102) | Progressive Web App (PWA) und Smartphone-Installation | Offen |
| [#105](https://github.com/JenSusann/ClubMatiq/issues/105) | Allgemeines Audit-Protokoll für Stammdaten und Einstellungen | Offen |
| [#109](https://github.com/JenSusann/ClubMatiq/issues/109) | Persönliche Favoriten für Inventarartikel | Offen |
| [#113](https://github.com/JenSusann/ClubMatiq/issues/113) | Vereinsindividuelles PDF-Design und Dokumentvorlagen | Offen |

## v1.2.0 – Advanced Inventory

| Issue | Funktion | Status am Planungsstichtag |
| --- | --- | --- |
| [#73](https://github.com/JenSusann/ClubMatiq/issues/73) | QR-Code-Schnellaktionen für Ausleihe, Rückgabe und Verkauf | Offen |
| [#75](https://github.com/JenSusann/ClubMatiq/issues/75) | Intelligente Nachbestellvorschläge | Offen |
| [#78](https://github.com/JenSusann/ClubMatiq/issues/78) | Automatische Erinnerungs-E-Mails für Rückgaben und Kleiderabholungen | Offen |
| [#80](https://github.com/JenSusann/ClubMatiq/issues/80) | Ausleihfristen und Überfälligkeitsanzeige im Dashboard | Offen |
| [#81](https://github.com/JenSusann/ClubMatiq/issues/81) | Kostenpflichtige Materialausleihe an externe Vereine | Offen |
| [#83](https://github.com/JenSusann/ClubMatiq/issues/83) | Lagerortwechsel mit Bewegungsprotokoll | Offen |
| [#90](https://github.com/JenSusann/ClubMatiq/issues/90) | Materialaussonderung und dokumentierte Inventarabgänge | Offen |
| [#98](https://github.com/JenSusann/ClubMatiq/issues/98) | Materialbedarf und Neuanschaffungen mit Freigabeprozess | Offen |
| [#103](https://github.com/JenSusann/ClubMatiq/issues/103) | Verbrauchsmaterialverwaltung und Verbrauchsbuchungen | Offen |
| [#108](https://github.com/JenSusann/ClubMatiq/issues/108) | Anschaffungsdatum, Materialalter und Garantieverwaltung | Offen |
| [#110](https://github.com/JenSusann/ClubMatiq/issues/110) | Ausleihbestätigung als PDF für interne Materialausleihen | Offen |
| [#111](https://github.com/JenSusann/ClubMatiq/issues/111) | Materialsets und gemeinsame Ausleihe mehrerer Artikel | Offen |

## v2.0.0 – Member Experience

| Issue | Funktion | Status am Planungsstichtag |
| --- | --- | --- |
| [#72](https://github.com/JenSusann/ClubMatiq/issues/72) | Mitgliederverwaltung: Manuelle Mitgliederanlage und Bearbeitung ohne ClubDesk | Offen |
| [#74](https://github.com/JenSusann/ClubMatiq/issues/74) | Packliste für Vereinskleiderbestellungen | Offen |
| [#87](https://github.com/JenSusann/ClubMatiq/issues/87) | Vereinsinterner Onlineshop und Mitglieder-Selbstbestellung | Offen |
| [#91](https://github.com/JenSusann/ClubMatiq/issues/91) | Selbstausleihe und Materialanfragen durch Mitglieder | Offen |
| [#92](https://github.com/JenSusann/ClubMatiq/issues/92) | Umtauschanfragen für Vereinskleider durch Mitglieder | Offen |
| [#93](https://github.com/JenSusann/ClubMatiq/issues/93) | Vereinsinterne Zweite-Hand-Kleiderbörse | Offen |
| [#106](https://github.com/JenSusann/ClubMatiq/issues/106) | Artikelspezifische Grössentabellen für Vereinskleider | Offen |
| [#107](https://github.com/JenSusann/ClubMatiq/issues/107) | Personalisierte Vereinskleider mit Namen, Initialen und individuellen Aufdrucken | Offen |
| [#112](https://github.com/JenSusann/ClubMatiq/issues/112) | Persönliche Wunschliste für Vereinskleider im Mitglieder-Onlineshop | Offen |

## v2.1.0 – Finance & Automation

| Issue | Funktion | Status am Planungsstichtag |
| --- | --- | --- |
| [#86](https://github.com/JenSusann/ClubMatiq/issues/86) | Zentrale Zahlungsübersicht und offene Forderungen im Dashboard | Offen |
| [#94](https://github.com/JenSusann/ClubMatiq/issues/94) | Automatische Zahlungserinnerungen für offene Rechnungen | Offen |
| [#96](https://github.com/JenSusann/ClubMatiq/issues/96) | Abschreibungen und Restwertberechnung langlebiger Inventarartikel | Offen |
| [#97](https://github.com/JenSusann/ClubMatiq/issues/97) | Verkaufsauswertung mit Umsatz, Einkaufskosten und Verkaufsmarge | Offen |

## v3.0.0 – ClubMatiq Business

| Issue | Funktion | Status am Planungsstichtag |
| --- | --- | --- |
| [#104](https://github.com/JenSusann/ClubMatiq/issues/104) | Plattformadministration, Vereinsübersicht und Lizenzverrechnung | Offen |
| [#114](https://github.com/JenSusann/ClubMatiq/issues/114) | Vereinsübergreifendes Feedback- und Ideenforum mit Feature-Wünschen | Offen |

## Abhängigkeiten und Freigabe

- #76 vor #113 und #77; #99 vor #101; #79 und #105 vor erweiterten Freigabeprozessen; #88/#100 vor Mitglieder-Selbstbedienung.
- #80 vor #78 und #110; #110 vor #111; #63 muss für Mailfunktionen freigegeben sein.
- #72 und #87 vor #92/#112; #85/#106/#107 mit Shop abstimmen.
- #108/#90 vor #96; #79/#95 vor Finanzautomatisierung; #104 vor #114.
- Major-Nummern sind Produktplanungsziele; bei strikt kompatiblen Änderungen wird die tatsächliche SemVer-Nummer vor Freigabe angepasst.
- Bestehende Projektmeilensteine M1–M5 bleiben erhalten. Die 43 optionalen Issues sind den Release-Meilensteinen zugeordnet; GitHub erlaubt nur einen Meilenstein pro Issue. Statuslabels ergänzen die Versionszuordnung, ersetzen sie aber nicht.
- Keine geplante Funktion gilt ohne Umsetzung, Testnachweis und manuelle Abnahme als bereit zur Veröffentlichung. Der Issue-Abschluss erfolgt erst bei Veröffentlichung der Zielversion gemäss Release-Strategie.
