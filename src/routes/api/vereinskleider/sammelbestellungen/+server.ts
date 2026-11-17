import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Position = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
  verkaufsart: string;
  uebergebenMenge?: number;
};

type Bedarf = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  lieferantId: string | null;
  lieferantName: string | null;
  offen: number;
  bestand: number | null;
  verfuegbar: number;
  bereitsInSammelbestellungen: number;
  nachbestellen: number;
};

type SammelPosition = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
  geliefertMenge?: number;
  kundenbedarfMenge?: number;
  lagerreserveMenge?: number;
};

type Sammelbestellung = {
  vereinId: string;
  lieferantId?: string | null;
  lieferantName?: string | null;
  status: 'entwurf' | 'bestellt' | 'geliefert';
  positionen: SammelPosition[];
  bestelltAm?: Date;
  geliefertAm?: Date;
  bemerkung: string;
  erstelltAm: Date;
  aktualisiertAm: Date;
};

function schluessel(artikelId: string, groesseId: string | null): string {
  return `${artikelId}:${groesseId ?? ''}`;
}

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && ObjectId.isValid(wert) && new ObjectId(wert).toString() === wert.toLowerCase();
}

async function ladeUebersicht(vereinId: string) {
  const [vorgaenge, artikel, varianten, sammelDokumente, lieferanten] = await Promise.all([
    db.collection('vereinskleider_verkaeufe')
      .find({ vereinId, 'positionen.verkaufsart': 'bestellung' })
      .project({ positionen: 1 }).toArray(),
    db.collection('artikel').find({ vereinId })
      .project({ _id: 1, name: 1, menge: 1, hatGroessen: 1, lieferantId: 1 }).toArray(),
    db.collection('artikelvarianten').find({ vereinId, aktiv: { $ne: false } })
      .project({ artikelId: 1, groesseId: 1, menge: 1 }).toArray(),
    db.collection<Sammelbestellung>('vereinskleider_sammelbestellungen')
      .find({ vereinId }).sort({ erstelltAm: -1 }).toArray(),
    db.collection('lieferanten').find({ vereinId }).project({ _id: 1, name: 1 }).toArray()
  ]);

  const lieferantenMap = new Map(lieferanten.map((l) => [l._id.toString(), String(l.name ?? '')]));
  const offen = new Map<string, { artikelId: string; groesseId: string | null; artikelname: string; menge: number }>();
  for (const vorgang of vorgaenge) {
    const positionen = Array.isArray(vorgang.positionen) ? vorgang.positionen as Position[] : [];
    for (const position of positionen) {
      if (position.verkaufsart !== 'bestellung' || !gueltigeId(position.artikelId) ||
          (position.groesseId !== null && !gueltigeId(position.groesseId))) continue;
      const bestellt = position.menge;
      const uebergeben = position.uebergebenMenge ?? 0;
      if (!Number.isSafeInteger(bestellt) || bestellt < 1 || !Number.isSafeInteger(uebergeben) ||
          uebergeben < 0 || uebergeben > bestellt) continue;
      const key = schluessel(position.artikelId, position.groesseId);
      const alt = offen.get(key);
      if (alt) alt.menge += bestellt - uebergeben;
      else offen.set(key, { artikelId: position.artikelId, groesseId: position.groesseId,
        artikelname: position.artikelname, menge: bestellt - uebergeben });
    }
  }

  const artikelMap = new Map(artikel.map((a) => [a._id.toString(), a]));
  const variantenMap = new Map(varianten.map((v) =>
    [schluessel(String(v.artikelId), String(v.groesseId)), Number(v.menge)]));
  const unterwegs = new Map<string, number>();
  for (const sammel of sammelDokumente) {
    if (sammel.status !== 'entwurf' && sammel.status !== 'bestellt') continue;
    for (const position of sammel.positionen ?? []) {
      const key = schluessel(position.artikelId, position.groesseId);
      // Bereits eingetroffene Ware ist schon im Lagerbestand enthalten.
      // Deshalb nur die noch ausstehende Menge als "unterwegs" abziehen.
      const geliefert = position.geliefertMenge ?? 0;
      if (!Number.isSafeInteger(position.menge) || position.menge < 0 ||
          !Number.isSafeInteger(geliefert) || geliefert < 0 || geliefert > position.menge) continue;
      unterwegs.set(key, (unterwegs.get(key) ?? 0) + (position.menge - geliefert));
    }
  }

  // Alle bestellbaren Artikel und aktiven Grössen aufnehmen – auch ohne
  // offene Kundenbestellung. So sind reine Lager-/Reservebestellungen möglich.
  const katalog = new Map<string, { artikelId: string; groesseId: string | null; artikelname: string }>();
  for (const a of artikel) {
    const artikelId = a._id.toString();
    if (a.hatGroessen === true) continue;
    katalog.set(schluessel(artikelId, null), {
      artikelId, groesseId: null, artikelname: String(a.name ?? 'Unbenannter Artikel')
    });
  }
  for (const v of varianten) {
    const artikelId = String(v.artikelId);
    const a = artikelMap.get(artikelId);
    if (!a || a.hatGroessen !== true || !gueltigeId(String(v.groesseId))) continue;
    const groesseId = String(v.groesseId);
    katalog.set(schluessel(artikelId, groesseId), {
      artikelId, groesseId, artikelname: String(a.name ?? 'Unbenannter Artikel')
    });
  }
  const bedarf: Bedarf[] = [...katalog.values()].map((p) => {
    const a = artikelMap.get(p.artikelId);
    const rohLieferantId = a?.lieferantId;
    const lieferantId = typeof rohLieferantId === 'string' && lieferantenMap.has(rohLieferantId)
      ? rohLieferantId : null;
    const bestand = !a ? null : p.groesseId === null
      ? Number(a.menge) : (variantenMap.get(schluessel(p.artikelId, p.groesseId)) ?? null);
    const sichererBestand = bestand !== null && Number.isFinite(bestand) && bestand >= 0 ? bestand : null;
    const verfuegbar = sichererBestand === null ? 0 : Math.max(0, sichererBestand - 1);
    const bereitsInSammelbestellungen = unterwegs.get(schluessel(p.artikelId, p.groesseId)) ?? 0;
    const offeneMenge = offen.get(schluessel(p.artikelId, p.groesseId))?.menge ?? 0;
    return { artikelId: p.artikelId, groesseId: p.groesseId, artikelname: p.artikelname,
      lieferantId, lieferantName: lieferantId ? lieferantenMap.get(lieferantId) ?? null : null,
      offen: offeneMenge, bestand: sichererBestand, verfuegbar, bereitsInSammelbestellungen,
      nachbestellen: Math.max(0, offeneMenge - verfuegbar - bereitsInSammelbestellungen) };
  });
  bedarf.sort((a, b) => (a.lieferantName ?? '').localeCompare(b.lieferantName ?? '', 'de-CH') ||
    a.artikelname.localeCompare(b.artikelname, 'de-CH') ||
    String(a.groesseId).localeCompare(String(b.groesseId)));

  const sammelbestellungen = sammelDokumente.map((s) => ({
    _id: s._id.toString(), lieferantId: s.lieferantId ?? null,
    lieferantName: s.lieferantName ?? (s.lieferantId ? lieferantenMap.get(s.lieferantId) ?? null : null),
    status: s.status, positionen: (s.positionen ?? []).map((p) => ({
      ...p, geliefertMenge: p.geliefertMenge ?? 0,
      // Alte Bestellungen haben keine gespeicherte Aufteilung. Nicht rückwirkend schätzen.
      kundenbedarfMenge: p.kundenbedarfMenge ?? null,
      lagerreserveMenge: p.lagerreserveMenge ?? null,
      offenMenge: Math.max(0, p.menge - (p.geliefertMenge ?? 0))
    })),
    bestelltAm: s.bestelltAm ?? null, geliefertAm: s.geliefertAm ?? null,
    bemerkung: s.bemerkung, erstelltAm: s.erstelltAm, aktualisiertAm: s.aktualisiertAm
  }));
  return { bedarf, sammelbestellungen };
}

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  try {
    return json(await ladeUebersicht(locals.benutzer!.vereinId));
  } catch (fehler) {
    console.error('Sammelbestellungen laden:', fehler);
    return json({ fehler: 'Sammelbestellungen konnten nicht geladen werden.' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe))
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  const daten = eingabe as Record<string, unknown>;
  if (!Array.isArray(daten.positionen) || daten.positionen.length < 1 || daten.positionen.length > 100)
    return json({ fehler: 'Bitte mindestens eine und höchstens 100 Positionen angeben.' }, { status: 400 });
  if (daten.bemerkung !== undefined && (typeof daten.bemerkung !== 'string' || daten.bemerkung.length > 2000))
    return json({ fehler: 'Bemerkung ist ungültig.' }, { status: 400 });

  const positionen: SammelPosition[] = [];
  const verwendet = new Set<string>();
  for (const roh of daten.positionen) {
    if (!roh || typeof roh !== 'object' || Array.isArray(roh))
      return json({ fehler: 'Ungültige Bestellposition.' }, { status: 400 });
    const p = roh as Record<string, unknown>;
    if (!gueltigeId(p.artikelId) || (p.groesseId !== null && !gueltigeId(p.groesseId)) ||
        !Number.isSafeInteger(p.menge) || (p.menge as number) < 1 || (p.menge as number) > 10000)
      return json({ fehler: 'Artikel, Grösse oder Menge ungültig.' }, { status: 400 });
    const key = schluessel(p.artikelId, p.groesseId as string | null);
    if (verwendet.has(key)) return json({ fehler: 'Eine Position wurde doppelt angegeben.' }, { status: 400 });
    verwendet.add(key);
    positionen.push({ artikelId: p.artikelId, groesseId: p.groesseId as string | null,
      artikelname: '', menge: p.menge as number });
  }

  const vereinId = locals.benutzer!.vereinId;
  try {
    const uebersicht = await ladeUebersicht(vereinId);
    let lieferantId: string | null | undefined;
    let lieferantName: string | null = null;
    for (const p of positionen) {
      const b = uebersicht.bedarf.find((b) => b.artikelId === p.artikelId && b.groesseId === p.groesseId);
      if (!b || b.bestand === null)
        return json({ fehler: 'Artikel oder Grösse ist nicht mehr bestellbar. Bitte aktualisieren.' }, { status: 409 });
      if (!b.lieferantId)
        return json({ fehler: `Für "${b.artikelname}" ist kein gültiger Standardlieferant hinterlegt. Bitte zuerst im Inventar zuordnen.` }, { status: 409 });
      if (lieferantId !== undefined && lieferantId !== b.lieferantId)
        return json({ fehler: 'Eine Sammelbestellung darf nur Artikel desselben Lieferanten enthalten.' }, { status: 400 });
      lieferantId = b.lieferantId;
      lieferantName = b.lieferantName;
      p.artikelname = b.artikelname;
      // Snapshot beim Erstellen: nur noch ungedeckter Kundenbedarf zählt
      // als Nachbestellung. Darüber hinausgehende Stücke sind Lagerreserve.
      p.kundenbedarfMenge = Math.min(p.menge, b.nachbestellen);
      p.lagerreserveMenge = p.menge - p.kundenbedarfMenge;
    }
    if (!lieferantId) return json({ fehler: 'Kein gültiger Lieferant ermittelt.' }, { status: 400 });
    const jetzt = new Date();
    const ergebnis = await db.collection<Sammelbestellung>('vereinskleider_sammelbestellungen').insertOne({
      vereinId, lieferantId, lieferantName, status: 'entwurf', positionen,
      bemerkung: (daten.bemerkung as string | undefined)?.trim() ?? '',
      erstelltAm: jetzt, aktualisiertAm: jetzt
    });
    return json({ erfolg: true, id: ergebnis.insertedId.toString(), status: 'entwurf', lieferantId }, { status: 201 });
  } catch (fehler) {
    console.error('Sammelbestellung erstellen:', fehler);
    return json({ fehler: 'Sammelbestellung konnte nicht erstellt werden.' }, { status: 500 });
  }
};
