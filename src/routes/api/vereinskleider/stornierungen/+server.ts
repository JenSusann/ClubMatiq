import { json } from '@sveltejs/kit';
import { ObjectId, type Document } from 'mongodb';
import { client, db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Position = {
  artikelId: string;
  groesseId: string | null;
  artikelname?: string;
  verkaufsart: 'direkt' | 'bestellung';
  menge: number;
  einzelpreis: number;
  positionsbetrag: number;
  uebergebenMenge?: number;
  reserviertMenge?: number;
  storniertMenge?: number;
  preisOffen?: boolean;
  positionsIndex?: number;
};
type Verkauf = Document & {
  vereinId: string;
  positionen: Position[];
  status: string;
  endbetrag: number;
  zwischentotal: number;
  rabattTotal: number;
  mitgliedId?: string;
  erstbezugsIds?: string[];
  direktMenge?: number;
  bestellMenge?: number;
  bezahltBetrag?: number;
  zahlungen?: { betrag: number }[];
  rechnungId?: string;
  trancheRechnungIds?: string[];
  aktualisiertAm?: Date;
  rabatte?: { betrag: number }[];
  zusaetzlicherRabatt?: number;
  stornierungen?: { positionsIndex: number; menge: number; grund: string; storniertAm: Date; storniertVon?: string; storniertVonName?: string }[];
};
type Rechnung = Document & {
  vereinId: string;
  verkaufId: string;
  rechnungsnummer: string;
  gesamtbetrag: number;
  bezahltBetrag: number;
  gutgeschriebenBetrag?: number;
  status: 'offen' | 'teilweise_bezahlt' | 'bezahlt' | 'storniert';
  positionen: Position[];
  aktualisiertAm?: Date;
};
class Stornierungsfehler extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}
const idGueltig = (wert: unknown): wert is string => typeof wert === 'string' && /^[0-9a-f]{24}$/i.test(wert);
const rappen = (wert: number) => Math.round(wert * 100);
const gueltigeRappen = (wert: unknown): wert is number =>
  typeof wert === 'number' && Number.isFinite(wert) && wert >= 0 &&
  Number.isSafeInteger(Math.round(wert * 100)) &&
  Math.abs(wert * 100 - Math.round(wert * 100)) < 0.000001;

// Storniert ausschliesslich nicht übergebene Bestellmengen ohne Rabatte.
// Bei bereits ausgestellten Belegen wird eine separate Gutschrift erzeugt.
// Bereits bezahlte Beträge bleiben erhalten; Rückerstattungen werden vorgemerkt.
// Ein PDF für die Gutschrift und die Auszahlung sind separate Folgeschritte.
export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const roh: unknown = await request.json().catch(() => null);
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) {
    return json({ fehler: 'Ungültige Stornierungsdaten.' }, { status: 400 });
  }
  const eingabe = roh as Record<string, unknown>;
  if (!idGueltig(eingabe.verkaufId) || !Number.isSafeInteger(eingabe.positionsIndex) ||
      (eingabe.positionsIndex as number) < 0 || !Number.isSafeInteger(eingabe.menge) ||
      (eingabe.menge as number) < 1 || (eingabe.menge as number) > 10000 ||
      typeof eingabe.grund !== 'string' || !eingabe.grund.trim() || eingabe.grund.length > 1000) {
    return json({ fehler: 'Verkauf, Position, Menge oder Stornierungsgrund ungültig.' }, { status: 400 });
  }
  const verkaufId = new ObjectId(eingabe.verkaufId);
  const index = eingabe.positionsIndex as number;
  const menge = eingabe.menge as number;
  const grund = eingabe.grund.trim();
  const vereinId = locals.benutzer!.vereinId;
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const sammlung = db.collection<Verkauf>('vereinskleider_verkaeufe');
      const verkauf = await sammlung.findOne({ _id: verkaufId, vereinId }, { session });
      if (!verkauf) throw new Stornierungsfehler('Verkauf nicht gefunden.', 404);
      if (verkauf.status === 'storniert') throw new Stornierungsfehler('Der Verkauf ist bereits storniert.', 409);
      // Teilrechnungen: ausschliesslich eine eindeutig zuordenbare,
      // bereits abgerechnete Bestellposition darf gutgeschrieben werden.
      // Mehrere Teilrechnungen derselben Position werden bis zur expliziten
      // Aufteilungslogik gesperrt, um doppelte Gutschriften zu verhindern.
      if (Array.isArray(verkauf.trancheRechnungIds) && verkauf.trancheRechnungIds.length > 0) {
        if (!Array.isArray(verkauf.positionen)) throw new Stornierungsfehler('Verkaufspositionen fehlen.', 409);
        const p = verkauf.positionen[index];
        if (!p || p.verkaufsart !== 'bestellung' || p.preisOffen === true ||
            !Number.isSafeInteger(p.menge) || p.menge < menge ||
            !gueltigeRappen(p.einzelpreis) || !gueltigeRappen(p.positionsbetrag)) {
          throw new Stornierungsfehler('Position kann nicht sicher storniert werden.', 409);
        }
        const uebergeben = p.uebergebenMenge ?? 0;
        const reserviert = p.reserviertMenge ?? 0;
        if (!Number.isSafeInteger(uebergeben) || uebergeben < 0 || uebergeben > p.menge ||
            !Number.isSafeInteger(reserviert) || reserviert < 0 || reserviert > p.menge - uebergeben ||
            menge > p.menge - uebergeben) {
          throw new Stornierungsfehler('Nur noch nicht übergebene Mengen können storniert werden.', 409);
        }
        if ((verkauf.rabatte ?? []).length || (verkauf.zusaetzlicherRabatt ?? 0) !== 0 ||
            verkauf.rabattTotal !== 0 || verkauf.rechnungId) {
          throw new Stornierungsfehler('Rabatte oder weitere Belege verhindern die sichere Korrektur.', 409);
        }
        const rechnungen = db.collection<Rechnung>('vereinskleider_rechnungen');
        const belege = await rechnungen.find({
          vereinId, verkaufId: verkaufId.toString(), rechnungstranche: true
        }, { session }).toArray();
        const trancheIds = verkauf.trancheRechnungIds;
        if (belege.length !== trancheIds.length ||
            belege.some((r) => !trancheIds.includes(r._id.toString()))) {
          throw new Stornierungsfehler('Teilrechnungen sind inkonsistent.', 409);
        }
        const passende = belege.filter((r) => r.positionen?.some((bp: Position & { positionsIndex?: number }) =>
          bp.positionsIndex === index));
        if (passende.length !== 1) {
          throw new Stornierungsfehler('Position ist nicht eindeutig einer Teilrechnung zugeordnet.', 409);
        }
        const rechnung = passende[0];
        const belegPositionen = rechnung.positionen.filter((bp: Position & { positionsIndex?: number }) =>
          bp.positionsIndex === index);
        if (belegPositionen.length !== 1 || rechnung.status === 'storniert' ||
            !gueltigeRappen(rechnung.gesamtbetrag) || !gueltigeRappen(rechnung.bezahltBetrag) ||
            !gueltigeRappen(rechnung.gutgeschriebenBetrag ?? 0)) {
          throw new Stornierungsfehler('Teilrechnung kann nicht korrigiert werden.', 409);
        }
        const bp = belegPositionen[0];
        const bereitsStorniert = (verkauf.stornierungen ?? [])
          .filter((st) => st.positionsIndex === index)
          .reduce((sum, st) => sum + st.menge, 0);
        if (bp.artikelId !== p.artikelId || bp.groesseId !== p.groesseId ||
            rappen(bp.einzelpreis) !== rappen(p.einzelpreis) ||
            !Number.isSafeInteger(bp.menge) || bp.menge < menge + bereitsStorniert ||
            rappen(p.positionsbetrag) !== rappen(p.einzelpreis) * p.menge) {
          throw new Stornierungsfehler('Abgerechnete Menge oder Preis stimmt nicht überein.', 409);
        }
        const differenz = rappen(p.einzelpreis) * menge;
        const gesamt = rappen(rechnung.gesamtbetrag);
        const bezahlt = rappen(rechnung.bezahltBetrag);
        const gutgeschrieben = rappen(rechnung.gutgeschriebenBetrag ?? 0);
        if (bezahlt > gesamt || gutgeschrieben > gesamt ||
            differenz > gesamt - gutgeschrieben ||
            differenz > rappen(verkauf.endbetrag) ||
            differenz > rappen(verkauf.zwischentotal)) {
          throw new Stornierungsfehler('Gutschrift übersteigt den verfügbaren Betrag.', 409);
        }
        const jetzt = new Date();
        const netto = gesamt - gutgeschrieben - differenz;
        const rueckerstattungOffen = Math.max(0, bezahlt - netto) / 100;
        const status: Rechnung['status'] = netto === 0 ? 'storniert' :
          bezahlt >= netto ? 'bezahlt' : bezahlt > 0 ? 'teilweise_bezahlt' : 'offen';
        const belegUpdate = await rechnungen.updateOne({
          _id: rechnung._id, vereinId, status: rechnung.status,
          bezahltBetrag: rechnung.bezahltBetrag,
          gutgeschriebenBetrag: rechnung.gutgeschriebenBetrag === undefined
            ? { $exists: false } : rechnung.gutgeschriebenBetrag
        }, { $set: {
          gutgeschriebenBetrag: (gutgeschrieben + differenz) / 100,
          rueckerstattungOffen, status, aktualisiertAm: jetzt
        } }, { session });
        if (belegUpdate.modifiedCount !== 1) throw new Stornierungsfehler('Teilrechnung wurde geändert.', 409);
        const freigegeben = Math.min(menge, reserviert);
        const positionen = verkauf.positionen.map((alt, i) => i === index ? {
          ...alt, menge: alt.menge - menge,
          positionsbetrag: (rappen(alt.positionsbetrag) - differenz) / 100,
          reserviertMenge: reserviert - freigegeben,
          storniertMenge: (alt.storniertMenge ?? 0) + menge
        } : alt);
        const aktive = positionen.filter((pos) => pos.menge > 0);
        const offen = aktive.some((pos) => pos.verkaufsart === 'bestellung' &&
          pos.menge > (pos.uebergebenMenge ?? 0));
        const neuerStatus = !aktive.length ? 'storniert' : offen ? 'offen' : 'abgeschlossen';
        const update = await sammlung.updateOne({
          _id: verkaufId, vereinId, aktualisiertAm: verkauf.aktualisiertAm
        }, { $set: {
          positionen, zwischentotal: (rappen(verkauf.zwischentotal) - differenz) / 100,
          endbetrag: (rappen(verkauf.endbetrag) - differenz) / 100,
          bestellMenge: positionen.filter((pos) => pos.verkaufsart === 'bestellung')
            .reduce((sum, pos) => sum + pos.menge, 0),
          status: neuerStatus, aktualisiertAm: jetzt,
          stornierungen: [...(verkauf.stornierungen ?? []), {
            positionsIndex: index, menge, grund, storniertAm: jetzt,
            storniertVon: locals.benutzer!.id,
            storniertVonName: [locals.benutzer!.vorname, locals.benutzer!.nachname]
              .filter(Boolean).join(' ').trim() || undefined
          }]
        } }, { session });
        if (update.modifiedCount !== 1) throw new Stornierungsfehler('Verkauf wurde geändert.', 409);
        const gutschrift = new ObjectId();
        await db.collection('vereinskleider_gutschriften').insertOne({
          _id: gutschrift, vereinId, verkaufId: verkaufId.toString(),
          rechnungId: rechnung._id.toString(), rechnungsnummer: rechnung.rechnungsnummer,
          gutschriftnummer: `GS-${gutschrift.toString().slice(-12).toUpperCase()}`,
          positionsIndex: index, artikelId: p.artikelId, groesseId: p.groesseId,
          artikelname: p.artikelname ?? '', menge, einzelpreis: p.einzelpreis,
          betrag: differenz / 100, grund, erstelltAm: jetzt, status: 'erstellt',
          pdfStatus: 'ausstehend', clubdeskExportStatus: 'nicht_exportiert'
        }, { session });
        return {
          verkaufId: eingabe.verkaufId, positionsIndex: index, storniert: menge,
          freigegebeneReserve: freigegeben, gutschriftId: gutschrift.toString(),
          gutschriftBetrag: differenz / 100, rueckerstattungOffen, status: neuerStatus
        };
      }
      // Vollständiger Erstbezug mit genau einer nicht übergebenen Bestellposition:
      // Rabatt und Anspruch werden gemeinsam mit der Bestellung aufgehoben.
      if (verkauf.erstbezugsIds?.length &&
          (verkauf.rechnungId || !Array.isArray(verkauf.erstbezugsPositionen)) &&
          (verkauf.rechnungId || ((verkauf.bezahltBetrag ?? 0) === 0 && !(verkauf.zahlungen ?? []).some(z => z.betrag > 0))) &&
          verkauf.positionen?.length === 1 && index === 0) {
        const p = verkauf.positionen[0];
        if (p.verkaufsart === 'bestellung' && (p.uebergebenMenge ?? 0) === 0 &&
            p.menge === menge && idGueltig(verkauf.mitgliedId) &&
            verkauf.erstbezugsIds.every(id => idGueltig(id) || /^gruppe:[a-z0-9][a-z0-9_-]{0,79}$/.test(id))) {
          const jetzt = new Date();
          let gutschriftId: string | null = null;
          let gutschriftBetrag = 0;
          let rueckerstattungOffen = 0;
          if (verkauf.rechnungId) {
            if (!idGueltig(verkauf.rechnungId) || !gueltigeRappen(verkauf.endbetrag) || verkauf.endbetrag <= 0 || p.preisOffen) {
              throw new Stornierungsfehler('Erstbezugsrechnung kann nicht sicher korrigiert werden.', 409);
            }
            const rechnungen = db.collection<Rechnung>('vereinskleider_rechnungen');
            const rechnung = await rechnungen.findOne({ _id: new ObjectId(verkauf.rechnungId), vereinId, verkaufId: verkaufId.toString() }, { session });
            const bp = rechnung?.positionen?.[0];
            if (!rechnung || rechnung.status === 'storniert' || rechnung.positionen?.length !== 1 ||
                !bp || bp.artikelId !== p.artikelId || bp.groesseId !== p.groesseId || bp.menge !== p.menge ||
                !gueltigeRappen(rechnung.gesamtbetrag) || !gueltigeRappen(rechnung.bezahltBetrag) ||
                rappen(rechnung.gesamtbetrag) !== rappen(verkauf.endbetrag) ||
                rechnung.bezahltBetrag > rechnung.gesamtbetrag || (rechnung.gutgeschriebenBetrag ?? 0) !== 0) {
              throw new Stornierungsfehler('Erstbezugsrechnung stimmt nicht eindeutig mit dem Verkauf überein.', 409);
            }
            gutschriftBetrag = rechnung.gesamtbetrag;
            rueckerstattungOffen = rechnung.bezahltBetrag;
            const korrigiert = await rechnungen.updateOne({
              _id: rechnung._id, vereinId, status: rechnung.status, bezahltBetrag: rechnung.bezahltBetrag,
              gutgeschriebenBetrag: rechnung.gutgeschriebenBetrag === undefined ? { $exists: false } : 0
            }, { $set: { gutgeschriebenBetrag: gutschriftBetrag, rueckerstattungOffen, status: 'storniert', aktualisiertAm: jetzt } }, { session });
            if (korrigiert.modifiedCount !== 1) throw new Stornierungsfehler('Rechnung wurde zwischenzeitlich geändert.', 409);
            const gs = new ObjectId();
            gutschriftId = gs.toString();
            await db.collection('vereinskleider_gutschriften').insertOne({
              _id: gs, vereinId, verkaufId: verkaufId.toString(), rechnungId: rechnung._id.toString(),
              rechnungsnummer: rechnung.rechnungsnummer, gutschriftnummer: `GS-${gs.toString().slice(-12).toUpperCase()}`,
              positionsIndex: index, artikelId: p.artikelId, groesseId: p.groesseId, artikelname: p.artikelname ?? '',
              menge, einzelpreis: gutschriftBetrag / menge, betrag: gutschriftBetrag, grund, erstelltAm: jetzt,
              status: 'erstellt', pdfStatus: 'ausstehend', clubdeskExportStatus: 'nicht_exportiert'
            }, { session });
          }
          const update = await sammlung.updateOne(
            { _id: verkaufId, vereinId, aktualisiertAm: verkauf.aktualisiertAm },
            { $set: {
              positionen: [{ ...p, menge: 0, positionsbetrag: 0, reserviertMenge: 0,
                storniertMenge: (p.storniertMenge ?? 0) + menge }],
              zwischentotal: 0, rabattTotal: 0, endbetrag: 0, bestellMenge: 0,
              status: 'storniert', aktualisiertAm: jetzt,
              erstbezugsFreigegebenAm: jetzt,
              stornierungen: [...(verkauf.stornierungen ?? []), {
                positionsIndex: index, menge, grund, storniertAm: jetzt,
                storniertVon: locals.benutzer!.id,
                storniertVonName: [locals.benutzer!.vorname, locals.benutzer!.nachname].filter(Boolean).join(' ').trim() || undefined
              }]
            } }, { session });
          if (update.modifiedCount !== 1) throw new Stornierungsfehler('Verkauf wurde zwischenzeitlich geändert.', 409);
          const freigabe = await db.collection<{ erstbezugsRabattIds?: string[]; vereinId: string }>('clubdesk_mitglieder').updateOne(
            { _id: new ObjectId(verkauf.mitgliedId), vereinId, erstbezugsRabattIds: { $all: verkauf.erstbezugsIds } },
            { $pullAll: { erstbezugsRabattIds: verkauf.erstbezugsIds } }, { session });
          if (freigabe.modifiedCount !== 1) throw new Stornierungsfehler('Erstbezugsanspruch konnte nicht freigegeben werden.', 409);
          return { verkaufId: eingabe.verkaufId, positionsIndex: index, storniert: menge,
            freigegebeneReserve: p.reserviertMenge ?? 0, gutschriftId, gutschriftBetrag,
            rueckerstattungOffen, status: 'storniert' };
        }
      }
      // Positionsbezogene Erstbezüge ohne Rechnung: reguläre Stücke zuerst stornieren.
      const zuordnungen = verkauf.erstbezugsPositionen as { anspruch: string; rabattId: string; positionsIndex: number; rabattBetrag: number }[] | undefined;
      if (verkauf.erstbezugsIds?.length && Array.isArray(zuordnungen) && !verkauf.rechnungId &&
          (verkauf.bezahltBetrag ?? 0) === 0 && !(verkauf.zahlungen ?? []).some(z => z.betrag > 0)) {
        const p = verkauf.positionen[index];
        const rabatte = verkauf.rabatte as { rabattId: string; betrag: number; einmaligProMitglied?: boolean }[] | undefined;
        if (!p || p.verkaufsart !== 'bestellung' || p.preisOffen || !idGueltig(verkauf.mitgliedId) ||
            !Number.isSafeInteger(p.menge) || !Number.isSafeInteger(p.uebergebenMenge ?? 0) ||
            (p.uebergebenMenge ?? 0) < 0 || menge > p.menge - (p.uebergebenMenge ?? 0) ||
            !Number.isSafeInteger(p.reserviertMenge ?? 0) || (p.reserviertMenge ?? 0) < 0 ||
            (p.reserviertMenge ?? 0) > p.menge - (p.uebergebenMenge ?? 0) ||
            !gueltigeRappen(p.einzelpreis) || rappen(p.positionsbetrag) !== rappen(p.einzelpreis) * p.menge ||
            (verkauf.zusaetzlicherRabatt ?? 0) !== 0 || !rabatte ||
            rabatte.length !== zuordnungen.length || rabatte.some(r => !r.einmaligProMitglied) ||
            zuordnungen.length !== verkauf.erstbezugsIds.length ||
            new Set(zuordnungen.map(z => z.anspruch)).size !== zuordnungen.length ||
            zuordnungen.some(z => !verkauf.erstbezugsIds!.includes(z.anspruch) ||
              !Number.isSafeInteger(z.positionsIndex) || !verkauf.positionen[z.positionsIndex]?.menge ||
              !gueltigeRappen(z.rabattBetrag) ||
              !rabatte.some(r => r.rabattId === z.rabattId && r.betrag === z.rabattBetrag)) ||
            zuordnungen.reduce((s,z) => s + rappen(z.rabattBetrag),0) !== rappen(verkauf.rabattTotal)) {
          throw new Stornierungsfehler('Erstbezugszuordnung oder Bestellmenge ist nicht eindeutig.', 409);
        }
        const freigaben = menge === p.menge ? zuordnungen.filter(z => z.positionsIndex === index) : [];
        const rabattKorrektur = freigaben.reduce((s,z) => s + rappen(z.rabattBetrag),0);
        const brutto = rappen(p.einzelpreis) * menge;
        const netto = brutto - rabattKorrektur;
        if (netto < 0 || netto > rappen(verkauf.endbetrag) || brutto > rappen(verkauf.zwischentotal)) {
          throw new Stornierungsfehler('Stornierungsbetrag ist inkonsistent.', 409);
        }
        const jetzt = new Date();
        const reserve = Math.min(menge,p.reserviertMenge ?? 0);
        const positionen = verkauf.positionen.map((alt,i) => i === index ? { ...alt, menge: alt.menge-menge,
          positionsbetrag: (rappen(alt.positionsbetrag)-brutto)/100, reserviertMenge: (alt.reserviertMenge ?? 0)-reserve,
          storniertMenge: (alt.storniertMenge ?? 0)+menge } : alt);
        const ids = freigaben.map(z => z.anspruch);
        const endbetrag = (rappen(verkauf.endbetrag)-netto)/100;
        const status = positionen.every(p => p.menge === 0) ? 'storniert' :
          positionen.some(p => p.verkaufsart === 'bestellung' && p.menge > (p.uebergebenMenge ?? 0)) ? 'offen' : 'abgeschlossen';
        const update = await sammlung.updateOne({ _id: verkaufId, vereinId, aktualisiertAm: verkauf.aktualisiertAm }, { $set: {
          positionen, status, endbetrag, restbetragBekannt: endbetrag, zahlungsstatus: endbetrag === 0 ? 'bezahlt' : 'offen',
          zwischentotal: (rappen(verkauf.zwischentotal)-brutto)/100, rabattTotal: (rappen(verkauf.rabattTotal)-rabattKorrektur)/100,
          erstbezugsIds: verkauf.erstbezugsIds.filter(id => !ids.includes(id)),
          erstbezugsPositionen: zuordnungen.filter(z => !ids.includes(z.anspruch)),
          rabatte: rabatte.filter(r => !freigaben.some(z => z.rabattId === r.rabattId)),
          bestellMenge: positionen.filter(p => p.verkaufsart === 'bestellung').reduce((s,p) => s+p.menge,0),
          aktualisiertAm: jetzt, stornierungen: [...(verkauf.stornierungen ?? []), { positionsIndex: index, menge, grund,
            storniertAm: jetzt, storniertVon: locals.benutzer!.id, storniertVonName: [locals.benutzer!.vorname, locals.benutzer!.nachname].filter(Boolean).join(' ').trim() || undefined,
            erstbezugsFreigaben: freigaben, rabattKorrektur: rabattKorrektur/100 }]
        } }, { session });
        if (update.modifiedCount !== 1) throw new Stornierungsfehler('Verkauf wurde zwischenzeitlich geändert.',409);
        if (ids.length) {
          const freigabe = await db.collection<{ vereinId: string; erstbezugsRabattIds?: string[] }>('clubdesk_mitglieder').updateOne(
            { _id: new ObjectId(verkauf.mitgliedId), vereinId, erstbezugsRabattIds: { $all: ids } },
            { $pullAll: { erstbezugsRabattIds: ids } }, { session });
          if (freigabe.modifiedCount !== 1) throw new Stornierungsfehler('Erstbezugsanspruch konnte nicht freigegeben werden.',409);
        }
        return { verkaufId: eingabe.verkaufId, positionsIndex: index, storniert: menge, freigegebeneReserve: reserve,
          gutschriftId: null, gutschriftBetrag: 0, rueckerstattungOffen: 0, status };
      }
      // Ohne Beleg bleibt der bisherige Schutz für bereits bezahlte Verkäufe bestehen.
      if (!verkauf.rechnungId && ((verkauf.bezahltBetrag ?? 0) > 0 ||
          (verkauf.zahlungen ?? []).some((z) => z.betrag > 0))) {
        throw new Stornierungsfehler('Für bezahlte Verkäufe ohne Beleg ist zuerst eine Belegkorrektur erforderlich.', 409);
      }
      if ((verkauf.rabatte ?? []).some((r) => r.betrag > 0) || (verkauf.zusaetzlicherRabatt ?? 0) > 0 || verkauf.rabattTotal !== 0) {
        throw new Stornierungsfehler('Für Verkäufe mit Rabatten muss zuerst die anteilige Rabattkorrektur umgesetzt werden.', 409);
      }
      if (!Array.isArray(verkauf.positionen)) throw new Stornierungsfehler('Verkaufspositionen fehlen.', 409);
      const position = verkauf.positionen[index];
      if (!position || position.verkaufsart !== 'bestellung') {
        throw new Stornierungsfehler('Aktuell können nur noch nicht übergebene Bestellartikel storniert werden.', 409);
      }
      const uebergeben = position.uebergebenMenge ?? 0;
      const reserviert = position.reserviertMenge ?? 0;
      if (!Number.isSafeInteger(position.menge) || position.menge < 1 ||
          !Number.isSafeInteger(uebergeben) || uebergeben < 0 || uebergeben > position.menge ||
          !Number.isSafeInteger(reserviert) || reserviert < 0 || reserviert > position.menge - uebergeben ||
          !Number.isFinite(position.einzelpreis) || !Number.isFinite(position.positionsbetrag)) {
        throw new Stornierungsfehler('Bestellmengen oder Preise sind inkonsistent.', 409);
      }
      const offen = position.menge - uebergeben;
      if (menge > offen) throw new Stornierungsfehler(`Nur ${offen} nicht übergebene Stück können storniert werden.`, 409);
      // Die reservierte Menge wird zuerst freigegeben. Der physische Bestand
      // bleibt unverändert, da die Ware noch nicht übergeben wurde.
      const freigegebeneReserve = Math.min(menge, reserviert);
      const neuerPositionsbetrag = rappen(position.einzelpreis) * (position.menge - menge);
      const alterPositionsbetrag = rappen(position.positionsbetrag);
      const differenz = alterPositionsbetrag - neuerPositionsbetrag;
      if (differenz < 0 || !Number.isSafeInteger(differenz) ||
          rappen(verkauf.endbetrag) < differenz || rappen(verkauf.zwischentotal) < differenz) {
        throw new Stornierungsfehler('Der Verkaufsbetrag ist inkonsistent.', 409);
      }
      const rechnungen = db.collection<Rechnung>('vereinskleider_rechnungen');
      let rechnung: Rechnung | null = null;
      let gutgeschriebenVorher = 0;
      let bezahlt = 0;
      let gesamt = 0;
      if (verkauf.rechnungId) {
        if (!idGueltig(verkauf.rechnungId)) throw new Stornierungsfehler('Ungültige Belegreferenz.', 409);
        rechnung = await rechnungen.findOne({
          _id: new ObjectId(verkauf.rechnungId), vereinId, verkaufId: verkaufId.toString()
        }, { session });
        if (!rechnung || rechnung.status === 'storniert') {
          throw new Stornierungsfehler('Rechnung fehlt oder ist bereits storniert.', 409);
        }
        if (!gueltigeRappen(rechnung.gesamtbetrag) || !gueltigeRappen(rechnung.bezahltBetrag) ||
            !gueltigeRappen(rechnung.gutgeschriebenBetrag ?? 0)) {
          throw new Stornierungsfehler('Die Rechnungsbeträge sind ungültig.', 409);
        }
        gesamt = rappen(rechnung.gesamtbetrag);
        bezahlt = rappen(rechnung.bezahltBetrag);
        gutgeschriebenVorher = rappen(rechnung.gutgeschriebenBetrag ?? 0);
        if (bezahlt > gesamt || gutgeschriebenVorher > gesamt ||
            differenz > gesamt - gutgeschriebenVorher) {
          throw new Stornierungsfehler('Gutschrift übersteigt den verbleibenden Rechnungsbetrag.', 409);
        }
        const belegPosition = rechnung.positionen?.[index];
        if (!belegPosition || belegPosition.artikelId !== position.artikelId ||
            belegPosition.groesseId !== position.groesseId ||
            belegPosition.verkaufsart !== position.verkaufsart ||
            rappen(belegPosition.einzelpreis) !== rappen(position.einzelpreis)) {
          throw new Stornierungsfehler('Rechnungsposition und Bestellposition stimmen nicht überein.', 409);
        }
      }
      const jetzt = new Date();
      let gutschriftId: string | null = null;
      let rueckerstattungOffen = 0;
      if (rechnung) {
        const gutgeschriebenNeu = gutgeschriebenVorher + differenz;
        const netto = gesamt - gutgeschriebenNeu;
        rueckerstattungOffen = Math.max(0, bezahlt - netto) / 100;
        const neuerRechnungsstatus: Rechnung['status'] = netto === 0
          ? 'storniert' : bezahlt >= netto ? 'bezahlt' : bezahlt > 0 ? 'teilweise_bezahlt' : 'offen';
        const aktualisierteRechnung = await rechnungen.updateOne(
          { _id: rechnung._id, vereinId, status: rechnung.status,
            gutgeschriebenBetrag: rechnung.gutgeschriebenBetrag === undefined
              ? { $exists: false } : rechnung.gutgeschriebenBetrag,
            bezahltBetrag: rechnung.bezahltBetrag },
          { $set: { gutgeschriebenBetrag: gutgeschriebenNeu / 100,
            rueckerstattungOffen, status: neuerRechnungsstatus, aktualisiertAm: jetzt } },
          { session }
        );
        if (aktualisierteRechnung.modifiedCount !== 1) {
          throw new Stornierungsfehler('Die Rechnung wurde zwischenzeitlich geändert. Bitte neu laden.', 409);
        }
        const gutschrift = new ObjectId();
        gutschriftId = gutschrift.toString();
        await db.collection('vereinskleider_gutschriften').insertOne({
          _id: gutschrift, vereinId, verkaufId: verkaufId.toString(),
          rechnungId: rechnung._id.toString(), rechnungsnummer: rechnung.rechnungsnummer,
          gutschriftnummer: `GS-${gutschrift.toString().slice(-12).toUpperCase()}`,
          positionsIndex: index, artikelId: position.artikelId,
          groesseId: position.groesseId, artikelname: position.artikelname ?? '',
          menge, einzelpreis: position.einzelpreis, betrag: differenz / 100,
          grund, erstelltAm: jetzt, status: 'erstellt',
          pdfStatus: 'ausstehend', clubdeskExportStatus: 'nicht_exportiert'
        }, { session });
      }
      const neuePositionen = verkauf.positionen.map((p, i) => i === index ? {
        ...p,
        menge: p.menge - menge,
        positionsbetrag: neuerPositionsbetrag / 100,
        reserviertMenge: reserviert - freigegebeneReserve,
        storniertMenge: (p.storniertMenge ?? 0) + menge
      } : p);
      const aktivePositionen = neuePositionen.filter((p) => p.menge > 0);
      const nochOffen = aktivePositionen.some((p) => p.verkaufsart === 'bestellung' &&
        p.menge > (p.uebergebenMenge ?? 0));
      const allesStorniert = aktivePositionen.length === 0;
      const aktualisiert = await sammlung.updateOne(
        { _id: verkaufId, vereinId, aktualisiertAm: verkauf.aktualisiertAm },
        { $set: {
          positionen: neuePositionen,
          zwischentotal: (rappen(verkauf.zwischentotal) - differenz) / 100,
          endbetrag: (rappen(verkauf.endbetrag) - differenz) / 100,
          bestellMenge: neuePositionen.filter((p) => p.verkaufsart === 'bestellung').reduce((s, p) => s + p.menge, 0),
          status: allesStorniert ? 'storniert' : nochOffen ? 'offen' : 'abgeschlossen',
          aktualisiertAm: jetzt,
          stornierungen: [
            ...(verkauf.stornierungen ?? []),
            { positionsIndex: index, menge, grund, storniertAm: jetzt, storniertVon: locals.benutzer!.id, storniertVonName: [locals.benutzer!.vorname, locals.benutzer!.nachname].filter(Boolean).join(' ').trim() || undefined }
          ]
        } },
        { session }
      );
      if (aktualisiert.modifiedCount !== 1) throw new Stornierungsfehler('Verkauf wurde zwischenzeitlich geändert. Bitte neu laden.', 409);
      return { verkaufId: eingabe.verkaufId, positionsIndex: index, storniert: menge,
        freigegebeneReserve, gutschriftId, gutschriftBetrag: gutschriftId ? differenz / 100 : 0,
        rueckerstattungOffen, status: allesStorniert ? 'storniert' : nochOffen ? 'offen' : 'abgeschlossen' };
    });
    return json({ erfolg: true, stornierung: ergebnis });
  } catch (fehler) {
    if (fehler instanceof Stornierungsfehler) return json({ fehler: fehler.message }, { status: fehler.statusCode });
    console.error('Stornierung Vereinskleider:', fehler);
    return json({ fehler: 'Stornierung konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};


// Gutschriften für die Verrechnungsübersicht laden.
export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  try {
    const vereinId = locals.benutzer!.vereinId;
    const gutschriften = await db.collection('vereinskleider_gutschriften')
      .find({ vereinId })
      .sort({ erstelltAm: -1 })
      .limit(1000)
      .project({ rechnungId: 1, gutschriftnummer: 1, artikelname: 1, menge: 1, betrag: 1, grund: 1, erstelltAm: 1, bearbeitungsstatus: 1, rueckerstattetBetrag: 1, rueckerstattungen: 1, clubdeskVerbuchung: 1 })
      .toArray();
    return json({
      gutschriften: gutschriften.map((g) => ({ ...g, _id: g._id.toString() })),
      begrenzt: gutschriften.length === 1000
    });
  } catch (fehler) {
    console.error('Gutschriften laden:', fehler);
    return json({ fehler: 'Gutschriften konnten nicht geladen werden.' }, { status: 500 });
  }
};
