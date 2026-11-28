import { describe, it, expect } from 'vitest';
import { verteileRabatte, type Verteilregel } from '../../../src/lib/rabattverteilung';

const positionen = [{ menge: 2, einzelpreis: 150 }, { menge: 1, einzelpreis: 50 }];
const regeln: Verteilregel[] = [
  { id: 'gw', einmalig: true, kombinierbar: true, art: 'fixpreis', wert: 50, maximaleMenge: 1, passendeIndizes: [0] },
  { id: 'jacke', einmalig: true, kombinierbar: true, art: 'fixpreis', wert: 20, maximaleMenge: 1, passendeIndizes: [1] },
  { id: 'sonstiges', einmalig: false, kombinierbar: true, art: 'fixpreis', wert: 5, passendeIndizes: [0,1] }
];
describe('Issue #130 – Rabattverteilung', () => {
  it('berechnet CHF 75 für zwei Gwändli und eine Jacke', () => {
    const r = verteileRabatte(positionen, regeln);
    expect(r.totalRappen).toBe(27500);
    expect(r.summen).toMatchObject({ gw: 10000, jacke: 3000, sonstiges: 14500 });
    expect(r.abschnitte).toContainEqual({ positionsIndex: 0, abStueck: 1, menge: 1, rabattRappen: 14500, regelId: 'sonstiges' });
  });
  it('priorisiert Erstbezüge unabhängig von Auswahlreihenfolge', () => {
    expect(verteileRabatte(positionen, [...regeln].reverse())).toEqual(verteileRabatte(positionen, regeln));
  });
  it('verweigert nicht kombinierbare Regeln', () => {
    expect(() => verteileRabatte(positionen, [{ ...regeln[0], kombinierbar: false }, regeln[1]])).toThrow();
  });
  it('verweigert weitere Regeln ohne verbleibende Stücke', () => {
    expect(() => verteileRabatte([{ menge: 1, einzelpreis: 150 }, positionen[1]], regeln)).toThrow();
  });
  it('begrenzt Erstbezug auf ein Stück', () => {
    expect(verteileRabatte(positionen, [regeln[0]]).totalRappen).toBe(10000);
  });
  it('verteilt Betragsrabatte rappengenau', () => {
    const r = verteileRabatte([{ menge: 1, einzelpreis: 1 }, { menge: 1, einzelpreis: 1 }, { menge: 1, einzelpreis: 1 }], [{ ...regeln[2], art: 'betrag', wert: 0.01, passendeIndizes: [0,1,2] }]);
    expect(r.abschnitte.reduce((s,a)=>s+a.rabattRappen,0)).toBe(1);
  });
});

describe('Rabattverteilung – Grenzfälle', () => {
  const regel = { ...regeln[2], art: 'betrag' as const, wert: 10 };
  it('verteilt auf kostenlose Positionen ohne Division durch null', () => {
    const r = verteileRabatte([{ menge: 2, einzelpreis: 0 }], [{ ...regel, passendeIndizes: [0] }]);
    expect(r.totalRappen).toBe(0);
    expect(r.abschnitte[0].rabattRappen).toBe(0);
  });
  it('ignoriert unbekannte und offene Positionen sowie doppelte Indizes', () => {
    const r = verteileRabatte([{ menge: 2, einzelpreis: null }, { menge: 1, einzelpreis: 5 }], [{ ...regel, passendeIndizes: [0, 1, 1, 99] }]);
    expect(r.totalRappen).toBe(500);
    expect(r.abschnitte).toHaveLength(1);
  });
  it('begrenzt Rabatt auf explizite Höchstmenge', () => {
    const r = verteileRabatte(positionen, [{ ...regel, maximaleMenge: 1 }]);
    expect(r.abschnitte).toHaveLength(1);
    expect(r.abschnitte[0].menge).toBe(1);
  });
  it('berechnet Prozentabzug rappengenau', () => {
    expect(verteileRabatte([{ menge: 3, einzelpreis: 1.01 }], [{ ...regel, art: 'prozent', wert: 10, passendeIndizes: [0] }]).totalRappen).toBe(30);
  });
  it('erhöht Preis nicht bei höherem Fixpreis', () => {
    expect(verteileRabatte([{ menge: 1, einzelpreis: 5 }], [{ ...regel, art: 'fixpreis', wert: 10, passendeIndizes: [0] }]).totalRappen).toBe(0);
  });
});
