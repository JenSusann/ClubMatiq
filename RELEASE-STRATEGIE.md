# Entwicklungs- und Release-Strategie

## Branches

- `main`: stabiler, produktiv einsetzbarer Stand.
- `develop/v2.0.0`, `develop/v3.0.0`: getrennte Entwicklungsstände der Zielversionen.
- `feature/issue-XX-beschreibung`: einzelne Funktionen, ausgehend vom jeweiligen Versionsbranch.
- `hotfix/issue-XX-beschreibung`: dringende Korrekturen ausgehend von main.

## Ablauf

1. Issue unabhängig von der Versionsreihenfolge auswählen; Meilenstein beibehalten.
2. Abhängigkeiten prüfen und Feature Branch erstellen.
3. Implementieren, Unit- und Integrationstests sowie CI ausführen.
4. Manuelle Abnahme durchführen und im Abnahmetestprotokoll dokumentieren.
5. Feature per Pull Request in den Zielversionsbranch übernehmen; Issue mit `Ready for Release` kennzeichnen.
6. Vor Release frühere Versionen und Hotfixes integrieren, Konflikte lösen und Regressionstests ausführen.
7. Zielversion nach erfolgreicher Abnahme in main übernehmen, Version taggen und GitHub Release erstellen. Zugehörige Issues abschliessen und als `Released` kennzeichnen.

## Statuslabels

- `In Development`: Umsetzung läuft.
- `Ready for Testing`: bereit zur Abnahme.
- `Ready for Release`: abgenommen, noch nicht veröffentlicht.
- `Released`: veröffentlicht.

Je Issue nur einen dieser Status verwenden. Bestehende fachliche Labels bleiben erhalten. Vor dem Release keine automatisch schliessenden Issue-Referenzen in Pull Requests nach main verwenden.

## Produktionsschutz

Produktionsdeployment ausschliesslich aus dem freigegebenen Stand von main bzw. Release-Tags. Entwicklungsbranches nur mit separater Testumgebung und Testdaten betreiben. Datenbankmigrationen auf Kompatibilität und Rückrollbarkeit prüfen. Hotfixes aus main in alle aktiven Versionsbranches übernehmen. Spätere Versionsbranches regelmässig mit freigegebenen Vorgängerversionen synchronisieren; keine späteren Funktionen in frühere Releases übernehmen.
