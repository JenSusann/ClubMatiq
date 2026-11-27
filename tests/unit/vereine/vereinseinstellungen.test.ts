import { describe, expect, it } from 'vitest';
import { validiereVereinseinstellungen } from '../../../src/lib/server/vereinseinstellungen';

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
