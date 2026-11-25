import { json } from '@sveltejs/kit';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Gruppe = { gruppe: string; funktion: string | null };
type Mitglied = { vereinId: string; aktiv: boolean; clubdeskHauptgruppe?: string; clubdeskGruppen?: string[]; clubdeskGruppendetails?: Gruppe[] };

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'stammdaten:verwalten');
  if (zugriff) return zugriff;
  const mitglieder = await db.collection<Mitglied>('clubdesk_mitglieder')
    .find({ vereinId: locals.benutzer!.vereinId, aktiv: true }, { projection: { clubdeskHauptgruppe: 1, clubdeskGruppen: 1, clubdeskGruppendetails: 1 } }).toArray();
  const gruppen = new Map<string, Gruppe>();
  function hinzufuegen(g: Gruppe) {
    if (g.gruppe.trim()) gruppen.set(JSON.stringify([g.gruppe, g.funktion]), g);
  }
  for (const m of mitglieder) {
    if (m.clubdeskHauptgruppe) hinzufuegen({ gruppe: m.clubdeskHauptgruppe, funktion: null });
    const details = m.clubdeskGruppendetails ?? (m.clubdeskGruppen ?? []).map(g => {
      const treffer = /^(.+?) \((.*)\)$/.exec(g);
      return treffer ? { gruppe: treffer[1].trim(), funktion: treffer[2].trim() } : { gruppe: g, funktion: null };
    });
    for (const g of details) hinzufuegen(g);
  }
  return json([...gruppen.values()].sort((a, b) => a.gruppe.localeCompare(b.gruppe, 'de-CH') || (a.funktion ?? '').localeCompare(b.funktion ?? '', 'de-CH')));
};
