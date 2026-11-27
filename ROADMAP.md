# ClubMatiq – Produkt-Roadmap

Stand: 27.11.2026. Zielversionen sind Planungswerte, keine Lieferzusagen. GitHub-Issues sind führend für den Umsetzungsstatus. Die technische Umsetzung und Veröffentlichung richten sich nach der [Entwicklungs- und Release-Strategie](docs/releases/Release-Management.md).

## Evaluation und Abgabe

- v0.9.x: Pilot- und Evaluationsphase. Produktive Abnahme v0.9.2 und separater Demo-Stand sind im [Pilotbetrieb](docs/testing/Pilotbetrieb.md) und [Demo-Betrieb](docs/betrieb/Demo-Betrieb.md) dokumentiert.
- v1.0.0: ZHAW-Abgabe; Issues #1–71 als vorläufiger Abgabekandidatenpool, nicht als pauschale Freigabezusage. Offene Kriterien und Umfang vor Freeze prüfen.

## Entwicklungsreihenfolge und Veröffentlichung

Die Roadmap beschreibt den geplanten Funktionsumfang der Releases, nicht die Reihenfolge der Implementierung. Issues dürfen versionsübergreifend vorgezogen werden, sofern ihre fachlichen und technischen Abhängigkeiten erfüllt sind. Die nachfolgende priorisierte Reihenfolge ist der vereinbarte Entwicklungsplan; Abhängigkeiten können eine begründete Anpassung erfordern.

- `main` bleibt der stabile Stand; die ZHAW-Abgabe und der Evaluationsstand werden nicht durch vorgezogene Funktionen erweitert.
- Versionsbranches folgen dem Muster `develop/vX.Y.Z` und werden bei Bedarf erstellt. `develop/v2.0.0` und `develop/v3.0.0` sind bereits eingerichtet.
- Einzelne Issues werden in Feature Branches umgesetzt, getestet und nach manueller Abnahme in den vorgesehenen Versionsbranch integriert.
- Die Statuslabels `In Development`, `Ready for Testing`, `Ready for Release` und `Released` bilden den Fortschritt ab. Ein abgenommenes, aber noch nicht veröffentlichtes Issue bleibt offen und behält seinen Zielmeilenstein.
- Vor der Veröffentlichung werden freigegebene Vorgängerversionen und Hotfixes integriert und Regressionstests durchgeführt. Erst nach Freigabe erfolgt die Übernahme in `main`, das Tagging und der Abschluss der zugehörigen Issues.
- Eine frühere Veröffentlichung einer Funktion erfordert eine bewusste Anpassung ihres Zielmeilensteins und der Roadmap.

## Priorisierte Zielversionen

Die 24 priorisierten Issues werden in der angegebenen Reihenfolge geplant. Die GitHub-Meilensteine und Release-Labels müssen noch mit dieser Einteilung synchronisiert werden. Die bisherigen Zielversionen v1.1.0 und v1.2.0 werden nicht als zusätzliche Pflichtreleases vorausgesetzt. Die übrigen Erweiterungen bleiben im Backlog; ihre neue Zielversion ist offen.

| Zielversion | Schwerpunkt | Issues |
| --- | --- | ---: |
| v2.0.0 | Vereins- und Benutzerverwaltung | 7 |
| v2.1.0 | Inventarverwaltung | 4 |
| v2.2.0 | Ausleihen und QR-Codes | 5 |
| v2.3.0 | Vereinskleider und Finanzen | 5 |
| v3.0.0 | Plattform und Kundenbeteiligung | 3 |

## v2.0.0 – Vereins- und Benutzerverwaltung

| Issue | Funktion | Status am bisherigen Planungsstichtag |
| --- | --- | --- |
| [#76](https://github.com/JenSusann/ClubMatiq/issues/76) | Vereinsbezogene Einstellungen und Vereinslogo verwalten | Offen |
| [#79](https://github.com/JenSusann/ClubMatiq/issues/79) | Benutzerrolle Kassier/in und finanzbezogene Berechtigungen | Offen |
| [#99](https://github.com/JenSusann/ClubMatiq/issues/99) | Benutzerdefinierte Rollen und vereinsbezogene Berechtigungsprofile | Offen |
| [#101](https://github.com/JenSusann/ClubMatiq/issues/101) | Mehrere Rollen pro Benutzer und kombinierte Berechtigungen | Offen |
| [#88](https://github.com/JenSusann/ClubMatiq/issues/88) | Passwort vergessen und selbstständige Passwortzurücksetzung per E-Mail | Offen |
| [#72](https://github.com/JenSusann/ClubMatiq/issues/72) | Mitgliederverwaltung: Manuelle Mitgliederanlage und Bearbeitung ohne ClubDesk | Offen |
| [#126](https://github.com/JenSusann/ClubMatiq/issues/126) | ClubDesk-Gruppenzuordnung verbessern | Offen |

## v2.1.0 – Inventarverwaltung

| Issue | Funktion | Status am bisherigen Planungsstichtag |
| --- | --- | --- |
| [#109](https://github.com/JenSusann/ClubMatiq/issues/109) | Persönliche Favoriten für Inventarartikel | Offen |
| [#108](https://github.com/JenSusann/ClubMatiq/issues/108) | Anschaffungsdatum, Materialalter und Garantieverwaltung | Offen |
| [#103](https://github.com/JenSusann/ClubMatiq/issues/103) | Verbrauchsmaterialverwaltung und Verbrauchsbuchungen | Offen |
| [#98](https://github.com/JenSusann/ClubMatiq/issues/98) | Materialbedarf und Neuanschaffungen mit Freigabeprozess | Offen |

## v2.2.0 – Ausleihen und QR-Codes

| Issue | Funktion | Status am bisherigen Planungsstichtag |
| --- | --- | --- |
| [#80](https://github.com/JenSusann/ClubMatiq/issues/80) | Ausleihfristen und Überfälligkeitsanzeige im Dashboard | Offen |
| [#81](https://github.com/JenSusann/ClubMatiq/issues/81) | Kostenpflichtige Materialausleihe an externe Vereine | Offen |
| [#111](https://github.com/JenSusann/ClubMatiq/issues/111) | Materialsets und gemeinsame Ausleihe mehrerer Artikel | Offen |
| [#73](https://github.com/JenSusann/ClubMatiq/issues/73) | QR-Code-Schnellaktionen für Ausleihe, Rückgabe und Verkauf | Offen |
| [#84](https://github.com/JenSusann/ClubMatiq/issues/84) | QR-Code-Etikettenbogen als PDF | Offen |

## v2.3.0 – Vereinskleider und Finanzen

| Issue | Funktion | Status am bisherigen Planungsstichtag |
| --- | --- | --- |
| [#129](https://github.com/JenSusann/ClubMatiq/issues/129) | Fehlende Verkaufspreise filtern | Offen |
| [#74](https://github.com/JenSusann/ClubMatiq/issues/74) | Packliste für Vereinskleiderbestellungen | Offen |
| [#96](https://github.com/JenSusann/ClubMatiq/issues/96) | Abschreibungen und Restwertberechnung langlebiger Inventarartikel | Offen |
| [#97](https://github.com/JenSusann/ClubMatiq/issues/97) | Verkaufsauswertung mit Umsatz, Einkaufskosten und Verkaufsmarge | Offen |
| [#86](https://github.com/JenSusann/ClubMatiq/issues/86) | Zentrale Zahlungsübersicht und offene Forderungen im Dashboard | Offen |

## v3.0.0 – Plattform und Kundenbeteiligung

| Issue | Funktion | Status am bisherigen Planungsstichtag |
| --- | --- | --- |
| [#104](https://github.com/JenSusann/ClubMatiq/issues/104) | Plattformadministration, Vereinsübersicht und Lizenzverrechnung | Offen |
| [#139](https://github.com/JenSusann/ClubMatiq/issues/139) | Release-Roadmap und Changelog | Offen |
| [#114](https://github.com/JenSusann/ClubMatiq/issues/114) | Vereinsübergreifendes Feedback- und Ideenforum mit Feature-Wünschen | Offen |

## Weitere optionale Erweiterungen – Backlog

| Issue | Funktion | Status am bisherigen Planungsstichtag |
| --- | --- | --- |
| [#77](https://github.com/JenSusann/ClubMatiq/issues/77) | Bestellbestätigung für Vereinskleider | Offen |
| [#82](https://github.com/JenSusann/ClubMatiq/issues/82) | Inventarartikel duplizieren | Offen |
| [#85](https://github.com/JenSusann/ClubMatiq/issues/85) | Artikelbilder und Bildergalerie im Inventar | Offen |
| [#89](https://github.com/JenSusann/ClubMatiq/issues/89) | Massenbearbeitung von Inventarartikeln | Offen |
| [#95](https://github.com/JenSusann/ClubMatiq/issues/95) | Individuelle Rechnungs- und Gutschriftsnummernkreise pro Verein | Offen |
| [#100](https://github.com/JenSusann/ClubMatiq/issues/100) | Zwei-Faktor-Authentifizierung (2FA) für Benutzerkonten | Offen |
| [#102](https://github.com/JenSusann/ClubMatiq/issues/102) | Progressive Web App (PWA) und Smartphone-Installation | Offen |
| [#105](https://github.com/JenSusann/ClubMatiq/issues/105) | Allgemeines Audit-Protokoll für Stammdaten und Einstellungen | Offen |
| [#113](https://github.com/JenSusann/ClubMatiq/issues/113) | Vereinsindividuelles PDF-Design und Dokumentvorlagen | Offen |
| [#75](https://github.com/JenSusann/ClubMatiq/issues/75) | Intelligente Nachbestellvorschläge | Offen |
| [#78](https://github.com/JenSusann/ClubMatiq/issues/78) | Automatische Erinnerungs-E-Mails für Rückgaben und Kleiderabholungen | Offen |
| [#83](https://github.com/JenSusann/ClubMatiq/issues/83) | Lagerortwechsel mit Bewegungsprotokoll | Offen |
| [#90](https://github.com/JenSusann/ClubMatiq/issues/90) | Materialaussonderung und dokumentierte Inventarabgänge | Offen |
| [#110](https://github.com/JenSusann/ClubMatiq/issues/110) | Ausleihbestätigung als PDF für interne Materialausleihen | Offen |
| [#87](https://github.com/JenSusann/ClubMatiq/issues/87) | Vereinsinterner Onlineshop und Mitglieder-Selbstbestellung | Offen |
| [#91](https://github.com/JenSusann/ClubMatiq/issues/91) | Selbstausleihe und Materialanfragen durch Mitglieder | Offen |
| [#92](https://github.com/JenSusann/ClubMatiq/issues/92) | Umtauschanfragen für Vereinskleider durch Mitglieder | Offen |
| [#93](https://github.com/JenSusann/ClubMatiq/issues/93) | Vereinsinterne Zweite-Hand-Kleiderbörse | Offen |
| [#106](https://github.com/JenSusann/ClubMatiq/issues/106) | Artikelspezifische Grössentabellen für Vereinskleider | Offen |
| [#107](https://github.com/JenSusann/ClubMatiq/issues/107) | Personalisierte Vereinskleider mit Namen, Initialen und individuellen Aufdrucken | Offen |
| [#112](https://github.com/JenSusann/ClubMatiq/issues/112) | Persönliche Wunschliste für Vereinskleider im Mitglieder-Onlineshop | Offen |
| [#94](https://github.com/JenSusann/ClubMatiq/issues/94) | Automatische Zahlungserinnerungen für offene Rechnungen | Offen |

## Abhängigkeiten und Freigabe

- #76 vor #113 und #77; #99 vor #101; #79 und #105 vor erweiterten Freigabeprozessen; #88/#100 vor Mitglieder-Selbstbedienung.
- #80 vor #78 und #110; #110 vor #111; #63 muss für Mailfunktionen freigegeben sein.
- #72 und #87 vor #92/#112; #85/#106/#107 mit Shop abstimmen.
- #108/#90 vor #96; #79/#95 vor Finanzautomatisierung; #104 vor #114 und #139; #139 und #114 gemeinsam abstimmen.
- Major-Nummern sind Produktplanungsziele; bei strikt kompatiblen Änderungen wird die tatsächliche SemVer-Nummer vor Freigabe angepasst.
- Bestehende Projektmeilensteine M1–M5 bleiben erhalten. Die priorisierten Issues sind gemäss obigem Plan neu zuzuordnen; GitHub erlaubt nur einen Meilenstein pro Issue. Statuslabels ergänzen die Versionszuordnung, ersetzen sie aber nicht.
- Keine geplante Funktion gilt ohne Umsetzung, Testnachweis und manuelle Abnahme als bereit zur Veröffentlichung. Der Issue-Abschluss erfolgt erst bei Veröffentlichung der Zielversion gemäss Release-Strategie.

- Vor Umsetzung insbesondere #105 für Freigabeprozesse, #110 für Materialsets und #90 für Abschreibungen prüfen. Diese nicht priorisierten Issues werden nicht automatisch vorgezogen.
- Die Liste weiterer Erweiterungen übernimmt den bisherigen Roadmap-Bestand; neue, dort noch nicht erfasste GitHub-Issues bleiben unverändert bestehen.
