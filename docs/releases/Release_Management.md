# Release-Management

## Versionierung

Semantic Versioning: MAJOR für inkompatible Änderungen, MINOR für kompatible Funktionen, PATCH für kompatible Fehlerkorrekturen. Vorabversionen mit -beta.1 oder -rc.1. Roadmap-Zielnummern sind vorläufig.

Die aktuelle interne Entwicklungsversion ist 0.9.0. `package.json` ist die zentrale Versionsquelle; Vite übernimmt die Version beim Build in die globale Footer-Anzeige. Versionsänderungen vor Freigabe mit `npm version <version> --no-git-tag-version` durchführen und Lockfile mitführen. Ein Versionswechsel allein ist keine Freigabe.

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

[Roadmap](../../ROADMAP.md), [Changelog](../../CHANGELOG.md), [Freigabecheckliste](Release_Checkliste.md). Projektmeilensteine M1–M5 und Release-Meilensteine v1.0.0–v3.0.0 getrennt nutzen. Die 43 optionalen Issues sind den fünf Folgeversionen zugeordnet. v1.0.0 verweist organisatorisch auf M1–M5. Zielversionslabels ergänzen die Zuordnung.

## Automatisierung (geplant)

GitHub Actions soll statische Prüfungen, Unit-Tests und Build automatisieren. MongoDB-Integrationstests benötigen eine getrennte Testdatenbank und geeignete Geheimnisverwaltung. Release-Erstellung erst nach erfolgreicher Prüfung und ausdrücklicher Freigabe; keine automatische Freigabe allein aufgrund eines Pushs. Die Einrichtung und ihr Nachweis stehen noch aus.
