import { describe, expect, it } from 'vitest';
import { hilfeArtikel, hilfeGruppen } from '../../../src/lib/hilfe';

describe('Hilfebereich: Konsistenz der Inhalte', () => {
  it('enthält Hilfeartikel und definierte Gruppen', () => {
    expect(hilfeArtikel.length).toBeGreaterThan(0);
    expect(hilfeGruppen.length).toBeGreaterThan(0);
  });
  it('verwendet eindeutige, URL-taugliche Slugs', () => {
    const slugs = hilfeArtikel.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
  it('enthält keine doppelten Gruppen', () => {
    expect(new Set(hilfeGruppen).size).toBe(hilfeGruppen.length);
  });
  it('ordnet jeden Artikel einer existierenden Gruppe zu', () => {
    for (const artikel of hilfeArtikel) expect(hilfeGruppen).toContain(artikel.gruppe);
  });
  it('enthält für jeden Artikel die Pflichtinformationen', () => {
    for (const artikel of hilfeArtikel) {
      for (const feld of ['slug', 'titel', 'gruppe', 'beschreibung', 'rollen'] as const) {
        expect(artikel[feld].trim(), `${artikel.slug}: ${feld}`).not.toBe('');
      }
      expect(artikel.abschnitte.length, artikel.slug).toBeGreaterThan(0);
    }
  });
  it('enthält in jedem Abschnitt einen Titel und verständlichen Inhalt', () => {
    for (const artikel of hilfeArtikel) for (const abschnitt of artikel.abschnitte) {
      expect(abschnitt.titel.trim(), artikel.slug).not.toBe('');
      const textVorhanden = typeof abschnitt.text === 'string' && abschnitt.text.trim().length > 0;
      const schritteVorhanden = Array.isArray(abschnitt.schritte) && abschnitt.schritte.length > 0;
      expect(textVorhanden || schritteVorhanden, `${artikel.slug}: ${abschnitt.titel}`).toBe(true);
      if (abschnitt.schritte) for (const schritt of abschnitt.schritte) expect(schritt.trim()).not.toBe('');
    }
  });
  it('enthält die zentralen Hilfeartikel', () => {
    const slugs = hilfeArtikel.map((a) => a.slug);
    for (const slug of ['erste-schritte', 'rollen-berechtigungen', 'inventar', 'ausleihen', 'inventur', 'vereinskleider']) {
      expect(slugs).toContain(slug);
    }
  });
});
