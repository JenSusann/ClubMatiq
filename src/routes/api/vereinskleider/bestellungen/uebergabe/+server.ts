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
};

type Uebergabe = {
  positionsIndex: number;
  artikelId: string;
  groesseId: string | null;
  menge: number;
  uebergebenAm: Date;
};

type Verkaufsdokument = Document & {
  uebergaben?: Uebergabe[];
};

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && ObjectId.isValid(wert) && new ObjectId(wert).toString() === wert.toLowerCase();
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
      (positionsIndex as number) < 0 || !Number.isSafeInteger(menge) || (menge as number) < 1 || (menge as number) > 10000) {
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
      const positionen = vorgang.positionen as Bestellposition[] | undefined;
      const position = Array.isArray(positionen) ? positionen[index] : undefined;
      if (!position || position.verkaufsart !== 'bestellung') {
        throw new Uebergabefehler('Diese Position ist keine offene Bestellung.');
      }
      if (!gueltigeId(position.artikelId) ||
          (position.groesseId !== null && !gueltigeId(position.groesseId))) {
        throw new Uebergabefehler('Artikel- oder Grössen-ID ist ungültig.');
      }
      const bisher = position.uebergebenMenge ?? 0;
      if (!Number.isSafeInteger(position.menge) || position.menge < 1 ||
          !Number.isSafeInteger(bisher) || bisher < 0 || bisher > position.menge) {
        throw new Uebergabefehler('Bestellmengen sind inkonsistent.', 409);
      }
      const offen = position.menge - bisher;
      if (anzahl > offen) throw new Uebergabefehler(`Es sind nur noch ${offen} Stück offen.`, 409);

      const artikelDokument = await artikel.findOne({ _id: new ObjectId(position.artikelId), vereinId }, { session });
      if (!artikelDokument) throw new Uebergabefehler('Artikel nicht gefunden.', 404);
      if (Boolean(artikelDokument.hatGroessen) !== (position.groesseId !== null)) {
        throw new Uebergabefehler('Grössenzuordnung stimmt nicht mehr.', 409);
      }

      if (position.groesseId !== null) {
        const varianteAktualisiert = await varianten.updateOne({
          vereinId, artikelId: position.artikelId, groesseId: position.groesseId,
          aktiv: { $ne: false }, menge: { $gte: anzahl + 1 }
        }, { $inc: { menge: -anzahl } }, { session });
        if (varianteAktualisiert.modifiedCount !== 1) {
          throw new Uebergabefehler('Nicht genügend verfügbarer Grössenbestand (inkl. Anprobierreserve).', 409);
        }
        const artikelAktualisiert = await artikel.updateOne({
          _id: new ObjectId(position.artikelId), vereinId, menge: { $gte: anzahl }
        }, { $inc: { menge: -anzahl }, $set: { aktualisiertAm: new Date() } }, { session });
        if (artikelAktualisiert.modifiedCount !== 1) {
          throw new Uebergabefehler('Artikelbestand konnte nicht aktualisiert werden.', 409);
        }
      } else {
        const artikelAktualisiert = await artikel.updateOne({
          _id: new ObjectId(position.artikelId), vereinId, menge: { $gte: anzahl + 1 }
        }, { $inc: { menge: -anzahl }, $set: { aktualisiertAm: new Date() } }, { session });
        if (artikelAktualisiert.modifiedCount !== 1) {
          throw new Uebergabefehler('Nicht genügend Lagerbestand (inkl. Anprobierreserve).', 409);
        }
      }

      const jetzt = new Date();
      const neuerStand = bisher + anzahl;
      const aktualisiertePositionen = positionen!.map((p, i) => i === index ? { ...p, uebergebenMenge: neuerStand } : p);
      const nochOffen = aktualisiertePositionen.some((p) => p.verkaufsart === 'bestellung' &&
        p.menge > (p.uebergebenMenge ?? 0));
      const aktualisiert = await verkaeufe.updateOne({
        _id: new ObjectId(vorgangId), vereinId,
        [`positionen.${index}.verkaufsart`]: 'bestellung',
        [`positionen.${index}.uebergebenMenge`]: bisher === 0
          ? { $in: [null, 0] }
          : bisher
      }, {
        $set: {
          [`positionen.${index}.uebergebenMenge`]: neuerStand,
          status: nochOffen ? 'offen' : 'abgeschlossen',
          aktualisiertAm: jetzt,
          uebergaben: [
            ...(Array.isArray(vorgang.uebergaben) ? vorgang.uebergaben : []),
            {
              positionsIndex: index,
              artikelId: position.artikelId,
              groesseId: position.groesseId,
              menge: anzahl,
              uebergebenAm: jetzt
            }
          ]
        }
      }, { session });
      if (aktualisiert.modifiedCount !== 1) {
        throw new Uebergabefehler('Bestellung wurde zwischenzeitlich geändert. Bitte aktualisieren.', 409);
      }
      return { vorgangId, positionsIndex: index, uebergeben: neuerStand, offen: position.menge - neuerStand,
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
