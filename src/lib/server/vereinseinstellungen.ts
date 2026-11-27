export type Vereinsadresse = { strasse: string; plz: string; ort: string };
export type Vereinskontakt = { email: string; telefon: string; website: string };
export type Vereinslogo = { url: string; publicId: string };
export type Vereinseinstellungen = {
  name: string;
  kuerzel: string;
  adresse: Vereinsadresse;
  kontakt: Vereinskontakt;
};
export type Ausstellerdaten = Vereinseinstellungen & { logo: Vereinslogo | null };

type Ergebnis = { erfolg: true; daten: Vereinseinstellungen } | { erfolg: false; fehler: string };

function objekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function feld(wert: unknown, name: string, max: number, pflicht = false): string {
  if (wert === undefined && !pflicht) return '';
  if (typeof wert !== 'string') throw new Error(name + ' muss Text sein.');
  const text = wert.trim();
  if ((pflicht && !text) || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(name + ' ist ungültig.');
  }
  return text;
}

function gruppe(wert: unknown, name: string): Record<string, unknown> {
  if (wert === undefined) return {};
  if (!objekt(wert)) throw new Error(name + ' ist ungültig.');
  return wert;
}

export function validiereVereinseinstellungen(eingabe: unknown): Ergebnis {
  try {
    if (!objekt(eingabe)) throw new Error('Ungültige Vereinsdaten.');
    const adresse = gruppe(eingabe.adresse, 'Adresse');
    const kontakt = gruppe(eingabe.kontakt, 'Kontakt');
    const email = feld(kontakt.email, 'E-Mail', 254);
    const website = feld(kontakt.website, 'Website', 500);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Ungültige Kontakt-E-Mail.');
    }
    if (website) {
      let url: URL;
      try { url = new URL(website); }
      catch { throw new Error('Ungültige Website.'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Ungültige Website.');
      }
    }
    return { erfolg: true, daten: {
      name: feld(eingabe.name, 'Vereinsname', 150, true),
      kuerzel: feld(eingabe.kuerzel, 'Vereinskürzel', 30),
      adresse: {
        strasse: feld(adresse.strasse, 'Strasse', 150),
        plz: feld(adresse.plz, 'PLZ', 20),
        ort: feld(adresse.ort, 'Ort', 100)
      },
      kontakt: { email, telefon: feld(kontakt.telefon, 'Telefonnummer', 50), website }
    } };
  } catch (fehler) {
    return { erfolg: false, fehler: fehler instanceof Error ? fehler.message : 'Ungültige Vereinsdaten.' };
  }
}

/** Erstellt eine unabhängige Kopie der verfügbaren Ausstellerdaten. */
export function erstelleAusstellerdaten(verein: unknown): Ausstellerdaten {
  const quelle = objekt(verein) ? verein : {};
  const adresse = objekt(quelle.adresse) ? quelle.adresse : {};
  const kontakt = objekt(quelle.kontakt) ? quelle.kontakt : {};
  const logo = objekt(quelle.logo) ? quelle.logo : {};
  const text = (wert: unknown): string => typeof wert === 'string' ? wert : '';
  return {
    name: text(quelle.name) || 'Verein',
    kuerzel: text(quelle.kuerzel),
    adresse: { strasse: text(adresse.strasse), plz: text(adresse.plz), ort: text(adresse.ort) },
    kontakt: { email: text(kontakt.email), telefon: text(kontakt.telefon), website: text(kontakt.website) },
    logo: typeof logo.url === 'string' && logo.url && typeof logo.publicId === 'string' && logo.publicId
      ? { url: logo.url, publicId: logo.publicId }
      : null
  };
}
