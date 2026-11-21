import { json } from '@sveltejs/kit';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const seiteText = url.searchParams.get('seite') ?? '1';
  if (!/^[1-9]\\d*$/.test(seiteText) || !Number.isSafeInteger(Number(seiteText))) {
    return json({ fehler: 'Ungültige Seitennummer.' }, { status: 400 });
  }
  const seite = Number(seiteText);
  const proSeite = 25;
  try {
    const pipeline = [
      { $match: { vereinId: locals.benutzer!.vereinId, 'retouren.0': { $exists: true } } },
      { $unwind: '$retouren' },
      { $sort: { 'retouren.erfasstAm': -1, _id: -1 } },
      { $facet: {
        daten: [
          { $skip: (seite - 1) * proSeite },
          { $limit: proSeite },
          { $project: {
            _id: 0, verkaufId: { $toString: '$_id' },
            kaeufer: { $ifNull: ['$kaeufer', 'Unbekannt'] },
            artikel: { $ifNull: [
              { $arrayElemAt: ['$positionen.artikelname', '$retouren.positionsIndex'] }, 'Artikel'
            ] },
            menge: '$retouren.menge', datum: '$retouren.datum',
            grund: '$retouren.grund', wiederverkaufbar: '$retouren.wiederverkaufbar',
            betrag: '$retouren.betrag', retourId: '$retouren._id',
            rechnungId: '$retouren.rechnungId'
          } }
        ],
        anzahl: [{ $count: 'total' }]
      } }
    ];
    const [ergebnis] = await db.collection('vereinskleider_verkaeufe').aggregate(pipeline).toArray();
    const total = ergebnis?.anzahl?.[0]?.total ?? 0;
    return json({ retouren: ergebnis?.daten ?? [], seite, seiten: Math.max(1, Math.ceil(total / proSeite)), total });
  } catch (e) {
    console.error('Retourenhistorie:', e);
    return json({ fehler: 'Retourenhistorie konnte nicht geladen werden.' }, { status: 500 });
  }
};
