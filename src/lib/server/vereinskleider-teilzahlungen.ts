/** Geldbeträge immer in Rappen verrechnen, nie unbekannte Preise als 0 interpretieren. */
export type Preisposition = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
  einzelpreis: number | null;
  preisOffen: boolean;
};

export type Zahlungsstand = {
  faellig: number;
  bezahlt: number;
  restbetrag: number;
  offenePreispositionen: number;
  status: 'preis_offen' | 'teilweise_bezahlt' | 'offen' | 'bezahlt';
};

function rappen(wert: number): number {
  if (!Number.isFinite(wert) || wert < 0 || Math.abs(wert * 100 - Math.round(wert * 100)) > 0.000001) {
    throw new Error('Ungültiger Geldbetrag.');
  }
  return Math.round(wert * 100);
}

/** Beträge mit noch unbekanntem Preis werden weder fällig noch als bezahlt markiert. */
export function berechneZahlungsstand(
  positionen: Preisposition[],
  zahlungen: { betrag: number }[]
): Zahlungsstand {
  let faelligRappen = 0;
  let offenePreispositionen = 0;
  for (const p of positionen) {
    if (!Number.isSafeInteger(p.menge) || p.menge <= 0) throw new Error('Ungültige Menge.');
    if (p.preisOffen) {
      if (p.einzelpreis !== null) throw new Error('Offene Preise dürfen keinen Betrag enthalten.');
      offenePreispositionen++;
    } else {
      if (p.einzelpreis === null) throw new Error('Ein fälliger Preis fehlt.');
      faelligRappen += rappen(p.einzelpreis) * p.menge;
    }
  }
  const bezahltRappen = zahlungen.reduce((summe, z) => summe + rappen(z.betrag), 0);
  if (!Number.isSafeInteger(faelligRappen) || !Number.isSafeInteger(bezahltRappen)) {
    throw new Error('Betrag ausserhalb des zulässigen Bereichs.');
  }
  if (bezahltRappen > faelligRappen) throw new Error('Zahlungen übersteigen fällige Beträge.');
  const restRappen = faelligRappen - bezahltRappen;
  return {
    faellig: faelligRappen / 100,
    bezahlt: bezahltRappen / 100,
    restbetrag: restRappen / 100,
    offenePreispositionen,
    status: offenePreispositionen > 0
      ? bezahltRappen > 0 ? 'teilweise_bezahlt' : 'preis_offen'
      : restRappen === 0 ? 'bezahlt' : bezahltRappen > 0 ? 'teilweise_bezahlt' : 'offen'
  };
}
