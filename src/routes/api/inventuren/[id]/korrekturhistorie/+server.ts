import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type VerlaufEintrag = {
  id: string;
  aktion: string;
  ausgefuehrtAm: Date | string;
  ausgefuehrtVon: string | null;
  bearbeitetVon: string;
  begruendung: string | null;
  artikelName: string | null;
  positionId: string | null;
  alterIstBestand: number | null;
  neuerIstBestand: number | null;
  differenz: number | null;
  statusVorher: string | null;
  anzahlRueckbuchungen: number | null;
  anzahlKorrekturen: number | null;
  positionen: unknown[] | null;
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'inventur:abschliessen');
  if (berechtigungsfehler) return berechtigungsfehler;

  const inventurId = params.id;
  const vereinId = locals.benutzer!.vereinId;

  if (!ObjectId.isValid(inventurId)) {
    return json({ fehler: 'Ungültige Inventur-ID.' }, { status: 400 });
  }

  try {
    const inventur = await db.collection('inventuren').findOne(
      { _id: new ObjectId(inventurId), vereinId }
    );

    if (!inventur) {
      return json({ fehler: 'Inventur nicht gefunden.' }, { status: 404 });
    }

    const [eintraege, positionen] = await Promise.all([
      db.collection('inventurprotokoll')
        .find({ vereinId, inventurId })
        .sort({ ausgefuehrtAm: 1, _id: 1 })
        .toArray(),
      db.collection('inventurpositionen')
        .find({ vereinId, inventurId })
        .project({ _id: 1, artikelName: 1, groesseId: 1 })
        .toArray()
    ]);

    const positionenNachId = new Map(
      positionen.map((position) => [position._id.toString(), position])
    );

    // Auch ältere Inventuren können Benutzerangaben direkt im Inventurdokument haben.
    const benutzerIds = [
      ...new Set([
        ...eintraege.map((eintrag) => String(eintrag.ausgefuehrtVon ?? '')),
        String(inventur.erstelltVon ?? ''),
        String(inventur.abgeschlossenVon ?? ''),
        String(inventur.storniertVon ?? '')
      ].filter((id) => ObjectId.isValid(id)))
    ];

    const benutzer = benutzerIds.length > 0
      ? await db.collection('benutzer')
          .find({ vereinId, _id: { $in: benutzerIds.map((id) => new ObjectId(id)) } })
          .project({ _id: 1, vorname: 1, nachname: 1 })
          .toArray()
      : [];

    const benutzernamenNachId = new Map(
      benutzer.map((person) => [
        person._id.toString(),
        [person.vorname, person.nachname]
          .filter((teil): teil is string => typeof teil === 'string' && teil.trim().length > 0)
          .join(' ') || 'Unbekannter Benutzer'
      ])
    );

    const nameFuer = (id: unknown): string =>
      benutzernamenNachId.get(String(id ?? '')) ?? 'Unbekannter Benutzer';

    // Unveränderte API-Struktur für die bereits funktionierende Korrekturtabelle.
    const korrekturen = eintraege
      .filter((eintrag) => eintrag.aktion === 'nachtraeglich_korrigiert')
      .map((eintrag) => {
        const position = positionenNachId.get(String(eintrag.positionId));
        return {
          id: eintrag._id.toString(),
          positionId: String(eintrag.positionId),
          artikelName: position?.artikelName ?? 'Unbekannter Artikel',
          groesseId: eintrag.groesseId ?? position?.groesseId ?? null,
          alterIstBestand: eintrag.alterIstBestand,
          neuerIstBestand: eintrag.neuerIstBestand,
          differenz: eintrag.differenz,
          begruendung: eintrag.begruendung,
          ausgefuehrtAm: eintrag.ausgefuehrtAm,
          ausgefuehrtVon: eintrag.ausgefuehrtVon,
          bearbeitetVon: nameFuer(eintrag.ausgefuehrtVon)
        };
      });

    const verlauf: VerlaufEintrag[] = eintraege
      .filter((eintrag) => eintrag.ausgefuehrtAm instanceof Date || typeof eintrag.ausgefuehrtAm === 'string')
      .map((eintrag) => {
        const positionId = eintrag.positionId == null ? null : String(eintrag.positionId);
        const position = positionId ? positionenNachId.get(positionId) : undefined;
        return {
          id: eintrag._id.toString(),
          aktion: String(eintrag.aktion ?? 'unbekannt'),
          ausgefuehrtAm: eintrag.ausgefuehrtAm as Date | string,
          ausgefuehrtVon: eintrag.ausgefuehrtVon == null ? null : String(eintrag.ausgefuehrtVon),
          bearbeitetVon: nameFuer(eintrag.ausgefuehrtVon),
          begruendung: typeof eintrag.begruendung === 'string' ? eintrag.begruendung : null,
          artikelName: position?.artikelName ?? (typeof eintrag.artikelName === 'string' ? eintrag.artikelName : null),
          positionId,
          alterIstBestand: typeof eintrag.alterIstBestand === 'number' ? eintrag.alterIstBestand : null,
          neuerIstBestand: typeof eintrag.neuerIstBestand === 'number' ? eintrag.neuerIstBestand : null,
          differenz: typeof eintrag.differenz === 'number' ? eintrag.differenz : null,
          statusVorher: typeof eintrag.statusVorher === 'string' ? eintrag.statusVorher : null,
          anzahlRueckbuchungen: typeof eintrag.anzahlRueckbuchungen === 'number' ? eintrag.anzahlRueckbuchungen : null,
          anzahlKorrekturen: typeof eintrag.anzahlKorrekturen === 'number' ? eintrag.anzahlKorrekturen : null,
          positionen: Array.isArray(eintrag.positionen) ? eintrag.positionen : null
        };
      });

    // Für ältere Inventuren nur tatsächlich vorhandene Metadaten ergänzen.
    // Falls ein entsprechender Protokolleintrag existiert, nicht doppelt anzeigen.
    const ergaenzeAltesEreignis = (
      aktion: string,
      datum: unknown,
      benutzerId: unknown,
      weitere: Partial<VerlaufEintrag> = {}
    ) => {
      if (!(datum instanceof Date) && typeof datum !== 'string') return;
      if (typeof datum === 'string' && Number.isNaN(Date.parse(datum))) return;
      if (verlauf.some((eintrag) => eintrag.aktion === aktion)) return;
      verlauf.push({
        id: `alt-${aktion}-${inventurId}`,
        aktion,
        ausgefuehrtAm: datum,
        ausgefuehrtVon: benutzerId == null ? null : String(benutzerId),
        bearbeitetVon: nameFuer(benutzerId),
        begruendung: null,
        artikelName: null,
        positionId: null,
        alterIstBestand: null,
        neuerIstBestand: null,
        differenz: null,
        statusVorher: null,
        anzahlRueckbuchungen: null,
        anzahlKorrekturen: null,
        positionen: null,
        ...weitere
      });
    };

    ergaenzeAltesEreignis('erstellt', inventur.erstelltAm, inventur.erstelltVon);
    ergaenzeAltesEreignis('abgeschlossen', inventur.abgeschlossenAm, inventur.abgeschlossenVon, {
      anzahlKorrekturen: typeof inventur.anzahlKorrekturen === 'number' ? inventur.anzahlKorrekturen : null
    });
    ergaenzeAltesEreignis('storniert', inventur.storniertAm, inventur.storniertVon, {
      begruendung: typeof inventur.stornierungsgrund === 'string' ? inventur.stornierungsgrund : null
    });

    verlauf.sort((a, b) => {
      const differenz = new Date(a.ausgefuehrtAm).getTime() - new Date(b.ausgefuehrtAm).getTime();
      return differenz || a.id.localeCompare(b.id);
    });

    return json({ korrekturen, verlauf });
  } catch (error) {
    console.error('Inventurverlauf laden:', error);
    return json(
      { fehler: 'Der Inventurverlauf konnte nicht geladen werden.' },
      { status: 500 }
    );
  }
};
