import { json, error } from '@sveltejs/kit';
import { type Collection, type WithId } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Mitglied = {
  vereinId: string;
  clubdeskId: string;
  anrede: string;
  nachname: string;
  vorname: string;
  adresse: string;
  ort: string;
  plz: string;
  status: string;
  aktiv: boolean;
  importiertAm: Date;
  erstbezugsRabattIds?: string[];
  riegen?: string[];
  clubdeskGruppen?: string[];
  clubdeskHauptgruppe?: string;
  clubdeskGruppendetails?: { gruppe: string; funktion: string | null }[];
};

function gruppendetails(gruppen: string): { gruppe: string; funktion: string | null }[] {
  return [...new Set(gruppen.split(',').map(g => g.trim()).filter(Boolean))].map(g => {
    const treffer = /^(.+?) \((.*)\)$/.exec(g);
    return treffer ? { gruppe: treffer[1].trim(), funktion: treffer[2].trim() } : { gruppe: g, funktion: null };
  });
}

function csvLesen(text: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let zitat = false;
  const eingabe = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < eingabe.length; i++) {
    const c = eingabe[i];
    if (c === '"') {
      if (zitat && eingabe[i + 1] === '"') {
        feld += '"';
        i++;
      } else {
        zitat = !zitat;
      }
    } else if (c === ';' && !zitat) {
      zeile.push(feld);
      feld = '';
    } else if ((c === '\n' || c === '\r') && !zitat) {
      if (c === '\r' && eingabe[i + 1] === '\n') i++;
      zeile.push(feld);
      if (zeile.some((v) => v.trim())) zeilen.push(zeile);
      zeile = [];
      feld = '';
    } else {
      feld += c;
    }
  }

  if (zitat) throw error(400, 'Die CSV enthält ein nicht geschlossenes Anführungszeichen.');
  zeile.push(feld);
  if (zeile.some((v) => v.trim())) zeilen.push(zeile);
  return zeilen;
}

// Mitglieder anzeigen: ausschliesslich Administratoren.
export const GET: RequestHandler = async ({ locals, url }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'mitglieder:verwalten');
  if (zugriff) return zugriff;

  const vereinId = locals.benutzer!.vereinId;
  const suche = (url.searchParams.get('suche') ?? '').trim().toLocaleLowerCase('de-CH');
  const sammlung: Collection<Mitglied> = db.collection<Mitglied>('clubdesk_mitglieder');
  const eintraege: WithId<Mitglied>[] = await sammlung
    .find({ vereinId, aktiv: true })
    .sort({ nachname: 1, vorname: 1 })
    .limit(3000)
    .toArray();

  const ergebnis = eintraege.filter((mitglied: WithId<Mitglied>) =>
    !suche || `${mitglied.vorname} ${mitglied.nachname} ${mitglied.nachname} ${mitglied.vorname} ${mitglied.clubdeskId}`
      .toLocaleLowerCase('de-CH').includes(suche)
  ).slice(0, 50);

  return json(ergebnis.map((mitglied: WithId<Mitglied>) => ({
    _id: String(mitglied._id),
    clubdeskId: mitglied.clubdeskId,
    anrede: mitglied.anrede,
    nachname: mitglied.nachname,
    vorname: mitglied.vorname,
    anzeigename: `${mitglied.vorname} ${mitglied.nachname}`.trim(),
    adresse: mitglied.adresse,
    ort: mitglied.ort,
    plz: mitglied.plz,
    status: mitglied.status,
    erstbezugsRabattIds: mitglied.erstbezugsRabattIds ?? [],
    ...(mitglied.riegen !== undefined ? { riegen: mitglied.riegen } : {}),
    ...(mitglied.clubdeskGruppen !== undefined ? { clubdeskGruppen: mitglied.clubdeskGruppen } : {}),
    ...(mitglied.clubdeskHauptgruppe !== undefined ? { clubdeskHauptgruppe: mitglied.clubdeskHauptgruppe } : {}),
    ...(mitglied.clubdeskGruppendetails !== undefined ? { clubdeskGruppendetails: mitglied.clubdeskGruppendetails } : {}),
    aktiv: mitglied.aktiv
  })));
};

// ClubDesk-CSV importieren: ausschliesslich Administratoren.
export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'mitglieder:verwalten');
  if (zugriff) return zugriff;

  const vereinId = locals.benutzer!.vereinId;
  if (!(request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    throw error(400, 'Bitte eine CSV-Datei hochladen.');
  }

  const formular = await request.formData();
  const datei = formular.get('datei');
  if (!(datei instanceof File)) throw error(400, 'Keine CSV-Datei übermittelt (Feld: datei).');
  if (datei.size > 5_000_000) throw error(413, 'Die CSV-Datei darf höchstens 5 MB gross sein.');

  const roh = new Uint8Array(await datei.arrayBuffer());
  let inhalt: string;
  try {
    inhalt = new TextDecoder('utf-8', { fatal: true }).decode(roh);
  } catch {
    inhalt = new TextDecoder('windows-1252').decode(roh);
  }

  const zeilen = csvLesen(inhalt);
  if (zeilen.length < 2) throw error(400, 'Die CSV enthält keine Mitglieder.');
  const kopf = zeilen[0].map((v) => v.trim());
  const index = (name: string): number => kopf.indexOf(name);

  for (const pflicht of ['[Id]', 'Vorname', 'Nachname']) {
    if (index(pflicht) < 0) throw error(400, `Pflichtspalte fehlt: ${pflicht}`);
  }

  const mitglieder = new Map<string, Mitglied>();
  for (let i = 1; i < zeilen.length; i++) {
    const werte = zeilen[i];
    const wert = (name: string): string => index(name) < 0 ? '' : (werte[index(name)] ?? '').trim();
    const clubdeskId = wert('[Id]');
    const vorname = wert('Vorname');
    const nachname = wert('Nachname');

    if (!clubdeskId || (!vorname && !nachname)) {
      throw error(400, `Ungültiger Mitgliedereintrag in CSV-Zeile ${i + 1}.`);
    }
    const bisher = mitglieder.get(clubdeskId);
    if (bisher && (bisher.vorname !== vorname || bisher.nachname !== nachname)) {
      throw error(400, `Widersprüchliche Namen zur gleichen ClubDesk-ID in CSV-Zeile ${i + 1}.`);
    }

    const eintrag: Mitglied = {
      vereinId,
      clubdeskId,
      anrede: wert('Anrede'),
      nachname,
      vorname,
      adresse: wert('Adresse'),
      ort: wert('Ort'),
      plz: wert('PLZ'),
      status: wert('Status'),
      ...(index('Gruppe') >= 0 ? { clubdeskHauptgruppe: wert('Gruppe') } : {}),
      ...(index('Gruppen') >= 0 ? { clubdeskGruppendetails: gruppendetails(wert('Gruppen')) } : {}),
      ...(index('Gruppen') >= 0 ? { clubdeskGruppen: [...new Set(wert('Gruppen').split(',').map(g => g.trim()).filter(Boolean))] } : {}),
      ...(index('Riegen') >= 0 ? { riegen: [...new Set(wert('Riegen').split('|').map(r => r.trim()).filter(Boolean))] } : {}),
      aktiv: true,
      importiertAm: new Date()
    };
    if (bisher) {
      if (eintrag.clubdeskGruppen !== undefined) eintrag.clubdeskGruppen = [...new Set([...(bisher.clubdeskGruppen ?? []), ...eintrag.clubdeskGruppen, ...[bisher.clubdeskHauptgruppe, eintrag.clubdeskHauptgruppe].filter((g): g is string => !!g)])];
      if (eintrag.clubdeskGruppen !== undefined) eintrag.clubdeskGruppendetails = gruppendetails(eintrag.clubdeskGruppen.join(','));
      if (eintrag.riegen !== undefined) eintrag.riegen = [...new Set([...(bisher.riegen ?? []), ...eintrag.riegen])];
    }
    mitglieder.set(clubdeskId, eintrag);
  }

  const sammlung: Collection<Mitglied> = db.collection<Mitglied>('clubdesk_mitglieder');
  await sammlung.createIndex({ vereinId: 1, clubdeskId: 1 }, { unique: true });
  const operationen = [...mitglieder.values()].map((mitglied) => ({
    updateOne: {
      filter: { vereinId, clubdeskId: mitglied.clubdeskId },
      update: { $set: mitglied },
      upsert: true
    }
  }));

  const ergebnis = await sammlung.bulkWrite(operationen, { ordered: true });
  return json({
    erfolg: true,
    eingelesen: mitglieder.size,
    neu: ergebnis.upsertedCount,
    aktualisiert: ergebnis.modifiedCount,
    unveraendert: ergebnis.matchedCount - ergebnis.modifiedCount,
    hinweis: 'Nicht enthaltene Mitglieder bleiben erhalten. Das Feld aktiv wird beim Import auf true gesetzt.'
  });
};
