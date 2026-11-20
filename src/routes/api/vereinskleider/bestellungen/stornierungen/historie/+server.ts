import { json } from '@sveltejs/kit';
import { db } from '../../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Stornierung = { positionsIndex?: number; menge?: number; grund?: string; storniertAm?: Date | string; storniertVon?: string; storniertVonName?: string };
type Position = { artikelId?: string; artikelname?: string; groesseId?: string | null; verkaufsart?: string };
type Verkauf = { _id: import('mongodb').ObjectId; vereinId: string; kaeufer?: string; riegen?: string[]; positionen?: Position[]; stornierungen?: Stornierung[] };

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  try {
    const vereinId = locals.benutzer!.vereinId;
    const vorgaenge = await db.collection<Verkauf>('vereinskleider_verkaeufe')
      .find({ vereinId, 'stornierungen.0': { $exists: true } })
      .project<Verkauf>({ kaeufer: 1, riegen: 1, positionen: 1, stornierungen: 1 })
      .toArray();

    const historie = vorgaenge.flatMap((vorgang) => {
      const positionen = Array.isArray(vorgang.positionen) ? vorgang.positionen : [];
      return (Array.isArray(vorgang.stornierungen) ? vorgang.stornierungen : []).flatMap((eintrag, index) => {
        if (!Number.isSafeInteger(eintrag.positionsIndex) || (eintrag.positionsIndex as number) < 0 ||
            !Number.isSafeInteger(eintrag.menge) || (eintrag.menge as number) < 1 || !eintrag.storniertAm) return [];
        const position = positionen[eintrag.positionsIndex as number];
        if (!position || position.verkaufsart !== 'bestellung') return [];
        const datum = new Date(eintrag.storniertAm);
        if (Number.isNaN(datum.getTime())) return [];
        return [{
          id: `${vorgang._id.toString()}:${index}`,
          vorgangId: vorgang._id.toString(),
          positionsIndex: eintrag.positionsIndex as number,
          kaeufer: vorgang.kaeufer ?? 'Unbekannt',
          riegen: Array.isArray(vorgang.riegen) ? vorgang.riegen : [],
          artikelId: position.artikelId ?? '',
          artikelname: position.artikelname ?? 'Unbekannter Artikel',
          groesseId: position.groesseId ?? null,
          menge: eintrag.menge as number,
          grund: eintrag.grund ?? '',
          storniertAm: datum.toISOString(),
          storniertVon: eintrag.storniertVon ?? null,
          storniertVonName: eintrag.storniertVonName ?? null
        }];
      });
    });
    historie.sort((a, b) => b.storniertAm.localeCompare(a.storniertAm));
    return json({ historie });
  } catch (fehler) {
    console.error('Fehler beim Laden der Stornierungshistorie:', fehler);
    return json({ fehler: 'Stornierungshistorie konnte nicht geladen werden.' }, { status: 500 });
  }
};
