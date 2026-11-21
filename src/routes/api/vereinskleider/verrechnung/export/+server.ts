import { json } from '@sveltejs/kit';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

const geld = (wert: unknown): number => {
  if (typeof wert !== 'number' || !Number.isFinite(wert) || wert < 0 ||
      !Number.isSafeInteger(Math.round(wert * 100)) ||
      Math.abs(wert * 100 - Math.round(wert * 100)) > 0.000001) {
    throw new Error('Ungültiger Rechnungsbetrag.');
  }
  return Math.round(wert * 100);
};
const feld = (wert: unknown): string => {
  const text = String(wert ?? '');
  return '"' + text.replace(/"/g, '""') + '"';
};

/**
 * Kontroll-CSV für die Buchhaltung: jede ausgestellte Rechnung erhält eine
 * eigene Zeile, auch wenn mehrere Teilrechnungen zum selben Verkauf gehören.
 * Kein ClubDesk-Importformat: ein Mapping muss separat festgelegt werden.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  try {
    const rechnungen = await db.collection('vereinskleider_rechnungen')
      .find({ vereinId: locals.benutzer!.vereinId })
      .sort({ erstelltAm: -1 }).limit(10001).toArray();
    if (rechnungen.length > 10000) {
      return json({ fehler: 'Mehr als 10000 Rechnungen vorhanden. Export bitte eingrenzen.' }, { status: 409 });
    }
    const zeilen = [[
      'Rechnungsnummer', 'Verkaufs-ID', 'Rechnungs-ID', 'Teilrechnung',
      'Datum', 'Empfaenger', 'Status', 'Original CHF', 'Gutschriften CHF',
      'Netto CHF', 'Bezahlt CHF', 'Offen CHF', 'Rueckerstattung offen CHF', 'Rueckerstattet CHF'
    ].map(feld).join(';')];
    for (const r of rechnungen) {
      const gesamt = geld(r.gesamtbetrag);
      const gutschriften = geld(r.gutgeschriebenBetrag ?? 0);
      const bezahlt = geld(r.bezahltBetrag ?? 0);
      if (gutschriften > gesamt || bezahlt > gesamt) throw new Error('Inkonsistente Rechnungsbeträge.');
      const netto = gesamt - gutschriften;
      const euro = (rappen: number) => (rappen / 100).toFixed(2).replace('.', ',');
      const erstellt = new Date(r.erstelltAm);
      if (Number.isNaN(erstellt.getTime())) throw new Error('Ungültiges Rechnungsdatum.');
      const rueckerstattungOffen = geld(r.rueckerstattungOffen ?? Math.max(0, bezahlt - netto));
      if (rueckerstattungOffen > Math.max(0, bezahlt - netto)) throw new Error('Inkonsistente Rückerstattung.');
      zeilen.push([
        r.rechnungsnummer, r.verkaufId, r._id.toString(),
        r.rechnungstranche === true ? 'Ja' : 'Nein', erstellt.toISOString().slice(0, 10),
        r.empfaenger, r.status, euro(gesamt), euro(gutschriften),
        euro(netto), euro(bezahlt), euro(Math.max(0, netto - bezahlt)),
        euro(rueckerstattungOffen), euro(Math.max(0, bezahlt - netto) - rueckerstattungOffen)
      ].map(feld).join(';'));
    }
    return new Response('\uFEFF' + zeilen.join('\r\n') + '\r\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ClubMatiq_Rechnungsabgleich.csv"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (fehler) {
    console.error('Rechnungsabgleich exportieren:', fehler);
    return json({ fehler: 'Rechnungsabgleich konnte nicht exportiert werden.' }, { status: 500 });
  }
};
