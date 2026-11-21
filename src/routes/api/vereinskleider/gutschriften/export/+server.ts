import { json } from '@sveltejs/kit';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

const rappen = (wert: unknown): number => {
  if (typeof wert !== 'number' || !Number.isFinite(wert) || wert < 0 ||
      !Number.isSafeInteger(Math.round(wert * 100)) ||
      Math.abs(wert * 100 - Math.round(wert * 100)) > 0.000001) {
    throw new Error('Ungültiger Gutschriftbetrag.');
  }
  return Math.round(wert * 100);
};
const feld = (wert: unknown) => '"' + String(wert ?? '').replace(/"/g, '""') + '"';
const chf = (wert: number) => (wert / 100).toFixed(2).replace('.', ',');

/** Buchhaltungs-Kontrollauszug, KEIN bestätigter ClubDesk-Import. */
export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const vereinId = locals.benutzer!.vereinId;
  try {
    const gutschriften = await db.collection('vereinskleider_gutschriften')
      .find({ vereinId }).sort({ erstelltAm: -1 }).limit(10001).toArray();
    if (gutschriften.length > 10000) {
      return json({ fehler: 'Mehr als 10000 Gutschriften vorhanden. Export bitte eingrenzen.' }, { status: 409 });
    }
    const ids = gutschriften.map((g) => g.rechnungId);
    if (ids.some((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))) {
      return json({ fehler: 'Mindestens eine Gutschrift hat keine gültige Rechnungsreferenz.' }, { status: 409 });
    }
    const { ObjectId } = await import('mongodb');
    const rechnungen = await db.collection('vereinskleider_rechnungen')
      .find({ vereinId, _id: { $in: [...new Set(ids)].map((id) => new ObjectId(id)) } }).toArray();
    const nachId = new Map(rechnungen.map((rechnung) => [rechnung._id.toString(), rechnung]));
    const zeilen = [[
      'Gutschrift-ID', 'Gutschriftnummer', 'Rechnungs-ID', 'Rechnungsnummer',
      'Verkaufs-ID', 'Retouren-ID', 'Datum', 'Artikel', 'Menge', 'Grund',
      'Gutschrift CHF', 'Rueckerstattet CHF', 'Rueckerstattung offen CHF',
      'ClubDesk Exportstatus'
    ].map(feld).join(';')];
    for (const g of gutschriften) {
      const rechnung = nachId.get(g.rechnungId);
      if (!rechnung || rechnung.rechnungsnummer !== g.rechnungsnummer) {
        return json({ fehler: 'Gutschrift und Rechnung sind nicht eindeutig zugeordnet.' }, { status: 409 });
      }
      const betrag = rappen(g.betrag);
      const ausbezahlt = rappen(g.rueckerstattetBetrag ?? 0);
      if (ausbezahlt > betrag) {
        return json({ fehler: 'Rückerstattung übersteigt Gutschriftbetrag.' }, { status: 409 });
      }
      const datum = new Date(g.erstelltAm);
      if (Number.isNaN(datum.getTime())) {
        return json({ fehler: 'Ungültiges Gutschriftdatum.' }, { status: 409 });
      }
      zeilen.push([
        g._id.toString(), g.gutschriftnummer, g.rechnungId, g.rechnungsnummer,
        g.verkaufId, g.retourId ?? '', datum.toISOString().slice(0, 10),
        g.artikelname, g.menge, g.grund, chf(betrag), chf(ausbezahlt),
        chf(betrag - ausbezahlt), g.clubdeskExportStatus ?? 'nicht_exportiert'
      ].map(feld).join(';'));
    }
    return new Response('\\uFEFF' + zeilen.join('\\r\\n') + '\\r\\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ClubMatiq_Gutschriftenabgleich.csv"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    console.error('Gutschriftenabgleich exportieren:', e);
    return json({ fehler: 'Gutschriftenabgleich konnte nicht exportiert werden.' }, { status: 500 });
  }
};
