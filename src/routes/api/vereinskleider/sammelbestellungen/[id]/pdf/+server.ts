import { error, type RequestHandler } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { db } from '../../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../../lib/server/berechtigungen';

type Position = { artikelId: string; groesseId: string | null; artikelname: string; menge: number };
type Bestellung = {
  vereinId: string;
  lieferantId?: string | null;
  lieferantName?: string | null;
  status: 'entwurf' | 'bestellt' | 'geliefert';
  positionen: Position[];
  bemerkung?: string;
  erstelltAm: Date;
  bestelltAm?: Date;
};

const sauber = (wert: unknown): string => String(wert ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
const pdfText = (wert: unknown): string => sauber(wert).replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '?');
const datum = (wert: Date): string => new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeZone: 'Europe/Zurich' }).format(wert);

export const GET: RequestHandler = async ({ params, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  if (!params.id || !/^[a-f\d]{24}$/i.test(params.id)) throw error(400, 'Ungültige Bestell-ID.');
  const vereinId = locals.benutzer!.vereinId;

  try {
    const bestellung = await db.collection<Bestellung>('vereinskleider_sammelbestellungen')
      .findOne({ _id: new ObjectId(params.id), vereinId });
    if (!bestellung) throw error(404, 'Sammelbestellung nicht gefunden.');
    if (!Array.isArray(bestellung.positionen) || bestellung.positionen.length === 0) {
      throw error(409, 'Diese Sammelbestellung enthält keine Positionen.');
    }

    const groesseIds = [...new Set(bestellung.positionen.map((p) => p.groesseId)
      .filter((id): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)))];
    const [groessen, lieferant, verein] = await Promise.all([
      groesseIds.length
        ? db.collection('groessen').find({ vereinId, _id: { $in: groesseIds.map((id) => new ObjectId(id)) } })
            .project({ bezeichnung: 1 }).toArray()
        : Promise.resolve([]),
      bestellung.lieferantId && /^[a-f\d]{24}$/i.test(bestellung.lieferantId)
        ? db.collection('lieferanten').findOne({ _id: new ObjectId(bestellung.lieferantId), vereinId })
        : Promise.resolve(null),
      // Vereinsstammdaten: üblicherweise in der Collection "vereine".
      // Unterstützt sowohl ObjectId als auch String als _id.
      /^[a-f\d]{24}$/i.test(vereinId)
        ? db.collection('vereine').findOne({ _id: new ObjectId(vereinId) })
        : db.collection('vereine').findOne({ vereinId })
    ]);
    const groessenNamen = new Map(groessen.map((g) => [g._id.toString(), String(g.bezeichnung ?? '')]));
    const lieferantName = sauber(lieferant?.name ?? bestellung.lieferantName) || 'Lieferant nicht hinterlegt';
    const vereinsname = sauber(verein?.name ?? verein?.vereinsname ?? verein?.bezeichnung) || 'Vereinsname nicht hinterlegt';

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Bestellung ${bestellung._id.toString().slice(-8)} - ${lieferantName}`);
    pdf.setCreator('ClubMatiq');
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
    const blau = rgb(0.10, 0.20, 0.36);
    const grau = rgb(0.39, 0.44, 0.51);
    const linie = rgb(0.84, 0.88, 0.92);
    const breite = 595.28;
    const hoehe = 841.89;
    const rand = 45;
    let seite: PDFPage = pdf.addPage([breite, hoehe]);
    let ersteSeite = true;
    let y = 0;

    function neueSeite(): void {
      if (!ersteSeite) seite = pdf.addPage([breite, hoehe]);
      ersteSeite = false;
      y = hoehe - 52;
      seite.drawText('ClubMatiq  |  LIEFERANTENBESTELLUNG', { x: rand, y, size: 10, font: fett, color: blau });
      y -= 17;
      seite.drawLine({ start: { x: rand, y }, end: { x: breite - rand, y }, thickness: 1, color: linie });
      y -= 32;
    }
    function umbrechen(wert: unknown, font: PDFFont, groesse: number, maxBreite: number): string[] {
      const woerter = pdfText(wert).split(/\s+/).filter(Boolean);
      const zeilen: string[] = [];
      let zeile = '';
      for (let wort of woerter) {
        while (font.widthOfTextAtSize(wort, groesse) > maxBreite && wort.length > 1) {
          if (zeile) { zeilen.push(zeile); zeile = ''; }
          let n = 1;
          while (n < wort.length && font.widthOfTextAtSize(wort.slice(0, n + 1), groesse) <= maxBreite) n++;
          zeilen.push(wort.slice(0, n));
          wort = wort.slice(n);
        }
        const probe = zeile ? `${zeile} ${wort}` : wort;
        if (zeile && font.widthOfTextAtSize(probe, groesse) > maxBreite) {
          zeilen.push(zeile);
          zeile = wort;
        } else zeile = probe;
      }
      if (zeile) zeilen.push(zeile);
      return zeilen.length ? zeilen : ['-'];
    }
    function zeile(wert: unknown, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}): void {
      const font = opts.bold ? fett : normal;
      const size = opts.size ?? 10;
      const lines = umbrechen(wert, font, size, breite - 2 * rand);
      if (y - lines.length * (size + 5) < 65) neueSeite();
      for (const t of lines) {
        seite.drawText(t, { x: rand, y, size, font, color: opts.color ?? blau });
        y -= size + 5;
      }
      y -= 5;
    }

    neueSeite();
    zeile('Bestellung', { bold: true, size: 22 });
    zeile(vereinsname, { bold: true, size: 13 });
    y -= 5;
    zeile(`Bestellnummer: ${bestellung._id.toString().slice(-8).toUpperCase()}`);
    zeile(`Lieferant: ${lieferantName}`, { bold: true });
    zeile(`Datum: ${datum(bestellung.bestelltAm ?? bestellung.erstelltAm)}`);
    y -= 13;

    const positionen = [...bestellung.positionen].sort((a, b) =>
      a.artikelname.localeCompare(b.artikelname, 'de-CH') ||
      String(a.groesseId ?? '').localeCompare(String(b.groesseId ?? '')));
    function tabellenKopf(): void {
      seite.drawText('Artikel', { x: rand, y, size: 9, font: fett, color: grau });
      seite.drawText('Grösse', { x: 365, y, size: 9, font: fett, color: grau });
      seite.drawText('Menge', { x: 495, y, size: 9, font: fett, color: grau });
      y -= 11;
      seite.drawLine({ start: { x: rand, y }, end: { x: breite - rand, y }, thickness: 1, color: linie });
      y -= 17;
    }
    tabellenKopf();
    let gesamt = 0;
    for (const p of positionen) {
      const menge = Number(p.menge);
      if (!Number.isSafeInteger(menge) || menge < 1) throw error(409, 'Ungültige Bestellmenge.');
      gesamt += menge;
      const artikelZeilen = umbrechen(p.artikelname, normal, 10, 300);
      const groesse = p.groesseId === null ? '-' : (groessenNamen.get(p.groesseId) ?? 'Unbekannt');
      const groessenZeilen = umbrechen(groesse, normal, 10, 105);
      const hoeheZeile = Math.max(artikelZeilen.length, groessenZeilen.length) * 15 + 12;
      if (y - hoeheZeile < 90) { neueSeite(); tabellenKopf(); }
      artikelZeilen.forEach((t, i) => seite.drawText(t, { x: rand, y: y - i * 15, size: 10, font: normal, color: blau }));
      groessenZeilen.forEach((t, i) => seite.drawText(t, { x: 365, y: y - i * 15, size: 10, font: normal, color: blau }));
      seite.drawText(String(menge), { x: 495, y, size: 10, font: fett, color: blau });
      y -= hoeheZeile;
      seite.drawLine({ start: { x: rand, y: y + 16 }, end: { x: breite - rand, y: y + 16 }, thickness: 0.5, color: linie });
    }
    if (y < 110) neueSeite();
    y -= 8;
    zeile(`Total: ${gesamt} Stück`, { bold: true, size: 12 });
    if (bestellung.bemerkung?.trim()) {
      y -= 10;
      zeile('Bemerkung', { bold: true, size: 11 });
      zeile(bestellung.bemerkung);
    }
    const bytes = await pdf.save();
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bestellung-${bestellung._id.toString().slice(-8)}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Bestell-PDF erstellen:', err);
    throw error(500, 'Bestell-PDF konnte nicht erstellt werden.');
  }
};
