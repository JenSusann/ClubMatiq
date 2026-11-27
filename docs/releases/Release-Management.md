# Release-Management

## Versionierung

Semantic Versioning: MAJOR für inkompatible Änderungen, MINOR für kompatible Funktionen, PATCH für kompatible Fehlerkorrekturen. Vorabversionen mit -beta.1 oder -rc.1. Roadmap-Zielnummern sind vorläufig.

`package.json` ist die zentrale Versionsquelle; Vite übernimmt die Version beim Build in die globale Footer-Anzeige. Versionsänderungen vor Freigabe mit `npm version <version> --no-git-tag-version` durchführen und Lockfile mitführen. Ein Versionswechsel allein ist keine Freigabe.

## Branch- und Statusstrategie


### Branches

- `main`: stabiler, produktiv einsetzbarer Stand.
- `develop/vX.Y.Z`: getrennte Entwicklungsstände der Zielversionen; bestehende Branches `develop/v2.0.0` und `develop/v3.0.0` weiterverwenden, weitere bei Bedarf erstellen.
- `feature/issue-XX-beschreibung`: einzelne Funktionen, ausgehend vom jeweiligen Versionsbranch.
- `hotfix/issue-XX-beschreibung`: dringende Korrekturen ausgehend von main.

### Ablauf

1. Issue gemäss priorisierter Roadmap auswählen; Abhängigkeiten prüfen und Zielmeilenstein gemäss bestätigter Planung synchronisieren.
2. Abhängigkeiten prüfen und Feature Branch erstellen.
3. Implementieren, Unit- und Integrationstests sowie CI ausführen.
4. Manuelle Abnahme durchführen und im Abnahmetestprotokoll dokumentieren.
5. Feature per Pull Request in den Zielversionsbranch übernehmen; Issue mit `Ready for Release` kennzeichnen.
6. Vor Release frühere Versionen und Hotfixes integrieren, Konflikte lösen und Regressionstests ausführen.
7. Zielversion nach erfolgreicher Abnahme in main übernehmen, Version taggen und GitHub Release erstellen. Zugehörige Issues abschliessen und als `Released` kennzeichnen.

### Statuslabels

- `In Development`: Umsetzung läuft.
- `Ready for Testing`: bereit zur Abnahme.
- `Ready for Release`: abgenommen, noch nicht veröffentlicht.
- `Released`: veröffentlicht.

Je Issue nur einen dieser Status verwenden. Bestehende fachliche Labels bleiben erhalten. Vor dem Release keine automatisch schliessenden Issue-Referenzen in Pull Requests nach main verwenden.

### Produktionsschutz

Produktionsdeployment ausschliesslich aus dem freigegebenen Stand von main bzw. Release-Tags. Entwicklungsbranches nur mit separater Testumgebung und Testdaten betreiben. Datenbankmigrationen auf Kompatibilität und Rückrollbarkeit prüfen. Hotfixes aus main in alle aktiven Versionsbranches übernehmen. Spätere Versionsbranches regelmässig mit freigegebenen Vorgängerversionen synchronisieren; keine späteren Funktionen in frühere Releases übernehmen.

## Workflow

1. Issue mit Zielversion, Anforderungen, Abhängigkeiten und Akzeptanztests planen.
2. Feature-Branch vom geeigneten Entwicklungsstand erstellen; Änderungen mit Issue-Referenz committen.
3. Review, automatisierte Tests und manuelle Abnahme dokumentieren.
4. Release-Kandidat integrieren, Versionsnummer in package.json und Lockfile konsistent setzen, Changelog aktualisieren.
5. Freigabecheckliste erfüllen, unveränderlichen Git-Tag auf geprüften Commit setzen und GitHub-Release mit Release Notes erstellen.
6. Deployment prüfen und Commit, Tag, URL und Testnachweis dokumentieren.

## Umgebungen

Lokale Entwicklung, Preview, separat eingefrorene Evaluation mit getrennten Testdaten und stabile Produktion. Keine produktiven Daten in Evaluation kopieren. Die separate Demo ist eingerichtet; siehe [Demo-Betrieb](../betrieb/Demo-Betrieb.md). Bei Fehlern Rollback auf geprüften Stand unter Beachtung der Datenbankmigrationen.

## Planung

[Roadmap](../../ROADMAP.md), [Changelog](../../CHANGELOG.md), [Freigabecheckliste](Release-Checkliste.md). Projektmeilensteine M1–M5 und Release-Meilensteine getrennt nutzen. v1.0.0 verweist organisatorisch auf M1–M5. Die bestätigte Roadmap vom 27.11.2026 priorisiert 24 Issues für v2.0.0 (7), v2.1.0 (4), v2.2.0 (5), v2.3.0 (5) und v3.0.0 (3). Weitere Erweiterungen bleiben im Backlog ohne neu bestätigte Zielversion. Die bisherigen v1.1.0 und v1.2.0 sind keine Pflichtreleases mehr. GitHub-Meilensteine und Zielversionslabels sind noch mit dem neuen Plan zu synchronisieren. Zielversionen bleiben Planungswerte; tatsächliche Versionsnummern folgen der SemVer-Prüfung vor Freigabe.

## Automatisierung

GitHub Actions automatisiert Qualitätsprüfungen; erfolgreiche CI-Läufe sind im Pilotbetrieb und Systemabnahmetestprotokoll dokumentiert. MongoDB-Integrationstests benötigen eine getrennte Testdatenbank und geeignete Geheimnisverwaltung. Release-Erstellung erst nach erfolgreicher Prüfung und ausdrücklicher Freigabe; keine automatische Freigabe allein aufgrund eines Pushs. Die Freigabe bleibt eine separate Entscheidung.

## Branch-Schutz und GitHub Rulesets

Seit dem 27.11.2026 werden der stabile Hauptbranch und die
Versionsbranches durch aktive GitHub Rulesets geschützt.

| Ruleset | Zielbranches | ID |
| --- | --- | --- |
| Main Branch Protection | main | 28268526 |
| Development Branch Protection | develop/**/* | 28268682 |

### Verpflichtende Schutzregeln

- Schutz vor Löschung.
- Schutz vor Force Pushes.
- Änderungen ausschliesslich über Pull Requests.
- Erfolgreiche Status Checks vor dem Merge.
- Aktueller Stand des Zielbranches vor dem Merge.
- Auflösung aller Review-Konversationen.
- Keine regulären Bypass-Ausnahmen.
- Keine zusätzliche verpflichtende Personenfreigabe
  während der Einzelentwicklung.

### Verpflichtende CI-Prüfungen

- Code Quality & Tests
- Integration Tests & Coverage
- Combined Coverage

Die Prüfungen werden auch bei reinen Dokumentationsänderungen
in Pull Requests ausgeführt. Netlify-Prüfungen und der
tagbasierte Release-Job sind keine verpflichtenden Status Checks.

Neue Versionsbranches dürfen ohne vorgängige Status Checks
erstellt werden. Feature Branches bleiben ungeschützt.

### Verifikation

Am 27.11.2026 wurden beide Rulesets mittels GitHub API
als aktiv bestätigt. Die effektiven Schutzregeln wurden
für main, develop/v2.0.0 und develop/v3.0.0 nachgewiesen.

