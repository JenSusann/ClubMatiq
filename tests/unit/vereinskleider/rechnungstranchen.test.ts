import { describe, expect, it } from 'vitest';
import { berechneNaechsteRechnungstranche as tranche } from '../../../src/lib/server/vereinskleider-rechnungstranchen';

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


describe('Rechnungstranchen – Grenzwerte und Datenintegrität', () => {
  const pos = { positionsIndex: 0, menge: 2, einzelpreis: 25 };
  it.each([-1, NaN, Infinity, 0.001, Number.MAX_SAFE_INTEGER])('verweigert ungültigen Preis %s', einzelpreis => {
    expect(() => tranche([{ ...pos, einzelpreis }], [])).toThrow('Ungültiger Rechnungsbetrag.');
  });
  it.each([{ positionsIndex: -1, menge: 1 }, { positionsIndex: 0.5, menge: 1 }, { positionsIndex: 0, menge: 0 }, { positionsIndex: 0, menge: 0.5 }])('verweigert ungültige Abrechnung %j', entry => {
    expect(() => tranche([pos], [entry])).toThrow('Ungültige bereits abgerechnete Menge.');
  });
  it.each([{ positionsIndex: -1 }, { positionsIndex: 0.5 }, { menge: 0 }, { menge: 0.5 }, { storniertMenge: -1 }, { storniertMenge: 0.5 }, { storniertMenge: 3 }])('verweigert inkonsistente Position %j', patch => {
    expect(() => tranche([{ ...pos, ...patch }], [])).toThrow('Ungültige Bestellposition.');
  });
  it('verweigert doppelte Positionsindices', () => {
    expect(() => tranche([pos, pos], [])).toThrow('Ungültige Bestellposition.');
  });
  it('verweigert offenen Preis mit festem Betrag', () => {
    expect(() => tranche([{ ...pos, preisOffen: true }], [])).toThrow('Widersprüchlicher Preisstatus.');
  });
  it('verweigert Überlauf eines Positionsbetrags', () => {
    expect(() => tranche([{ ...pos, menge: Number.MAX_SAFE_INTEGER }], [])).toThrow('Rechnungsbetrag zu gross.');
  });
  it('verweigert Überlauf der Gesamtsumme', () => {
    const p = { ...pos, menge: Number.MAX_SAFE_INTEGER, einzelpreis: 0.01 };
    expect(() => tranche([p, { ...p, positionsIndex: 1 }], [])).toThrow('Rechnungsbetrag zu gross.');
  });
  it('summiert mehrere frühere Abrechnungen derselben Position', () => {
    expect(tranche([{ ...pos, menge: 3 }], [{ positionsIndex: 0, menge: 1 }, { positionsIndex: 0, menge: 1 }])).toEqual({ positionen: [{ positionsIndex: 0, menge: 1, einzelpreis: 25, betrag: 25 }], gesamtbetrag: 25, offenePreispositionen: 0 });
  });
});
