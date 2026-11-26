import { error, type RequestHandler } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';

type Position = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
};
type Bestellung = {
  vereinId: string;
  lieferantId?: string | null;
  lieferantName?: string | null;
  status: 'entwurf' | 'bestellt' | 'geliefert';
  positionen: Position[];
  erstelltAm: Date;
};

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[a-f\d]{24}$/i.test(wert);
}
function pdfText(wert: unknown): string {
  return String(wert ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '?').trim();
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) throw error(400, 'Ungültige Eingabe.');
  const ids = (eingabe as Record<string, unknown>).bestellungIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || !ids.every(gueltigeId))
    throw error(400, 'Bitte 1 bis 50 gültige Bestellungen auswählen.');
  const eindeutig = [...new Set(ids as string[])];
  if (eindeutig.length !== ids.length) throw error(400, 'Bestellungen dürfen nicht doppelt ausgewählt werden.');

  const vereinId = locals.benutzer!.vereinId;
  try {
    const bestellungen = await db.collection<Bestellung>('vereinskleider_sammelbestellungen')
      .find({ vereinId, _id: { $in: eindeutig.map((id) => new ObjectId(id)) } }).toArray();
    if (bestellungen.length !== eindeutig.length) throw error(404, 'Mindestens eine Bestellung wurde nicht gefunden.');
    const lieferantIds = new Set(bestellungen.map((b) => b.lieferantId ?? ''));
    if (lieferantIds.size !== 1 || !bestellungen[0].lieferantId || !gueltigeId(bestellungen[0].lieferantId))
      throw error(409, 'Für eine Gesamt-PDF müssen alle Bestellungen denselben gültigen Lieferanten haben.');

    const lieferant = await db.collection('lieferanten').findOne({ vereinId, _id: new ObjectId(bestellungen[0].lieferantId) });
    if (!lieferant) throw error(409, 'Der Lieferant ist nicht mehr verfügbar.');
    const lieferantName = pdfText(lieferant.name) || 'Unbekannter Lieferant';
    // Vereinsnamen aus den Stammdaten lesen (wie beim Einzel-PDF).
    const verein = gueltigeId(vereinId)
      ? await db.collection('vereine').findOne({ _id: new ObjectId(vereinId) })
      : await db.collection('vereine').findOne({ vereinId });
    const vereinsname = pdfText(verein?.name ?? verein?.vereinsname ?? verein?.bezeichnung)
      || 'Vereinsname nicht hinterlegt';
    const groesseIds = [...new Set(bestellungen.flatMap((b) => b.positionen ?? [])
      .map((p) => p.groesseId).filter((id): id is string => gueltigeId(id)))];
    const groessen = groesseIds.length ? await db.collection('groessen')
      .find({ vereinId, _id: { $in: groesseIds.map((id) => new ObjectId(id)) } })
      .project({ bezeichnung: 1 }).toArray() : [];
    const groessenNamen = new Map(groessen.map((g) => [g._id.toString(), pdfText(g.bezeichnung)]));

    const gruppiert = new Map<string, Position>();
    for (const bestellung of bestellungen) {
      if (!Array.isArray(bestellung.positionen) || bestellung.positionen.length === 0)
        throw error(409, 'Eine ausgewählte Bestellung enthält keine Positionen.');
      for (const p of bestellung.positionen) {
        if (!gueltigeId(p.artikelId) || (p.groesseId !== null && !gueltigeId(p.groesseId)) ||
          !Number.isSafeInteger(p.menge) || p.menge < 1)
          throw error(409, 'Eine ausgewählte Bestellung enthält ungültige Positionen.');
        const key = `${p.artikelId}:${p.groesseId ?? ''}`;
        const bisher = gruppiert.get(key);
        if (bisher) {
          if (!Number.isSafeInteger(bisher.menge + p.menge)) throw error(409, 'Bestellmenge zu gross.');
          bisher.menge += p.menge;
        } else gruppiert.set(key, { ...p });
      }
    }
    const positionen = [...gruppiert.values()].sort((a, b) =>
      a.artikelname.localeCompare(b.artikelname, 'de-CH') ||
      (groessenNamen.get(a.groesseId ?? '') ?? '').localeCompare(groessenNamen.get(b.groesseId ?? '') ?? '', 'de-CH'));

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Bestellübersicht - ${vereinsname} - ${lieferantName}`);
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
      seite.drawText('ClubMatiq  |  BESTELLÜBERSICHT', { x: rand, y, size: 10, font: fett, color: blau });
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
        if (zeile && font.widthOfTextAtSize(probe, groesse) > maxBreite) { zeilen.push(zeile); zeile = wort; }
        else zeile = probe;
      }
      if (zeile) zeilen.push(zeile);
      return zeilen.length ? zeilen : ['-'];
    }
    function textzeile(wert: unknown, bold = false, size = 10): void {
      const font = bold ? fett : normal;
      const zeilen = umbrechen(wert, font, size, breite - 2 * rand);
      if (y - zeilen.length * (size + 5) < 65) neueSeite();
      for (const t of zeilen) { seite.drawText(t, { x: rand, y, size, font, color: blau }); y -= size + 5; }
      y -= 5;
    }
    function tabellenKopf(): void {
      seite.drawText('Artikel', { x: rand, y, size: 9, font: fett, color: grau });
      seite.drawText('Grösse', { x: 365, y, size: 9, font: fett, color: grau });
      seite.drawText('Menge', { x: 495, y, size: 9, font: fett, color: grau });
      y -= 11;
      seite.drawLine({ start: { x: rand, y }, end: { x: breite - rand, y }, thickness: 1, color: linie });
      y -= 17;
    }
    neueSeite();
    textzeile('Bestellübersicht', true, 22);
    textzeile(`Verein: ${vereinsname}`, true);
    textzeile(`Lieferant: ${lieferantName}`, true);
    textzeile(`Enthaltene Bestellungen: ${eindeutig.map((id) => id.slice(-8).toUpperCase()).join(', ')}`);
    textzeile(`Erstellt am: ${new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeZone: 'Europe/Zurich' }).format(new Date())}`);
    y -= 13;
    tabellenKopf();
    let gesamt = 0;
    for (const p of positionen) {
      gesamt += p.menge;
      const artikelZeilen = umbrechen(p.artikelname, normal, 10, 300);
      const groesse = p.groesseId === null ? '-' : (groessenNamen.get(p.groesseId) ?? 'Unbekannt');
      const groessenZeilen = umbrechen(groesse, normal, 10, 105);
      const zeilenHoehe = Math.max(artikelZeilen.length, groessenZeilen.length) * 15 + 12;
      if (y - zeilenHoehe < 90) { neueSeite(); tabellenKopf(); }
      artikelZeilen.forEach((t, i) => seite.drawText(t, { x: rand, y: y - i * 15, size: 10, font: normal, color: blau }));
      groessenZeilen.forEach((t, i) => seite.drawText(t, { x: 365, y: y - i * 15, size: 10, font: normal, color: blau }));
      seite.drawText(String(p.menge), { x: 495, y, size: 10, font: fett, color: blau });
      y -= zeilenHoehe;
      seite.drawLine({ start: { x: rand, y: y + 16 }, end: { x: breite - rand, y: y + 16 }, thickness: 0.5, color: linie });
    }
    if (y < 110) neueSeite();
    y -= 8;
    textzeile(`Total: ${gesamt} Stück`, true, 12);
    const bytes = await pdf.save();
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="sammelbestellungen-lieferant.pdf"',
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Gesamt-PDF erstellen:', err);
    throw error(500, 'Gesamt-PDF konnte nicht erstellt werden.');
  }
};
