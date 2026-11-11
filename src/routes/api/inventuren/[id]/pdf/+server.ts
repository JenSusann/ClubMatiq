import { error, type RequestHandler } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';

const datum = (wert: unknown): string => {
  if (!wert) return '–';
  const d = new Date(wert instanceof Date ? wert.getTime() : String(wert));
  return Number.isNaN(d.getTime()) ? '–' : new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Zurich' }).format(d);
};
const zahl = (wert: unknown) => typeof wert === 'number' ? String(wert) : '–';
const vorzeichen = (wert: unknown) => typeof wert === 'number' ? `${wert > 0 ? '+' : ''}${wert}` : '–';
const sicher = (wert: unknown) => String(wert ?? '–').replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ');

export const GET: RequestHandler = async ({ params, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'inventur:lesen');
  if (berechtigungsfehler) return berechtigungsfehler;
  if (!params.id || !ObjectId.isValid(params.id)) {  throw error(400, 'Ungültige Inventur-ID.');    }
  const vereinId = locals.benutzer!.vereinId;
  const inventurId = params.id;

  try {
    const inventur = await db.collection('inventuren').findOne({ _id: new ObjectId(inventurId), vereinId });
    if (!inventur) throw error(404, 'Inventur nicht gefunden.');
    const [positionen, protokoll] = await Promise.all([
      db.collection('inventurpositionen').find({ vereinId, inventurId }).sort({ artikelName: 1, groesseId: 1 }).toArray(),
      db.collection('inventurprotokoll').find({ vereinId, inventurId }).sort({ ausgefuehrtAm: 1, _id: 1 }).toArray()
    ]);
    const ids = [...new Set([inventur.erstelltVon, inventur.abgeschlossenVon, inventur.storniertVon, ...protokoll.map(p => p.ausgefuehrtVon)].filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id)))];
    const personen = ids.length ? await db.collection('benutzer').find({ vereinId, _id: { $in: ids.map(id => new ObjectId(id)) } }).project({ vorname: 1, nachname: 1 }).toArray() : [];
    const namen = new Map(personen.map(p => [p._id.toString(), [p.vorname, p.nachname].filter(Boolean).join(' ')]));
    const name = (id: unknown) => namen.get(String(id ?? '')) || 'Unbekannter Benutzer';
    const abschluss = protokoll.find(p => p.aktion === 'abgeschlossen' && Array.isArray(p.positionen));
    const original = new Map<string, Record<string, unknown>>((abschluss?.positionen ?? []).map((p: Record<string, unknown>) => [String(p.positionId), p]));
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Inventurbericht – ${sicher(inventur.name)}`);
    pdf.setCreator('ClubMatiq');
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
    const blau = rgb(0.09, 0.17, 0.30);
    const grau = rgb(0.39, 0.45, 0.53);
    const breite = 595.28, hoehe = 841.89, rand = 43;
    let seite: PDFPage;
    let y = 0;
    const neueSeite = () => {
      seite = pdf.addPage([breite, hoehe]); y = hoehe - 46;
      seite.drawText('ClubMatiq  /  INVENTURBERICHT', { x: rand, y, size: 10, font: fett, color: blau });
      seite.drawLine({ start: { x: rand, y: y - 10 }, end: { x: breite - rand, y: y - 10 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
      y -= 35;
    };
    const fit = (t: unknown) => sicher(t).replace(/[^\x20-\x7e\u00a0-\u00ff\u2013\u2014]/g, '?').replace(/[\u2013\u2014]/g, '-');
    const zeilen = (t: unknown, font: PDFFont, size: number, max: number): string[] => {
      const woerter = fit(t).split(/\s+/);
      const out: string[] = []; let aktuell = '';
      for (let wort of woerter) {
        while (font.widthOfTextAtSize(wort, size) > max && wort.length > 1) {
          let n = 1;
          while (n < wort.length && font.widthOfTextAtSize(wort.slice(0, n + 1), size) <= max) n++;
          if (aktuell) { out.push(aktuell); aktuell = ''; }
          out.push(wort.slice(0, n)); wort = wort.slice(n);
        }
        const kandidat = aktuell ? `${aktuell} ${wort}` : wort;
        if (font.widthOfTextAtSize(kandidat, size) > max && aktuell) { out.push(aktuell); aktuell = wort; }
        else aktuell = kandidat;
      }
      if (aktuell) out.push(aktuell);
      return out.length ? out : ['–'];
    };
    const platz = (h: number) => { if (y - h < 55) neueSeite(); };
    const text = (t: unknown, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; indent?: number } = {}) => {
      const font = opts.bold ? fett : normal; const size = opts.size ?? 10;
      const links = rand + (opts.indent ?? 0);
      const lines = zeilen(t, font, size, breite - rand - links);
      platz(lines.length * (size + 4) + 4);
      for (const line of lines) { seite.drawText(line, { x: links, y, size, font, color: opts.color ?? blau }); y -= size + 4; }
      y -= 4;
    };
    const titel = (t: string) => { platz(36); y -= 10; text(t, { bold: true, size: 14 }); };
    neueSeite();
    text(inventur.name ?? 'Inventur', { bold: true, size: 19 });
    text(`Status: ${sicher(inventur.status)}  |  Typ: ${sicher(inventur.typ)}  |  Lagerort: ${sicher(inventur.lagerortName ?? 'Alle')}`, { color: grau });
    text(`Erstellt: ${datum(inventur.erstelltAm)} (${name(inventur.erstelltVon)})`);
    if (inventur.abgeschlossenAm) text(`Abgeschlossen: ${datum(inventur.abgeschlossenAm)} (${name(inventur.abgeschlossenVon)})`);
    if (inventur.storniertAm) text(`Storniert: ${datum(inventur.storniertAm)} (${name(inventur.storniertVon)})`);
    if (inventur.stornierungsgrund) text(`Stornierungsgrund: ${inventur.stornierungsgrund}`);
    text(`Bericht erstellt: ${datum(new Date())}`, { color: grau });

    titel('Zusammenfassung');
    const abweichungen = positionen.filter(p => typeof p.istBestand === 'number' && p.istBestand !== p.sollBestand).length;
    text(`${positionen.length} Positionen  |  ${abweichungen} aktuelle Abweichungen  |  ${positionen.filter(p => p.istBestand === null).length} ungezählt`);
    if (inventur.status === 'storniert') text('Hinweis: Diese Inventur wurde storniert. Die angezeigten Differenzen sind keine aktuell wirksamen Inventurbuchungen.', { bold: true });
    if (!abschluss) text('Hinweis: Kein ursprünglicher Abschluss-Snapshot vorhanden. Ursprüngliche Abschlusswerte sind nicht rekonstruierbar.', { color: grau });

    titel('Bestandsübersicht');
    text('Pro Position: Soll / ursprünglicher Abschluss-Ist / aktueller Ist / Differenz zum Soll', { color: grau, size: 9 });
    for (const p of positionen) {
      const alt = original.get(p._id.toString());
      const istAlt = alt ? alt.istBestand : undefined;
      platz(46);
      text(`${p.artikelName ?? 'Unbekannter Artikel'}${p.groesseId ? `  |  Grösse-ID: ${p.groesseId}` : ''}`, { bold: true });
      text(`Soll ${zahl(p.sollBestand)}    Abschluss-Ist ${zahl(istAlt)}    Aktuell-Ist ${zahl(p.istBestand)}    Differenz ${vorzeichen(typeof p.istBestand === 'number' ? p.istBestand - p.sollBestand : null)}`, { size: 9, indent: 8 });
      if (p.bemerkung) text(`Bemerkung: ${p.bemerkung}`, { size: 9, indent: 8, color: grau });
    }

    titel('Protokoll und nachträgliche Korrekturen');
    if (!protokoll.length) text('Keine Protokolleinträge vorhanden.');
    for (const p of protokoll) {
      platz(46);
      text(`${datum(p.ausgefuehrtAm)}  |  ${sicher(p.aktion)}  |  ${name(p.ausgefuehrtVon)}`, { bold: true });
      if (p.aktion === 'nachtraeglich_korrigiert') {
        const pos = positionen.find(x => x._id.toString() === String(p.positionId));
        text(`${pos?.artikelName ?? 'Unbekannter Artikel'}: ${zahl(p.alterIstBestand)} -> ${zahl(p.neuerIstBestand)} (${vorzeichen(p.differenz)} Stück)`, { indent: 8 });
      }
      if (p.aktion === 'abgeschlossen') text(`Abschluss: ${zahl(p.anzahlKorrekturen)} Bestandskorrekturen`, { indent: 8 });
      if (p.aktion === 'storniert') text(`Vorheriger Status: ${sicher(p.statusVorher)}; Rückbuchungen: ${zahl(p.anzahlRueckbuchungen)}`, { indent: 8 });
      if (p.begruendung) text(`Begründung: ${p.begruendung}`, { indent: 8 });
    }
    const bytes = await pdf.save();
    const dateiname = `inventurbericht-${inventurId}.pdf`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${dateiname}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Inventur-PDF erstellen:', err);
    throw error(500, 'Inventurbericht konnte nicht erstellt werden.');
  }
};
