# Release-Management

## Versionierung

Semantic Versioning: MAJOR für inkompatible Änderungen, MINOR für kompatible Funktionen, PATCH für kompatible Fehlerkorrekturen. Vorabversionen mit -beta.1 oder -rc.1. Roadmap-Zielnummern sind vorläufig.

## Workflow

1. Issue mit Zielversion, Anforderungen, Abhängigkeiten und Akzeptanztests planen.
2. Feature-Branch vom geeigneten Entwicklungsstand erstellen; Änderungen mit Issue-Referenz committen.
3. Review, automatisierte Tests und manuelle Abnahme dokumentieren.
4. Release-Kandidat integrieren, Versionsnummer in package.json und Lockfile konsistent setzen, Changelog aktualisieren.
5. Freigabecheckliste erfüllen, unveränderlichen Git-Tag auf geprüften Commit setzen und GitHub-Release mit Release Notes erstellen.
6. Deployment prüfen und Commit, Tag, URL und Testnachweis dokumentieren.

## Umgebungen

Lokale Entwicklung, Preview, separat eingefrorene Evaluation mit getrennten Testdaten und stabile Produktion. Keine produktiven Daten in Evaluation kopieren. Evaluationstag und Deployment erst nach tatsächlicher Einrichtung dokumentieren. Bei Fehlern Rollback auf geprüften Stand unter Beachtung der Datenbankmigrationen.

## Planung

[Roadmap](../../ROADMAP.md), [Changelog](../../CHANGELOG.md), [Freigabecheckliste](Release_Checkliste.md). Bestehende Projektmilestones und Release-Labels getrennt nutzen.
