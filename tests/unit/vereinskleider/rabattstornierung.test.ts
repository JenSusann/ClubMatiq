import { describe, it, expect } from 'vitest';
import { korrigiereRabattAbschnitte } from '../../../src/lib/rabattstornierung';
import { verteileRabatte } from '../../../src/lib/rabattverteilung';

const abschnitte = verteileRabatte([{ menge: 2, einzelpreis: 150 }, { menge: 1, einzelpreis: 50 }], [
  { id: 'gw', einmalig: true, kombinierbar: true, art: 'fixpreis', wert: 50, passendeIndizes: [0] },
  { id: 'jacke', einmalig: true, kombinierbar: true, art: 'fixpreis', wert: 20, passendeIndizes: [1] },
  { id: 'sonstiges', einmalig: false, kombinierbar: true, art: 'fixpreis', wert: 5, passendeIndizes: [0,1] }
]).abschnitte;

describe('Issue #130 – Rabattstornierung', () => {
  it('storniert zuerst das zweite Gwändli für CHF 5', () => {
    const r = korrigiereRabattAbschnitte(abschnitte,0,2,1);
    expect(15000-r.rabattKorrektur).toBe(500);
    expect(r.abschnitte.some(a=>a.regelId==='gw')).toBe(true);
    expect(r.abschnitte.some(a=>a.regelId==='sonstiges')).toBe(false);
  });
  it('storniert danach den Erstbezug für CHF 50', () => {
    const r = korrigiereRabattAbschnitte(abschnitte,0,2,1);
    const s = korrigiereRabattAbschnitte(r.abschnitte,0,1,1);
    expect(15000-s.rabattKorrektur).toBe(5000);
    expect(s.abschnitte.map(a=>a.regelId)).toEqual(['jacke']);
  });
  it('korrigiert beide Gwändli zusammen um netto CHF 55', () => {
    expect(30000-korrigiereRabattAbschnitte(abschnitte,0,2,2).rabattKorrektur).toBe(5500);
  });
  it('korrigiert die Jacke unabhängig um CHF 20', () => {
    const r = korrigiereRabattAbschnitte(abschnitte,1,1,1);
    expect(5000-r.rabattKorrektur).toBe(2000);
    expect(r.abschnitte).toHaveLength(2);
  });
  it('erhält Rundungsreste bei mehreren Stornierungen', () => {
    const a = [{positionsIndex:0,abStueck:0,menge:3,rabattRappen:100,regelId:'r'}];
    const r = korrigiereRabattAbschnitte(a,0,3,1);
    const s = korrigiereRabattAbschnitte(r.abschnitte,0,2,2);
    expect(r.rabattKorrektur+s.rabattKorrektur).toBe(100);
  });
  it('verweigert ungültige Mengen und überlappende Abschnitte', () => {
    expect(()=>korrigiereRabattAbschnitte(abschnitte,0,2,3)).toThrow();
    expect(()=>korrigiereRabattAbschnitte([...abschnitte,...abschnitte],0,2,1)).toThrow();
  });
});
