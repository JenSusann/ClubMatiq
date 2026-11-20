import { describe, expect, it } from 'vitest';
import { berechneNaechsteRechnungstranche as tranche } from '../../src/lib/server/vereinskleider-rechnungstranchen';

describe('Issue #68 – Rechnungen in Tranchen', () => {
  const positionen = [
    { positionsIndex: 0, menge: 1, einzelpreis: 25, preisOffen: false },
    { positionsIndex: 1, menge: 1, einzelpreis: 30, preisOffen: false },
    { positionsIndex: 2, menge: 1, einzelpreis: null, preisOffen: true }
  ];
  it('stellt nur die bekannten CHF 55 in Rechnung', () => {
    expect(tranche(positionen, [])).toEqual({
      positionen: [
        { positionsIndex: 0, menge: 1, einzelpreis: 25, betrag: 25 },
        { positionsIndex: 1, menge: 1, einzelpreis: 30, betrag: 30 }
      ], gesamtbetrag: 55, offenePreispositionen: 1
    });
  });
  it('verrechnet später nur die CHF 48 der Jacke, nicht nochmals CHF 55', () => {
    const festgelegt = positionen.map((p) => p.positionsIndex === 2
      ? { ...p, einzelpreis: 48, preisOffen: false } : p);
    expect(tranche(festgelegt, [
      { positionsIndex: 0, menge: 1 }, { positionsIndex: 1, menge: 1 }
    ])).toEqual({
      positionen: [{ positionsIndex: 2, menge: 1, einzelpreis: 48, betrag: 48 }],
      gesamtbetrag: 48, offenePreispositionen: 0
    });
  });
  it('erzeugt keine weitere Rechnung für vollständig verrechnete Positionen', () => {
    const result = tranche([{ positionsIndex: 0, menge: 1, einzelpreis: 25 }],
      [{ positionsIndex: 0, menge: 1 }]);
    expect(result.gesamtbetrag).toBe(0);
    expect(result.positionen).toEqual([]);
  });
  it('verhindert doppelte Abrechnung und ungültige Mengen', () => {
    expect(() => tranche(positionen, [{ positionsIndex: 0, menge: 2 }])).toThrow();
    expect(() => tranche(positionen, [{ positionsIndex: 99, menge: 1 }])).toThrow();
  });
  it('berücksichtigt bereits stornierte, noch nicht verrechnete Mengen', () => {
    expect(tranche([{ positionsIndex: 0, menge: 3, storniertMenge: 1, einzelpreis: 12.5 }], []))
      .toMatchObject({ gesamtbetrag: 25 });
  });
  it('weist widersprüchliche Preisangaben zurück', () => {
    expect(() => tranche([{ positionsIndex: 0, menge: 1, einzelpreis: null, preisOffen: false }], [])).toThrow();
  });
});
