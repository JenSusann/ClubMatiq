import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { pruefeRetourenmenge } from '../../../../lib/server/vereinskleider-retouren';
import type { RequestHandler } from './$types';

/**
 * Read-only Übersicht für Issue #69. Die POST-Funktion wird erst freigeschaltet,
 * wenn Gutschriften, Zahlungen und Lageränderungen in EINER Transaktion
 * konsistent aktualisiert werden können.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const verkaufId = url.searchParams.get('verkaufId');
  if (!verkaufId || !/^[a-f0-9]{24}$/i.test(verkaufId)) {
    return json({ fehler: 'Ungültige Verkaufs-ID.' }, { status: 400 });
  }
  try {
    const verkauf = await db.collection('vereinskleider_verkaeufe').findOne({
      _id: new ObjectId(verkaufId), vereinId: locals.benutzer!.vereinId
    });
    if (!verkauf) return json({ fehler: 'Verkauf nicht gefunden.' }, { status: 404 });
    const positionen = (Array.isArray(verkauf.positionen) ? verkauf.positionen : []).map((p, i) => {
      const uebergeben = (Array.isArray(verkauf.uebergaben) ? verkauf.uebergaben : [])
        .filter((u: { positionsIndex?: number }) => u.positionsIndex === i)
        .reduce((summe: number, u: { menge?: number }) => summe + (u.menge ?? 0), 0);
      const retourniert = (Array.isArray(verkauf.retouren) ? verkauf.retouren : [])
        .filter((r: { positionsIndex?: number }) => r.positionsIndex === i)
        .reduce((summe: number, r: { menge?: number }) => summe + (r.menge ?? 0), 0);
      const maximal = Math.max(0, uebergeben - retourniert);
      const freigegeben = false;
      let hinweis = '';
      if (maximal > 0) {
        try {
          pruefeRetourenmenge(verkauf, i, 1);
          // Eine Menge ist nicht automatisch finanziell freigegeben.
          hinweis = 'Finanzielle Zuordnung und Gutschrift müssen vor einer Retoure geprüft werden.';
        } catch (e) {
          hinweis = e instanceof Error ? e.message : 'Retoure nicht möglich.';
        }
      }
      return {
        positionsIndex: i, artikelname: p.artikelname ?? '',
        groesseId: p.groesseId ?? null, uebergeben, retourniert,
        maximal, freigegeben, hinweis
      };
    });
    const retouren = Array.isArray(verkauf.retouren) ? verkauf.retouren : [];
    return json({ verkaufId, positionen, retouren });
  } catch (e) {
    console.error('Retourenübersicht:', e);
    return json({ fehler: 'Retourenübersicht konnte nicht geladen werden.' }, { status: 500 });
  }
};
