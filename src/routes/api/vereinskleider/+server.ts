import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type PositionEingabe = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
  einzelpreis?: number;
};
type Rabattart = 'prozent' | 'betrag' | 'fixpreis';
type Rabattregel = {
  _id: ObjectId;
  name: string;
  rabattart: Rabattart;
  wert: number;
  geltungsbereich: 'warenkorb' | 'artikel' | 'kategorie';
  artikelIds?: string[];
  kategorieIds?: string[];
  riegen?: string[];
  maximaleMenge?: number | null;
  gueltigAb?: string | null;
  gueltigBis?: string | null;
  kombinierbar?: boolean;
  aktiv?: boolean;
};
type PositionGeprueft = Omit<PositionEingabe, 'einzelpreis'> & {
  einzelpreis: number;
  artikelname: string;
  kategorieId: string;
  positionsbetrag: number;
};

const geld = (betrag: number) => Math.round((betrag + Number.EPSILON) * 100);
const betragGueltig = (wert: unknown): wert is number =>
  typeof wert === 'number' && Number.isFinite(wert) && wert >= 0 &&
  Math.abs(wert * 100 - Math.round(wert * 100)) < 0.000001;
const gueltigeId = (wert: unknown): wert is string =>
  typeof wert === 'string' && ObjectId.isValid(wert) && new ObjectId(wert).toString() === wert.toLowerCase();

class Verkaufsfehler extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function pruefeEingabe(daten: unknown) {
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    throw new Verkaufsfehler('Ungültige Verkaufsdaten.');
  }
  const d = daten as Record<string, unknown>;
  if (d.verkaufsart !== 'direkt' && d.verkaufsart !== 'bestellung') {
    throw new Verkaufsfehler('Ungültige Verkaufsart.');
  }
  if (typeof d.kaeufer !== 'string' || !d.kaeufer.trim() || d.kaeufer.length > 200) {
    throw new Verkaufsfehler('Bitte einen Käufer angeben (maximal 200 Zeichen).');
  }
  if (!['rechnung', 'twint', 'bar'].includes(d.zahlungsart as string)) {
    throw new Verkaufsfehler('Ungültige Zahlungsart.');
  }
  if (d.bemerkung !== undefined && (typeof d.bemerkung !== 'string' || d.bemerkung.length > 2000)) {
    throw new Verkaufsfehler('Ungültige Bemerkung.');
  }
  if (!Array.isArray(d.riegen) || d.riegen.length === 0 || d.riegen.length > 30 ||
      !d.riegen.every((r) => typeof r === 'string' && r.trim() && r.length <= 100)) {
    throw new Verkaufsfehler('Bitte mindestens eine gültige Riege auswählen.');
  }
  if (!Array.isArray(d.positionen) || d.positionen.length === 0 || d.positionen.length > 100) {
    throw new Verkaufsfehler('Der Warenkorb muss 1 bis 100 Positionen enthalten.');
  }
  const positionen: PositionEingabe[] = [];
  for (const p of d.positionen) {
    if (!p || typeof p !== 'object' || Array.isArray(p) || !gueltigeId(p.artikelId) ||
        (p.groesseId !== null && !gueltigeId(p.groesseId)) ||
        !Number.isSafeInteger(p.menge) || p.menge < 1 || p.menge > 10000 ||
        (p.einzelpreis !== undefined && !betragGueltig(p.einzelpreis))) {
      throw new Verkaufsfehler('Eine Warenkorbposition ist ungültig.');
    }
    positionen.push({ artikelId: p.artikelId, groesseId: p.groesseId, menge: p.menge, einzelpreis: p.einzelpreis });
  }
  const rabattIds = d.rabattIds ?? [];
  if (!Array.isArray(rabattIds) || rabattIds.length > 30 || !rabattIds.every(gueltigeId) ||
      new Set(rabattIds).size !== rabattIds.length) {
    throw new Verkaufsfehler('Ungültige Rabattregel-Auswahl.');
  }
  const zusatz = d.zusaetzlicherRabatt ?? 0;
  if (!betragGueltig(zusatz)) throw new Verkaufsfehler('Ungültiger zusätzlicher Rabatt.');
  return {
    verkaufsart: d.verkaufsart as 'direkt' | 'bestellung',
    kaeufer: (d.kaeufer as string).trim(),
    zahlungsart: d.zahlungsart as string,
    bemerkung: (d.bemerkung as string | undefined)?.trim() ?? '',
    riegen: [...new Set(d.riegen as string[])],
    positionen,
    rabattIds: rabattIds as string[],
    zusaetzlicherRabatt: zusatz as number
  };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (berechtigungsfehler) return berechtigungsfehler;

  let eingabe: ReturnType<typeof pruefeEingabe>;
  try {
    eingabe = pruefeEingabe(await request.json().catch(() => null));
  } catch (error) {
    return json({ fehler: error instanceof Error ? error.message : 'Ungültige Eingabe.' }, { status: 400 });
  }

  const vereinId = locals.benutzer!.vereinId;
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const artikelCollection = db.collection('artikel');
      const variantenCollection = db.collection('artikelvarianten');
      const preiseCollection = db.collection('vereinskleider_preise');
      const geprueft: PositionGeprueft[] = [];
      const mengen = new Map<string, { artikelId: string; groesseId: string | null; menge: number }>();

      for (const position of eingabe.positionen) {
        const artikel = await artikelCollection.findOne({ _id: new ObjectId(position.artikelId), vereinId }, { session });
        if (!artikel) throw new Verkaufsfehler('Ein Artikel wurde nicht gefunden.', 404);
        const kategorie = await db.collection('kategorien').findOne({ _id: new ObjectId(artikel.kategorieId), vereinId }, { session });
        if (!kategorie || kategorie.name.trim().toLowerCase() !== 'vereinskleider') {
          throw new Verkaufsfehler('Ein Artikel gehört nicht zu den Vereinskleidern.');
        }
        if (artikel.hatGroessen !== (position.groesseId !== null)) {
          throw new Verkaufsfehler('Die Grössenzuordnung einer Position ist ungültig.');
        }
        if (position.groesseId !== null) {
          const variante = await variantenCollection.findOne({
            artikelId: position.artikelId, groesseId: position.groesseId, vereinId, aktiv: { $ne: false }
          }, { session });
          if (!variante) throw new Verkaufsfehler('Eine Grössenvariante ist nicht verfügbar.');
        }
        const preis = await preiseCollection.findOne({
          vereinId, artikelId: position.artikelId, groesseId: position.groesseId
        }, { session });
        if (!preis) throw new Verkaufsfehler(`Für ${artikel.name} fehlt ein Verkaufspreis.`);
        let einzelpreis: number;
        if (preis.preistyp === 'fix') {
          if (!betragGueltig(preis.verkaufspreis)) throw new Verkaufsfehler('Ein Fixpreis ist ungültig.');
          einzelpreis = preis.verkaufspreis;
          if (position.einzelpreis !== undefined && geld(position.einzelpreis) !== geld(einzelpreis)) {
            throw new Verkaufsfehler(`Der Preis für ${artikel.name} wurde geändert. Bitte Warenkorb neu laden.`, 409);
          }
        } else if (preis.preistyp === 'variabel') {
          const wert = position.einzelpreis ?? preis.verkaufspreis;
          if (!betragGueltig(wert)) throw new Verkaufsfehler(`Bitte einen gültigen Preis für ${artikel.name} angeben.`);
          einzelpreis = wert;
        } else {
          throw new Verkaufsfehler('Unbekannter Preistyp.');
        }
        const schluessel = `${position.artikelId}:${position.groesseId ?? ''}`;
        const bisher = mengen.get(schluessel);
        mengen.set(schluessel, {
          artikelId: position.artikelId,
          groesseId: position.groesseId,
          menge: (bisher?.menge ?? 0) + position.menge
        });
        geprueft.push({
          artikelId: position.artikelId,
          groesseId: position.groesseId,
          menge: position.menge,
          einzelpreis,
          artikelname: artikel.name,
          kategorieId: artikel.kategorieId,
          positionsbetrag: geld(einzelpreis) * position.menge
        });
      }

      const zwischentotalRappen = geprueft.reduce((summe, p) => summe + p.positionsbetrag, 0);
      let regelRabattRappen = 0;
      const angewendeteRabatte: Array<{ rabattId: string; name: string; betrag: number }> = [];
      if (eingabe.rabattIds.length) {
        const regeln = await db.collection<Rabattregel>('rabattregeln').find({
          _id: { $in: eingabe.rabattIds.map((id) => new ObjectId(id)) }, vereinId
        }, { session }).toArray();
        if (regeln.length !== eingabe.rabattIds.length) throw new Verkaufsfehler('Eine Rabattregel existiert nicht in diesem Verein.');
        if (regeln.length > 1 && regeln.some((r) => !r.kombinierbar)) {
          throw new Verkaufsfehler('Diese Rabattregeln dürfen nicht kombiniert werden.');
        }
        const heute = new Date().toISOString().slice(0, 10);
        for (const regel of regeln) {
          if (regel.aktiv === false || (regel.gueltigAb && heute < regel.gueltigAb) ||
              (regel.gueltigBis && heute > regel.gueltigBis)) {
            throw new Verkaufsfehler(`Rabattregel «${regel.name}» ist nicht gültig.`);
          }
          if (regel.riegen?.length && !regel.riegen.some((r: string) => eingabe.riegen.includes(r))) {
            throw new Verkaufsfehler(`Rabattregel «${regel.name}» gilt nicht für die gewählte Riege.`);
          }
          const passend = geprueft.filter((p) =>
            regel.geltungsbereich === 'warenkorb' ||
            (regel.geltungsbereich === 'artikel' && regel.artikelIds?.includes(p.artikelId)) ||
            (regel.geltungsbereich === 'kategorie' && regel.kategorieIds?.includes(p.kategorieId))
          );
          if (!passend.length) throw new Verkaufsfehler(`Für «${regel.name}» gibt es keine passende Position.`);
          // Maximale Menge begrenzt die Anzahl rabattierter Stücke, nicht die Warenkorbmenge.
          let restmenge: number = typeof regel.maximaleMenge === 'number' ? regel.maximaleMenge : Number.MAX_SAFE_INTEGER;
          let basis = 0;
          for (const p of passend) {
            const anzahl: number = Math.min(restmenge, p.menge);
            basis += anzahl * geld(p.einzelpreis);
            restmenge -= anzahl;
            if (restmenge === 0) break;
          }
          let rabatt = 0;
          if (regel.rabattart === 'prozent') rabatt = Math.round(basis * regel.wert / 100);
          else if (regel.rabattart === 'betrag') rabatt = Math.min(basis, geld(regel.wert));
          else if (regel.rabattart === 'fixpreis') {
            // Sonderpreis pro rabattiertem Stück; bei Warenkorb-Regeln nicht eindeutig.
            if (regel.geltungsbereich === 'warenkorb') {
              throw new Verkaufsfehler('Sonderpreise sind nur für Artikel oder Kategorien möglich.');
            }
            restmenge = typeof regel.maximaleMenge === 'number' ? regel.maximaleMenge : Number.MAX_SAFE_INTEGER;
            for (const p of passend) {
              const anzahl: number = Math.min(restmenge, p.menge);
              rabatt += anzahl * Math.max(0, geld(p.einzelpreis) - geld(regel.wert));
              restmenge -= anzahl;
              if (restmenge === 0) break;
            }
          } else throw new Verkaufsfehler('Ungültige Rabattart.');
          rabatt = Math.min(rabatt, Math.max(0, zwischentotalRappen - regelRabattRappen));
          regelRabattRappen += rabatt;
          angewendeteRabatte.push({ rabattId: regel._id.toString(), name: regel.name, betrag: rabatt / 100 });
        }
      }
      const zusatzRappen = geld(eingabe.zusaetzlicherRabatt);
      if (regelRabattRappen + zusatzRappen > zwischentotalRappen) {
        throw new Verkaufsfehler('Die Rabatte übersteigen den Warenkorbwert.');
      }

      if (eingabe.verkaufsart === 'direkt') {
        // Bedingte Updates verhindern negative Bestände bei parallelen Verkäufen.
        for (const eintrag of mengen.values()) {
          const mindestbestand = eintrag.menge + 1; // 1 Stück Anprobierreserve
          if (eintrag.groesseId !== null) {
            const aktualisiert = await variantenCollection.updateOne({
              vereinId, artikelId: eintrag.artikelId, groesseId: eintrag.groesseId,
              aktiv: { $ne: false }, menge: { $gte: mindestbestand }
            }, { $inc: { menge: -eintrag.menge } }, { session });
            if (aktualisiert.modifiedCount !== 1) throw new Verkaufsfehler('Nicht genügend Lagerbestand für eine Grösse.', 409);
            const artikelAktualisiert = await artikelCollection.updateOne({
              _id: new ObjectId(eintrag.artikelId), vereinId, menge: { $gte: eintrag.menge }
            }, { $inc: { menge: -eintrag.menge }, $set: { aktualisiertAm: new Date() } }, { session });
            if (artikelAktualisiert.modifiedCount !== 1) throw new Verkaufsfehler('Artikelbestand konnte nicht aktualisiert werden.', 409);
          } else {
            const aktualisiert = await artikelCollection.updateOne({
              _id: new ObjectId(eintrag.artikelId), vereinId, menge: { $gte: mindestbestand }
            }, { $inc: { menge: -eintrag.menge }, $set: { aktualisiertAm: new Date() } }, { session });
            if (aktualisiert.modifiedCount !== 1) throw new Verkaufsfehler('Nicht genügend Lagerbestand.', 409);
          }
        }
      }

      const jetzt = new Date();
      const dokument = {
        vereinId,
        verkaufsart: eingabe.verkaufsart,
        status: eingabe.verkaufsart === 'direkt' ? 'abgeschlossen' : 'offen',
        kaeufer: eingabe.kaeufer,
        riegen: eingabe.riegen,
        zahlungsart: eingabe.zahlungsart,
        zahlungsstatus: 'offen', // Zahlungsart bedeutet noch nicht, dass bezahlt wurde.
        bemerkung: eingabe.bemerkung,
        positionen: geprueft.map(({ kategorieId, positionsbetrag, ...p }) => ({ ...p, positionsbetrag: positionsbetrag / 100 })),
        rabatte: angewendeteRabatte,
        zusaetzlicherRabatt: eingabe.zusaetzlicherRabatt,
        zwischentotal: zwischentotalRappen / 100,
        rabattTotal: (regelRabattRappen + zusatzRappen) / 100,
        endbetrag: (zwischentotalRappen - regelRabattRappen - zusatzRappen) / 100,
        erstelltAm: jetzt,
        aktualisiertAm: jetzt
      };
      const gespeichert = await db.collection('vereinskleider_verkaeufe').insertOne(dokument, { session });
      return { _id: gespeichert.insertedId.toString(), ...dokument };
    });
    return json({ erfolg: true, verkauf: ergebnis }, { status: 201 });
  } catch (error) {
    if (error instanceof Verkaufsfehler) return json({ fehler: error.message }, { status: error.status });
    console.error('Fehler beim Speichern des Verkaufs:', error);
    return json({ fehler: 'Verkauf konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
