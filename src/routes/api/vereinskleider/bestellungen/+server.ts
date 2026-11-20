import { json } from '@sveltejs/kit';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Bestellposition = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
  einzelpreis: number | null;
  preisOffen?: boolean;
  verkaufsart: 'direkt' | 'bestellung';
  uebergebenMenge?: number;
  reserviertMenge?: number;
  storniertMenge?: number;
};

type Positionsstatus = 'offen' | 'teilweise' | 'abgeschlossen' | 'storniert';

export const GET: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  const vereinId = locals.benutzer!.vereinId;
  const suche = (url.searchParams.get('suche') ?? '').trim().toLocaleLowerCase('de-CH');
  const status = url.searchParams.get('status') ?? 'offen';
  if (!['alle', 'offen', 'teilweise', 'abgeschlossen', 'storniert'].includes(status)) {
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

        // Nach einer Stornierung enthält menge nur noch die aktive Bestellmenge.
        // storniertMenge dokumentiert die bereits stornierten Stücke separat.
        const bestellt = Number(position.menge);
        const uebergeben = Number(position.uebergebenMenge ?? 0);
        const reserviert = Number(position.reserviertMenge ?? 0);
        const storniert = Number(position.storniertMenge ?? 0);
        if (!Number.isSafeInteger(bestellt) || bestellt < 0 ||
            !Number.isSafeInteger(storniert) || storniert < 0 ||
            bestellt + storniert < 1 || !Number.isSafeInteger(bestellt + storniert) ||
            !Number.isSafeInteger(uebergeben) || uebergeben < 0 || uebergeben > bestellt ||
            !Number.isSafeInteger(reserviert) || reserviert < 0 || reserviert > bestellt - uebergeben) return [];

        const offen = bestellt - uebergeben;
        const nochFehlend = offen - reserviert;
        const positionsstatus: Positionsstatus = bestellt === 0
          ? 'storniert'
          : offen === 0 ? 'abgeschlossen' : uebergeben > 0 ? 'teilweise' : 'offen';
        const eintrag = {
          vorgangId: vorgang._id.toString(),
          positionsIndex: index,
          erstelltAm: vorgang.erstelltAm,
          kaeufer: String(vorgang.kaeufer ?? ''),
          riegen: Array.isArray(vorgang.riegen) ? vorgang.riegen : [],
          zahlungsart: vorgang.zahlungsart,
          zahlungsstatus: vorgang.zahlungsstatus ?? 'offen',
          endbetrag: Number(vorgang.endbetrag ?? 0),
          bezahltBetrag: Number(vorgang.bezahltBetrag ?? 0),
          zahlungen: Array.isArray(vorgang.zahlungen) ? vorgang.zahlungen.map((z: { betrag: number; zahlungsart: string; datum: Date }) => ({ betrag: z.betrag, zahlungsart: z.zahlungsart, datum: z.datum })) : [],
          restbetragBekannt: Math.max(0, Math.round((Number(vorgang.endbetrag ?? 0) - Number(vorgang.bezahltBetrag ?? 0)) * 100) / 100),
          artikelId: position.artikelId,
          artikelname: position.artikelname,
          groesseId: position.groesseId,
          bestellt,
          urspruenglichBestellt: bestellt + storniert,
          storniert,
          storniertMenge: storniert,
          uebergeben,
          reserviert,
          reserviertMenge: reserviert,
          nochFehlend,
          offen,
          einzelpreis: position.einzelpreis,
          preisOffen: position.preisOffen === true,
          status: positionsstatus
        };
        if (status !== 'alle' && status !== positionsstatus &&
            !(status === 'offen' && positionsstatus === 'teilweise')) return [];
        if (suche && ![eintrag.kaeufer, eintrag.artikelname, ...eintrag.riegen]
          .some((wert) => String(wert).toLocaleLowerCase('de-CH').includes(suche))) return [];
        return [eintrag];
      });
    });

    return json({ bestellungen, anzahl: bestellungen.length, begrenzt: vorgaenge.length === 1000 });
  } catch (fehler) {
    console.error('Fehler beim Laden der Vereinskleiderbestellungen:', fehler);
    return json({ fehler: 'Bestellungen konnten nicht geladen werden.' }, { status: 500 });
  }
};
