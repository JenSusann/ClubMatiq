# Projektdokumentation - ClubMatiq

## Projektübersicht & Zugänge

| Angabe | Inhalt |
|---|---|
| Projekttitel | ClubMatiq – Digitale Material- und Inventarverwaltung für Vereine |
| Verfasser/in | Jennifer Mentner – **[Klasse ergänzen]** |
| GitHub-Repository | **[Direkten Link zum Repository ergänzen]** |
| Aktuelle App | Noch nicht öffentlich bereitgestellt; derzeit lokale Entwicklungsumgebung |
| Getestete Version | Lokaler Entwicklungsstand vom 10. November 2026; **[Commit/Tag nach dem Push ergänzen]** |
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

- **Kernfunktionalität:** ClubMatiq bündelt die Inventarverwaltung in einer Weboberfläche. Artikel werden mit Kategorie, Lagerort, Beschreibung, Bestand und Einzelwert erfasst. Vereinskleider können mehrere Grössen mit unterschiedlichen Beständen und Werten besitzen. Material kann an Personen ausgeliehen und teilweise oder vollständig zurückgegeben werden; verfügbare Mengen werden dabei automatisch angepasst. Die Übersicht zeigt offene, überfällige und abgeschlossene Ausleihen. Vereine können sich mit einem Administratorkonto registrieren und anschliessend ihre eigenen Inventardaten verwalten. Weitere Module für QR-Codes, Inventur, Schadensmeldungen und Materialsuche sind vorgesehen.
- **Annahmen [Optional]:** Eine gemeinsame Datenbasis reduziert Mehrfacherfassungen. Eine übersichtliche Bedienung mit klaren Formularen unterstützt auch Vereinsmitglieder mit wenig IT-Erfahrung. Grössenvarianten sind für die Verwaltung von Vereinskleidern notwendig.
- **Abgrenzung [Optional]:** Der aktuelle Stand ist ein lokal getesteter Prototyp und keine produktiv freigegebene Vereinssoftware. Registrierung, Anmeldung und eine erste Administratorrolle sind implementiert. Eine differenzierte Rollen- und Benutzerverwaltung, öffentliches Deployment sowie weitere Module sind noch nicht fertiggestellt. Eine vollständige Buchhaltung ist nicht Bestandteil des Prototyps.

## 3. Vorgehen & Artefakte

Die Entwicklung erfolgt schrittweise anhand des Vereinskontexts, der Entwurfsaufgaben aus dem Unterricht und der technischen Umsetzung eines testbaren Prototyps.

### 3.1 Understand & Define

- **Zielgruppenverständnis:** Als zentrale Perspektiven wurden Jennifer (Kasse und buchhalterische Sicht), Nathalie (Leitung und Materialnutzung) sowie Laura (Materialverantwortung) betrachtet. Die Anforderungen orientieren sich an Aufgaben wie Bestände kontrollieren, Material finden, Vereinskleider verwalten und Ausleihen nachvollziehen.
- **Wesentliche Erkenntnisse:** Die Anwendung benötigt eine gemeinsame Artikelbasis, getrennte Stammdaten für Kategorien und Lagerorte, Grössenvarianten für Vereinskleider und eine einfache Erfassung von Ausleihen und Rückgaben. Die konkrete Problemraumanalyse und die ausgearbeiteten Personas sind in den Unterrichtsartefakten zu dokumentieren: **[Artefaktlink ergänzen]**.

### 3.2 Sketch

- **Variantenüberblick:** In der Skizzierphase wurden Ideen zur Navigation, Artikelübersicht und Materialverwaltung entwickelt. Ziel war es, die wichtigsten Vereinsaufgaben ohne komplizierte Menüstruktur zugänglich zu machen.
- **Skizzen:** Im Rahmen der Crazy-8s-Aufgabe wurden mehrere Entwurfsansätze skizziert. **[Fotos/Scans der handgezeichneten Skizzen einfügen und Unterschiede der tatsächlich erarbeiteten Varianten kurz beschreiben]**.

### 3.3 Decide

- **Gewählte Variante & Begründung:** Weiterverfolgt wird eine zentrale Webanwendung mit einer Startseite aus Funktionskacheln und eigenen Verwaltungsseiten. Die Lösung ermöglicht einen direkten Einstieg in häufig genutzte Aufgaben und trennt Stammdaten von operativen Prozessen. **[Konkrete Entscheidkriterien aus der Abgabe ergänzen]**.
- **End-to-End-Ablauf:** Beispiel Materialausleihe: Materialartikel auswählen → gegebenenfalls Grösse wählen → verfügbare Menge prüfen → Person und Daten erfassen → Ausleihe speichern → offene Ausleihe in der Übersicht anzeigen → Teil- oder Vollrückgabe erfassen → Bestand aktualisieren. **[User Journey Map verlinken]**.
- **Mockup:** Link siehe «Figma / Referenz-Mockup» in der [Projektübersicht](#projektübersicht--zugänge). **[Screenshots des tatsächlichen Mockups mit kurzen Beschreibungen ergänzen; Mockup nicht mit dem implementierten Prototyp verwechseln]**.

### 3.4 Prototype

#### 3.4.1. Entwurf (Design)

- **Informationsarchitektur:** Die Startseite bietet Zugänge zu Inventar, QR-Code, Materialausleihe, Vereinskleidern, Inventur, Inventarbewertung, Schadensmeldungen und Materialsuche. Registrierung und Anmeldung sind als eigene Seiten umgesetzt; der Kopfbereich zeigt bei angemeldeten Benutzern Name, Rolle und Abmeldefunktion. Über die Navigation ist ausserdem die Stammdatenverwaltung mit Kategorien, Lagerorten und Grössen erreichbar. Noch nicht implementierte Bereiche dienen teilweise als Platzhalter.
- **User Interface Design:** Die Inventarübersicht kombiniert Kennzahlen, Suche, Kategorienfilter und eine Artikeltabelle. Artikel können aufgeklappt, bearbeitet und gelöscht werden. Das Ausleihformular zeigt verfügbare Mengen; die Ausleihübersicht enthält Statusfilter, Kennzahlen und einen Rückgabedialog. **[Screenshots der Startseite, Inventarübersicht, Artikelmaske und Materialausleihe ergänzen]**.
- **Designentscheidungen:** Wiederkehrende Formulare, eindeutige Schaltflächen und eine konsistente Farbgestaltung sollen die Bedienung vereinfachen. Vereinskleider werden nicht als separate Artikelwelt geführt, sondern über Grössenvarianten innerhalb der zentralen Inventarverwaltung abgebildet.

#### 3.4.2. Umsetzung (Technik)

- **Technologie-Stack:** SvelteKit 3, Svelte 5, TypeScript, MongoDB-Treiber für Node.js und MongoDB Atlas als Cloud-Datenbank.
- **Tooling:** Visual Studio Code, Node.js/npm, Git, GitHub, MongoDB Atlas und lokale Browser-Tests. KI-Unterstützung ist in Kapitel 6 beschrieben.
- **Vorgehen bei der Implementierung:** Funktionen wurden in kleinen Schritten umgesetzt und unmittelbar lokal geprüft: zunächst Projektstruktur und Datenbankverbindung, danach Stammdaten, Artikelanlage, Inventarübersicht, Artikelbearbeitung und schliesslich Materialausleihe mit Rückgabe. Fehlermeldungen aus TypeScript und Laufzeittests wurden schrittweise behoben. Danach wurden Registrierung, Login, Session-Prüfung, automatische Anmeldung nach Registrierung und die Vereinsfilter in den API-Endpunkten ergänzt. Die Umsetzung wurde durch ChatGPT mit Codevorschlägen und Fehlersuche unterstützt; Auswahl, Integration und lokale Prüfung erfolgten im Projekt. Details siehe Kapitel 6.
- **Struktur & Komponenten:** Die Seiten liegen unter `src/routes/`, beispielsweise `inventar/`, `inventar/neu/`, `inventar/[id]/bearbeiten/`, `ausleihen/`, `stammdaten/`, `anmelden/` und `registrieren/`. Die Komponente `src/lib/AusleihenUebersicht.svelte` stellt die Ausleihen dar und ermöglicht Rückgaben. Die MongoDB-Verbindung befindet sich in `src/lib/server/mongodb.ts`. Server-Endpunkte liegen unter `src/routes/api/`.
- **Daten & Schnittstellen:** Die Datenbank `clubmatiq` enthält unter anderem die Collections `artikel`, `artikelvarianten`, `kategorien`, `lagerorte`, `groessen`, `ausleihen`, `vereine`, `benutzer` und `sessions`. SvelteKit-API-Routen stellen JSON-Daten bereit und übernehmen Prüfungen und Schreiboperationen. Für Ausleihen und Rückgaben werden MongoDB-Transaktionen eingesetzt, damit Bestandsänderungen und Ausleihvorgänge gemeinsam gespeichert werden. Verbindungsdaten werden über eine lokale `.env`-Datei verwaltet und nicht ins Repository übernommen. Passwörter werden mit Argon2 gehasht; Sessions werden über ein HttpOnly-Cookie und serverseitig gespeicherte Token-Hashes verwaltet. Der Server-Hook `src/hooks.server.ts` prüft die Anmeldung und schützt nicht öffentliche Routen. Die Datensätze der Inventar-Collections tragen eine `vereinId`; API-Abfragen und Schreiboperationen sind auf den angemeldeten Verein eingeschränkt. Für ältere Datensätze wurde ein Migrationsskript zur Vereinszuordnung ausgeführt.
- **Deployment:** Link siehe «Aktuelle App» in der [Projektübersicht](#projektübersicht--zugänge). Ein öffentliches Deployment ist noch ausstehend; Netlify ist als Hosting-Option vorgesehen.
- **Besondere Entscheidungen:** Grössenabhängige Artikel erhalten eigene Datensätze in `artikelvarianten`, damit Mengen und Einzelwerte pro Grösse unterschiedlich sein können. Bei einer Ausleihe wird derzeit der **verfügbare** Bestand reduziert und bei Rückgabe erhöht. Für eine spätere buchhalterische Inventarbewertung muss weiterhin ausgeliehenes, aber vereinseigenes Material mitgezählt werden. Die grundlegende Authentifizierung ist umgesetzt. Vor einer öffentlichen Freigabe müssen insbesondere Rollenrechte, alle API-Endpunkte, parallele Änderungen, Registrierungs-Missbrauchsschutz und Mandantentrennung sicherheitstechnisch weiter geprüft werden.

### 3.5 Validate

> **Stand 10. November 2026:** Bisher wurden Funktionen während der Entwicklung lokal ausprobiert. Eine formelle, separat deployte Nutzerevaluation mit dokumentierter Stichprobe und Nachweisen ist noch nicht abgeschlossen. Die folgenden Angaben sind deshalb als Planungsstand gekennzeichnet.

- **Getestete Version:** Bislang lokaler Entwicklungsstand; separat deployte Testversion und Commit/Tag noch ausstehend. Link nach Bereitstellung in der [Projektübersicht](#projektübersicht--zugänge) ergänzen.
- **Ziele der Prüfung:** Können Vereinsverantwortliche Artikel selbstständig erfassen und finden? Sind Grössenbestände verständlich? Lassen sich Ausleihen und Teilrückgaben fehlerfrei durchführen?
- **Vorgehen:** **[Formelle Evaluation noch planen: moderiert/unmoderiert, vor Ort/remote]**. Bisher erfolgten manuelle Funktionstests während der Entwicklung.
- **Stichprobe:** **[Testpersonen, Rollen und Anzahl nach tatsächlicher Durchführung ergänzen]**.
- **Aufgaben/Szenarien:** Vorgeschlagene Szenarien: (1) Neuen Inventarartikel mit Lagerort erfassen; (2) Vereinskleid mit mehreren Grössen und Preisen erfassen; (3) Artikel über Suche finden; (4) Material ausleihen; (5) Teilrückgabe und anschliessend vollständige Rückgabe erfassen.
- **Kennzahlen & Beobachtungen:** **[Erfolgsquote, Zeitbedarf, Schwierigkeiten und Rückmeldungen erst nach Durchführung eintragen]**. In lokalen Entwicklungstests funktionierten Artikelanlage, Bearbeitung, Löschung sowie Ausleihe und Rückgabe nach Fehlerkorrekturen. Zusätzlich wurden die automatische Anmeldung nach Neuregistrierung sowie die Trennung von Inventardaten und Testkategorien zwischen zwei Vereinen manuell erfolgreich überprüft.
- **Nachweise:** **[Anonymisierte Testprotokolle, Screenshots, Beobachtungsnotizen und Auswertung verlinken]**.
- **Zusammenfassung der Resultate:** Die bisherigen lokalen Tests bestätigen die grundlegende technische Funktionsfähigkeit der umgesetzten Kernabläufe. Bei einem zweiten Testverein waren die Daten des ersten Vereins nicht sichtbar; auch eine neu erstellte Testkategorie blieb auf den eigenen Verein beschränkt. Dies ist ein Funktionstest, kein vollständiger Sicherheitsnachweis gegen manipulierte API-Anfragen. Aussagen über die Verständlichkeit und Nutzbarkeit für andere Vereinsmitglieder sind erst nach einer strukturierten Evaluation möglich.
- **Abgeleitete Verbesserungen:** Als nächste Schritte sind eine vollständige Prüfung der Mandantentrennung bei direkten API-Anfragen, differenzierte Benutzer- und Rollenrechte, QR-Code-Zugriff auf Artikel sowie weitere Module vorgesehen. Konkrete, aus Nutzertests abgeleitete Verbesserungen werden nach der Evaluation ergänzt.

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
- **Entwurfsartefakte:** **[Links zu Personas, Crazy-8s-Skizzen, Entscheidungsreflexion, User Journey Map und Mockup ergänzen]**.

---

**Dokumentationsstand:** 10. November 2026 – laufender Prototyp, noch keine abschliessende Evaluation.
