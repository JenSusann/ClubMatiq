# Changelog

Diese Datei dokumentiert Änderungen an ClubMatiq. Geplante Funktionen stehen in der [Produkt-Roadmap](ROADMAP.md). Die Versionierung orientiert sich an Semantic Versioning.

## [Unreleased]

## [0.9.2] – Pilot-Hotfix (Freigabe ausstehend)

- #130: Kombinierbare Erstbezugs- und weitere Rabattregeln mit stückbezogener Verteilung, Preisübersicht und Rabattkorrektur bei unterstützten Bestellstornierungen.
- #127: Navigation bei neuer Artikelanlage korrigiert.
- #128: Verkaufspreise aktiver Grössen gemeinsam bearbeiten.
- Lokale Regression fehlerfrei gemeldet; manuelle Abnahme #130: 13/13 bestanden. #127 und #128 positiv zusammenfassend bestätigt.
- Stornierungen bezahlter Verkäufe ohne Beleg, rabattierter Teilrechnungen und zusätzlicher manueller Rabatte bleiben gesperrt. CI und produktive Freigabe ausstehend.

## [0.9.1] – Hotfix (Freigabe ausstehend)

### Behoben

- ClubDesk-Gruppenimport mit `[Gruppen]` und bisherigen Spaltennamen korrigiert (#125, #115).
- Gruppenleerzeichen normalisiert und Riegenberechnung bei einzelnen Gruppenspalten erweitert; bisherige explizite Riegenimporte bleiben kompatibel.

### Qualitätssicherung

- PR #124, CI-Lauf 45989603629: 5 erfolgreich, 3 übersprungen, 0 fehlgeschlagen.
- Kombinierte Coverage: Statements 98.45 %, Branches 95.51 %, Functions 96.39 %, Lines 99.10 %.
- Erneute CI nach Versionserhöhung sowie produktive Abnahme stehen aus.

## [0.9.0] – Pilotversion

### Hinzugefügt

- Sechs Versionsmeilensteine für die Erstveröffentlichung und die langfristige Produktentwicklung.
- Zuordnung von 43 optionalen Issues zu fünf zukünftigen Releases anhand ihrer Zielversionslabels.
- Beschreibungen der Versionsmeilensteine.
- Automatische Anzeige der Softwareversion im globalen Footer über die Vite-Konfiguration.

### Geändert

- Interne Entwicklungsversion von `0.0.1` auf `0.9.0` erhöht; Versionsnummer zentral in `package.json` gepflegt.
- ZHAW-Projektmeilensteine und zukünftige Release-Meilensteine getrennt.

### Qualitätssicherung

- Für die Versionierungsänderung (Commit `f56bf71`) wurden Svelte-Check, automatisierte Tests und Produktions-Build lokal als erfolgreich gemeldet. Detaillierte Testzahlen und separate MongoDB-Integrationstestnachweise sind hier nicht erfasst.

### Freigabestatus

Die Version 0.9.0 wurde für den Pilotbetrieb manuell veröffentlicht (#115); eine stabile Freigabe ist damit nicht verbunden. Die erste stabile Veröffentlichung ist als 1.0.0 geplant.
