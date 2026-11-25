import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Rabattart = 'prozent' | 'betrag' | 'fixpreis';
type Geltungsbereich = 'warenkorb' | 'artikel' | 'kategorie';
type RabattEingabe = {
  name: string;
  rabattart: Rabattart;
  wert: number;
  geltungsbereich: Geltungsbereich;
  artikelIds: string[];
  kategorieIds: string[];
  riegen: string[];
  maximaleMenge: number | null;
  gueltigAb: string | null;
  gueltigBis: string | null;
  einmaligProMitglied: boolean;
  anspruchsgruppe?: string;
  kombinierbar: boolean;
  aktiv: boolean;
};

const rabattarten = ['prozent', 'betrag', 'fixpreis'];
const geltungsbereiche = ['warenkorb', 'artikel', 'kategorie'];

function parseRabatt(daten: unknown): { wert?: RabattEingabe; fehler?: string } {
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return { fehler: 'Ungültige Rabattdaten.' };
  }

  const d = daten as Record<string, unknown>;
  const name = typeof d.name === 'string' ? d.name.trim() : '';
  if (!name || name.length > 120) {
    return { fehler: 'Bitte einen Rabattnamen mit maximal 120 Zeichen eingeben.' };
  }
  if (!rabattarten.includes(d.rabattart as string)) {
    return { fehler: 'Ungültige Rabattart.' };
  }
  if (!geltungsbereiche.includes(d.geltungsbereich as string)) {
    return { fehler: 'Ungültiger Gültigkeitsbereich.' };
  }
  if (typeof d.wert !== 'number' || !Number.isFinite(d.wert) || d.wert < 0 || Math.round(d.wert * 100) !== d.wert * 100 && Math.abs(Math.round(d.wert * 100) - d.wert * 100) > 1e-6) {
    return { fehler: 'Der Rabattwert muss eine gültige, nicht negative Zahl mit höchstens zwei Dezimalstellen sein.' };
  }
  if (d.rabattart === 'prozent' && d.wert > 100) {
    return { fehler: 'Ein prozentualer Rabatt darf höchstens 100 % betragen.' };
  }

  function ids(feld: unknown): string[] | null {
    if (!Array.isArray(feld) || feld.length > 200 || !feld.every((x) => typeof x === 'string' && ObjectId.isValid(x))) return null;
    return [...new Set(feld as string[])];
  }
  const artikelIds = ids(d.artikelIds ?? []);
  const kategorieIds = ids(d.kategorieIds ?? []);
  if (!artikelIds || !kategorieIds) return { fehler: 'Ungültige Artikel- oder Kategorie-IDs.' };
  if (d.geltungsbereich === 'artikel' && artikelIds.length === 0) return { fehler: 'Bitte mindestens einen Artikel auswählen.' };
  if (d.geltungsbereich === 'kategorie' && kategorieIds.length === 0) return { fehler: 'Bitte mindestens eine Kategorie auswählen.' };

  const riegen = d.riegen ?? [];
  if (!Array.isArray(riegen) || riegen.length > 50 || !riegen.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 100)) {
    return { fehler: 'Ungültige Riegen.' };
  }
  const maximaleMenge = d.maximaleMenge ?? null;
  if (maximaleMenge !== null && (!Number.isSafeInteger(maximaleMenge) || (maximaleMenge as number) < 1)) {
    return { fehler: 'Die maximale Menge muss eine positive ganze Zahl sein.' };
  }
  if (d.einmaligProMitglied !== undefined && typeof d.einmaligProMitglied !== 'boolean') return { fehler: 'Ungültige Erstbezugsregel.' };
  if (d.einmaligProMitglied === true && (d.rabattart !== 'fixpreis' || d.geltungsbereich === 'warenkorb' || maximaleMenge !== 1)) return { fehler: 'Ein Erstbezug benötigt einen Fixpreis für Artikel oder Kategorien und maximal ein Stück.' };
  const anspruchsgruppe = typeof d.anspruchsgruppe === 'string' ? d.anspruchsgruppe.trim().toLowerCase() : '';
  if (d.anspruchsgruppe != null && typeof d.anspruchsgruppe !== 'string' ||
      anspruchsgruppe && (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(anspruchsgruppe) || d.einmaligProMitglied !== true)) {
    return { fehler: 'Ungültige Anspruchsgruppe. Erlaubt sind Buchstaben, Zahlen, Bindestriche und Unterstriche.' };
  }
  function datum(feld: unknown): string | null | undefined {
    if (feld === null || feld === undefined || feld === '') return null;
    if (typeof feld !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(feld)) return undefined;
    const zeit = new Date(`${feld}T00:00:00.000Z`);
    return !Number.isNaN(zeit.getTime()) && zeit.toISOString().slice(0, 10) === feld ? feld : undefined;
  }
  const gueltigAb = datum(d.gueltigAb);
  const gueltigBis = datum(d.gueltigBis);
  if (gueltigAb === undefined || gueltigBis === undefined || (gueltigAb && gueltigBis && gueltigBis < gueltigAb)) {
    return { fehler: 'Ungültiger Gültigkeitszeitraum.' };
  }
  if (d.kombinierbar !== undefined && typeof d.kombinierbar !== 'boolean') return { fehler: 'Ungültige Angabe zur Kombinierbarkeit.' };
  if (d.aktiv !== undefined && typeof d.aktiv !== 'boolean') return { fehler: 'Ungültiger Aktivstatus.' };

  return {
    wert: {
      name,
      rabattart: d.rabattart as Rabattart,
      wert: d.wert,
      geltungsbereich: d.geltungsbereich as Geltungsbereich,
      artikelIds: d.geltungsbereich === 'artikel' ? artikelIds : [],
      kategorieIds: d.geltungsbereich === 'kategorie' ? kategorieIds : [],
      riegen: [...new Set((riegen as string[]).map((x) => x.trim()))],
      maximaleMenge: maximaleMenge as number | null,
      gueltigAb,
      gueltigBis,
      einmaligProMitglied: d.einmaligProMitglied === true,
      ...(anspruchsgruppe ? { anspruchsgruppe } : {}),
      kombinierbar: (d.kombinierbar as boolean | undefined) ?? false,
      aktiv: (d.aktiv as boolean | undefined) ?? true
    }
  };
}

function ausgabe(eintrag: Record<string, any>) {
  return {
    _id: eintrag._id.toString(),
    name: eintrag.name,
    rabattart: eintrag.rabattart,
    wert: eintrag.wert,
    geltungsbereich: eintrag.geltungsbereich,
    artikelIds: eintrag.artikelIds ?? [],
    kategorieIds: eintrag.kategorieIds ?? [],
    riegen: eintrag.riegen ?? [],
    maximaleMenge: eintrag.maximaleMenge ?? null,
    gueltigAb: eintrag.gueltigAb ?? null,
    gueltigBis: eintrag.gueltigBis ?? null,
    einmaligProMitglied: eintrag.einmaligProMitglied === true,
    ...(eintrag.anspruchsgruppe ? { anspruchsgruppe: eintrag.anspruchsgruppe } : {}),
    kombinierbar: eintrag.kombinierbar ?? false,
    aktiv: eintrag.aktiv ?? true
  };
}

async function pruefeZuordnungen(vereinId: string, eingabe: RabattEingabe): Promise<boolean> {
  if (eingabe.geltungsbereich === 'artikel') {
    const anzahl = await db.collection('artikel').countDocuments({
      vereinId,
      _id: { $in: eingabe.artikelIds.map((id) => new ObjectId(id)) }
    });
    return anzahl === eingabe.artikelIds.length;
  }
  if (eingabe.geltungsbereich === 'kategorie') {
    const anzahl = await db.collection('kategorien').countDocuments({
      vereinId,
      _id: { $in: eingabe.kategorieIds.map((id) => new ObjectId(id)) }
    });
    return anzahl === eingabe.kategorieIds.length;
  }
  return true;
}

export const GET: RequestHandler = async ({ locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'rabatte:verwalten');
  if (fehler) return fehler;
  try {
    const eintraege = await db.collection('rabattregeln')
      .find({ vereinId: locals.benutzer!.vereinId })
      .sort({ name: 1 }).toArray();
    return json(eintraege.map(ausgabe));
  } catch (error) {
    console.error('Rabatte laden:', error);
    return json({ fehler: 'Rabattregeln konnten nicht geladen werden.' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'rabatte:verwalten');
  if (fehler) return fehler;
  const parsed = parseRabatt(await request.json().catch(() => null));
  if (!parsed.wert) return json({ fehler: parsed.fehler }, { status: 400 });
  const vereinId = locals.benutzer!.vereinId;
  try {
    if (!(await pruefeZuordnungen(vereinId, parsed.wert))) {
      return json({ fehler: 'Ein Artikel oder eine Kategorie gehört nicht zu diesem Verein.' }, { status: 400 });
    }
    const dokument = { ...parsed.wert, vereinId, erstelltAm: new Date(), aktualisiertAm: new Date() };
    const ergebnis = await db.collection('rabattregeln').insertOne(dokument);
    return json(ausgabe({ ...dokument, _id: ergebnis.insertedId }), { status: 201 });
  } catch (error) {
    console.error('Rabatt erstellen:', error);
    return json({ fehler: 'Rabattregel konnte nicht erstellt werden.' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'rabatte:verwalten');
  if (fehler) return fehler;
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Rabattdaten.' }, { status: 400 });
  }
  const id = (daten as Record<string, unknown>)._id;
  if (typeof id !== 'string' || !ObjectId.isValid(id)) {
    return json({ fehler: 'Ungültige Rabatt-ID.' }, { status: 400 });
  }
  const parsed = parseRabatt(daten);
  if (!parsed.wert) return json({ fehler: parsed.fehler }, { status: 400 });
  const vereinId = locals.benutzer!.vereinId;
  try {
    if (!(await pruefeZuordnungen(vereinId, parsed.wert))) {
      return json({ fehler: 'Ein Artikel oder eine Kategorie gehört nicht zu diesem Verein.' }, { status: 400 });
    }
    const ergebnis = await db.collection('rabattregeln').findOneAndUpdate(
      { _id: new ObjectId(id), vereinId },
      { $set: { ...parsed.wert, aktualisiertAm: new Date() }, ...(parsed.wert.anspruchsgruppe ? {} : { $unset: { anspruchsgruppe: '' } }) },
      { returnDocument: 'after' }
    );
    if (!ergebnis) return json({ fehler: 'Rabattregel nicht gefunden.' }, { status: 404 });
    return json(ausgabe(ergebnis));
  } catch (error) {
    console.error('Rabatt bearbeiten:', error);
    return json({ fehler: 'Rabattregel konnte nicht aktualisiert werden.' }, { status: 500 });
  }
};
