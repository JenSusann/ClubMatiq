import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

const arten = ['anlage', 'ausleihe', 'rueckgabe', 'inventur', 'verkauf', 'wareneingang', 'korrektur', 'storno'];

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'inventar:lesen');
  if (fehler) return fehler;
  if (!ObjectId.isValid(params.id)) return json({ fehler: 'Ungültige Artikel-ID.' }, { status: 400 });
  const vereinId = locals.benutzer!.vereinId;
  const art = url.searchParams.get('art');
  if (art && !arten.includes(art)) return json({ fehler: 'Ungültiger Bewegungstyp.' }, { status: 400 });
  const von = url.searchParams.get('von');
  const bis = url.searchParams.get('bis');
  const datum = (wert: string | null) => !wert || /^\d{4}-\d{2}-\d{2}$/.test(wert) && !Number.isNaN(Date.parse(wert)) && new Date(wert).toISOString().slice(0, 10) === wert;
  if (!datum(von) || !datum(bis) || (von && bis && von > bis)) return json({ fehler: 'Ungültiger Zeitraum.' }, { status: 400 });
  try {
    const artikel = await db.collection('artikel').findOne({ _id: new ObjectId(params.id), vereinId }, { projection: { _id: 1 } });
    if (!artikel) return json({ fehler: 'Artikel nicht gefunden.' }, { status: 404 });
    const filter: Record<string, unknown> = { vereinId, artikelId: params.id };
    if (art) filter.art = art;
    if (von || bis) filter.zeitpunkt = { ...(von ? { $gte: new Date(von + 'T00:00:00.000Z') } : {}), ...(bis ? { $lt: new Date(new Date(bis + 'T00:00:00.000Z').getTime() + 86400000) } : {}) };
    const bewegungen = await db.collection('lagerbewegungen').find(filter).sort({ zeitpunkt: -1, _id: -1 }).limit(200).toArray();
    return json({ bewegungen: bewegungen.map(({ _id, ...bewegung }) => ({ ...bewegung, id: _id.toString() })), hinweis: 'Bewegungen vor Einführung des Journals sind nicht rückwirkend erfasst. Es werden maximal 200 Einträge angezeigt.' });
  } catch (error) {
    console.error('Lagerbewegungen laden:', error instanceof Error ? error.name : 'Unbekannter Fehler');
    return json({ fehler: 'Lagerbewegungen konnten nicht geladen werden.' }, { status: 500 });
  }
};
