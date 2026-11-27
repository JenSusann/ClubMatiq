import type { RabattAbschnitt } from './rabattverteilung';

// Stornierung vom Ende einer Position: Erstbezugsstück bleibt bis zuletzt erhalten.
export function korrigiereRabattAbschnitte(abschnitte: RabattAbschnitt[], index: number, bisher: number, menge: number) {
  if (!Number.isSafeInteger(bisher) || !Number.isSafeInteger(menge) || menge < 1 || menge > bisher) throw new Error('Ungültige Stornierungsmenge.');
  const grenze = bisher - menge;
  const verbleibend: RabattAbschnitt[] = [];
  const korrekturen: Record<string, number> = Object.create(null);
  let ende = 0;
  for (const a of abschnitte.filter(a => a.positionsIndex === index).sort((a,b)=>a.abStueck-b.abStueck)) {
    if (!Number.isSafeInteger(a.abStueck) || !Number.isSafeInteger(a.menge) || !Number.isSafeInteger(a.rabattRappen) ||
        a.abStueck < ende || a.menge < 1 || a.rabattRappen < 0 || a.abStueck+a.menge > bisher) throw new Error('Ungültiger Rabattabschnitt.');
    ende = a.abStueck+a.menge;
    const rest = Math.max(0,Math.min(a.menge,grenze-a.abStueck));
    const rabattRest = Math.round(a.rabattRappen*rest/a.menge);
    korrekturen[a.regelId] = (korrekturen[a.regelId] ?? 0) + a.rabattRappen-rabattRest;
    if (rest > 0) verbleibend.push({...a,menge:rest,rabattRappen:rabattRest});
  }
  return { abschnitte: [...abschnitte.filter(a=>a.positionsIndex!==index),...verbleibend],
    korrekturen, rabattKorrektur: Object.values(korrekturen).reduce((s,n)=>s+n,0) };
}
