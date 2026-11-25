import { json } from '@sveltejs/kit';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { ermittleRiegen, type Gruppenmitglied, type Riegenregel, type Zuordnungsriege } from '../../../../lib/server/riegenzuordnung';
import type { RequestHandler } from './$types';

type Mitglied = Gruppenmitglied & { vereinId: string; aktiv: boolean; clubdeskId: string; vorname: string; nachname: string; status?: string; erstbezugsRabattIds?: string[] };

export const GET: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const vereinId = locals.benutzer!.vereinId;
  const suche = (url.searchParams.get('suche') ?? '').trim().toLowerCase();
  if (suche.length < 2) return json([]);
  if (suche.length > 120) return json({ fehler: 'Suchbegriff zu lang.' }, { status: 400 });
  const [mitglieder, regeln, riegen] = await Promise.all([
    db.collection<Mitglied>('clubdesk_mitglieder').find({ vereinId, aktiv: true }).sort({ nachname: 1, vorname: 1 }).toArray(),
    db.collection<Riegenregel & { vereinId: string }>('clubdesk_gruppenzuordnungen').find({ vereinId }).toArray(),
    db.collection<Zuordnungsriege & { vereinId: string }>('riegen').find({ vereinId, aktiv: true }).toArray()
  ]);
  return json(mitglieder.filter(m => [m.vorname + ' ' + m.nachname, m.nachname + ' ' + m.vorname, m.clubdeskId].some(s => s.toLowerCase().includes(suche))).slice(0, 50).map(m => ({
    _id: String(m._id), clubdeskId: m.clubdeskId, vorname: m.vorname, nachname: m.nachname,
    anzeigename: (m.vorname + ' ' + m.nachname).trim(), status: m.status ?? '',
    erstbezugsRabattIds: m.erstbezugsRabattIds ?? [], riegen: ermittleRiegen(m, regeln, riegen)
  })));
};
