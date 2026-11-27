import { describe, expect, it } from 'vitest';
import { berechneZahlungsstand, type Preisposition } from '../../../src/lib/server/vereinskleider-teilzahlungen';

const bekannt: Preisposition = { artikelId: 'shirt', groesseId: null, menge: 1, einzelpreis: 25, preisOffen: false };
const offen: Preisposition = { artikelId: 'jacke', groesseId: 'M', menge: 1, einzelpreis: null, preisOffen: true };

describe('Issue #68 – gemischte Zahlungen', () => {
  it('weist unbekannte Preise nicht als CHF 0 aus', () => {
    expect(berechneZahlungsstand([offen], [])).toEqual({
      faellig: 0, bezahlt: 0, restbetrag: 0, offenePreispositionen: 1, status: 'preis_offen'
    });
  });
  it('erlaubt Zahlung des bekannten Teils ohne zweite Bestellung', () => {
    expect(berechneZahlungsstand([bekannt, { ...bekannt, artikelId: 'hose', einzelpreis: 30 }, offen], [{ betrag: 55 }])).toEqual({
      faellig: 55, bezahlt: 55, restbetrag: 0, offenePreispositionen: 1, status: 'teilweise_bezahlt'
    });
  });
  it('ermittelt nach Preisfestlegung die Restforderung ohne frühere Zahlung erneut zu fordern', () => {
    const fixiert = { ...offen, einzelpreis: 48, preisOffen: false };
    expect(berechneZahlungsstand([bekannt, { ...bekannt, artikelId: 'hose', einzelpreis: 30 }, fixiert], [{ betrag: 55 }])).toMatchObject({
      faellig: 103, bezahlt: 55, restbetrag: 48, status: 'teilweise_bezahlt'
    });
    expect(berechneZahlungsstand([bekannt, { ...bekannt, artikelId: 'hose', einzelpreis: 30 }, fixiert], [{ betrag: 55 }, { betrag: 48 }])).toMatchObject({
      restbetrag: 0, status: 'bezahlt'
    });
  });
  it('verhindert doppelte Zahlung', () => {
    expect(() => berechneZahlungsstand([bekannt], [{ betrag: 25 }, { betrag: 25 }])).toThrow('übersteigen');
  });
  it('verhindert einen fiktiven Betrag für offene Preise', () => {
    expect(() => berechneZahlungsstand([{ ...offen, einzelpreis: 0 }], [])).toThrow('Offene Preise');
  });
  it('verhindert negative und ungenaue Zahlungen', () => {
    expect(() => berechneZahlungsstand([bekannt], [{ betrag: -1 }])).toThrow('Ungültiger');
    expect(() => berechneZahlungsstand([bekannt], [{ betrag: 1.001 }])).toThrow('Ungültiger');
  });
});

describe('Zahlungsstand – Grenzwerte (#38)', () => {
  it.each([0,-1,1.5,Number.MAX_SAFE_INTEGER+1])('verwirft Menge %s', menge => {
    expect(() => berechneZahlungsstand([{...bekannt,menge}],[])).toThrow('Ungültige Menge');
  });
  it('verwirft fehlenden fälligen Preis', () => {
    expect(() => berechneZahlungsstand([{...bekannt,einzelpreis:null}],[])).toThrow('Ein fälliger Preis fehlt');
  });
  it.each([NaN,Infinity,-Infinity])('verwirft nicht endlichen Betrag %s', betrag => {
    expect(() => berechneZahlungsstand([bekannt],[{betrag}])).toThrow('Ungültiger Geldbetrag');
  });
  it('verwirft Überlauf der Forderung', () => {
    expect(() => berechneZahlungsstand([{...bekannt,menge:Number.MAX_SAFE_INTEGER}],[])).toThrow('Betrag ausserhalb');
  });
  it('verwirft Überlauf der Zahlungen', () => {
    expect(() => berechneZahlungsstand([bekannt],[{betrag:Number.MAX_SAFE_INTEGER}])).toThrow('Betrag ausserhalb');
  });
  it('zeigt unbezahlte Forderung als offen', () => {
    expect(berechneZahlungsstand([bekannt],[])).toEqual({faellig:25,bezahlt:0,restbetrag:25,offenePreispositionen:0,status:'offen'});
  });
  it('rechnet Rappen ohne Rundungsdifferenz', () => {
    expect(berechneZahlungsstand([{...bekannt,einzelpreis:0.1,menge:3}],[{betrag:0.3}])).toMatchObject({restbetrag:0,status:'bezahlt'});
  });
});
