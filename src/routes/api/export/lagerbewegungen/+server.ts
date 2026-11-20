import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { erstelleLagerjournalExcel, leseJournalFilter } from '../../../../lib/server/lagerjournal-export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'inventar:lesen');
  if (fehler) return fehler;
  try {
    const { filter } = leseJournalFilter(url);
    if (typeof filter.artikelId === 'string') {
      const artikel = await db.collection('artikel').findOne({ _id: new ObjectId(filter.artikelId), vereinId: locals.benutzer!.vereinId }, { projection: { _id: 1 } });
      if (!artikel) return json({ fehler: 'Artikel nicht gefunden.' }, { status: 404 });
    }
    const datei = await erstelleLagerjournalExcel(locals.benutzer!.vereinId, url);
    const dateiname = 'clubmatiq-lagerbewegungen-' + new Date().toISOString().slice(0, 10) + '.xlsx';
    return new Response(new Uint8Array(datei), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="' + dateiname + '"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    if (error instanceof Error && /^(Ungültig|Suchbegriff)/.test(error.message)) return json({ fehler: error.message }, { status: 400 });
    console.error('Lagerjournal-Excel-Export:', error instanceof Error ? error.name : 'Unbekannter Fehler');
    return json({ fehler: 'Excel-Export konnte nicht erstellt werden.' }, { status: 500 });
  }
};
