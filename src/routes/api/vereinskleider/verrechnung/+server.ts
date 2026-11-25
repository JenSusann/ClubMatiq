import { json } from '@sveltejs/kit';
import { ObjectId, type Document } from 'mongodb';
import { client, db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Verkaufsposition = {
  artikelId: string;
  groesseId: string | null;
  artikelname: string;
  menge: number;
  einzelpreis: number | null;
  preisOffen?: boolean;
  positionsbetrag: number;
  verkaufsart: 'direkt' | 'bestellung';
};

type Verkauf = Document & {
  vereinId: string;
  kaeufer: string;
  riegen?: string[];
  zahlungsart: string;
  zahlungsstatus?: string;
  bezahltBetrag?: number;
  preisOffen?: boolean;
  trancheRechnungIds?: string[];
  zahlungen?: { betrag: number; datum: Date; zahlungsart: string }[];
  bemerkung?: string;
  positionen: Verkaufsposition[];
  rabatte?: { rabattId: string; name: string; betrag: number }[];
  zusaetzlicherRabatt?: number;
  zwischentotal: number;
  erstbezugsIds?: string[];
  rabattTotal: number;
  endbetrag: number;
  erstelltAm: Date;
  rechnungId?: string;
};

type RechnungsnummerZaehler = {
  _id: string;
  vereinId: string;
  jahr: number;
  nummer: number;
};

type Rechnung = Document & {
  vereinId: string;
  verkaufId: string;
  rechnungsnummer: string;
  status: 'offen' | 'teilweise_bezahlt' | 'bezahlt' | 'storniert';
  gesamtbetrag: number;
  bezahltBetrag: number;
};

class Rechnungsfehler extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

function gueltigeId(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[0-9a-fA-F]{24}$/.test(wert);
}

function gueltigerBetrag(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert) && wert >= 0 &&
    Math.abs(wert * 100 - Math.round(wert * 100)) < 0.000001;
}

export const GET: RequestHandler = async ({ locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const vereinId = locals.benutzer!.vereinId;

  try {
    const [rechnungen, verkaeufe] = await Promise.all([
      db.collection<Rechnung>('vereinskleider_rechnungen')
        .find({ vereinId }).sort({ erstelltAm: -1 }).limit(1000).toArray(),
      db.collection<Verkauf>('vereinskleider_verkaeufe')
        .find({ vereinId, rechnungId: { $exists: false }, $nor: [{ endbetrag: 0, preisOffen: { $ne: true }, 'erstbezugsIds.0': { $exists: true } }] })
        .sort({ erstelltAm: -1 }).limit(1000)
        .project<Verkauf>({ kaeufer: 1, riegen: 1, endbetrag: 1, erstelltAm: 1, zahlungsart: 1, zahlungsstatus: 1, bezahltBetrag: 1, preisOffen: 1, offenePreispositionen: 1, trancheRechnungIds: 1 })
        .toArray()
    ]);

    return json({
      rechnungen: rechnungen.map((r) => ({ ...r, _id: r._id.toString() })),
      unverrechneteVerkaeufe: verkaeufe.map((v) => ({ ...v, _id: v._id.toString() })),
      begrenzt: rechnungen.length === 1000 || verkaeufe.length === 1000
    });
  } catch (fehler) {
    console.error('Verrechnung laden:', fehler);
    return json({ fehler: 'Verrechnungsdaten konnten nicht geladen werden.' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;

  const eingabe: unknown = await request.json().catch(() => null);
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) {
    return json({ fehler: 'Ungültige Rechnungsdaten.' }, { status: 400 });
  }
  const daten = eingabe as Record<string, unknown>;
  if (!gueltigeId(daten.verkaufId)) {
    return json({ fehler: 'Ungültige Verkaufs-ID.' }, { status: 400 });
  }

  const vereinId = locals.benutzer!.vereinId;
  const verkaufId = daten.verkaufId;
  const session = client.startSession();

  try {
    const rechnung = await session.withTransaction(async () => {
      const verkaeufe = db.collection<Verkauf>('vereinskleider_verkaeufe');
      const verkauf = await verkaeufe.findOne({ _id: new ObjectId(verkaufId), vereinId }, { session });
      if (!verkauf) throw new Rechnungsfehler('Verkauf nicht gefunden.', 404);
      if (verkauf.rechnungId) throw new Rechnungsfehler('Dieser Verkauf wurde bereits verrechnet.', 409);
      if (Array.isArray(verkauf.trancheRechnungIds) && verkauf.trancheRechnungIds.length > 0) {
        throw new Rechnungsfehler('Für diese Bestellung existieren bereits Teilrechnungen. Bitte weitere Tranchen erstellen.', 409);
      }
      if (verkauf.preisOffen === true || verkauf.positionen?.some((p) => p.preisOffen === true || p.einzelpreis === null)) {
        throw new Rechnungsfehler('Die Bestellung enthält noch offene Verkaufspreise. Bitte zuerst alle Preise festlegen.', 409);
      }
      if (!Array.isArray(verkauf.positionen) || verkauf.positionen.length === 0 ||
          !gueltigerBetrag(verkauf.endbetrag) || !gueltigerBetrag(verkauf.zwischentotal) ||
          !gueltigerBetrag(verkauf.rabattTotal) ||
          !verkauf.positionen.every((p) => Number.isSafeInteger(p.menge) && p.menge > 0 &&
            gueltigerBetrag(p.einzelpreis) && gueltigerBetrag(p.positionsbetrag))) {
        throw new Rechnungsfehler('Der Verkauf enthält unvollständige oder ungültige Rechnungswerte.', 409);
      }
      // Zahlungseingänge aus dem Verkauf übernehmen, nicht erneut buchen.
      // Fehlende Felder bei älteren Verkäufen bedeuten: noch nicht bezahlt.
      const zahlungen = verkauf.zahlungen ?? [];
      if (!Array.isArray(zahlungen) || !zahlungen.every((z) =>
        z && gueltigerBetrag(z.betrag) && z.betrag > 0 &&
        z.datum && !Number.isNaN(new Date(z.datum).getTime()) &&
        typeof z.zahlungsart === 'string' && ['bar', 'twint', 'rechnung'].includes(z.zahlungsart)
      )) {
        throw new Rechnungsfehler('Die gespeicherten Zahlungseingänge sind ungültig.', 409);
      }
      const summeZahlungenRappen = zahlungen.reduce((summe, z) => summe + Math.round(z.betrag * 100), 0);
      const bezahltRappen = verkauf.bezahltBetrag === undefined
        ? summeZahlungenRappen
        : gueltigerBetrag(verkauf.bezahltBetrag)
          ? Math.round(verkauf.bezahltBetrag * 100)
          : -1;
      const gesamtRappen = Math.round(verkauf.endbetrag * 100);
      if (gesamtRappen === 0 && verkauf.erstbezugsIds?.length) {
        throw new Rechnungsfehler('Kostenlose Erstbezüge benötigen keine Rechnung.', 409);
      }
      if (bezahltRappen < 0 || bezahltRappen !== summeZahlungenRappen || bezahltRappen > gesamtRappen ||
          (verkauf.zahlungsstatus === 'bezahlt' && bezahltRappen !== gesamtRappen)) {
        throw new Rechnungsfehler('Der Zahlungsstatus stimmt nicht mit den erfassten Zahlungseingängen überein.', 409);
      }
      const status: Rechnung['status'] = gesamtRappen === bezahltRappen
        ? 'bezahlt'
        : bezahltRappen > 0 ? 'teilweise_bezahlt' : 'offen';
      const jetzt = new Date();
      const jahr = jetzt.getFullYear();
      const zaehler = await db.collection<RechnungsnummerZaehler>('vereinskleider_rechnungsnummern').findOneAndUpdate(
        { _id: `${vereinId}:${jahr}` },
        { $inc: { nummer: 1 }, $setOnInsert: { vereinId, jahr } },
        { upsert: true, returnDocument: 'after', session }
      );
      if (!zaehler || typeof zaehler.nummer !== 'number') {
        throw new Rechnungsfehler('Rechnungsnummer konnte nicht vergeben werden.', 500);
      }
      const rechnungsnummer = `${jahr}-${String(zaehler.nummer).padStart(5, '0')}`;
      const rechnungId = new ObjectId();
      const dokument = {
        _id: rechnungId,
        vereinId,
        verkaufId,
        rechnungsnummer,
        empfaenger: verkauf.kaeufer,
        riegen: verkauf.riegen ?? [],
        zahlungsart: verkauf.zahlungsart,
        bemerkung: verkauf.bemerkung ?? '',
        positionen: verkauf.positionen.map((p) => ({ ...p })),
        rabatte: verkauf.rabatte ?? [],
        zusaetzlicherRabatt: verkauf.zusaetzlicherRabatt ?? 0,
        zwischentotal: verkauf.zwischentotal,
        rabattTotal: verkauf.rabattTotal,
        gesamtbetrag: verkauf.endbetrag,
        bezahltBetrag: bezahltRappen / 100,
        zahlungen: zahlungen.map((z) => ({
          betrag: z.betrag,
          datum: new Date(z.datum),
          zahlungsart: z.zahlungsart
        })),
        status,
        erstelltAm: jetzt,
        aktualisiertAm: jetzt,
        clubdeskExportStatus: 'nicht_exportiert' as const
      };
      const beansprucht = await verkaeufe.updateOne(
        { _id: new ObjectId(verkaufId), vereinId, rechnungId: { $exists: false },
          trancheRechnungIds: { $exists: false } },
        { $set: { rechnungId: rechnungId.toString(), aktualisiertAm: jetzt } },
        { session }
      );
      if (beansprucht.modifiedCount !== 1) {
        throw new Rechnungsfehler('Dieser Verkauf wurde zwischenzeitlich verrechnet.', 409);
      }
      await db.collection('vereinskleider_rechnungen').insertOne(dokument, { session });
      return { _id: rechnungId.toString(), rechnungsnummer, gesamtbetrag: dokument.gesamtbetrag };
    });
    return json({ erfolg: true, rechnung }, { status: 201 });
  } catch (fehler) {
    if (fehler instanceof Rechnungsfehler) {
      return json({ fehler: fehler.message }, { status: fehler.statusCode });
    }
    console.error('Rechnung erstellen:', fehler);
    return json({ fehler: 'Rechnung konnte nicht erstellt werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
