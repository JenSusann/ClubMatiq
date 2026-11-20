import { json } from '@sveltejs/kit';
import { ObjectId, type Document } from 'mongodb';
import { db, client } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

class Uebergabefehler extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type Bestellposition = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
  verkaufsart: 'direkt' | 'bestellung';
  uebergebenMenge?: number;
  reserviertMenge?: number;
};
type Uebergabe = {
  positionsIndex: number;
  artikelId: string;
  groesseId: string | null;
  menge: number;
  uebergebenAm: Date;
};
type Verkaufsdokument = Document & {
  vereinId: string;
  positionen?: Bestellposition[];
  uebergaben?: Uebergabe[];
};

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[0-9a-fA-F]{24}$/.test(wert);
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Übergabedaten.' }, { status: 400 });
  }
  const eingabe = daten as Record<string, unknown>;
  const { vorgangId, positionsIndex, menge } = eingabe;
  if (!gueltigeId(vorgangId) || !Number.isSafeInteger(positionsIndex) ||
      (positionsIndex as number) < 0 || !Number.isSafeInteger(menge) ||
      (menge as number) < 1 || (menge as number) > 10000) {
    return json({ fehler: 'Vorgang, Position oder Übergabemenge ungültig.' }, { status: 400 });
  }

  const vereinId = locals.benutzer!.vereinId;
  const index = positionsIndex as number;
  const anzahl = menge as number;
  const session = client.startSession();

  try {
    const ergebnis = await session.withTransaction(async () => {
      const verkaeufe = db.collection<Verkaufsdokument>('vereinskleider_verkaeufe');
      const artikel = db.collection('artikel');
      const varianten = db.collection('artikelvarianten');
      const vorgang = await verkaeufe.findOne({ _id: new ObjectId(vorgangId), vereinId }, { session });
      if (!vorgang) throw new Uebergabefehler('Vorgang nicht gefunden.', 404);
      const positionen = vorgang.positionen;
      const position = Array.isArray(positionen) ? positionen[index] : undefined;
      if (!position || position.verkaufsart !== 'bestellung') {
        throw new Uebergabefehler('Diese Position ist keine offene Bestellung.');
      }
      if (!gueltigeId(position.artikelId) ||
          (position.groesseId !== null && !gueltigeId(position.groesseId))) {
        throw new Uebergabefehler('Artikel- oder Grössen-ID ist ungültig.');
      }
      const bisher = position.uebergebenMenge ?? 0;
      const eigeneReserve = position.reserviertMenge ?? 0;
      if (!Number.isSafeInteger(position.menge) || position.menge < 1 ||
          !Number.isSafeInteger(bisher) || bisher < 0 || bisher > position.menge ||
          !Number.isSafeInteger(eigeneReserve) || eigeneReserve < 0 ||
          eigeneReserve > position.menge - bisher) {
        throw new Uebergabefehler('Bestellmengen oder Reservierungen sind inkonsistent.', 409);
      }
      const offen = position.menge - bisher;
      if (anzahl > offen) throw new Uebergabefehler(`Es sind nur noch ${offen} Stück offen.`, 409);

      const artikelDokument = await artikel.findOne({ _id: new ObjectId(position.artikelId), vereinId }, { session });
      if (!artikelDokument) throw new Uebergabefehler('Artikel nicht gefunden.', 404);
      if (Boolean(artikelDokument.hatGroessen) !== (position.groesseId !== null)) {
        throw new Uebergabefehler('Grössenzuordnung stimmt nicht mehr.', 409);
      }

      // Alle Reservierungen für diese Artikelvariante berücksichtigen, auch aus anderen Vorgängen.
      // Die eigene Reservierung darf verwendet werden, fremde Reservierungen nicht.
      const reservierteVorgaenge = await verkaeufe.find(
        { vereinId, 'positionen.verkaufsart': 'bestellung' },
        { session, projection: { positionen: 1 } }
      ).toArray();
      let reserviertGesamt = 0;
      for (const v of reservierteVorgaenge) {
        for (const p of v.positionen ?? []) {
          if (p.verkaufsart !== 'bestellung' || p.artikelId !== position.artikelId ||
              p.groesseId !== position.groesseId) continue;
          const uebergeben = p.uebergebenMenge ?? 0;
          const reserviert = p.reserviertMenge ?? 0;
          if (!Number.isSafeInteger(p.menge) || p.menge < 1 ||
              !Number.isSafeInteger(uebergeben) || uebergeben < 0 || uebergeben > p.menge ||
              !Number.isSafeInteger(reserviert) || reserviert < 0 || reserviert > p.menge - uebergeben) {
            throw new Uebergabefehler('Bestehende Reservierungen sind inkonsistent.', 409);
          }
          reserviertGesamt += reserviert;
          if (!Number.isSafeInteger(reserviertGesamt)) {
            throw new Uebergabefehler('Reservierungssumme ist ungültig.', 409);
          }
        }
      }

      const bestand = position.groesseId === null
        ? artikelDokument.menge
        : (await varianten.findOne({
            vereinId, artikelId: position.artikelId, groesseId: position.groesseId,
            aktiv: { $ne: false }
          }, { session }))?.menge;
      if (!Number.isSafeInteger(bestand) || (bestand as number) < 0) {
        throw new Uebergabefehler('Lagerbestand ist ungültig oder Variante nicht aktiv.', 409);
      }
      const fremdReserviert = reserviertGesamt - eigeneReserve;
      const maximalUebergebbar = Math.max(0, (bestand as number) - fremdReserviert);
      if (anzahl > maximalUebergebbar) {
        throw new Uebergabefehler(
          `Nur ${maximalUebergebbar} Stück sind für diese Übergabe verfügbar (fremde Reservierungen geschützt).`,
          409
        );
      }
      const reserveVerbraucht = Math.min(anzahl, eigeneReserve);
      const jetzt = new Date();

      if (position.groesseId !== null) {
        const varianteAktualisiert = await varianten.updateOne({
          vereinId, artikelId: position.artikelId, groesseId: position.groesseId,
          aktiv: { $ne: false }, menge: { $gte: anzahl + fremdReserviert }
        }, { $inc: { menge: -anzahl } }, { session });
        if (varianteAktualisiert.modifiedCount !== 1) {
          throw new Uebergabefehler('Nicht genügend freier Grössenbestand (inkl. fremder Reservierungen).', 409);
        }
        const artikelAktualisiert = await artikel.updateOne({
          _id: new ObjectId(position.artikelId), vereinId, menge: { $gte: anzahl }
        }, { $inc: { menge: -anzahl }, $set: { aktualisiertAm: jetzt } }, { session });
        if (artikelAktualisiert.modifiedCount !== 1) {
          throw new Uebergabefehler('Artikelbestand konnte nicht aktualisiert werden.', 409);
        }
      } else {
        const artikelAktualisiert = await artikel.updateOne({
          _id: new ObjectId(position.artikelId), vereinId,
          menge: { $gte: anzahl + fremdReserviert }
        }, { $inc: { menge: -anzahl }, $set: { aktualisiertAm: jetzt } }, { session });
        if (artikelAktualisiert.modifiedCount !== 1) {
          throw new Uebergabefehler('Nicht genügend freier Lagerbestand (inkl. Reservierungen und Anprobierreserve).', 409);
        }
      }

      const neuerStand = bisher + anzahl;
      const neueReserve = eigeneReserve - reserveVerbraucht;
      const aktualisiertePositionen = positionen!.map((p, i) => i === index
        ? { ...p, uebergebenMenge: neuerStand, reserviertMenge: neueReserve }
        : p);
      const nochOffen = aktualisiertePositionen.some((p) => p.verkaufsart === 'bestellung' &&
        p.menge > (p.uebergebenMenge ?? 0));
      const aktualisiert = await verkaeufe.updateOne({
        _id: new ObjectId(vorgangId), vereinId,
        [`positionen.${index}.verkaufsart`]: 'bestellung',
        [`positionen.${index}.uebergebenMenge`]: bisher === 0 ? { $in: [null, 0] } : bisher,
        [`positionen.${index}.reserviertMenge`]: eigeneReserve === 0 ? { $in: [null, 0] } : eigeneReserve
      }, {
        $set: {
          [`positionen.${index}.uebergebenMenge`]: neuerStand,
          [`positionen.${index}.reserviertMenge`]: neueReserve,
          status: nochOffen ? 'offen' : 'abgeschlossen',
          aktualisiertAm: jetzt,
          uebergaben: [
            ...(Array.isArray(vorgang.uebergaben) ? vorgang.uebergaben : []),
            { positionsIndex: index, artikelId: position.artikelId,
              groesseId: position.groesseId, menge: anzahl, uebergebenAm: jetzt }
          ]
        }
      }, { session });
      if (aktualisiert.modifiedCount !== 1) {
        throw new Uebergabefehler('Bestellung wurde zwischenzeitlich geändert. Bitte aktualisieren.', 409);
      }
      return { vorgangId, positionsIndex: index, uebergeben: neuerStand,
        reserviert: neueReserve, offen: position.menge - neuerStand,
        status: nochOffen ? 'offen' : 'abgeschlossen' };
    });
    return json({ erfolg: true, uebergabe: ergebnis });
  } catch (fehler) {
    if (fehler instanceof Uebergabefehler) return json({ fehler: fehler.message }, { status: fehler.status });
    console.error('Fehler bei Vereinskleiderübergabe:', fehler);
    return json({ fehler: 'Übergabe konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
