import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from '../../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../../lib/server/berechtigungen';
import { erstelleAusstellerdaten, type Ausstellerdaten } from '../../../../../../lib/server/vereinseinstellungen';
import { zeichneVereinsprofil } from '../../../../../../lib/server/pdf-vereinsprofil';
import type { RequestHandler } from './$types';

type Position = {
  artikelname?: string;
  groesseId?: string | null;
  menge?: number;
  einzelpreis?: number;
  positionsbetrag?: number;
};

type Zahlung = { betrag: number; datum: Date | string; zahlungsart: string };
type Gutschrift = {
  aussteller?: Ausstellerdaten;
  vereinId: string;
  rechnungId: string;
  rechnungsnummer: string;
  gutschriftnummer: string;
  artikelname: string;
  groesseId?: string | null;
  menge: number;
  einzelpreis: number;
  betrag: number;
  grund: string;
  erstelltAm: Date;
};
type Rechnung = {
  aussteller?: Ausstellerdaten;
  vereinId: string;
  rechnungsnummer: string;
  empfaenger: string;
  riegen?: string[];
  positionen: Position[];
  rabatte?: { name: string; betrag: number }[];
  zusaetzlicherRabatt?: number;
  zwischentotal: number;
  rabattTotal: number;
  gesamtbetrag: number;
  bezahltBetrag?: number;
  gutgeschriebenBetrag?: number;
  rueckerstattungOffen?: number;
  zahlungen?: Zahlung[];
  zahlungsart?: string;
  erstelltAm: Date;
  status?: 'offen' | 'teilweise_bezahlt' | 'bezahlt' | 'storniert';
};

const chf = (betrag: number) => `CHF ${betrag.toFixed(2)}`;
const datum = (wert: Date) => new Intl.DateTimeFormat('de-CH', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich'
}).format(wert);

// Die PDF-Standardschrift Helvetica unterstützt keine Umlaute.
const pdfText = (wert: unknown) => String(wert ?? '')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
  .replace(/ß/g, 'ss').replace(/[\u2010-\u2015]/g, '-')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

function gueltigesDatum(wert: unknown): Date | null {
  if (!(wert instanceof Date) && typeof wert !== 'string') return null;
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d;
}

function zahlungsartText(art: string | undefined): string {
  if (art === 'twint') return 'TWINT';
  if (art === 'bar') return 'Bar';
  if (art === 'rechnung') return 'Rechnung / Ueberweisung';
  return art || 'Nicht angegeben';
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  if (!/^[a-f\d]{24}$/i.test(params.id)) {
    return json({ fehler: 'Ungueltige Rechnungs-ID.' }, { status: 400 });
  }

  try {
    const vereinId = locals.benutzer!.vereinId;
    const rechnung = await db.collection<Rechnung>('vereinskleider_rechnungen').findOne({
      _id: new ObjectId(params.id), vereinId
    });
    if (!rechnung) return json({ fehler: 'Rechnung nicht gefunden.' }, { status: 404 });

    const gutschriftId = url.searchParams.get('gutschriftId');
    if (gutschriftId !== null) {
      if (!/^[a-f\d]{24}$/i.test(gutschriftId)) {
        return json({ fehler: 'Ungueltige Gutschrift-ID.' }, { status: 400 });
      }
      const gutschrift = await db.collection<Gutschrift>('vereinskleider_gutschriften').findOne({
        _id: new ObjectId(gutschriftId), vereinId, rechnungId: params.id
      });
      if (!gutschrift) return json({ fehler: 'Gutschrift nicht gefunden.' }, { status: 404 });
      const vereinFuerGutschrift = gutschrift.aussteller || rechnung.aussteller ? null : await db.collection('vereine').findOne({
        $or: [
          ...(ObjectId.isValid(vereinId) ? [{ _id: new ObjectId(vereinId) }] : []),
          { vereinId }
        ]
      });
      const ausstellerGutschrift = erstelleAusstellerdaten(gutschrift.aussteller ?? rechnung.aussteller ?? vereinFuerGutschrift?.ausstellerVorErsterAenderung ?? vereinFuerGutschrift);
      const groesse = gutschrift.groesseId && /^[a-f\d]{24}$/i.test(gutschrift.groesseId)
        ? await db.collection('groessen').findOne({ _id: new ObjectId(gutschrift.groesseId), vereinId })
        : null;
      const groessenname = String(groesse?.bezeichnung ?? (gutschrift.groesseId ? 'Unbekannt' : 'Ohne Groesse'));
      const pdfGutschrift = await PDFDocument.create();
      const normal = await pdfGutschrift.embedFont(StandardFonts.Helvetica);
      const fettGutschrift = await pdfGutschrift.embedFont(StandardFonts.HelveticaBold);
      const seiteGutschrift = pdfGutschrift.addPage([595.28, 841.89]);
      const dunkel = rgb(0.13, 0.19, 0.29);
      const grauGutschrift = rgb(0.36, 0.42, 0.50);
      let yGutschrift = 785;
      const zeile = (wert: unknown, groesseSchrift = 10, fettSchrift = false, abstand = 23) => {
        const font = fettSchrift ? fettGutschrift : normal;
        const inhalt = pdfText(wert);
        // Text auf A4-Breite begrenzen, ohne die Standardschrift zu ueberlaufen.
        let rest = inhalt;
        do {
          let teil = rest;
          while (teil.length > 1 && font.widthOfTextAtSize(teil, groesseSchrift) > 495) {
            teil = teil.slice(0, -1);
          }
          seiteGutschrift.drawText(teil, {
            x: 48, y: yGutschrift, size: groesseSchrift, font, color: fettSchrift ? dunkel : grauGutschrift
          });
          yGutschrift -= abstand;
          rest = rest.slice(teil.length);
        } while (rest.length > 0 && yGutschrift > 75);
      };
      yGutschrift = await zeichneVereinsprofil(pdfGutschrift, seiteGutschrift, ausstellerGutschrift, normal, fettGutschrift, 48, yGutschrift, 495, pdfText);
      zeile('GUTSCHRIFT', 22, true, 36);
      zeile(`Gutschriftnummer: ${gutschrift.gutschriftnummer}`);
      zeile(`Zur Rechnung / Quittung: ${gutschrift.rechnungsnummer}`);
      zeile(`Ausstellungsdatum: ${datum(new Date(gutschrift.erstelltAm))}`);
      yGutschrift -= 15;
      zeile(`Empfaenger: ${rechnung.empfaenger}`, 11, true, 35);
      zeile('Stornierte Position', 12, true, 28);
      zeile(`${gutschrift.artikelname} (${groessenname})`);
      zeile(`Menge: ${gutschrift.menge}`);
      zeile(`Einzelpreis: ${chf(gutschrift.einzelpreis)}`);
      zeile(`Gutschriftbetrag: ${chf(gutschrift.betrag)}`, 13, true, 35);
      zeile('Stornierungsgrund:', 10, true);
      zeile(gutschrift.grund || 'Nicht angegeben');
      yGutschrift -= 20;
      zeile('Diese Gutschrift korrigiert den oben genannten Originalbeleg.', 9);
      zeile('Eine allfaellige Rueckerstattung wird separat abgewickelt.', 9);
      const bytesGutschrift = await pdfGutschrift.save();
      const dateiname = gutschrift.gutschriftnummer.replace(/[^A-Za-z0-9_-]/g, '_');
      return new Response(new Uint8Array(bytesGutschrift), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Gutschrift-${dateiname}.pdf"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    const verein = rechnung.aussteller ? null : await db.collection('vereine').findOne({
      $or: [
        ...(ObjectId.isValid(vereinId) ? [{ _id: new ObjectId(vereinId) }] : []),
        { vereinId }
      ]
    });
    const aussteller = erstelleAusstellerdaten(rechnung.aussteller ?? verein?.ausstellerVorErsterAenderung ?? verein);
    const vereinsname = aussteller.name;

    const gesamtRappen = Math.round(rechnung.gesamtbetrag * 100);
    const bezahltRappen = Math.max(0, Math.round((rechnung.bezahltBetrag ?? 0) * 100));
    const gutgeschriebenRappen = Math.max(0, Math.round((rechnung.gutgeschriebenBetrag ?? 0) * 100));
    const nettoRappen = Math.max(0, gesamtRappen - gutgeschriebenRappen);
    const offenRappen = Math.max(0, nettoRappen - bezahltRappen);
    const rueckerstattungRappen = Math.max(0, Math.min(Math.max(0, bezahltRappen - nettoRappen), Math.round((rechnung.rueckerstattungOffen ?? Math.max(0, (bezahltRappen - nettoRappen) / 100)) * 100)));
    const vollBezahlt = offenRappen === 0 && rueckerstattungRappen === 0 && rechnung.status !== 'storniert';
    const istQuittung = vollBezahlt &&
      (rechnung.zahlungsart === 'bar' || rechnung.zahlungsart === 'twint');
    const istStorniert = rechnung.status === 'storniert';
    const bezeichnung = istQuittung ? 'QUITTUNG' : 'RECHNUNG';
    const dokumentName = istQuittung ? 'Quittung' : 'Rechnung';
    const zahlungen = Array.isArray(rechnung.zahlungen)
      ? rechnung.zahlungen.filter((z) =>
          typeof z.betrag === 'number' && Number.isFinite(z.betrag) && z.betrag > 0 && gueltigesDatum(z.datum))
      : [];

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
    const seitenBreite = 595.28;
    const seitenHoehe = 841.89;
    const rand = 48;
    let seite = pdf.addPage([seitenBreite, seitenHoehe]);
    let y = seitenHoehe - 55;
    const schwarz = rgb(0.13, 0.19, 0.29);
    const grau = rgb(0.36, 0.42, 0.50);
    const linie = rgb(0.82, 0.85, 0.89);
    const gruen = rgb(0.10, 0.42, 0.23);

    const schreiben = (inhalt: unknown, x: number, yy: number, groesse = 10, bold = false, farbe = schwarz) => {
      seite.drawText(pdfText(inhalt), { x, y: yy, size: groesse, font: bold ? fett : regular, color: farbe });
    };
    const rechts = (inhalt: unknown, yy: number, groesse = 10, bold = false) => {
      const text = pdfText(inhalt);
      const font = bold ? fett : regular;
      schreiben(text, seitenBreite - rand - font.widthOfTextAtSize(text, groesse), yy, groesse, bold);
    };
    const trennlinie = (yy: number) => seite.drawLine({
      start: { x: rand, y: yy }, end: { x: seitenBreite - rand, y: yy }, thickness: 0.7, color: linie
    });
    const neueSeite = () => {
      seite = pdf.addPage([seitenBreite, seitenHoehe]);
      y = seitenHoehe - 55;
      schreiben(vereinsname, rand, y, 12, true);
      rechts(`${dokumentName} ${rechnung.rechnungsnummer}`, y, 9);
      y -= 32;
    };
    const platz = (hoehe: number) => { if (y - hoehe < 75) neueSeite(); };

    y = await zeichneVereinsprofil(pdf, seite, aussteller, regular, fett, rand, y, seitenBreite - 2 * rand, pdfText);
    schreiben(bezeichnung, rand, y, 21, true);
    y -= 28;
    schreiben(`${dokumentName}snummer: ${rechnung.rechnungsnummer}`, rand, y, 10);
    y -= 17;
    schreiben(`Ausstellungsdatum: ${datum(new Date(rechnung.erstelltAm))}`, rand, y, 10);
    y -= 17;
    if (!vollBezahlt && !istStorniert) {
      const faellig = new Date(rechnung.erstelltAm);
      faellig.setDate(faellig.getDate() + 30);
      schreiben(`Zahlbar bis: ${datum(faellig)}`, rand, y, 10);
      y -= 17;
    }
    if (vollBezahlt) {
      schreiben('BEZAHLT', rand, y, 11, true, gruen);
      y -= 17;
    } else if (istStorniert) {
      schreiben('STORNIERT', rand, y, 11, true, grau);
      y -= 17;
    }
    y -= 20;
    schreiben(istQuittung ? 'Quittung fuer' : 'Rechnung an', rand, y, 10, true);
    y -= 18;
    schreiben(rechnung.empfaenger, rand, y, 12);
    y -= 18;
    if (rechnung.riegen?.length) {
      schreiben(`Riege: ${rechnung.riegen.join(', ')}`, rand, y, 9, false, grau);
      y -= 18;
    }
    y -= 24;

    const kopf = () => {
      platz(55);
      schreiben('Artikel / Groesse', rand, y, 10, true);
      schreiben('Menge', 320, y, 10, true);
      rechts('Betrag', y, 10, true);
      y -= 10;
      trennlinie(y);
      y -= 23;
    };
    kopf();
    const groessenIds = [...new Set(rechnung.positionen.map((p) => p.groesseId)
      .filter((id): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)))];
    const groessen = groessenIds.length
      ? await db.collection('groessen').find({
          _id: { $in: groessenIds.map((id) => new ObjectId(id)) }, vereinId
        }).toArray()
      : [];
    const groessenNamen = new Map(groessen.map((g: { _id: ObjectId; bezeichnung?: string }) =>
      [g._id.toString(), String(g.bezeichnung ?? '')]));

    for (const p of rechnung.positionen) {
      platz(47);
      const groesse = p.groesseId ? groessenNamen.get(p.groesseId) ?? 'Unbekannt' : 'Ohne Groesse';
      let name = pdfText(`${p.artikelname ?? 'Artikel'} (${groesse})`);
      while (regular.widthOfTextAtSize(name, 10) > 250 && name.length > 4) name = name.slice(0, -4) + '...';
      schreiben(name, rand, y, 10);
      schreiben(String(p.menge ?? 0), 330, y, 10);
      rechts(chf(Number(p.positionsbetrag ?? (p.menge ?? 0) * (p.einzelpreis ?? 0))), y, 10);
      y -= 16;
      schreiben(`${chf(Number(p.einzelpreis ?? 0))} pro Stueck`, rand, y, 8, false, grau);
      y -= 28;
    }

    platz(110);
    trennlinie(y + 6);
    y -= 20;
    schreiben('Zwischentotal', 315, y);
    rechts(chf(rechnung.zwischentotal), y);
    y -= 20;
    for (const rabatt of rechnung.rabatte ?? []) {
      platz(24);
      schreiben(pdfText(rabatt.name).slice(0, 28), 315, y, 9);
      rechts(`- ${chf(rabatt.betrag)}`, y, 9);
      y -= 20;
    }
    if ((rechnung.zusaetzlicherRabatt ?? 0) > 0) {
      platz(24);
      schreiben('Weiterer Rabatt', 315, y, 9);
      rechts(`- ${chf(rechnung.zusaetzlicherRabatt ?? 0)}`, y, 9);
      y -= 20;
    }
    platz(40);
    trennlinie(y + 7);
    y -= 17;
    schreiben('Originaltotal', 315, y, 13, true);
    rechts(chf(rechnung.gesamtbetrag), y, 13, true);
    y -= 25;
    if (gutgeschriebenRappen > 0) {
      platz(45);
      schreiben('Gutschriften', 315, y, 10);
      rechts(`- ${chf(gutgeschriebenRappen / 100)}`, y, 10);
      y -= 22;
      schreiben('Korrigiertes Total', 315, y, 11, true);
      rechts(chf(nettoRappen / 100), y, 11, true);
      y -= 24;
    } else {
      y -= 8;
    }

    // Zahlungseingänge werden ausschliesslich angezeigt, nicht neu gebucht.
    if (zahlungen.length > 0) {
      platz(55);
      schreiben('Erhaltene Zahlungen', rand, y, 11, true);
      y -= 21;
      for (const zahlung of zahlungen) {
        platz(20);
        const zahlungsdatum = gueltigesDatum(zahlung.datum);
        schreiben(`${zahlungsdatum ? datum(zahlungsdatum) : '-'}  ${zahlungsartText(zahlung.zahlungsart)}`, rand, y, 9);
        rechts(chf(zahlung.betrag), y, 9);
        y -= 19;
      }
      y -= 8;
    } else if (vollBezahlt && gesamtRappen > 0) {
      platz(38);
      schreiben(`Zahlungsart: ${zahlungsartText(rechnung.zahlungsart)}`, rand, y, 10);
      y -= 23;
    }

    platz(62);
    trennlinie(y + 8);
    y -= 18;
    schreiben('Bereits bezahlt', 315, y, 10);
    rechts(chf(bezahltRappen / 100), y, 10);
    y -= 21;
    schreiben('Noch offen', 315, y, 11, true);
    rechts(chf(offenRappen / 100), y, 11, true);
    y -= 22;
    if (rueckerstattungRappen > 0) {
      platz(30);
      schreiben('Rueckerstattung offen', 315, y, 10, true);
      rechts(chf(rueckerstattungRappen / 100), y, 10, true);
      y -= 22;
    }
    y -= 17;

    if (istStorniert) {
      platz(25);
      schreiben('Dieses Dokument wurde storniert.', rand, y, 10, true, grau);
    } else if (rueckerstattungRappen > 0) {
      platz(40);
      schreiben('Eine Rueckerstattung ist noch offen.', rand, y, 10, true, grau);
    } else if (vollBezahlt) {
      platz(40);
      schreiben('Vielen Dank. Der Betrag wurde vollstaendig bezahlt.', rand, y, 10, true, gruen);
      if (istQuittung) {
        y -= 19;
        schreiben('Diese Quittung bestaetigt den erhaltenen Zahlungseingang.', rand, y, 9, false, grau);
      }
    } else {
      platz(80);
      schreiben('Zahlungsinformationen', rand, y, 11, true);
      y -= 19;
      schreiben(`Bitte den offenen Betrag von ${chf(offenRappen / 100)} begleichen.`, rand, y, 9);
      y -= 17;
      schreiben(`Referenz: ${rechnung.rechnungsnummer}`, rand, y, 9);
      y -= 17;
      schreiben('Bankverbindung / QR-Zahlteil sind noch nicht konfiguriert.', rand, y, 9, false, grau);
    }

    const bytes = await pdf.save();
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${dokumentName}-${rechnung.rechnungsnummer}.pdf"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (fehler) {
    console.error('Rechnungs-/Quittungs-PDF erstellen:', fehler);
    return json({ fehler: 'PDF konnte nicht erstellt werden.' }, { status: 500 });
  }
};
