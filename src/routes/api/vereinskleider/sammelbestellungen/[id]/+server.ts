import { json } from '@sveltejs/kit';
import { ObjectId, type ClientSession } from 'mongodb';
import { client, db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import { protokolliereLagerbewegung } from '../../../../../lib/server/lagerbewegungen';
import type { RequestHandler } from './$types';

type Position = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
  geliefertMenge?: number;
};
type Sammelbestellung = {
  vereinId: string;
  lieferantId?: string | null;
  status: 'entwurf' | 'bestellt' | 'geliefert';
  positionen: Position[];
  bestelltAm?: Date;
  geliefertAm?: Date;
  aktualisiertAm: Date;
};
type Kundenposition = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
  verkaufsart: 'direkt' | 'bestellung';
  uebergebenMenge?: number;
  reserviertMenge?: number;
};
type Kundenbestellung = {
  vereinId: string;
  erstelltAm?: Date;
  positionen?: Kundenposition[];
};
type WareneingangsPosition = { artikelId: string; groesseId: string | null; menge: number };
type Zuordnung = { vorgangId: string; positionsIndex: number; artikelId: string; groesseId: string | null; menge: number };

class Fachfehler extends Error {
  constructor(message: string, readonly statusCode = 409) { super(message); }
}
const gueltigeId = (wert: unknown): wert is string => typeof wert === 'string' && /^[0-9a-fA-F]{24}$/.test(wert);
const schluessel = (artikelId: string, groesseId: string | null): string => `${artikelId}:${groesseId ?? ''}`;

async function lagerZubuchen(vereinId: string, position: WareneingangsPosition, session: ClientSession): Promise<void> {
  if (position.groesseId === null) {
    const ergebnis = await db.collection('artikel').updateOne(
      { _id: new ObjectId(position.artikelId), vereinId, hatGroessen: false },
      { $inc: { menge: position.menge } }, { session }
    );
    if (ergebnis.matchedCount !== 1) throw new Fachfehler('Artikel ohne Grösse nicht gefunden oder inzwischen geändert.');
    return;
  }
  const variante = await db.collection('artikelvarianten').updateOne(
    { vereinId, artikelId: position.artikelId, groesseId: position.groesseId, aktiv: { $ne: false } },
    { $inc: { menge: position.menge } }, { session }
  );
  if (variante.matchedCount !== 1) throw new Fachfehler('Artikelvariante nicht gefunden oder nicht mehr aktiv.');
  const artikel = await db.collection('artikel').updateOne(
    { _id: new ObjectId(position.artikelId), vereinId, hatGroessen: true },
    { $inc: { menge: position.menge } }, { session }
  );
  if (artikel.matchedCount !== 1) throw new Fachfehler('Zugehöriger Artikel nicht gefunden oder inzwischen geändert.');
}

async function reservierungenZuteilen(
  vereinId: string, lieferung: WareneingangsPosition[], session: ClientSession
): Promise<Zuordnung[]> {
  const verkaeufe = db.collection<Kundenbestellung>('vereinskleider_verkaeufe');
  // Alle Vorgänge laden, nicht nur die ersten 1000: auch ältere Reservierungen schützen.
  const vorgaenge = await verkaeufe.find(
    { vereinId, 'positionen.verkaufsart': 'bestellung' }, { session }
  ).sort({ erstelltAm: 1, _id: 1 }).toArray();
  const reserviertGesamt = new Map<string, number>();
  for (const vorgang of vorgaenge) {
    for (const p of vorgang.positionen ?? []) {
      if (p.verkaufsart !== 'bestellung') continue;
      const offen = p.menge - (p.uebergebenMenge ?? 0);
      const reserviert = p.reserviertMenge ?? 0;
      if (!Number.isSafeInteger(p.menge) || p.menge < 1 || !Number.isSafeInteger(offen) || offen < 0 ||
          !Number.isSafeInteger(reserviert) || reserviert < 0 || reserviert > offen) {
        throw new Fachfehler('Kundenbestellmengen oder Reservierungen sind inkonsistent.');
      }
      const key = schluessel(p.artikelId, p.groesseId);
      reserviertGesamt.set(key, (reserviertGesamt.get(key) ?? 0) + reserviert);
    }
  }

  const zuordnungen: Zuordnung[] = [];
  for (const geliefert of lieferung) {
    const key = schluessel(geliefert.artikelId, geliefert.groesseId);
    // Nur die neu gelieferte Menge reservieren. Andere Lagerware bleibt unberührt.
    const bestandDokument = geliefert.groesseId === null
      ? await db.collection('artikel').findOne(
          { _id: new ObjectId(geliefert.artikelId), vereinId, hatGroessen: false },
          { session, projection: { menge: 1 } }
        )
      : await db.collection('artikelvarianten').findOne(
          { vereinId, artikelId: geliefert.artikelId, groesseId: geliefert.groesseId, aktiv: { $ne: false } },
          { session, projection: { menge: 1 } }
        );
    const bestand = bestandDokument?.menge;
    if (typeof bestand !== 'number' || !Number.isSafeInteger(bestand) || bestand < 0) throw new Fachfehler('Lagerbestand ist ungültig.');
    const frei = Math.max(0, bestand - 1 - (reserviertGesamt.get(key) ?? 0));
    let verbleibend = Math.min(geliefert.menge, frei);
    for (const vorgang of vorgaenge) {
      if (verbleibend === 0) break;
      for (const [index, p] of (vorgang.positionen ?? []).entries()) {
        if (verbleibend === 0) break;
        if (p.verkaufsart !== 'bestellung' || schluessel(p.artikelId, p.groesseId) !== key) continue;
        const nochNichtReserviert = p.menge - (p.uebergebenMenge ?? 0) - (p.reserviertMenge ?? 0);
        if (nochNichtReserviert <= 0) continue;
        const menge = Math.min(verbleibend, nochNichtReserviert);
        const ergebnis = await verkaeufe.updateOne(
          { _id: vorgang._id, vereinId },
          { $inc: { [`positionen.${index}.reserviertMenge`]: menge } },
          { session }
        );
        if (ergebnis.modifiedCount !== 1) throw new Fachfehler('Kundenreservierung konnte nicht gespeichert werden.');
        p.reserviertMenge = (p.reserviertMenge ?? 0) + menge;
        verbleibend -= menge;
        zuordnungen.push({ vorgangId: vorgang._id.toString(), positionsIndex: index,
          artikelId: p.artikelId, groesseId: p.groesseId, menge });
      }
    }
    reserviertGesamt.set(key, (reserviertGesamt.get(key) ?? 0) + (Math.min(geliefert.menge, frei) - verbleibend));
  }
  return zuordnungen;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  if (!gueltigeId(params.id)) return json({ fehler: 'Ungültige Sammelbestellungs-ID.' }, { status: 400 });
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe))
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  const daten = eingabe as Record<string, unknown>;
  if (daten.aktion !== 'bestellen' && daten.aktion !== 'wareneingang')
    return json({ fehler: 'Aktion muss "bestellen" oder "wareneingang" sein.' }, { status: 400 });

  const lieferung: WareneingangsPosition[] = [];
  if (daten.aktion === 'wareneingang') {
    if (!Array.isArray(daten.positionen) || daten.positionen.length < 1 || daten.positionen.length > 100)
      return json({ fehler: 'Bitte 1 bis 100 gelieferte Positionen angeben.' }, { status: 400 });
    const gesehen = new Set<string>();
    for (const roh of daten.positionen) {
      if (!roh || typeof roh !== 'object' || Array.isArray(roh))
        return json({ fehler: 'Ungültige Wareneingangsposition.' }, { status: 400 });
      const p = roh as Record<string, unknown>;
      if (!gueltigeId(p.artikelId) || !(p.groesseId === null || gueltigeId(p.groesseId)) ||
          !Number.isSafeInteger(p.menge) || (p.menge as number) < 1 || (p.menge as number) > 10000)
        return json({ fehler: 'Artikel, Grösse oder gelieferte Menge ungültig.' }, { status: 400 });
      const key = schluessel(p.artikelId, p.groesseId as string | null);
      if (gesehen.has(key)) return json({ fehler: 'Doppelte Wareneingangsposition.' }, { status: 400 });
      gesehen.add(key);
      lieferung.push({ artikelId: p.artikelId, groesseId: p.groesseId as string | null, menge: p.menge as number });
    }
  }

  const vereinId = locals.benutzer!.vereinId;
  const bestellId = new ObjectId(params.id);
  const session = client.startSession();
  try {
    let rueckgabe: { erfolg: true; status: string; vollstaendig?: boolean; zuordnungen?: Zuordnung[] } =
      { erfolg: true, status: 'bestellt' };
    await session.withTransaction(async () => {
      const sammlung = db.collection<Sammelbestellung>('vereinskleider_sammelbestellungen');
      const bestellung = await sammlung.findOne({ _id: bestellId, vereinId }, { session });
      if (!bestellung) throw new Fachfehler('Sammelbestellung nicht gefunden.', 404);
      const jetzt = new Date();
      if (daten.aktion === 'bestellen') {
        if (bestellung.status !== 'entwurf') throw new Fachfehler('Nur Entwürfe können als bestellt markiert werden.');
        const ergebnis = await sammlung.updateOne(
          { _id: bestellId, vereinId, status: 'entwurf' },
          { $set: { status: 'bestellt', bestelltAm: jetzt, aktualisiertAm: jetzt } }, { session }
        );
        if (ergebnis.modifiedCount !== 1) throw new Fachfehler('Bestellstatus konnte nicht aktualisiert werden.');
        rueckgabe = { erfolg: true, status: 'bestellt' };
        return;
      }
      if (bestellung.status !== 'bestellt')
        throw new Fachfehler('Wareneingänge sind nur für bestellte, noch nicht abgeschlossene Bestellungen möglich.');
      const positionen = bestellung.positionen.map((p) => ({ ...p }));
      for (const geliefert of lieferung) {
        const position = positionen.find((p) => p.artikelId === geliefert.artikelId && p.groesseId === geliefert.groesseId);
        if (!position) throw new Fachfehler('Eine gelieferte Position gehört nicht zu dieser Bestellung.');
        const bisher = position.geliefertMenge ?? 0;
        if (!Number.isSafeInteger(bisher) || bisher < 0 || bisher > position.menge ||
            bisher + geliefert.menge > position.menge)
          throw new Fachfehler(`Gelieferte Menge für "${position.artikelname}" überschreitet die offene Bestellmenge.`);
        position.geliefertMenge = bisher + geliefert.menge;
      }
      for (const geliefert of lieferung) {
        await lagerZubuchen(vereinId, geliefert, session);
        await protokolliereLagerbewegung({
          vereinId, artikelId: geliefert.artikelId, groesseId: geliefert.groesseId,
          art: 'wareneingang', mengeDelta: geliefert.menge,
          benutzerId: locals.benutzer!.id, referenzId: params.id,
          referenzTyp: 'sammelbestellung'
        }, session);
      }
      const zuordnungen = await reservierungenZuteilen(vereinId, lieferung, session);
      const vollstaendig = positionen.every((p) => (p.geliefertMenge ?? 0) === p.menge);
      const status = vollstaendig ? 'geliefert' : 'bestellt';
      const aenderungen: Record<string, unknown> = { positionen, status, aktualisiertAm: jetzt };
      if (vollstaendig) aenderungen.geliefertAm = jetzt;
      const ergebnis = await sammlung.updateOne(
        { _id: bestellId, vereinId, status: 'bestellt' }, { $set: aenderungen }, { session }
      );
      if (ergebnis.modifiedCount !== 1) throw new Fachfehler('Wareneingang konnte nicht abgeschlossen werden.');
      rueckgabe = { erfolg: true, status, vollstaendig, zuordnungen };
    });
    return json(rueckgabe);
  } catch (fehler) {
    if (fehler instanceof Fachfehler) return json({ fehler: fehler.message }, { status: fehler.statusCode });
    console.error('Sammelbestellung aktualisieren:', fehler);
    return json({ fehler: 'Änderung konnte nicht gespeichert werden.' }, { status: 500 });
  } finally { await session.endSession(); }
};
