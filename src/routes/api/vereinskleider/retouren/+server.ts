import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { protokolliereLagerbewegung } from '../../../../lib/server/lagerbewegungen';
import { pruefeRetourenmenge } from '../../../../lib/server/vereinskleider-retouren';
import type { RequestHandler } from './$types';

/** Retourenübersicht. Finanzielle Freigabe erfolgt erst im transaktionalen POST. */
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
      const protokolliert = (Array.isArray(verkauf.uebergaben) ? verkauf.uebergaben : [])
        .filter((u: { positionsIndex?: number }) => u.positionsIndex === i)
        .reduce((summe: number, u: { menge?: number }) => summe + (u.menge ?? 0), 0);
      const uebergeben = p.verkaufsart === 'direkt' && protokolliert === 0 ? p.menge ?? 0 : protokolliert;
      const retourniert = (Array.isArray(verkauf.retouren) ? verkauf.retouren : [])
        .filter((r: { positionsIndex?: number }) => r.positionsIndex === i)
        .reduce((summe: number, r: { menge?: number }) => summe + (r.menge ?? 0), 0);
      const maximal = Math.max(0, uebergeben - retourniert);
      // Die Übersicht garantiert keine Finanzfreigabe; diese wird beim POST erneut geprüft.
      const freigegeben = false;
      let hinweis = '';
      if (maximal > 0) {
        try {
          pruefeRetourenmenge({
            positionen: Array.isArray(verkauf.positionen) ? verkauf.positionen : [],
            uebergaben: Array.isArray(verkauf.uebergaben) ? verkauf.uebergaben : [],
            retouren: Array.isArray(verkauf.retouren) ? verkauf.retouren : [],
            rabattTotal: verkauf.rabattTotal,
            rabatte: Array.isArray(verkauf.rabatte) ? verkauf.rabatte : [],
            zusaetzlicherRabatt: verkauf.zusaetzlicherRabatt
          }, i, 1);
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

class Retourenfehler extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
const idGueltig = (wert: unknown): wert is string =>
  typeof wert === 'string' && /^[a-f0-9]{24}$/i.test(wert);
const rappen = (wert: number): number => Math.round(wert * 100);

/** Retoure mit Bestandskorrektur und Gutschrift in einer Transaktion. */
export const POST: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const eingabe = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!eingabe || Array.isArray(eingabe) || !idGueltig(eingabe.verkaufId) ||
      !Number.isSafeInteger(eingabe.positionsIndex) || (eingabe.positionsIndex as number) < 0 ||
      !Number.isSafeInteger(eingabe.menge) || (eingabe.menge as number) < 1 ||
      (eingabe.menge as number) > 10000 ||
      !['falsche_groesse', 'gefaellt_nicht', 'defekt', 'sonstiges'].includes(String(eingabe.grund)) ||
      typeof eingabe.wiederverkaufbar !== 'boolean' ||
      typeof eingabe.bemerkung !== 'string' || eingabe.bemerkung.length > 1000 ||
      typeof eingabe.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(eingabe.datum)) {
    return json({ fehler: 'Ungültige Retourendaten.' }, { status: 400 });
  }
  const datum = new Date(eingabe.datum + 'T12:00:00Z');
  if (Number.isNaN(datum.getTime()) || datum.toISOString().slice(0, 10) !== eingabe.datum) {
    return json({ fehler: 'Ungültiges Retourendatum.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const grund = eingabe.grund as string;
  const wiederverkaufbar = eingabe.wiederverkaufbar as boolean;
  const bemerkung = (eingabe.bemerkung as string).trim();
  const verkaufId = new ObjectId(eingabe.verkaufId as string);
  const index = eingabe.positionsIndex as number;
  const menge = eingabe.menge as number;
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const verkaeufe = db.collection('vereinskleider_verkaeufe');
      const rechnungen = db.collection('vereinskleider_rechnungen');
      const verkauf = await verkaeufe.findOne({ _id: verkaufId, vereinId }, { session });
      if (!verkauf) throw new Retourenfehler('Verkauf nicht gefunden.', 404);
      let einzelpreisRappen: number;
      try {
        ({ einzelpreisRappen } = pruefeRetourenmenge({
          positionen: verkauf.positionen, uebergaben: verkauf.uebergaben,
          retouren: verkauf.retouren, rabatte: verkauf.rabatte,
          rabattTotal: verkauf.rabattTotal,
          zusaetzlicherRabatt: verkauf.zusaetzlicherRabatt
        }, index, menge));
      } catch (e) {
        throw new Retourenfehler(e instanceof Error ? e.message : 'Retourenmenge ungültig.');
      }
      const p = verkauf.positionen[index];
      if (!idGueltig(p.artikelId) || (p.groesseId !== null && !idGueltig(p.groesseId))) {
        throw new Retourenfehler('Artikel- oder Grössen-ID ungültig.');
      }
      const betrag = einzelpreisRappen * menge;
      if (betrag <= 0 || !Number.isSafeInteger(betrag)) {
        throw new Retourenfehler('Retourenbetrag muss positiv und eindeutig sein.');
      }
      // Bei mehreren Teilrechnungen muss die betroffene Position eindeutig
      // genau einer Tranche zugeordnet sein.
      const belege = await rechnungen.find({
        vereinId, verkaufId: verkaufId.toString()
      }, { session }).toArray();
      const trancheIds = Array.isArray(verkauf.trancheRechnungIds) ? verkauf.trancheRechnungIds : [];
      if (trancheIds.length > 0 && (belege.length !== trancheIds.length ||
          belege.some((b) => !trancheIds.includes(b._id.toString())) ||
          verkauf.rechnungId)) {
        throw new Retourenfehler('Teilrechnungen sind nicht vollständig oder nicht eindeutig zugeordnet.');
      }
      if (belege.length === 0) {
        throw new Retourenfehler('Keine Rechnung vorhanden. Beleglose Retouren benötigen eine separate Finanzkorrektur.');
      }
      const passende = belege.flatMap((beleg) => (Array.isArray(beleg.positionen) ? beleg.positionen : [])
        .filter((bp: { positionsIndex?: number; artikelId?: string; groesseId?: string | null }) =>
          trancheIds.length > 0 ? bp.positionsIndex === index :
          bp.positionsIndex === index ||
          (bp.artikelId === p.artikelId && bp.groesseId === p.groesseId))
        .map((bp: { menge?: number; einzelpreis?: number }) => ({ beleg, bp })));
      if (passende.length !== 1) {
        throw new Retourenfehler('Rechnungsposition ist nicht eindeutig zugeordnet.');
      }
      const { beleg: rechnung, bp } = passende[0];
      const bisherRetourniert = (Array.isArray(verkauf.retouren) ? verkauf.retouren : [])
        .filter((r: { positionsIndex?: number; rechnungId?: string }) =>
          r.positionsIndex === index && (!r.rechnungId || r.rechnungId === rechnung._id.toString()))
        .reduce((summe: number, r: { menge?: number }) => summe + (r.menge ?? 0), 0);
      if (!Number.isSafeInteger(bp.menge) || bp.menge < menge + bisherRetourniert ||
          rappen(bp.einzelpreis) !== einzelpreisRappen) {
        throw new Retourenfehler('Rechnungsmenge oder Preis stimmt nicht mit der Retoure überein.');
      }
      const gesamt = rappen(rechnung.gesamtbetrag);
      const bezahlt = rappen(rechnung.bezahltBetrag ?? 0);
      const gutgeschrieben = rappen(rechnung.gutgeschriebenBetrag ?? 0);
      const gutschriften = db.collection('vereinskleider_gutschriften');
      const bestehendeGutschriften = await gutschriften.find({
        vereinId, rechnungId: rechnung._id.toString()
      }, { session }).toArray();
      const belegGutschriften = bestehendeGutschriften.reduce(
        (summe, g) => summe + rappen(g.betrag), 0);
      const bereitsAusbezahlt = bestehendeGutschriften.reduce(
        (summe, g) => summe + rappen(g.rueckerstattetBetrag ?? 0), 0);
      if (![gesamt, bezahlt, gutgeschrieben, belegGutschriften, bereitsAusbezahlt]
          .every(Number.isSafeInteger) ||
          gesamt < 0 || bezahlt < 0 || bezahlt > gesamt ||
          gutgeschrieben < 0 || gutgeschrieben !== belegGutschriften ||
          bereitsAusbezahlt < 0 || bereitsAusbezahlt > bezahlt ||
          gutgeschrieben + betrag > gesamt ||
          rappen(rechnung.rueckerstattungOffen ?? 0) !==
            Math.max(0, bezahlt - (gesamt - gutgeschrieben) - bereitsAusbezahlt)) {
        throw new Retourenfehler('Rechnung, Gutschriften und Rückerstattungen sind nicht konsistent.');
      }
      const jetzt = new Date();
      const netto = gesamt - gutgeschrieben - betrag;
      const status = netto === 0 ? 'storniert' : bezahlt >= netto
        ? 'bezahlt' : bezahlt > 0 ? 'teilweise_bezahlt' : 'offen';
      const rechnungUpdate = await rechnungen.updateOne({
        _id: rechnung._id, vereinId,
        bezahltBetrag: rechnung.bezahltBetrag,
        gutgeschriebenBetrag: rechnung.gutgeschriebenBetrag === undefined
          ? { $exists: false } : rechnung.gutgeschriebenBetrag
      }, { $set: {
        gutgeschriebenBetrag: (gutgeschrieben + betrag) / 100,
        rueckerstattungOffen: Math.max(0, bezahlt - netto - bereitsAusbezahlt) / 100,
        status, aktualisiertAm: jetzt
      } }, { session });
      if (rechnungUpdate.modifiedCount !== 1) throw new Retourenfehler('Rechnung wurde geändert.');
      if (wiederverkaufbar) {
        const artikelUpdate = await db.collection('artikel').updateOne({
          _id: new ObjectId(p.artikelId), vereinId
        }, { $inc: { menge }, $set: { aktualisiertAm: jetzt } }, { session });
        if (artikelUpdate.modifiedCount !== 1) throw new Retourenfehler('Artikelbestand konnte nicht erhöht werden.');
        if (p.groesseId !== null) {
          const varianteUpdate = await db.collection('artikelvarianten').updateOne({
            artikelId: p.artikelId, groesseId: p.groesseId, vereinId, aktiv: { $ne: false }
          }, { $inc: { menge } }, { session });
          if (varianteUpdate.modifiedCount !== 1) throw new Retourenfehler('Grössenbestand konnte nicht erhöht werden.');
        }
      }
      const retourId = new ObjectId();
      const retoure = {
        _id: retourId.toString(), positionsIndex: index, artikelId: p.artikelId,
        groesseId: p.groesseId, menge, betrag: betrag / 100,
        grund, wiederverkaufbar,
        bemerkung, datum, erfasstAm: jetzt,
        erfasstVon: locals.benutzer!.id,
        rechnungId: rechnung._id.toString()
      };
      const verkaufUpdate = await verkaeufe.updateOne({
        _id: verkaufId, vereinId,
        aktualisiertAm: verkauf.aktualisiertAm === undefined
          ? { $exists: false } : verkauf.aktualisiertAm
      }, { $set: {
        retouren: [...(Array.isArray(verkauf.retouren) ? verkauf.retouren : []), retoure],
        aktualisiertAm: jetzt
      } }, { session });
      if (verkaufUpdate.modifiedCount !== 1) throw new Retourenfehler('Verkauf wurde zwischenzeitlich geändert.');
      const gutschriftId = new ObjectId();
      await db.collection('vereinskleider_gutschriften').insertOne({
        _id: gutschriftId, vereinId, verkaufId: verkaufId.toString(),
        rechnungId: rechnung._id.toString(), rechnungsnummer: rechnung.rechnungsnummer,
        gutschriftnummer: `GS-${gutschriftId.toString().slice(-12).toUpperCase()}`,
        positionsIndex: index, artikelId: p.artikelId, groesseId: p.groesseId,
        artikelname: p.artikelname ?? '', menge, einzelpreis: p.einzelpreis,
        betrag: betrag / 100, grund: `Retoure: ${grund}`,
        retourId: retourId.toString(), erstelltAm: jetzt, status: 'erstellt',
        pdfStatus: 'ausstehend', clubdeskExportStatus: 'nicht_exportiert'
      }, { session });
      if (eingabe.wiederverkaufbar) {
        await protokolliereLagerbewegung({
          vereinId, artikelId: p.artikelId, groesseId: p.groesseId,
          art: 'rueckgabe', mengeDelta: menge, benutzerId: locals.benutzer!.id,
          referenzId: retourId.toString(), referenzTyp: 'vereinskleider-retoure'
        }, session);
      }
      return { retourId: retourId.toString(), gutschriftId: gutschriftId.toString(), betrag: betrag / 100 };
    });
    return json({ erfolg: true, ...ergebnis }, { status: 201 });
  } catch (e) {
    if (e instanceof Retourenfehler) return json({ fehler: e.message }, { status: e.status });
    console.error('Retoure erfassen:', e);
    return json({ fehler: 'Retoure konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
