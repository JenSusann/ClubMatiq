# AGENTS.md – ClubMatiq

## Projekt und Ziel
ClubMatiq ist eine mandantenfähige Webanwendung zur Material-, Inventar- und Vereinskleiderverwaltung im Rahmen des ZHAW-Moduls Prototyping. Hauptworkflow: Material erfassen, suchen, ausleihen und zurückgeben. Weitere Funktionen gemäss README und GitHub-Issues.

## Technischer Rahmen
- SvelteKit 3, Svelte 5, TypeScript, MongoDB, Vitest und Netlify.
- Bestehende Komponenten, API-Routen und Servermodule wiederverwenden.
- Schweizer Rechtschreibung und bestehende Benennungskonventionen beibehalten.
- README, package.json, relevante Issues und betroffene Implementierung vor Änderungen prüfen.

## Arbeitsweise
1. Issue, Anforderungen und Akzeptanzkriterien prüfen; Unklarheiten offenlegen.
2. Grössere Änderungen zuerst planen; Umfang und betroffene Geschäftsprozesse benennen.
3. Kleine, nachvollziehbare Änderungen mit passenden Tests erstellen.
4. Bestehende Funktionen und Schnittstellen nicht ohne fachliche Begründung ändern.
5. Commits mit aussagekräftiger Beschreibung und zutreffenden Issue-Referenzen erstellen.
6. Issues erst nach bestätigter Abnahme abschliessen.

## Sicherheit und Datenintegrität
- Serverseitige Berechtigungsprüfung und Mandantentrennung bei jedem relevanten Datenzugriff beachten.
- Eingaben validieren; Bestände, finanzielle Vorgänge und Historien konsistent halten.
- Entwicklungs-, Demo-, Test- und Produktivdaten nicht vermischen.
- Keine Zugangsdaten, Zertifikatsschlüssel oder personenbezogenen Produktivdaten in Prompts, Tests oder Commits aufnehmen.
- Destruktive Datenbankoperationen und produktive Deployments nur nach ausdrücklicher Freigabe.

## Qualitätsprüfung
- `npm run check` für Svelte und TypeScript.
- `npm run test` für Unit-Tests.
- `npm run test:all` für Unit- und Integrationstests sowie kombinierte Coverage in geeigneter Testumgebung.
- `npm run build` für den Produktions-Build.
- Kombiniertes Coverage-Ziel: mindestens 95 % je Kennzahl gemäss dokumentiertem Quality Gate.
- Fehlerfälle, Berechtigungen und Regressionen gezielt testen.
- Manuelle Abnahme durch die entwickelnde Person; Ergebnisse in docs/testing/System_Abnahmetestprotokoll.md dokumentieren.
- Nie nicht ausgeführte Tests als bestanden ausweisen.

## Dokumentation und KI
- README, Roadmap und Release-Strategie bei relevanten Änderungen konsistent halten.
- Implementierte, getestete und geplante Funktionen unterscheiden.
- KI-Beiträge, konkrete Fehler, Korrekturen und menschliche Entscheidungen für Kapitel 6 der README nachvollziehbar dokumentieren.
- Lokale Ausführung, Live-Deployment und fachliche Freigabe nicht ohne Nachweis behaupten.
- Diese Regeln wurden am 27.11.2026 aus der bisherigen dokumentierten Arbeitsweise abgeleitet und gelten als Leitlinien für die weitere Entwicklung; sie sind kein Nachweis einer bereits früher vorhandenen AGENTS.md.
