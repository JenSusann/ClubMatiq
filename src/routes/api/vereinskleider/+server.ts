import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';
import { berechneZahlungsstand } from '../../../lib/server/vereinskleider-teilzahlungen';

type PositionEingabe = {
  artikelId: string;
  groesseId: string | null;
  menge: number;
  einzelpreis?: number;
  preisOffen?: boolean;
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
  einmaligProMitglied?: boolean;
  anspruchsgruppe?: string;
  kombinierbar?: boolean;
  aktiv?: boolean;
};
type PositionGeprueft = Omit<PositionEingabe, 'einzelpreis'> & {
  einzelpreis: number | null;
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
  if (d.verkaufsart !== 'direkt' && d.verkaufsart !== 'bestellung' && d.verkaufsart !== 'automatisch') {
    throw new Verkaufsfehler('Ungültige Verkaufsart.');
  }
  if (typeof d.kaeufer !== 'string' || !d.kaeufer.trim() || d.kaeufer.length > 200) {
    throw new Verkaufsfehler('Bitte einen Käufer angeben (maximal 200 Zeichen).');
  }
  if (!['rechnung', 'twint', 'bar'].includes(d.zahlungsart as string)) {
    throw new Verkaufsfehler('Ungültige Zahlungsart.');
  }
  if (d.zahlungErhalten !== undefined && typeof d.zahlungErhalten !== 'boolean') {
    throw new Verkaufsfehler('Ungültige Zahlungsbestätigung.');
  }
  if (d.zahlungsart === 'rechnung' && d.zahlungErhalten === true) {
    throw new Verkaufsfehler('Bei Zahlungsart Rechnung kann die Zahlung nicht beim Verkauf bestätigt werden.');
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
        (p.einzelpreis !== undefined && !betragGueltig(p.einzelpreis)) ||
        (p.preisOffen !== undefined && typeof p.preisOffen !== 'boolean')) {
      throw new Verkaufsfehler('Eine Warenkorbposition ist ungültig.');
    }
    positionen.push({ artikelId: p.artikelId, groesseId: p.groesseId, menge: p.menge, einzelpreis: p.einzelpreis, preisOffen: p.preisOffen === true });
  }
  if (d.mitgliedId != null && !gueltigeId(d.mitgliedId)) throw new Verkaufsfehler('Ungültige Mitglieder-ID.');
  const rabattIds = d.rabattIds ?? [];
  if (!Array.isArray(rabattIds) || rabattIds.length > 30 || !rabattIds.every(gueltigeId) ||
      new Set(rabattIds).size !== rabattIds.length) {
    throw new Verkaufsfehler('Ungültige Rabattregel-Auswahl.');
  }
  const zusatz = d.zusaetzlicherRabatt ?? 0;
  if (!betragGueltig(zusatz)) throw new Verkaufsfehler('Ungültiger zusätzlicher Rabatt.');
  return {
    verkaufsart: d.verkaufsart as 'direkt' | 'bestellung' | 'automatisch',
    kaeufer: (d.kaeufer as string).trim(),
    mitgliedId: (d.mitgliedId as string | null | undefined) ?? null,
    zahlungsart: d.zahlungsart as string,
    zahlungErhalten: d.zahlungErhalten === true,
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
      const mitglied = eingabe.mitgliedId ? await db.collection('clubdesk_mitglieder').findOne({
        _id: new ObjectId(eingabe.mitgliedId), vereinId, aktiv: { $ne: false }
      }, { session }) : null;
      if (eingabe.mitgliedId && !mitglied) throw new Verkaufsfehler('Mitglied nicht gefunden oder inaktiv.', 409);
      const artikelCollection = db.collection('artikel');
      const variantenCollection = db.collection('artikelvarianten');
      const preiseCollection = db.collection('vereinskleider_preise');
      const geprueft: PositionGeprueft[] = [];
      const mengen = new Map<string, { artikelId: string; groesseId: string | null; menge: number }>();

      for (const position of eingabe.positionen) {
        const artikel = await artikelCollection.findOne({ _id: new ObjectId(position.artikelId), vereinId }, { session });
        if (!artikel) throw new Verkaufsfehler('Ein Artikel wurde nicht gefunden.', 404);
        if (artikel.archiviert === true) throw new Verkaufsfehler('Dieser Artikel ist archiviert und kann nicht verkauft oder bestellt werden.', 409);
        if (artikel.istVereinskleidung !== true) {
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
        // Preis-offen-Positionen dürfen bis zur Einführung der Teilzahlungslogik
        // keinesfalls mit einem manuellen Ersatzpreis als bezahlt verbucht werden.
        if (preis.preisOffen === true) {
          // Unbekannte Preise sind ausdrücklich keine Null-Franken-Positionen.
          // Der Warenkorb kann solche Positionen bereits verbindlich vorsehen,
          // ihre Verrechnung benötigt jedoch eine separate Teilforderung.
          if (position.einzelpreis !== undefined) {
            throw new Verkaufsfehler(`Für ${artikel.name} ist der Verkaufspreis noch offen. Ein Ersatzpreis ist nicht zulässig.`, 409);
          }
          if (eingabe.verkaufsart === 'direkt') {
            throw new Verkaufsfehler('Artikel mit offenem Preis können nicht direkt verkauft werden. Bitte Automatisch oder Nur Bestellung wählen.', 409);
          }
          const schluessel = `${position.artikelId}:${position.groesseId ?? ''}`;
          const bisher = mengen.get(schluessel);
          mengen.set(schluessel, { artikelId: position.artikelId, groesseId: position.groesseId,
            menge: (bisher?.menge ?? 0) + position.menge });
          geprueft.push({ artikelId: position.artikelId, groesseId: position.groesseId,
            menge: position.menge, einzelpreis: null, preisOffen: true,
            artikelname: artikel.name, kategorieId: artikel.kategorieId, positionsbetrag: 0 });
          continue;
        }
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

      const hatOffenePreise = geprueft.some((p) => p.preisOffen);
      if (hatOffenePreise && (eingabe.rabattIds.length > 0 || eingabe.zusaetzlicherRabatt !== 0)) {
        throw new Verkaufsfehler('Rabatte bei offenen Preispositionen sind noch nicht unterstützt.', 409);
      }
      const zwischentotalRappen = geprueft.reduce((summe, p) => summe + p.positionsbetrag, 0);
      let regelRabattRappen = 0;
      const angewendeteRabatte: Array<{ rabattId: string; name: string; betrag: number; einmaligProMitglied?: boolean }> = [];
      const erstbezugsIds: string[] = [];
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
          const passend = geprueft.filter((p) => p.einzelpreis !== null && (
            regel.geltungsbereich === 'warenkorb' ||
            (regel.geltungsbereich === 'artikel' && regel.artikelIds?.includes(p.artikelId)) ||
            (regel.geltungsbereich === 'kategorie' && regel.kategorieIds?.includes(p.kategorieId))
          ));
          if (!passend.length) throw new Verkaufsfehler(`Für «${regel.name}» gibt es keine passende Position.`);
          if (regel.einmaligProMitglied === true) {
            if (!mitglied) throw new Verkaufsfehler('Für einen Erstbezug muss ein Mitglied ausgewählt werden.', 409);
            if (regel.rabattart !== 'fixpreis' || regel.geltungsbereich === 'warenkorb' || regel.maximaleMenge !== 1) {
              throw new Verkaufsfehler('Ungültige Erstbezugsregel.', 409);
            }
            const gruppe = regel.anspruchsgruppe;
            if (gruppe && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(gruppe)) throw new Verkaufsfehler('Ungültige Anspruchsgruppe.', 409);
            const anspruch = gruppe ? 'gruppe:' + gruppe : passend[0].artikelId;
            const bisherigeIds = [passend[0].artikelId, regel._id.toString(), anspruch];
            if (gruppe) {
              const gruppenregeln = await db.collection<Rabattregel>('rabattregeln').find({ vereinId, anspruchsgruppe: gruppe, einmaligProMitglied: true }, { session }).toArray();
              for (const gr of gruppenregeln) {
                bisherigeIds.push(gr._id.toString(), ...(gr.artikelIds ?? []));
                if (gr.kategorieIds?.length) {
                  const artikel = await db.collection('artikel').find({ vereinId, kategorieId: { $in: gr.kategorieIds } }, { session, projection: { _id: 1 } }).toArray();
                  bisherigeIds.push(...artikel.map(a => String(a._id)));
                }
              }
            }
            // Ein Schreibzugriff auf das Mitglied serialisiert konkurrierende Ansprüche.
            const sperre = await db.collection('clubdesk_mitglieder').updateOne(
              { _id: mitglied._id, vereinId, aktiv: { $ne: false }, erstbezugsRabattIds: { $nin: [...new Set(bisherigeIds)] } },
              { $addToSet: { erstbezugsRabattIds: anspruch } }, { session }
            );
            if (sperre.modifiedCount !== 1) throw new Verkaufsfehler(`Erstbezug «${regel.name}» wurde bereits beansprucht.`, 409);
            erstbezugsIds.push(anspruch);
          }
          // Maximale Menge begrenzt die Anzahl rabattierter Stücke, nicht die Warenkorbmenge.
          let restmenge: number = typeof regel.maximaleMenge === 'number' ? regel.maximaleMenge : Number.MAX_SAFE_INTEGER;
          let basis = 0;
          for (const p of passend) {
            const anzahl: number = Math.min(restmenge, p.menge);
            basis += anzahl * geld(p.einzelpreis!);
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
              rabatt += anzahl * Math.max(0, geld(p.einzelpreis!) - geld(regel.wert));
              restmenge -= anzahl;
              if (restmenge === 0) break;
            }
          } else throw new Verkaufsfehler('Ungültige Rabattart.');
          rabatt = Math.min(rabatt, Math.max(0, zwischentotalRappen - regelRabattRappen));
          regelRabattRappen += rabatt;
          angewendeteRabatte.push({ rabattId: regel._id.toString(), name: regel.name, betrag: rabatt / 100, ...(regel.einmaligProMitglied ? { einmaligProMitglied: true } : {}) });
        }
      }
      const zusatzRappen = geld(eingabe.zusaetzlicherRabatt);
      if (regelRabattRappen + zusatzRappen > zwischentotalRappen) {
        throw new Verkaufsfehler('Die Rabatte übersteigen den Warenkorbwert.');
      }

       // Pro Artikel und Grösse wird nur der tatsächlich verfügbare Bestand
       // (abzüglich eines Stücks Anprobierreserve) direkt verkauft.
       const direkteMengen = new Map<string, number>();
       const offeneVarianten = new Set(geprueft.filter((p) => p.preisOffen).map((p) => `${p.artikelId}:${p.groesseId ?? ''}`));
       for (const [schluessel, eintrag] of mengen) {
         let direkt = 0;
         if (eingabe.verkaufsart !== 'bestellung' && !offeneVarianten.has(schluessel)) {
           const bestandDokument = eintrag.groesseId !== null
             ? await variantenCollection.findOne({
                 vereinId, artikelId: eintrag.artikelId, groesseId: eintrag.groesseId,
                 aktiv: { $ne: false }
               }, { session })
             : await artikelCollection.findOne({
                 _id: new ObjectId(eintrag.artikelId), vereinId
               }, { session });
           if (!bestandDokument) throw new Verkaufsfehler('Lagerbestand nicht gefunden.', 409);
           const verfuegbar = Math.max(0, (Number(bestandDokument.menge) || 0) - 1);
           direkt = eingabe.verkaufsart === 'direkt'
             ? eintrag.menge
             : Math.min(eintrag.menge, verfuegbar);
           if (eingabe.verkaufsart === 'direkt' && direkt > verfuegbar) {
             throw new Verkaufsfehler('Nicht genügend Lagerbestand nach Abzug der Anprobierreserve.', 409);
           }
         }
         direkteMengen.set(schluessel, direkt);
         if (direkt === 0) continue;

         // Bedingte Updates schützen vor konkurrierenden Verkäufen.
         if (eintrag.groesseId !== null) {
           const aktualisiert = await variantenCollection.updateOne({
             vereinId, artikelId: eintrag.artikelId, groesseId: eintrag.groesseId,
             aktiv: { $ne: false }, menge: { $gte: direkt + 1 }
           }, { $inc: { menge: -direkt } }, { session });
           if (aktualisiert.modifiedCount !== 1) throw new Verkaufsfehler('Bestand der Grösse wurde zwischenzeitlich geändert.', 409);
           const artikelAktualisiert = await artikelCollection.updateOne({
             _id: new ObjectId(eintrag.artikelId), vereinId, menge: { $gte: direkt }
           }, { $inc: { menge: -direkt }, $set: { aktualisiertAm: new Date() } }, { session });
           if (artikelAktualisiert.modifiedCount !== 1) throw new Verkaufsfehler('Artikelbestand konnte nicht aktualisiert werden.', 409);
         } else {
           const aktualisiert = await artikelCollection.updateOne({
             _id: new ObjectId(eintrag.artikelId), vereinId, menge: { $gte: direkt + 1 }
           }, { $inc: { menge: -direkt }, $set: { aktualisiertAm: new Date() } }, { session });
           if (aktualisiert.modifiedCount !== 1) throw new Verkaufsfehler('Lagerbestand wurde zwischenzeitlich geändert.', 409);
         }
       }

       // Die Aufteilung erfolgt auch bei mehreren Positionen derselben Variante
       // deterministisch in Warenkorbreihenfolge.
       const verbleibendDirekt = new Map(direkteMengen);
       const aufgeteiltePositionen: Array<PositionGeprueft & { verkaufsart: 'direkt' | 'bestellung' }> = [];
       for (const p of geprueft) {
         const schluessel = `${p.artikelId}:${p.groesseId ?? ''}`;
         const direkt = Math.min(p.menge, verbleibendDirekt.get(schluessel) ?? 0);
         verbleibendDirekt.set(schluessel, (verbleibendDirekt.get(schluessel) ?? 0) - direkt);
         const bestellt = p.menge - direkt;
         if (direkt > 0) aufgeteiltePositionen.push({
           ...p, menge: direkt, positionsbetrag: p.einzelpreis === null ? 0 : geld(p.einzelpreis) * direkt, verkaufsart: 'direkt'
         });
         if (bestellt > 0) aufgeteiltePositionen.push({
           ...p, menge: bestellt, positionsbetrag: p.einzelpreis === null ? 0 : geld(p.einzelpreis) * bestellt, verkaufsart: 'bestellung'
         });
       }
       const direktMenge = aufgeteiltePositionen.filter((p) => p.verkaufsart === 'direkt')
         .reduce((summe, p) => summe + p.menge, 0);
       const bestellMenge = aufgeteiltePositionen.filter((p) => p.verkaufsart === 'bestellung')
         .reduce((summe, p) => summe + p.menge, 0);
       const effektiveVerkaufsart = direktMenge > 0 && bestellMenge > 0
         ? 'gemischt' : bestellMenge > 0 ? 'bestellung' : 'direkt';

      // Gemeinsame, auf Rappen geprüfte Zahlungsberechnung für den bisherigen
      // Festpreis-Verkauf. Künftige offene Positionen bleiben explizit null.
      const zahlungsbasis = berechneZahlungsstand(
        geprueft.map((p) => ({ artikelId: p.artikelId, groesseId: p.groesseId,
          menge: p.menge, einzelpreis: p.einzelpreis, preisOffen: p.preisOffen === true })), []
      );
      if (Math.round(zahlungsbasis.faellig * 100) !== zwischentotalRappen) {
        throw new Verkaufsfehler('Der Warenkorbwert konnte nicht korrekt berechnet werden.');
      }
      const jetzt = new Date();
      const endbetrag = (zwischentotalRappen - regelRabattRappen - zusatzRappen) / 100;
      const bezahlt = eingabe.zahlungErhalten && eingabe.zahlungsart !== 'rechnung';
      const zahlungen: { betrag: number; datum: Date; zahlungsart: string }[] = bezahlt && endbetrag > 0
        ? [{ betrag: endbetrag, datum: jetzt, zahlungsart: eingabe.zahlungsart }]
        : [];
      const dokument = {
        vereinId,
        verkaufsart: effektiveVerkaufsart,
        status: bestellMenge > 0 ? 'offen' : 'abgeschlossen',
        preisOffen: hatOffenePreise,
        offenePreispositionen: geprueft.filter((p) => p.preisOffen).length,
        direktMenge,
        bestellMenge,
        kaeufer: mitglied ? `${mitglied.vorname} ${mitglied.nachname}`.trim() : eingabe.kaeufer,
        ...(mitglied ? { mitgliedId: String(mitglied._id), clubdeskId: mitglied.clubdeskId } : {}),
        riegen: eingabe.riegen,
        zahlungsart: eingabe.zahlungsart,
        zahlungsstatus: hatOffenePreise ? (bezahlt && endbetrag > 0 ? 'teilweise_bezahlt' : 'preis_offen') : bezahlt || endbetrag === 0 ? 'bezahlt' : 'offen',
        bezahltBetrag: bezahlt ? endbetrag : 0,
        zahlungen,
        bemerkung: eingabe.bemerkung,
        positionen: aufgeteiltePositionen.map(({ kategorieId, positionsbetrag, ...p }) => ({ ...p, positionsbetrag: positionsbetrag / 100 })),
        rabatte: angewendeteRabatte,
        ...(erstbezugsIds.length ? { erstbezugsIds } : {}),
        zusaetzlicherRabatt: eingabe.zusaetzlicherRabatt,
        zwischentotal: zwischentotalRappen / 100,
        rabattTotal: (regelRabattRappen + zusatzRappen) / 100,
        endbetrag,
        restbetragBekannt: bezahlt ? 0 : endbetrag,
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


// Verkaufshistorie: serverseitige Suche und Filter, ohne die Verkaufslogik zu verändern.
export const GET: RequestHandler = async ({ locals, url }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (berechtigungsfehler) return berechtigungsfehler;

  const vereinId = locals.benutzer!.vereinId;
  const parameter = url.searchParams;
  const seiteText = parameter.get('seite') ?? '1';
  if (!/^[1-9]\d*$/.test(seiteText) || !Number.isSafeInteger(Number(seiteText)) || Number(seiteText) > 10000) {
    return json({ fehler: 'Ungültige Seitennummer.' }, { status: 400 });
  }
  const seite = Number(seiteText);
  const suche = (parameter.get('suche') ?? '').trim();
  const art = parameter.get('art') ?? 'alle';
  const zahlung = parameter.get('zahlung') ?? 'alle';
  const riege = (parameter.get('riege') ?? '').trim();
  const von = parameter.get('von') ?? '';
  const bis = parameter.get('bis') ?? '';
  if (suche.length > 120 || riege.length > 100 || !['alle', 'direkt', 'bestellung', 'gemischt'].includes(art) ||
      !['alle', 'bezahlt', 'offen', 'gutschrift'].includes(zahlung) ||
      (von && !/^\d{4}-\d{2}-\d{2}$/.test(von)) || (bis && !/^\d{4}-\d{2}-\d{2}$/.test(bis))) {
    return json({ fehler: 'Ungültige Such- oder Filterparameter.' }, { status: 400 });
  }
  const datumGueltig = (wert: string) => !wert || (!Number.isNaN(Date.parse(`${wert}T00:00:00Z`)) &&
    new Date(`${wert}T00:00:00Z`).toISOString().slice(0, 10) === wert);
  if (!datumGueltig(von) || !datumGueltig(bis) || (von && bis && von > bis)) {
    return json({ fehler: 'Ungültiger Datumsbereich.' }, { status: 400 });
  }

  const limit = 100;
  try {
    const collection = db.collection('vereinskleider_verkaeufe');
    const rechnungsCollection = db.collection('vereinskleider_rechnungen');
    const filter: Record<string, unknown> = { vereinId };
    if (art !== 'alle') filter.verkaufsart = art;
    if (riege) filter.riegen = riege;
    if (von || bis) {
      const bereich: Record<string, Date> = {};
      if (von) bereich.$gte = new Date(`${von}T00:00:00.000Z`);
      if (bis) {
        const ende = new Date(`${bis}T00:00:00.000Z`);
        ende.setUTCDate(ende.getUTCDate() + 1);
        bereich.$lt = ende;
      }
      filter.erstelltAm = bereich;
    }
    if (suche) {
      const escaped = suche.replace(/[^a-zA-Z0-9äöüÄÖÜéèàÉÈÀ\s-]/g, (zeichen) => `\\${zeichen}`);
      const regex = new RegExp(escaped, 'i');
      const passendeRechnungen = await rechnungsCollection.find({ vereinId, rechnungsnummer: regex })
        .project({ verkaufId: 1 }).toArray();
      const rechnungsVerkaufIds = passendeRechnungen.map((r) => r.verkaufId).filter((id): id is string => typeof id === 'string');
      const sucheOder: Record<string, unknown>[] = [
        { kaeufer: regex }, { 'positionen.artikelname': regex }, { rechnungId: { $in: [] } },
        { _id: { $in: rechnungsVerkaufIds.filter((id) => /^[0-9a-f]{24}$/i.test(id)).map((id) => new ObjectId(id)) } }
      ];
      sucheOder.splice(2, 1);
      if (/^[0-9a-f]{24}$/i.test(suche)) sucheOder.push({ _id: new ObjectId(suche) });
      filter.$or = sucheOder;
    }

    // Zahlungsstatus wird anhand des aktuellen Rechnungsstands ermittelt.
    // Die Aggregation vermeidet falsche Treffer nach Gutschriften/Stornierungen.
    const pipeline: Record<string, unknown>[] = [
      { $match: filter },
      { $lookup: {
        from: 'vereinskleider_rechnungen',
        let: { verkaufSchluessel: { $toString: '$_id' }, verein: '$vereinId' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$verkaufId', '$$verkaufSchluessel'] }, { $eq: ['$vereinId', '$$verein'] }
          ] } } },
          { $project: { rechnungsnummer: 1, status: 1, gesamtbetrag: 1, bezahltBetrag: 1,
            gutgeschriebenBetrag: 1, rueckerstattungOffen: 1 } },
          { $limit: 1 }
        ], as: 'rechnungsTreffer'
      } },
      { $set: { rechnung: { $arrayElemAt: ['$rechnungsTreffer', 0] } } },
      { $set: {
        nettoFilter: { $max: [0, { $subtract: [
          { $ifNull: ['$rechnung.gesamtbetrag', '$endbetrag'] },
          { $ifNull: ['$rechnung.gutgeschriebenBetrag', 0] }
        ] }] },
        bezahltFilter: { $ifNull: ['$rechnung.bezahltBetrag', { $ifNull: ['$bezahltBetrag', 0] }] }
      } }
    ];
    if (zahlung === 'gutschrift') pipeline.push({ $match: { 'rechnung.gutgeschriebenBetrag': { $gt: 0 } } });
    if (zahlung === 'bezahlt') pipeline.push({ $match: { $expr: { $lte: [
      { $subtract: ['$nettoFilter', '$bezahltFilter'] }, 0.005
    ] } } });
    if (zahlung === 'offen') pipeline.push({ $match: { $expr: { $gt: [
      { $subtract: ['$nettoFilter', '$bezahltFilter'] }, 0.005
    ] } } });
    pipeline.push({ $facet: {
      eintraege: [
        { $sort: { erstelltAm: -1, _id: -1 } },
        { $skip: (seite - 1) * limit }, { $limit: limit },
        { $project: { rechnungsTreffer: 0, nettoFilter: 0, bezahltFilter: 0 } }
      ],
      zaehler: [{ $count: 'anzahl' }]
    } });
    const [resultat] = await collection.aggregate<{
      eintraege: Record<string, unknown>[];
      zaehler: { anzahl: number }[];
    }>(pipeline).toArray();
    const gesamt = resultat?.zaehler?.[0]?.anzahl ?? 0;
    const verkaeufe = (resultat?.eintraege ?? []).map((v) => {
      const rechnung = v.rechnung as Record<string, unknown> | undefined;
      return {
        ...v,
        _id: String(v._id),
        rechnung: rechnung ? { ...rechnung, _id: String(rechnung._id) } : null
      };
    });
    return json({ verkaeufe, seite, proSeite: limit, gesamt, seiten: Math.ceil(gesamt / limit) });
  } catch (error) {
    console.error('Fehler beim Laden der Verkaufshistorie:', error);
    return json({ fehler: 'Verkaufshistorie konnte nicht geladen werden.' }, { status: 500 });
  }
};
