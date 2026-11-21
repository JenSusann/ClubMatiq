/**
 * Issue #69: Mengenprüfung für Retouren. Die Funktion führt keine
 * Lager- oder Finanzbuchung aus und ist bewusst unabhängig von MongoDB.
 */
export type RetourenPosition = {
  menge?: number;
  verkaufsart?: string;
  uebergebenMenge?: number;
  retourniertMenge?: number;
  storniertMenge?: number;
  einzelpreis?: number | null;
  preisOffen?: boolean;
};
export type RetourenVorgang = {
  positionen?: RetourenPosition[];
  uebergaben?: { positionsIndex?: number; menge?: number }[];
  retouren?: { positionsIndex?: number; menge?: number }[];
  rabattTotal?: number;
  rabatte?: unknown[];
  zusaetzlicherRabatt?: number;
};

export function pruefeRetourenmenge(
  vorgang: RetourenVorgang,
  positionsIndex: number,
  menge: number
): { maximal: number; einzelpreisRappen: number } {
  if (!Number.isSafeInteger(positionsIndex) || positionsIndex < 0 ||
      !Number.isSafeInteger(menge) || menge <= 0 || menge > 10000) {
    throw new Error('Ungültige Retourenposition oder Menge.');
  }
  const p = vorgang.positionen?.[positionsIndex];
  if (!p) throw new Error('Verkaufsposition nicht gefunden.');
  const uebergaben = (vorgang.uebergaben ?? []).filter((u) => u.positionsIndex === positionsIndex);
  const protokolliert = uebergaben.reduce((summe, u) => {
    if (!Number.isSafeInteger(u.menge) || (u.menge ?? 0) <= 0) throw new Error('Übergabedaten inkonsistent.');
    return summe + (u.menge ?? 0);
  }, 0);
  // Direktverkäufe gelten mit Abschluss als sofort übergeben.
  // Bestellungen benötigen weiterhin einen expliziten Übergabenachweis.
  const uebergeben = p.verkaufsart === 'direkt' && protokolliert === 0
    ? p.menge ?? 0 : protokolliert;
  if (uebergeben <= 0) throw new Error('Keine dokumentierte Übergabe für diese Position.');
  if (p.verkaufsart !== 'direkt' && p.uebergebenMenge !== undefined && p.uebergebenMenge !== uebergeben) {
    throw new Error('Übergabemengen stimmen nicht überein.');
  }
  const retouren = (vorgang.retouren ?? []).filter((r) => r.positionsIndex === positionsIndex);
  const retourniert = retouren.reduce((summe, r) => {
    if (!Number.isSafeInteger(r.menge) || (r.menge ?? 0) <= 0) throw new Error('Retourendaten inkonsistent.');
    return summe + (r.menge ?? 0);
  }, 0);
  if (!Number.isSafeInteger(p.menge) || (p.menge ?? 0) < 0 ||
      !Number.isSafeInteger(p.storniertMenge ?? 0) || (p.storniertMenge ?? 0) < 0 ||
      retourniert > uebergeben || uebergeben > (p.menge ?? 0) + (p.storniertMenge ?? 0)) {
    throw new Error('Verkaufs- oder Retourenmengen inkonsistent.');
  }
  const maximal = uebergeben - retourniert;
  if (menge > maximal) throw new Error(`Nur ${maximal} bereits übergebene Stück sind noch retournierbar.`);
  if ((vorgang.rabatte?.length ?? 0) > 0 || (vorgang.rabattTotal ?? 0) !== 0 ||
      (vorgang.zusaetzlicherRabatt ?? 0) !== 0 || p.preisOffen === true ||
      typeof p.einzelpreis !== 'number' || !Number.isFinite(p.einzelpreis) ||
      p.einzelpreis < 0 || !Number.isSafeInteger(Math.round(p.einzelpreis * 100)) ||
      Math.abs(p.einzelpreis * 100 - Math.round(p.einzelpreis * 100)) > 0.000001) {
    throw new Error('Retourenbetrag wegen Rabatt oder offenem Preis nicht eindeutig berechenbar.');
  }
  return { maximal, einzelpreisRappen: Math.round(p.einzelpreis * 100) };
}
