export type RabattPosition = { menge: number; einzelpreis: number | null };
export type Verteilregel = {
  id: string; einmalig: boolean; kombinierbar: boolean;
  art: 'fixpreis' | 'prozent' | 'betrag'; wert: number;
  maximaleMenge?: number | null; passendeIndizes: number[];
};
export type RabattAbschnitt = { positionsIndex: number; abStueck: number; menge: number; rabattRappen: number; regelId: string };
export function verteileRabatte(positionen: RabattPosition[], regeln: Verteilregel[]) {
  if (regeln.length > 1 && regeln.some(r => !r.kombinierbar)) throw new Error('Rabattregeln nicht kombinierbar.');
  const rest = positionen.map(p => p.einzelpreis === null ? 0 : p.menge);
  const abschnitte: RabattAbschnitt[] = [];
  const summen: Record<string, number> = Object.create(null);
  const sortiert = [...regeln].sort((a,b) => Number(b.einmalig)-Number(a.einmalig) || a.id.localeCompare(b.id));
  for (const r of sortiert) {
    let limit = r.einmalig ? 1 : r.maximaleMenge ?? Number.MAX_SAFE_INTEGER;
    let basis = 0;
    const teile: { positionsIndex: number; abStueck: number; menge: number; brutto: number }[] = [];
    for (const i of [...new Set(r.passendeIndizes)].sort((a,b)=>a-b)) {
      const p = positionen[i];
      if (!p || p.einzelpreis === null || rest[i] <= 0 || limit <= 0) continue;
      const menge = Math.min(rest[i],limit);
      const brutto = Math.round(p.einzelpreis*100)*menge;
      teile.push({ positionsIndex:i, abStueck:p.menge-rest[i], menge, brutto });
      basis += brutto; rest[i] -= menge; limit -= menge;
    }
    if (!teile.length) throw new Error('Keine verbleibenden Stücke für Rabattregel.');
    const gesamt = r.art === 'betrag' ? Math.min(basis,Math.round(r.wert*100)) :
      r.art === 'prozent' ? Math.min(basis,Math.round(basis*r.wert/100)) :
      teile.reduce((s,t)=>s+Math.max(0,t.brutto-Math.round(r.wert*100)*t.menge),0);
    let kumuliert = 0, verteilt = 0;
    for (const t of teile) {
      kumuliert += t.brutto;
      const rabatt = r.art === 'fixpreis' ? Math.max(0,t.brutto-Math.round(r.wert*100)*t.menge) :
        basis === 0 ? 0 : Math.round(gesamt*kumuliert/basis)-verteilt;
      verteilt += rabatt;
      abschnitte.push({ positionsIndex:t.positionsIndex, abStueck:t.abStueck, menge:t.menge, rabattRappen:rabatt, regelId:r.id });
    }
    summen[r.id] = gesamt;
  }
  return { abschnitte, summen, totalRappen: Object.values(summen).reduce((s,n)=>s+n,0) };
}
