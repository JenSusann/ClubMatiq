import { describe, expect, it } from 'vitest';
import { validiereVereinseinstellungen, erstelleAusstellerdaten } from '../../../src/lib/server/vereinseinstellungen';

describe('Vereinseinstellungen', () => {
  it('akzeptiert einen Namen und ergänzt optionale Standardwerte', () => {
    expect(validiereVereinseinstellungen({ name: ' TV Weiningen ' })).toEqual({
      erfolg: true,
      daten: {
        name: 'TV Weiningen', kuerzel: '',
        adresse: { strasse: '', plz: '', ort: '' },
        kontakt: { email: '', telefon: '', website: '' }
      }
    });
  });

  it('übernimmt gültige Kontakt- und Adressdaten', () => {
    const daten = {
      name: 'TV Weiningen', kuerzel: 'TVW',
      adresse: { strasse: 'Dorfstrasse 1', plz: '8104', ort: 'Weiningen' },
      kontakt: { email: 'info@example.org', telefon: '+41 44 123 45 67', website: 'https://example.org' }
    };
    expect(validiereVereinseinstellungen(daten)).toEqual({ erfolg: true, daten });
  });

  it.each([null, [], {}, { name: '' }, { name: '   ' }, { name: 42 },
    { name: 'a'.repeat(151) }, { name: 'TV\u0000W' },
    { name: 'TV', adresse: [] }, { name: 'TV', kontakt: null },
    { name: 'TV', kuerzel: 'a'.repeat(31) },
    { name: 'TV', adresse: { plz: 8104 } },
    { name: 'TV', kontakt: { email: 'ungueltig' } },
    { name: 'TV', kontakt: { website: 'javascript:alert(1)' } },
    { name: 'TV', kontakt: { website: 'keine-url' } },
    { name: 'TV', kontakt: { website: 'https://user:pass@example.org' } }
  ])('weist ungültige Eingaben ab: %j', (eingabe) => {
    expect(validiereVereinseinstellungen(eingabe).erfolg).toBe(false);
  });

  it('ignoriert nicht freigegebene Felder', () => {
    const ergebnis = validiereVereinseinstellungen({
      name: 'TV', _id: 'fremd', vereinId: 'fremd', logo: { url: 'https://example.org' },
      kontakt: { email: 'info@example.org', passwort: 'geheim' },
      mailEinstellungen: { passwort: 'geheim' }
    });
    expect(ergebnis).toEqual({
      erfolg: true,
      daten: {
        name: 'TV', kuerzel: '',
        adresse: { strasse: '', plz: '', ort: '' },
        kontakt: { email: 'info@example.org', telefon: '', website: '' }
      }
    });
  });
});

describe('Aussteller-Snapshot', () => {
  it('ergänzt fehlende historische Daten', () => {
    expect(erstelleAusstellerdaten(null)).toEqual({
      name: 'Verein', kuerzel: '',
      adresse: { strasse: '', plz: '', ort: '' },
      kontakt: { email: '', telefon: '', website: '' }, logo: null
    });
  });
  it('kopiert die Ausstellerdaten unabhängig von der Quelle', () => {
    const verein = {
      name: 'TV', adresse: { ort: 'Weiningen' },
      logo: { url: 'https://example.org/logo.png', publicId: 'logo-alt' },
      mailEinstellungen: { passwort: 'geheim' }
    };
    const snapshot = erstelleAusstellerdaten(verein);
    verein.name = 'Neu';
    verein.adresse.ort = 'Zürich';
    verein.logo.publicId = 'logo-neu';
    expect(snapshot.name).toBe('TV');
    expect(snapshot.adresse.ort).toBe('Weiningen');
    expect(snapshot.logo?.publicId).toBe('logo-alt');
    expect(snapshot).not.toHaveProperty('mailEinstellungen');
  });
  it.each([null, {}, { url: 'https://example.org/logo.png' }, { url: '', publicId: 'logo' }])(
    'ignoriert unvollständige Logos: %j', (logo) => {
      expect(erstelleAusstellerdaten({ name: 'TV', logo }).logo).toBeNull();
    }
  );
});

describe('Vereinsprofil – Grenzwerte und Altdaten', () => {
  it('akzeptiert die maximalen Textlängen', () => {
    const daten = { name: 'a'.repeat(150), kuerzel: 'b'.repeat(30),
      adresse: { strasse: 'c'.repeat(150), plz: '1'.repeat(20), ort: 'd'.repeat(100) },
      kontakt: { telefon: '1'.repeat(50), email: 'a'.repeat(240) + '@example.org', website: 'https://example.org/' + 'x'.repeat(480) } };
    expect(validiereVereinseinstellungen(daten)).toEqual({ erfolg: true, daten });
  });
  it.each([
    { adresse: { strasse: 'a'.repeat(151) } },
    { adresse: { plz: '1'.repeat(21) } },
    { adresse: { ort: 'a'.repeat(101) } },
    { kontakt: { telefon: '1'.repeat(51) } },
    { kontakt: { email: 'a'.repeat(255) } },
    { kontakt: { website: 'https://example.org/' + 'a'.repeat(501) } },
    { kontakt: { website: 'https://:pass@example.org' } }
  ])('verwirft ungültigen Grenzwert %#', (teil) => {
    expect(validiereVereinseinstellungen({ name: 'TV', ...teil }).erfolg).toBe(false);
  });
  it.each([{ url: 'https://example.org/logo.png', publicId: '' }, { url: 42, publicId: 'logo' }, { url: 'https://example.org/logo.png', publicId: 42 }])('verwirft unbrauchbare historische Bildreferenz %#', logo => {
    expect(erstelleAusstellerdaten({ name: 'TV', logo }).logo).toBeNull();
  });
  it('normalisiert fehlerhafte Altdaten ohne Ausnahme', () => {
    expect(erstelleAusstellerdaten({ name: 42, kuerzel: null, adresse: [], kontakt: 'alt', logo: [] })).toEqual(erstelleAusstellerdaten(null));
  });
});
