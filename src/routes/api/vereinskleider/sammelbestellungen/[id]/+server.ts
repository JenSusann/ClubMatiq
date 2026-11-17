import { json } from '@sveltejs/kit';
import { ObjectId, type ClientSession } from 'mongodb';
import { client, db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
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

type WareneingangsPosition = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
};

class Fachfehler extends Error {
  constructor(message: string, readonly statusCode = 409) {
    super(message);
  }
}

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[0-9a-fA-F]{24}$/.test(wert);
}

function schluessel(artikelId: string, groesseId: string | null): string {
  return `${artikelId}:${groesseId ?? ''}`;
}

async function lagerZubuchen(
  vereinId: string,
  position: WareneingangsPosition,
  session: ClientSession
): Promise<void> {
  if (position.groesseId === null) {
    const ergebnis = await db.collection('artikel').updateOne(
      { _id: new ObjectId(position.artikelId), vereinId, hatGroessen: false },
      { $inc: { menge: position.menge } },
      { session }
    );
    if (ergebnis.matchedCount !== 1) {
      throw new Fachfehler('Artikel ohne Grösse nicht gefunden oder inzwischen geändert.');
    }
    return;
  }

  const ergebnis = await db.collection('artikelvarianten').updateOne(
    { vereinId, artikelId: position.artikelId, groesseId: position.groesseId, aktiv: { $ne: false } },
    { $inc: { menge: position.menge } },
    { session }
  );
  if (ergebnis.matchedCount !== 1) {
    throw new Fachfehler('Artikelvariante nicht gefunden oder nicht mehr aktiv.');
  }

  // Den Gesamtbestand des Artikels mit der Variantenmenge synchron halten.
  const artikelErgebnis = await db.collection('artikel').updateOne(
    { _id: new ObjectId(position.artikelId), vereinId, hatGroessen: true },
    { $inc: { menge: position.menge } },
    { session }
  );
  if (artikelErgebnis.matchedCount !== 1) {
    throw new Fachfehler('Zugehöriger Artikel nicht gefunden oder inzwischen geändert.');
  }
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  if (!gueltigeId(params.id)) {
    return json({ fehler: 'Ungültige Sammelbestellungs-ID.' }, { status: 400 });
  }
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) {
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  }
  const daten = eingabe as Record<string, unknown>;
  if (daten.aktion !== 'bestellen' && daten.aktion !== 'wareneingang') {
    return json({ fehler: 'Aktion muss "bestellen" oder "wareneingang" sein.' }, { status: 400 });
  }

  let lieferung: WareneingangsPosition[] = [];
  if (daten.aktion === 'wareneingang') {
    if (!Array.isArray(daten.positionen) || daten.positionen.length === 0 || daten.positionen.length > 100) {
      return json({ fehler: 'Bitte 1 bis 100 gelieferte Positionen angeben.' }, { status: 400 });
    }
    const gesehen = new Set<string>();
    for (const roh of daten.positionen) {
      if (!roh || typeof roh !== 'object' || Array.isArray(roh)) {
        return json({ fehler: 'Ungültige Wareneingangsposition.' }, { status: 400 });
      }
      const p = roh as Record<string, unknown>;
      if (!gueltigeId(p.artikelId) || !(p.groesseId === null || gueltigeId(p.groesseId)) ||
        !Number.isSafeInteger(p.menge) || (p.menge as number) < 1 || (p.menge as number) > 10000) {
        return json({ fehler: 'Artikel, Grösse oder gelieferte Menge ungültig.' }, { status: 400 });
      }
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
    let rueckgabe: { erfolg: true; status: string; vollstaendig?: boolean } = { erfolg: true, status: 'bestellt' };
    await session.withTransaction(async () => {
      const sammlung = db.collection<Sammelbestellung>('vereinskleider_sammelbestellungen');
      const bestellung = await sammlung.findOne({ _id: bestellId, vereinId }, { session });
      if (!bestellung) throw new Fachfehler('Sammelbestellung nicht gefunden.', 404);

      const jetzt = new Date();
      if (daten.aktion === 'bestellen') {
        if (bestellung.status !== 'entwurf') {
          throw new Fachfehler('Nur Entwürfe können als bestellt markiert werden.');
        }
        await sammlung.updateOne(
          { _id: bestellId, vereinId, status: 'entwurf' },
          { $set: { status: 'bestellt', bestelltAm: jetzt, aktualisiertAm: jetzt } },
          { session }
        );
        rueckgabe = { erfolg: true, status: 'bestellt' };
        return;
      }

      if (bestellung.status !== 'bestellt') {
        throw new Fachfehler('Wareneingänge sind nur für bestellte, noch nicht abgeschlossene Bestellungen möglich.');
      }
      const positionen = bestellung.positionen.map((p) => ({ ...p }));
      for (const geliefert of lieferung) {
        const position = positionen.find((p) =>
          p.artikelId === geliefert.artikelId && p.groesseId === geliefert.groesseId
        );
        if (!position) throw new Fachfehler('Eine gelieferte Position gehört nicht zu dieser Bestellung.');
        const bisher = position.geliefertMenge ?? 0;
        if (!Number.isSafeInteger(bisher) || bisher < 0 || bisher > position.menge ||
          bisher + geliefert.menge > position.menge) {
          throw new Fachfehler(`Gelieferte Menge für "${position.artikelname}" überschreitet die offene Bestellmenge.`);
        }
        position.geliefertMenge = bisher + geliefert.menge;
      }

      // Alles innerhalb einer MongoDB-Transaktion: bei einem Fehler keine Teilbuchungen.
      for (const geliefert of lieferung) {
        await lagerZubuchen(vereinId, geliefert, session);
      }
      const vollstaendig = positionen.every((p) => (p.geliefertMenge ?? 0) === p.menge);
      const status = vollstaendig ? 'geliefert' : 'bestellt';
      const aenderungen: Record<string, unknown> = { positionen, status, aktualisiertAm: jetzt };
      if (vollstaendig) aenderungen.geliefertAm = jetzt;
      await sammlung.updateOne(
        { _id: bestellId, vereinId, status: 'bestellt' },
        { $set: aenderungen },
        { session }
      );
      rueckgabe = { erfolg: true, status, vollstaendig };
    });
    return json(rueckgabe);
  } catch (fehler) {
    if (fehler instanceof Fachfehler) return json({ fehler: fehler.message }, { status: fehler.statusCode });
    console.error('Sammelbestellung aktualisieren:', fehler);
    return json({ fehler: 'Änderung konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
