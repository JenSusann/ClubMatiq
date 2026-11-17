import { json } from '@sveltejs/kit';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Uebergabe = {
  positionsIndex?: number;
  artikelId?: string;
  groesseId?: string | null;
  menge?: number;
  uebergebenAm?: Date | string;
};

type Position = {
  artikelId?: string;
  artikelname?: string;
  groesseId?: string | null;
  verkaufsart?: string;
};

type Verkaufsdokument = {
  _id: import('mongodb').ObjectId;
  vereinId: string;
  kaeufer?: string;
  riegen?: string[];
  positionen?: Position[];
  uebergaben?: Uebergabe[];
};

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  try {
    const vereinId = locals.benutzer!.vereinId;
    const vorgaenge = await db.collection<Verkaufsdokument>('vereinskleider_verkaeufe')
      .find({ vereinId, 'uebergaben.0': { $exists: true } })
      .project<Verkaufsdokument>({ kaeufer: 1, riegen: 1, positionen: 1, uebergaben: 1 })
      .toArray();

    const historie = vorgaenge.flatMap((vorgang) => {
      const positionen = Array.isArray(vorgang.positionen) ? vorgang.positionen : [];
      const uebergaben = Array.isArray(vorgang.uebergaben) ? vorgang.uebergaben : [];
      return uebergaben.flatMap((eintrag, eintragsIndex) => {
        const positionsIndex = eintrag.positionsIndex;
        if (!Number.isSafeInteger(positionsIndex) || (positionsIndex as number) < 0 ||
            !Number.isSafeInteger(eintrag.menge) || (eintrag.menge as number) < 1 ||
            !eintrag.uebergebenAm) return [];

        const position = positionen[positionsIndex as number];
        const datum = new Date(eintrag.uebergebenAm);
        if (Number.isNaN(datum.getTime())) return [];

        return [{
          id: `${vorgang._id.toString()}:${eintragsIndex}`,
          vorgangId: vorgang._id.toString(),
          positionsIndex,
          kaeufer: vorgang.kaeufer ?? 'Unbekannt',
          riegen: Array.isArray(vorgang.riegen) ? vorgang.riegen : [],
          artikelId: eintrag.artikelId ?? position?.artikelId ?? '',
          artikelname: position?.artikelname ?? 'Unbekannter Artikel',
          groesseId: eintrag.groesseId ?? position?.groesseId ?? null,
          menge: eintrag.menge as number,
          uebergebenAm: datum.toISOString()
        }];
      });
    });

    historie.sort((a, b) => b.uebergebenAm.localeCompare(a.uebergebenAm));
    return json({ historie });
  } catch (fehler) {
    console.error('Fehler beim Laden der Übergabehistorie:', fehler);
    return json({ fehler: 'Übergabehistorie konnte nicht geladen werden.' }, { status: 500 });
  }
};
