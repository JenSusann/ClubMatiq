
export interface InventarArtikel {
  _id?: string;
  name: string;
  kategorieId: string;
  lagerortId: string;
  menge: number;
  einzelwert: number;
  beschreibung?: string;
  hatGroessen: boolean;
}

export interface Kategorie {
  _id?: string;
  name: string;
}

export interface Lagerort {
  _id?: string;
  name: string;
}

export interface Groesse {
  _id?: string;
  bezeichnung: string;
  sortierung: number;
}

export interface Artikelvariante {
  _id?: string;
  artikelId: string;
  groesseId: string;
  menge: number;
}
