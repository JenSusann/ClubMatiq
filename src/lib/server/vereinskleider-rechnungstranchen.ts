/**
 * Issue #68: Rechenbasis für mehrere Rechnungen derselben Bestellung.
 * Jede Rechnungsposition verweist auf ihren ursprünglichen Positionsindex.
 * Bereits abgerechnete Mengen dürfen nicht erneut in Rechnung gestellt werden.
 */
export type TranchePosition = {
  positionsIndex: number;
  menge: number;
  einzelpreis: number | null;
  preisOffen?: boolean;
  storniertMenge?: number;
};
export type AbgerechnetePosition = { positionsIndex: number; menge: number };
export type Rechnungstranche = {
  positionen: { positionsIndex: number; menge: number; einzelpreis: number; betrag: number }[];
  gesamtbetrag: number;
  offenePreispositionen: number;
};

const rappen = (betrag: number): number => {
  const wert = Math.round(betrag * 100);
  if (!Number.isFinite(betrag) || betrag < 0 || !Number.isSafeInteger(wert) ||
      Math.abs(betrag * 100 - wert) > 0.000001) {
    throw new Error('Ungültiger Rechnungsbetrag.');
  }
  return wert;
};

export function berechneNaechsteRechnungstranche(
  positionen: TranchePosition[],
  bereitsAbgerechnet: AbgerechnetePosition[]
): Rechnungstranche {
  const abgerechnet = new Map<number, number>();
  for (const eintrag of bereitsAbgerechnet) {
    if (!Number.isSafeInteger(eintrag.positionsIndex) || eintrag.positionsIndex < 0 ||
        !Number.isSafeInteger(eintrag.menge) || eintrag.menge <= 0) {
      throw new Error('Ungültige bereits abgerechnete Menge.');
    }
    abgerechnet.set(eintrag.positionsIndex,
      (abgerechnet.get(eintrag.positionsIndex) ?? 0) + eintrag.menge);
  }
  const indices = new Set<number>();
  const tranche: Rechnungstranche['positionen'] = [];
  let total = 0;
  let offenePreispositionen = 0;
  for (const p of positionen) {
    if (!Number.isSafeInteger(p.positionsIndex) || p.positionsIndex < 0 ||
        indices.has(p.positionsIndex) || !Number.isSafeInteger(p.menge) || p.menge <= 0 ||
        !Number.isSafeInteger(p.storniertMenge ?? 0) || (p.storniertMenge ?? 0) < 0 ||
        (p.storniertMenge ?? 0) > p.menge) {
      throw new Error('Ungültige Bestellposition.');
    }
    indices.add(p.positionsIndex);
    const nochVerrechenbar = p.menge - (p.storniertMenge ?? 0);
    const schon = abgerechnet.get(p.positionsIndex) ?? 0;
    if (schon > nochVerrechenbar) throw new Error('Bereits abgerechnete Menge übersteigt die Bestellmenge.');
    const menge = nochVerrechenbar - schon;
    if (menge === 0) continue;
    if (p.preisOffen === true || p.einzelpreis === null) {
      if (p.preisOffen !== true || p.einzelpreis !== null) throw new Error('Widersprüchlicher Preisstatus.');
      offenePreispositionen++;
      continue;
    }
    const einzelpreis = rappen(p.einzelpreis);
    const betrag = einzelpreis * menge;
    if (!Number.isSafeInteger(betrag)) throw new Error('Rechnungsbetrag zu gross.');
    total += betrag;
    if (!Number.isSafeInteger(total)) throw new Error('Rechnungsbetrag zu gross.');
    tranche.push({ positionsIndex: p.positionsIndex, menge, einzelpreis: einzelpreis / 100, betrag: betrag / 100 });
  }
  for (const index of abgerechnet.keys()) {
    if (!indices.has(index)) throw new Error('Abgerechnete Position existiert nicht.');
  }
  return { positionen: tranche, gesamtbetrag: total / 100, offenePreispositionen };
}
