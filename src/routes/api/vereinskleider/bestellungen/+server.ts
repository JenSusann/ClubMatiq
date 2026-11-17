import { json } from '@sveltejs/kit';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Bestellposition = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
  einzelpreis: number;
  verkaufsart: 'direkt' | 'bestellung';
  uebergebenMenge?: number;
};

export const GET: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  const vereinId = locals.benutzer!.vereinId;
  const suche = (url.searchParams.get('suche') ?? '').trim().toLocaleLowerCase('de-CH');
  const status = url.searchParams.get('status') ?? 'offen';
  if (!['alle', 'offen', 'teilweise', 'abgeschlossen'].includes(status)) {
    return json({ fehler: 'Ungültiger Statusfilter.' }, { status: 400 });
  }

  try {
    const vorgaenge = await db.collection('vereinskleider_verkaeufe')
      .find({ vereinId, 'positionen.verkaufsart': 'bestellung' })
      .sort({ erstelltAm: -1 })
      .limit(1000)
      .toArray();

    const bestellungen = vorgaenge.flatMap((vorgang) => {
      const positionen = (Array.isArray(vorgang.positionen) ? vorgang.positionen : []) as Bestellposition[];
      return positionen.flatMap((position, index) => {
        if (position.verkaufsart !== 'bestellung') return [];
        const bestellt = Number(position.menge);
        const uebergeben = Number(position.uebergebenMenge ?? 0);
        if (!Number.isSafeInteger(bestellt) || bestellt < 1 || !Number.isSafeInteger(uebergeben) || uebergeben < 0 || uebergeben > bestellt) return [];
        const offen = bestellt - uebergeben;
        const positionsstatus = offen === 0 ? 'abgeschlossen' : uebergeben > 0 ? 'teilweise' : 'offen';
        const eintrag = {
          vorgangId: vorgang._id.toString(),
          positionsIndex: index,
          erstelltAm: vorgang.erstelltAm,
          kaeufer: String(vorgang.kaeufer ?? ''),
          riegen: Array.isArray(vorgang.riegen) ? vorgang.riegen : [],
          zahlungsart: vorgang.zahlungsart,
          zahlungsstatus: vorgang.zahlungsstatus ?? 'offen',
          artikelId: position.artikelId,
          artikelname: position.artikelname,
          groesseId: position.groesseId,
          bestellt,
          uebergeben,
          offen,
          einzelpreis: position.einzelpreis,
          status: positionsstatus
        };
        if (status !== 'alle' && status !== positionsstatus && !(status === 'offen' && positionsstatus === 'teilweise')) return [];
        if (suche && ![eintrag.kaeufer, eintrag.artikelname, ...eintrag.riegen].some((wert) => String(wert).toLocaleLowerCase('de-CH').includes(suche))) return [];
        return [eintrag];
      });
    });

    return json({ bestellungen, anzahl: bestellungen.length, begrenzt: vorgaenge.length === 1000 });
  } catch (fehler) {
    console.error('Fehler beim Laden der Vereinskleiderbestellungen:', fehler);
    return json({ fehler: 'Bestellungen konnten nicht geladen werden.' }, { status: 500 });
  }
};
