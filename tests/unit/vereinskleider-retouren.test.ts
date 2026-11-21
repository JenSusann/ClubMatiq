import { describe, expect, it } from 'vitest';
import { pruefeRetourenmenge, type RetourenVorgang } from '../../src/lib/server/vereinskleider-retouren';

const basis = (): RetourenVorgang => ({
  positionen: [{ menge: 4, uebergebenMenge: 3, einzelpreis: 28, verkaufsart: 'bestellung' }],
  uebergaben: [
    { positionsIndex: 0, menge: 1 },
    { positionsIndex: 0, menge: 2 }
  ],
  retouren: []
});

describe('Issue #69 – sichere Retourenprüfung', () => {
  it('erlaubt eine vollständige Retoure über mehrere Übergaben', () => {
    expect(pruefeRetourenmenge(basis(), 0, 3)).toEqual({ maximal: 3, einzelpreisRappen: 2800 });
  });
  it('erlaubt Direktverkäufe ohne separaten Übergabebeleg', () => {
    const v: RetourenVorgang = {
      positionen: [{ menge: 1, verkaufsart: 'direkt', einzelpreis: 28 }],
      uebergaben: [], retouren: []
    };
    expect(pruefeRetourenmenge(v, 0, 1).maximal).toBe(1);
    v.retouren = [{ positionsIndex: 0, menge: 1 }];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Nur 0/);
  });
  it('zieht bereits retournierte Mengen ab', () => {
    const v = basis();
    v.retouren = [{ positionsIndex: 0, menge: 2 }];
    expect(pruefeRetourenmenge(v, 0, 1).maximal).toBe(1);
    expect(() => pruefeRetourenmenge(v, 0, 2)).toThrow(/Nur 1/);
  });
  it('verweigert Retouren ohne nachgewiesene Übergabe', () => {
    const v = basis();
    v.uebergaben = [];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Keine dokumentierte Übergabe/);
  });
  it('verweigert inkonsistente Übergaben', () => {
    const v = basis();
    v.positionen![0].uebergebenMenge = 2;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/stimmen nicht überein/);
  });
  it('verweigert Rabattfälle ohne sichere Finanzzuordnung', () => {
    const v = basis();
    v.rabattTotal = 5;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/nicht eindeutig/);
  });
  it('verweigert offene Preise', () => {
    const v = basis();
    v.positionen![0].preisOffen = true;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/nicht eindeutig/);
  });
  it('verweigert ungültige Mengen und Positionen', () => {
    expect(() => pruefeRetourenmenge(basis(), 0, 0)).toThrow(/Ungültige/);
    expect(() => pruefeRetourenmenge(basis(), 9, 1)).toThrow(/nicht gefunden/);
  });
  it('berücksichtigt Stornierungen ohne diese als Retoure zu zählen', () => {
    const v = basis();
    v.positionen![0].menge = 3;
    v.positionen![0].storniertMenge = 1;
    expect(pruefeRetourenmenge(v, 0, 3).maximal).toBe(3);
  });
});
