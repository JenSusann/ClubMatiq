# Projektdokumentation - ClubMatiq

## Projektübersicht & Zugänge

| Angabe | Inhalt |
|---|---|
| Projekttitel | ClubMatiq – Digitale Material- und Inventarverwaltung für Vereine |
| Verfasser/in | Jennifer Mentner – **[Klasse ergänzen]** |
| GitHub-Repository | **[Direkten Link zum Repository ergänzen]** |
| Aktuelle App | Noch nicht öffentlich bereitgestellt; derzeit lokale Entwicklungsumgebung |
| Getestete Version | Lokaler Entwicklungsstand vom 11. November 2026; **[Commit/Tag nach dem Push ergänzen]** |
| Testzugänge | Registrierung und Anmeldung implementiert; separate Testzugänge für Dozierende vor der Abgabe sicher bereitstellen |
| Figma / Referenz-Mockup | **[Link ergänzen, sobald vorhanden]** |
| Weitere Artefakte [Optional] | **[Links zu Abgaben, Skizzen, User Journey Map und Projektunterlagen ergänzen]** |

> **Zugriff:** Vor der Abgabe sicherstellen, dass die Dozierenden auf Repository, App und verlinkte Artefakte zugreifen können.

> **Testzugänge:** Keine persönlichen Passwörter, API-Schlüssel oder MongoDB-Zugangsdaten im Repository veröffentlichen. Testkonten gegebenenfalls separat bereitstellen.

## Inhaltsverzeichnis

[Projektübersicht & Zugänge](#projektübersicht--zugänge)

1. [Ausgangslage](#1-ausgangslage)

2. [Lösungsidee](#2-lösungsidee)

3. [Vorgehen & Artefakte](#3-vorgehen--artefakte)

    1. [Understand & Define](#31-understand--define)

    2. [Sketch](#32-sketch)

    3. [Decide](#33-decide)

    4. [Prototype](#34-prototype)

    5. [Validate](#35-validate)

4. [Erweiterungen [Optional]](#4-erweiterungen-optional)

5. [Projektorganisation [Optional]](#5-projektorganisation-optional)

6. [KI-Deklaration](#6-ki-deklaration)

7. [Anhang [Optional]](#7-anhang-optional)

> **Hinweis:** Massgeblich sind die im Unterricht und auf Moodle kommunizierten Anforderungen. Die Angaben zu Mindestumfang und Erweiterungen sind vor der Abgabe mit diesen Anforderungen abzugleichen.

## 1. Ausgangslage

- **Problem:** In Vereinen werden Materialbestände, Vereinskleider und Ausleihen häufig über unterschiedliche Listen und manuelle Absprachen verwaltet. Dadurch ist nicht jederzeit ersichtlich, welches Material vorhanden ist, wo es lagert und an wen es ausgeliehen wurde. Auch die Erfassung von Kleidergrössen und Inventarwerten kann aufwendig sein.

- **Ziele:** ClubMatiq soll eine zentrale, einfach bedienbare Webanwendung für Artikel, Lagerorte, Grössen und Materialbewegungen bereitstellen. Bestände sollen nachvollziehbar sein und Ausleihen sowie Rückgaben ohne parallele Listen dokumentiert werden können.

- **Primäre Zielgruppe:** Personen, die in einem Verein Material, Vereinskleider und Inventar betreuen, insbesondere Materialverantwortliche und Leiterinnen bzw. Leiter.

- **Weitere Stakeholder [Optional]:** Kassiererin bzw. Finanzverantwortliche für Inventarwerte und Rechnungsbezüge; Vereinsvorstand als organisatorisch verantwortliches Gremium. Der Turnverein Weiningen dient als Praxisbeispiel.

## 2. Lösungsidee

- **Kernfunktionalität:** ClubMatiq bündelt die Inventarverwaltung in einer Weboberfläche. Artikel werden mit Kategorie, Lagerort, Beschreibung, Bestand und Einzelwert erfasst. Vereinskleider können mehrere Grössen mit unterschiedlichen Beständen und Werten besitzen. Material kann an Personen ausgeliehen und teilweise oder vollständig zurückgegeben werden; verfügbare Mengen werden dabei automatisch angepasst. Die Übersicht zeigt offene, überfällige und abgeschlossene Ausleihen. Vereine können sich mit einem Administratorkonto registrieren und anschliessend ihre eigenen Inventardaten verwalten. Die Inventurverwaltung mit Abschluss, Korrekturen, Stornierung, Verlauf und PDF-Bericht ist inzwischen umgesetzt. QR-Codes und weitere Bereiche sind je nach Entwicklungsstand noch vorgesehen oder als Platzhalter vorhanden.

- **Annahmen [Optional]:** Eine gemeinsame Datenbasis reduziert Mehrfacherfassungen. Eine übersichtliche Bedienung mit klaren Formularen unterstützt auch Vereinsmitglieder mit wenig IT-Erfahrung. Grössenvarianten sind für die Verwaltung von Vereinskleidern notwendig.

- **Abgrenzung [Optional]:** Der aktuelle Stand ist ein lokal getesteter Prototyp und keine produktiv freigegebene Vereinssoftware. Registrierung, Anmeldung und eine erste Administratorrolle sind implementiert. Eine serverseitige Berechtigungsprüfung ist für die Inventur-Endpunkte vorhanden; die vollständige Benutzer- und Rollenverwaltung sowie sämtliche Rechteprüfungen sind vor einer Produktivfreigabe weiter zu verifizieren. Öffentliches Deployment und weitere Module sind noch nicht abgeschlossen. Eine vollständige Buchhaltung ist nicht Bestandteil des Prototyps.

## 3. Vorgehen & Artefakte

Die Entwicklung erfolgt schrittweise anhand des Vereinskontexts, der Entwurfsaufgaben aus dem Unterricht und der technischen Umsetzung eines testbaren Prototyps.

### 3.1 Understand & Define

**Ausgangslage und Problemraum.** In der ersten Abgabe wurden vier Problembereiche identifiziert: fehlende Inventarübersicht, unübersichtliche Materialausleihe, aufwendige Bestandskontrolle und verteilte Informationen. Ausgewählt wurde der Problemraum **«Fehlende Transparenz und hoher Verwaltungsaufwand bei der Inventarverwaltung»**. Im Vereinskontext sind insbesondere begrenzte Zeitressourcen und unterschiedliche Zuständigkeiten relevant.

**Zielgruppen und Bedürfnisse.** Die Problemraumanalyse betrachtet Materialverantwortliche, Vorstandsmitglieder, Vereinsmitglieder und Trainingsleitende. Zentrale Bedürfnisse sind aktuelle Mengen und Lagerorte, nachvollziehbare Materialbewegungen und eine möglichst einfache Bedienung.

**Annahmen (noch nicht empirisch bestätigt).** Die Analyse hält fest, dass Inventardaten teilweise dezentral liegen könnten, Bestandsänderungen verspätet dokumentiert werden könnten, ehrenamtliche Personen wenig Zeit haben, Material von mehreren Personen genutzt wird und fehlende Transparenz Doppelanschaffungen begünstigen könnte. Diese Punkte sind **Hypothesen**, keine durch Interviews bestätigten Befunde.

**How-Might-We-Fragen (HMW):**

1. **Transparenz (priorisiert):** Wie könnten wir Materialverantwortliche dabei unterstützen, jederzeit einen einfachen und aktuellen Überblick über vorhandenes Inventar, Bestände und Lagerorte zu erhalten?
2. **Materialbewegungen:** Wie könnten wir Ausgabe und Rückgabe gemeinsam genutzten Materials nachvollziehbar und administrativ einfach gestalten?
3. **Bestandskontrolle:** Wie könnten wir fehlendes oder knappes Material frühzeitig erkennen und Bestandskontrollen effizienter durchführen?

Die erste Frage bildet die Leitfrage des Prototyps; die beiden weiteren Fragen begründen ergänzende Funktionen wie Ausleihe und Inventur.

**Primärnachweis:** [Abgabe 1 – Problemraumanalyse (PDF)](docs/artefakte/problemraumanalyse.pdf), Seiten 1–3.

### 3.2 Sketch

**Drei Proto-Personas.** Die Skizzierabgabe beschreibt drei unterschiedliche Nutzungsperspektiven:

| Proto-Persona | Hauptziel | Daraus abgeleitete Designanforderung |
|---|---|---|
| Jennifer – Kassiererin / Vorstand | Inventarwerte und Kleiderverkäufe für Buchhaltung und Rechnungsstellung nachvollziehen | Auswertbare Bestände, Werte und nachvollziehbare Änderungen |
| Nathalie – Leiterin | Material und Lagerort schnell finden und Verfügbarkeit prüfen | Schnelle Suche, verständliche Navigation und geringer Erfassungsaufwand |
| Laura – Materialverantwortliche | Material, Grössen, Lagerorte, Ausleihen und Inventuren zentral verwalten | Zentrale Artikelübersicht und verlässliche Bestandsführung |

Die Personas sind **konzeptionelle Proto-Personas**, keine nachgewiesenen Interviewprofile.

![Proto-Persona Jennifer](docs/images/personas-jennifer.png)

*Abbildung 1: Proto-Persona Jennifer und ihre Anforderungen aus Sicht der Vereinsbuchhaltung.*

![Proto-Personas Nathalie und Laura](docs/images/personas-nathalie-laura.png)

*Abbildung 2: Bedürfnisse von Trainingsleitung und Materialverantwortung.*

![Vergleich der Proto-Personas](docs/images/personas-vergleich.png)

*Abbildung 3: Vergleich der Aufgabenprioritäten der drei Rollen.*

**Crazy 8s – Ideenentwicklung.** Aus den Bedürfnissen der drei Proto-Personas wurden acht Lösungsansätze entwickelt und handschriftlich skizziert.

| Nr. | Lösungsansatz | Beschreibung | Relevante Personas |
|---|---|---|---|
| 1 | Zentrales Inventar-Dashboard | Übersicht über Materialien, Bestand, Lagerort und Status inklusive Warnhinweisen. | Laura, Jennifer, Nathalie |
| 2 | Materialverwaltung per QR-Code | Artikelinformationen und Bestandsänderungen per QR-Code aufrufen bzw. erfassen. | Laura, Nathalie |
| 3 | Digitale Materialausleihe | Material Personen zuordnen, Rückgabedaten festhalten und offene Ausleihen anzeigen. | Laura, Nathalie |
| 4 | Vereinskleider mit Rechnungsstellung | Kleiderverkäufe erfassen, Bestand anpassen und Rechnung vorbereiten. | Jennifer, Laura |
| 5 | Digitale Inventur | Soll- und Ist-Bestände vergleichen und Abweichungen korrigieren. | Jennifer, Laura |
| 6 | Inventarbewertung für die Buchhaltung | Bestände und Einstandspreise zu einem Inventarwert zusammenführen. | Jennifer, Laura |
| 7 | Materialbedarf und Schadensmeldungen | Fehlendes oder beschädigtes Material melden und bearbeiten. | Nathalie, Laura |
| 8 | Materialsuche nach Lagerort | Material nach Kategorien, Suchbegriffen und Lagerorten finden. | Nathalie, Laura |

![Handgezeichnete Crazy-8s-Skizzen](docs/images/crazy8s.png)

*Abbildung: Acht handgezeichnete Lösungsvarianten aus der Sketch-Phase.*

![Crazy-8s-Skizzen](docs/images/crazy8s.png)

*Abbildung 4: Acht Ideen mit handgezeichneten Skizzen aus der Sketch-Abgabe.*

**Primärnachweis:** [Abgabe 9 – Sketch / Skizzieren (PDF)](docs/artefakte/skizzieren.pdf), Seiten 1–4.

### 3.3 Decide

**Entscheidung.** Ausgewählt wurde das **zentrale Inventar-Dashboard**. Gemäss Entscheidungsreflexion berücksichtigt es die Bedürfnisse aller drei Proto-Personas, vereinfacht die Artikelsuche und bildet eine erweiterbare Grundlage für Ausleihe, Rechnungsstellung und Inventarbewertung. Damit passt die Wahl zur priorisierten HMW-Frage nach Transparenz über Bestände und Lagerorte.

**User Journey Map – Artikel erfassen.** Das dokumentierte Szenario folgt **Laura**, die einen neuen Artikel anlegt. Die vier Phasen sind: Dashboard öffnen → Artikel erfassen → Angaben prüfen → Speichern. Die Journey beschreibt Ziele, Aktionen, Touchpoints, gewünschte Emotionen, Risiken und Massnahmen. Beispiele: klare Navigation gegen Orientierungsprobleme, Pflichtfeldkennzeichnung gegen unvollständige Eingaben, Plausibilitätsprüfung gegen falsche Mengen und eine Erfolgs-/Fehlermeldung nach dem Speichern.

![User Journey und handgezeichneter Ablauf](docs/images/user-journey.png)

*Abbildung 5: User Journey Map und skizzierter End-to-End-Ablauf der Artikelerfassung.*

**Wichtige Abgrenzung:** Diese User Journey dokumentiert die **Artikelerfassung**, nicht die Materialausleihe. Ein Figma-Mockup ist durch die vorliegenden beiden Abgaben nicht belegt; falls vorhanden, separat verlinken. Die gezeichneten Ansichten sind Konzeptskizzen, keine Screenshots der fertigen Anwendung.

**Primärnachweis:** [Abgabe 9 – Sketch / Skizzieren (PDF)](docs/artefakte/skizzieren.pdf), Seiten 5–6.

### 3.4 Prototype

#### 3.4.1. Entwurf (Design)

- **Informationsarchitektur:** Die Startseite bietet Zugänge zu Inventar, QR-Code, Materialausleihe, Vereinskleidern, Inventur, Inventarbewertung, Schadensmeldungen und Materialsuche. Registrierung und Anmeldung sind als eigene Seiten umgesetzt; der Kopfbereich zeigt bei angemeldeten Benutzern Name, Rolle und Abmeldefunktion. Über die Navigation ist ausserdem die Stammdatenverwaltung mit Kategorien, Lagerorten und Grössen erreichbar. Einzelne noch nicht implementierte Bereiche dienen weiterhin als Platzhalter.

- **User Interface Design:** Die Inventarübersicht kombiniert Kennzahlen, Suche, Kategorienfilter und eine Artikeltabelle. Artikel können aufgeklappt, bearbeitet und gelöscht werden. Das Ausleihformular zeigt verfügbare Mengen; die Ausleihübersicht enthält Statusfilter, Kennzahlen und einen Rückgabedialog. **[Screenshots der Startseite, Inventarübersicht, Artikelmaske und Materialausleihe ergänzen]**.

- **Designentscheidungen:** Wiederkehrende Formulare, eindeutige Schaltflächen und eine konsistente Farbgestaltung sollen die Bedienung vereinfachen. Vereinskleider werden nicht als separate Artikelwelt geführt, sondern über Grössenvarianten innerhalb der zentralen Inventarverwaltung abgebildet.

#### 3.4.2. Umsetzung (Technik)

- **Technologie-Stack:** SvelteKit, Svelte 5, TypeScript, MongoDB-Treiber für Node.js und MongoDB Atlas als Cloud-Datenbank.

- **Tooling:** Visual Studio Code, Node.js/npm, Git, GitHub, MongoDB Atlas und lokale Browser-Tests. KI-Unterstützung ist in Kapitel 6 beschrieben.

- **Vorgehen bei der Implementierung:** Funktionen wurden in kleinen Schritten umgesetzt und unmittelbar lokal geprüft: zunächst Projektstruktur und Datenbankverbindung, danach Stammdaten, Artikelanlage, Inventarübersicht, Artikelbearbeitung, Materialausleihe mit Rückgabe und anschliessend die Inventurverwaltung samt PDF-Export. Fehlermeldungen aus TypeScript und Laufzeittests wurden schrittweise behoben. Danach wurden Registrierung, Login, Session-Prüfung, automatische Anmeldung nach Registrierung und die Vereinsfilter in den API-Endpunkten ergänzt. Die Umsetzung wurde durch ChatGPT mit Codevorschlägen und Fehlersuche unterstützt; Auswahl, Integration und lokale Prüfung erfolgten im Projekt. Details siehe Kapitel 6.

- **Struktur & Komponenten:** Die Seiten liegen unter `src/routes/`, beispielsweise `inventar/`, `inventar/neu/`, `inventar/[id]/bearbeiten/`, `ausleihen/`, `stammdaten/`, `anmelden/` und `registrieren/`. Die Komponente `src/lib/AusleihenUebersicht.svelte` stellt die Ausleihen dar und ermöglicht Rückgaben. Die MongoDB-Verbindung befindet sich in `src/lib/server/mongodb.ts`. Server-Endpunkte liegen unter `src/routes/api/`.

- **Daten & Schnittstellen:** Die Datenbank `clubmatiq` enthält unter anderem die Collections `artikel`, `artikelvarianten`, `kategorien`, `lagerorte`, `groessen`, `ausleihen`, `vereine`, `benutzer` und `sessions`. SvelteKit-API-Routen stellen JSON-Daten bereit und übernehmen Prüfungen und Schreiboperationen. Für Ausleihen, Rückgaben und kritische Inventurvorgänge werden MongoDB-Transaktionen eingesetzt, damit Bestandsänderungen und Ausleihvorgänge gemeinsam gespeichert werden. Verbindungsdaten werden über eine lokale `.env`-Datei verwaltet und nicht ins Repository übernommen. Passwörter werden mit Argon2 gehasht; Sessions werden über ein HttpOnly-Cookie und serverseitig gespeicherte Token-Hashes verwaltet. Der Server-Hook `src/hooks.server.ts` prüft die Anmeldung und schützt nicht öffentliche Routen. Die Datensätze der Inventar-Collections tragen eine `vereinId`; API-Abfragen und Schreiboperationen sind auf den angemeldeten Verein eingeschränkt. Für ältere Datensätze wurde ein Migrationsskript zur Vereinszuordnung ausgeführt.

- **Deployment:** Link siehe «Aktuelle App» in der [Projektübersicht](#projektübersicht--zugänge). Ein öffentliches Deployment ist noch ausstehend; Netlify ist als Hosting-Option vorgesehen.

- **Besondere Entscheidungen:** Grössenabhängige Artikel erhalten eigene Datensätze in `artikelvarianten`, damit Mengen und Einzelwerte pro Grösse unterschiedlich sein können. Bei einer Ausleihe wird derzeit der **verfügbare** Bestand reduziert und bei Rückgabe erhöht. Für eine spätere buchhalterische Inventarbewertung muss weiterhin ausgeliehenes, aber vereinseigenes Material mitgezählt werden. Die grundlegende Authentifizierung ist umgesetzt. Vor einer öffentlichen Freigabe müssen insbesondere Rollenrechte, alle API-Endpunkte, parallele Änderungen, Registrierungs-Missbrauchsschutz, PDF-Zugriff und Mandantentrennung sicherheitstechnisch weiter geprüft werden.

### 3.5 Validate

> **Stand 11. November 2026:** Bisher wurden Funktionen während der Entwicklung lokal ausprobiert. Eine formelle, separat deployte Nutzerevaluation mit dokumentierter Stichprobe und Nachweisen ist noch nicht abgeschlossen. Inventur- und PDF-Funktionen wurden lokal mit `npm run check` und manuellen Browser-Tests überprüft. Die folgenden Angaben sind deshalb als Planungsstand gekennzeichnet.

- **Getestete Version:** Bislang lokaler Entwicklungsstand; separat deployte Testversion und Commit/Tag noch ausstehend. Link nach Bereitstellung in der [Projektübersicht](#projektübersicht--zugänge) ergänzen.

- **Ziele der Prüfung:** Können Vereinsverantwortliche Artikel selbstständig erfassen und finden? Sind Grössenbestände verständlich? Lassen sich Ausleihen und Teilrückgaben fehlerfrei durchführen?

- **Vorgehen:** **[Formelle Evaluation noch planen: moderiert/unmoderiert, vor Ort/remote]**. Bisher erfolgten manuelle Funktionstests während der Entwicklung.

- **Stichprobe:** **[Testpersonen, Rollen und Anzahl nach tatsächlicher Durchführung ergänzen]**.

- **Aufgaben/Szenarien:** Vorgeschlagene Szenarien: (1) Neuen Inventarartikel mit Lagerort erfassen; (2) Vereinskleid mit mehreren Grössen und Preisen erfassen; (3) Artikel über Suche finden; (4) Material ausleihen; (5) Teilrückgabe und anschliessend vollständige Rückgabe erfassen.

- **Kennzahlen & Beobachtungen:** **[Erfolgsquote, Zeitbedarf, Schwierigkeiten und Rückmeldungen erst nach Durchführung eintragen]**. In lokalen Entwicklungstests funktionierten Artikelanlage, Bearbeitung, Löschung sowie Ausleihe und Rückgabe nach Fehlerkorrekturen. Zusätzlich wurden die automatische Anmeldung nach Neuregistrierung sowie die Trennung von Inventardaten und Testkategorien zwischen zwei Vereinen manuell erfolgreich überprüft.

- **Nachweise:** **[Anonymisierte Testprotokolle, Screenshots, Beobachtungsnotizen und Auswertung verlinken]**.

- **Zusammenfassung der Resultate:** Die bisherigen lokalen Tests bestätigen die grundlegende technische Funktionsfähigkeit der umgesetzten Kernabläufe. Bei einem zweiten Testverein waren die Daten des ersten Vereins nicht sichtbar; auch eine neu erstellte Testkategorie blieb auf den eigenen Verein beschränkt. Dies ist ein Funktionstest, kein vollständiger Sicherheitsnachweis gegen manipulierte API-Anfragen. Aussagen über die Verständlichkeit und Nutzbarkeit für andere Vereinsmitglieder sind erst nach einer strukturierten Evaluation möglich.

- **Abgeleitete Verbesserungen:** Als nächste Schritte sind eine vollständige Prüfung der Mandantentrennung bei direkten API-Anfragen, die Verifikation aller Benutzer- und Rollenrechte, QR-Code-Zugriff auf Artikel sowie weitere Module vorgesehen. Konkrete, aus Nutzertests abgeleitete Verbesserungen werden nach der Evaluation ergänzt.

## 4. Erweiterungen [Optional]

> **Wichtig:** Die nachfolgenden Funktionen sind als **mögliche** Software-Erweiterungen dokumentiert. Ob sie tatsächlich über den verbindlichen Mindestumfang hinausgehen und als Erweiterung zählen, muss anhand der Moodle-/Unterrichtsanforderungen geprüft werden. Für eine Bewertung sind Nachweise und Codereferenzen zu ergänzen.

### 4.1 Software-Erweiterungen

#### 4.1.1 Grössenabhängige Inventarvarianten

- **Beschreibung & Nutzen:** Vereinskleider können mit mehreren Grössen und jeweils eigenem Bestand sowie Einzelwert verwaltet werden. Dies erleichtert die Bestandsführung für Kinder- und Erwachsenengrössen.

- **Abgrenzung zum Mindestumfang:** **[Prüfen und konkret mit den verbindlichen Mindestanforderungen abgleichen]**.

- **Umsetzung:** Datenmodell mit `artikel` und `artikelvarianten`; Artikelanlage und -bearbeitung mit Grössentabelle sowie Summenberechnung in der Inventarübersicht.

- **Nachweise:** **[Screenshot der Grössentabelle ergänzen]**. Codestellen: `src/routes/inventar/neu/+page.svelte`, `src/routes/inventar/[id]/bearbeiten/+page.svelte`, `src/routes/api/artikel/+server.ts`, `src/routes/api/inventar-uebersicht/+server.ts`.

- **Bezug zur Evaluation:** Nein; aus dem Vereinskontext und den Anforderungen an die Kleiderverwaltung abgeleitet.

#### 4.1.2 Teil- und Vollrückgabe bei Materialausleihen

- **Beschreibung & Nutzen:** Material kann in mehreren Schritten zurückgegeben werden. Der verfügbare Bestand erhöht sich jeweils um die tatsächlich zurückgegebene Menge; abgeschlossene Ausleihen bleiben nachvollziehbar.

- **Abgrenzung zum Mindestumfang:** **[Prüfen und konkret mit den verbindlichen Mindestanforderungen abgleichen]**.

- **Umsetzung:** Rückgabe-Endpunkt mit MongoDB-Transaktion und Rückgabedialog in der Ausleihübersicht. Status und Restmenge werden aktualisiert.

- **Nachweise:** **[Screenshot einer Teilrückgabe und der aktualisierten Übersicht ergänzen]**. Codestellen: `src/routes/api/ausleihen/[id]/rueckgabe/+server.ts` und `src/lib/AusleihenUebersicht.svelte`.

- **Bezug zur Evaluation:** Nein; als funktionale Ergänzung des Ausleihprozesses umgesetzt. Eine spätere Nutzerevaluation steht noch aus.

### 4.2 Weitere Erweiterungen

#### 4.2.1 Vereinsregistrierung, Anmeldung und Mandantentrennung

- **Beschreibung & Nutzen:** Mehrere Vereine können die gleiche Anwendung mit getrennten Datenbeständen nutzen. Bei der Registrierung werden ein Verein und ein Administratorkonto angelegt; nach erfolgreicher Registrierung erfolgt die automatische Anmeldung.

- **Abgrenzung zum Mindestumfang:** **[Mit verbindlichen Anforderungen aus Moodle abgleichen]**.

- **Umsetzung:** `vereine`, `benutzer` und `sessions` in MongoDB; Passwort-Hashing mit Argon2; Session-Cookie und Authentifizierungsprüfung in `src/hooks.server.ts`; serverseitige Weitergabe des Benutzers über `src/routes/+layout.server.ts`. Die relevanten Inventar-APIs filtern nach `vereinId`, darunter Artikel, Kategorien, Lagerorte, Grössen, Ausleihen und Inventarübersicht. Registrierungsseite unter `src/routes/registrieren/+page.svelte`.

- **Nachweise:** **[Screenshots der Registrierung, angemeldeten Startseite und des Tests mit zwei Vereinen ergänzen]**.

- **Bezug zur Evaluation:** Zwei Vereine wurden im lokalen Entwicklungstest auf getrennte Anzeige und Erstellung von Daten geprüft; ein systematischer Sicherheits- und Nutzertest steht aus.

Noch keine zusätzliche methodische oder organisatorische Erweiterung zur Bewertung dokumentiert. **[Bei Bedarf einen Eintrag 4.2.1 mit sämtlichen Pflichtfeldern gemäss Vorlage ergänzen]**.

## 5. Projektorganisation [Optional]

- **Repository & Struktur:** Die Projektdateien werden in einem GitHub-Repository verwaltet; Link siehe [Projektübersicht](#projektübersicht--zugänge). SvelteKit trennt Seiten, wiederverwendbare Komponenten, serverseitige Datenbankanbindung und API-Endpunkte.

- **Issue-Management:** **[Falls verwendet: Vorgehen und Link ergänzen; andernfalls «Kein separates Issue-Management dokumentiert»]**.

- **Commit-Praxis:** Änderungen werden mit Git versioniert und auf GitHub gesichert. Sprechende Commit-Nachrichten sollen den jeweiligen Entwicklungsstand erkennbar machen.

## 6. KI-Deklaration

KI wurde im Projekt eingesetzt, insbesondere bei der Programmierung und technischen Fehlersuche. Die Nutzung wird nachfolgend offengelegt.

### 6.1 KI-Tools

- **Eingesetzte Tools:** ChatGPT (OpenAI); **[weitere tatsächlich eingesetzte KI-Tools und gegebenenfalls Modellvarianten ergänzen]**.

- **Zweck & Umfang:** ChatGPT wurde zur Strukturierung von Entwicklungsschritten, zum Formulieren von Codevorschlägen für SvelteKit-Komponenten und API-Endpunkte, zur Erklärung von TypeScript-Fehlern, zur Fehlerbehebung und zur Überarbeitung der Projektdokumentation verwendet. Wesentliche Teile der bisher implementierten Funktionen basieren auf KI-unterstützten Codevorschlägen.

- **Eigene Leistung (Abgrenzung):** Projektidee und Vereinsanforderungen wurden aus dem eigenen Anwendungskontext eingebracht. Die vorgeschlagenen Änderungen wurden eigenständig in VS Code integriert, lokal ausgeführt, auf Fehler geprüft und bei Bedarf gemeinsam mit der KI überarbeitet. **[Weitere selbst erstellte Entwurfs- und Analyseartefakte konkret ergänzen]**.

### 6.2 Vorgehen mit KI

- **Arbeitsablauf & Aufgabenverteilung:** Die Entwicklung wurde in kleine, einzeln überprüfbare Schritte gegliedert. ChatGPT lieferte Erklärungen und teilweise vollständige Dateivorschläge. Die Umsetzung in der lokalen Entwicklungsumgebung, das Ausführen der Tests und die Rückmeldung zu auftretenden Fehlern erfolgten durch die Projektbearbeiterin. Es wurde keine eigenständig im Repository handelnde Coding-Agent-Umgebung eingesetzt, soweit bisher dokumentiert.

- **Prompt-Vorgehen & Kontext:** Anforderungen wurden anhand konkreter Vereinsprozesse beschrieben. Für Fehlerbehebungen wurden Fehlermeldungen und bestehende Codeausschnitte bereitgestellt. Nach jedem Entwicklungsschritt wurde geprüft, ob die Funktion wie vorgesehen arbeitet.

- **Konfiguration & Werkzeuge:** Keine projektspezifische KI-Agenten-Konfiguration dokumentiert. Die Codeintegration erfolgte in Visual Studio Code; Git/GitHub dienten der Versionsverwaltung. Die Anmeldung und Mandantentrennung wurden anhand vorhandener API-Dateien und lokaler Tests schrittweise überarbeitet.

- **Prüfung & Überarbeitung:** KI-Vorschläge wurden durch lokale Ausführung, Browser-Tests und TypeScript-Fehlermeldungen überprüft. Bei Problemen wurden die betroffenen Stellen angepasst und erneut getestet. So wurde die automatische Anmeldung nach der Registrierung erst nach Anpassung der Registrierungsseite und der Navigation korrekt angezeigt. Für eine spätere Veröffentlichung sind zusätzliche Sicherheits-, Integrations- und Nutzertests erforderlich. Externe Inhalte und Lizenzen sind vor der Abgabe gesondert zu prüfen.

### 6.3 Reflexion

Der Einsatz von ChatGPT hat die schrittweise technische Umsetzung beschleunigt und insbesondere bei der Fehlersuche geholfen. Gleichzeitig zeigte sich, dass generierter Code nicht automatisch fehlerfrei oder direkt mit bestehenden Dateien kompatibel ist: Unter anderem mussten TypeScript-Typen und die Reihenfolge von Variablendeklarationen korrigiert werden. Die Verantwortung für das Verständnis, die Integration, die Prüfung und die abschliessende Qualität der Anwendung verbleibt bei der Projektbearbeiterin. Für die weitere Entwicklung sind nachvollziehbare Tests und eine kritische Prüfung sicherheitsrelevanter Funktionen wichtig.

## 7. Anhang [Optional]

- **Quellen:** **[Verwendete fremde Vorlagen, Bilder, Icons, Code und weitere Inhalte mit Quelle sowie Lizenz/Nutzungsbedingungen ergänzen]**. Die Dokumentationsstruktur basiert auf der im Unterricht bereitgestellten README-Vorlage.

- **Testskript & Materialien:** **[Link zu den Testaufgaben und anonymisierten Testprotokollen ergänzen]**.

- **Rohdaten/Auswertung:** **[Falls vorhanden: Link ergänzen]**.

- **Entwurfsartefakte:** [Problemraumanalyse](docs/artefakte/problemraumanalyse.pdf) und [Sketch-Abgabe](docs/artefakte/skizzieren.pdf); Mockup-Link bei Vorliegen ergänzen.

**---**

**Dokumentationsstand:** 11. November 2026 – Designartefakte aus Abgabe 1 und Abgabe 9 integriert; laufender Prototyp, noch keine abschliessende Evaluation.


## 8. Inventurverwaltung – technischer Funktionsstand

**Stand: 11. November 2026.** Die nachfolgenden Funktionen wurden im Projekt schrittweise ergänzt und lokal geprüft. Die Dokumentation beschreibt den bekannten Implementierungsstand, keine produktive Sicherheitszertifizierung.

### 8.1 Inventur anlegen, zählen und verwalten

- Inventurtypen: Gesamtinventur oder Inventur für einen bestimmten Lagerort.
- Inventurpositionen enthalten Artikel, optionale Grösse, Soll-Bestand, Ist-Bestand, Differenz und Bemerkung.
- Suche und Filter nach offenen, gezählten oder abweichenden Positionen; Fortschrittsanzeige und Kennzahlen.
- Ist-Mengen werden positionsweise gespeichert; Eingaben müssen ganze Zahlen ab null sein oder für eine noch offene Zählung `null`.
- Offene Zählungen können zurückgesetzt werden, ohne die eigentlichen Lagerbestände zu verändern.
- Abschluss erst, wenn alle Positionen gezählt und gespeichert sind. Bestandsdifferenzen werden bei Abschluss ins Inventar übernommen.

### 8.2 Abschluss, Korrekturen und Stornierung

- **Abschluss:** Verbindliche Übernahme der Differenzen, Statuswechsel auf `abgeschlossen`, Protokollierung des Vorgangs.
- **Nachträgliche Korrektur:** Bei abgeschlossenen Inventuren kann eine gezählte Menge mit Begründung korrigiert werden. Nur die zusätzliche Bestandsdifferenz wird gebucht; ursprüngliche Werte bleiben über das Protokoll nachvollziehbar.
- **Stornierung:** Offene oder abgeschlossene Inventuren können mit Begründung storniert werden. Bei abgeschlossenen Inventuren werden die durch die Inventur gebuchten Differenzen unter den serverseitigen Sicherheitsprüfungen rückgebucht. Spätere unabhängige Ausleihen und Rückgaben sollen bestehen bleiben.
- **Schutz vor konkurrierenden Änderungen:** Inventuren führen eine `version`. Vor kritischen Aktionen werden Status und Version erneut geprüft; Transaktionen halten zusammengehörige Datenbankänderungen konsistent.
- **Protokollierung:** In `inventurprotokoll` werden insbesondere Abschlüsse, nachträgliche Korrekturen und Stornierungen mit Zeitstempel und Benutzerreferenz dokumentiert. Für ältere Inventuren können einzelne historische Angaben fehlen.

### 8.3 Inventurverlauf und Korrekturhistorie

Die Detailseite zeigt einen chronologischen **Inventurverlauf** (unter anderem Erstellung, Abschluss, Korrektur, Stornierung) sowie eine separate Tabelle **Nachträgliche Korrekturen**. Die Historie enthält Artikel/Grösse, vorherige und neue Menge, Buchungsdifferenz, Begründung, Zeitpunkt und – soweit auflösbar – den Namen der bearbeitenden Person. Die ursprünglichen Abschlusszählungen sind im Verlauf einsehbar. Historie und Verlauf können aktualisiert werden.

### 8.4 Inventurbericht als PDF

- Bibliothek: `pdf-lib` (über npm installiert).
- Serverroute: `GET /api/inventuren/[id]/pdf`.
- Zugriff aus der Inventurdetailseite über **«Inventurbericht als PDF herunterladen»**.
- Bericht mit Inventurinformationen, Positionen und Soll-/Ist-/Differenzvergleich sowie Informationen zu Abschluss, nachträglichen Korrekturen und gegebenenfalls Stornierung.
- Die Unterscheidung zwischen ursprünglichem Abschlussbestand und späteren Korrekturen ist für die Nachvollziehbarkeit wesentlich.
- **Bekannte Einschränkung:** Im ersten PDF-Stand können Grössen als IDs statt als lesbare Bezeichnungen erscheinen. Dies sollte vor der Abgabe verbessert und mit verschiedenen Inventurtypen getestet werden.

### 8.5 Wichtige Dateien und API-Routen

| Datei / Route | Aufgabe |
|---|---|
| `src/routes/inventur/[id]/+page.svelte` | Detailansicht, Zählung, Abschluss, Korrektur, Stornierung, Verlauf und PDF-Button |
| `src/routes/api/inventuren/[id]/+server.ts` | `GET` Inventur und Positionen; `PATCH` einzelne Zählposition speichern |
| `src/routes/api/inventuren/[id]/abschliessen/+server.ts` | Inventur abschliessen und Bestandsdifferenzen übernehmen |
| `src/routes/api/inventuren/[id]/zuruecksetzen/+server.ts` | Zählung einer offenen Inventur zurücksetzen |
| `src/routes/api/inventuren/[id]/korrigieren/+server.ts` | Nachträgliche Bestandskorrektur mit Begründung |
| `src/routes/api/inventuren/[id]/stornieren/+server.ts` | Inventur stornieren, gegebenenfalls Rückbuchungen |
| `src/routes/api/inventuren/[id]/korrekturhistorie/+server.ts` | Korrekturhistorie und chronologischen Verlauf liefern |
| `src/routes/api/inventuren/[id]/pdf/+server.ts` | PDF-Bericht aus MongoDB-Daten erstellen |
| `src/lib/server/mongodb.ts` | MongoDB-Verbindung und Client für Transaktionen |
| `src/lib/server/berechtigungen.ts` | Zentrale Berechtigungsprüfung |

Die Route für den PDF-Bericht wird separat von der bestehenden Inventur-`GET`/`PATCH`-API geführt. Dadurch muss der bereits funktionierende Datenabruf nicht für die PDF-Ausgabe umgebaut werden.

### 8.6 Relevante Datenbank-Collections

| Collection | Zweck |
|---|---|
| `inventuren` | Inventurkopf mit Name, Typ, Lagerort, Status, Version und Zeitstempeln |
| `inventurpositionen` | Einzelne Zählpositionen mit Soll-/Ist-Bestand, Bemerkungen und Artikelbezug |
| `inventurprotokoll` | Historische Aktionen und nachträgliche Korrekturen |
| `artikel`, `artikelvarianten` | Tatsächliche Artikelbestände und grössenabhängige Bestände |
| `groessen`, `lagerorte`, `kategorien` | Stammdaten |
| `vereine`, `benutzer`, `sessions` | Mandantentrennung, Benutzer und Anmeldung |
| `ausleihen` | Ausleihen und Rückgaben |

**Mandantentrennung:** Inventurdaten werden mit der `vereinId` des angemeldeten Benutzers abgefragt und verändert. Der API-Zugriff muss zusätzlich anhand der erforderlichen Berechtigung geprüft werden (z. B. `inventur:lesen`, `inventur:zaehlen`, `inventur:abschliessen`). Die vollständige Rechteabdeckung aller Endpunkte ist weiterhin zu testen.

## 9. Lokale Installation und Tests

### 9.1 Voraussetzungen

- Node.js und npm
- Zugriff auf die konfigurierte MongoDB-Instanz
- Lokale Umgebungsvariablen in `.env` gemäss Projektkonfiguration; **niemals Zugangsdaten ins Git-Repository übernehmen**

```bash
npm install
npm run dev
```

Die lokale Anwendung ist üblicherweise unter `http://localhost:5173` erreichbar, sofern Vite keinen anderen Port meldet.

### 9.2 Qualitätskontrolle

```bash
npm run check
```

`npm run check` führt SvelteKit-Synchronisierung und TypeScript-/Svelte-Prüfungen aus. Ein fehlerfreier Check ersetzt **keine** funktionalen, Berechtigungs- oder Integrationstests.

### 9.3 Manuelle Inventur-Testfälle

1. Gesamtinventur und Lagerortinventur anlegen; Soll-Bestände prüfen.
2. Zählpositionen speichern, Filter und Fortschrittsanzeige prüfen.
3. Abschluss bei offenen oder ungespeicherten Positionen blockieren; vollständig gezählte Inventur abschliessen.
4. Ursprüngliche Soll-/Ist-Werte und Bestandsbuchungen nach Abschluss kontrollieren.
5. Nachträgliche Korrektur mit Begründung buchen; zusätzliche Differenz und Historie prüfen.
6. Inventurverlauf öffnen, Benutzername und Abschlussdetails kontrollieren.
7. Offene und abgeschlossene Inventur stornieren; Rückbuchung und Protokoll prüfen.
8. PDF über den Button herunterladen; Inhalte mit Inventurpositionen und Verlauf vergleichen.
9. Negative Bestände, veraltete Versionen, ungültige Mengen und fehlende Berechtigungen gezielt testen.
10. Zugriffe zwischen zwei Vereinen sowie manipulierte Inventur-IDs auf Datenisolation prüfen.

**Bisher bestätigte lokale Prüfungen:** `npm run check` nach dem PDF-Endpunkt ohne Fehler; PDF-Download über die direkte API-URL und über den Button erfolgreich ausprobiert. Weitere Testfälle sind als Testplan zu verstehen und nicht automatisch als bereits bestanden.

## 10. Technische Entscheidungen und offene Punkte

### 10.1 Entscheidungen

- **SvelteKit + TypeScript:** Gemeinsames Projekt für Weboberfläche und serverseitige API.
- **MongoDB mit Vereinsfilter:** Daten werden mandantenbezogen über `vereinId` verarbeitet.
- **Transaktionen:** Bestandsänderungen und Protokolleinträge sollen gemeinsam erfolgreich sein oder gemeinsam fehlschlagen.
- **Versionierung:** Reduziert das Risiko, dass parallele Bearbeitungen unbemerkt überschrieben werden.
- **Historisches Protokoll:** Änderungen bleiben nachvollziehbar, statt ausschliesslich den aktuellen Bestand zu zeigen.
- **Serverseitiges PDF:** Einheitliche Berichtserstellung aus den gespeicherten Daten ohne clientseitige Bestandsberechnung.
- **Schrittweise Entwicklung:** Eine Datei beziehungsweise Funktion pro Änderung, anschliessend `npm run check` und Browser-Test.

### 10.2 Offene Aufgaben vor der Abgabe / Produktivsetzung

- [ ] Repository-Link, Klasse, Testzugänge und Entwurfsartefakte in Kapitel «Projektübersicht» ergänzen.
- [ ] Screenshots der tatsächlichen Oberfläche, Crazy-8s, Entscheidungsreflexion, User Journey und Mockup verlinken.
- [ ] Verbindliche Moodle-Anforderungen mit dokumentierten Erweiterungen abgleichen.
- [ ] Strukturierte Nutzerevaluation durchführen und Ergebnisse nachvollziehbar dokumentieren.
- [ ] PDF-Grössenbezeichnungen verbessern und Berichte mit Korrekturen/Stornierungen gegenprüfen.
- [ ] Sämtliche Berechtigungen und die Mandantentrennung mit negativen API-Tests überprüfen.
- [ ] Grenzfälle bei Transaktionen, konkurrierenden Änderungen und Rückbuchungen testen.
- [ ] Öffentliche Bereitstellung, Datenschutz, Sicherung/Wiederherstellung und Betriebsprozesse klären.
- [ ] Weitere geplante Module nur dann als implementiert kennzeichnen, wenn sie tatsächlich funktionieren.

### 10.3 Entwicklungsstand / Änderungsprotokoll

| Datum | Änderung | Status |
|---|---|---|
| Bis 10.11.2026 | Stammdaten, Artikelverwaltung, Ausleihen/Rückgaben, Anmeldung und Vereinszuordnung | Lokal entwickelt und teilweise manuell getestet |
| 11.11.2026 | Inventurabschluss, nachträgliche Korrektur, Stornierung, Protokoll und Inventurverlauf dokumentiert | Lokal umgesetzt und geprüft |
| 11.11.2026 | Inventur-PDF über `pdf-lib` und Download-Button | `npm run check` und Download lokal erfolgreich getestet |

> **Dokumentationsregel:** Nach jedem weiteren Entwicklungsschritt die betroffenen Funktionen, API-Routen, bekannten Einschränkungen und Testresultate hier nachführen. Nicht getestete Funktionen ausdrücklich als offen markieren.
