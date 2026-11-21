import { json } from '@sveltejs/kit';
import { ObjectId, type Document } from 'mongodb';
import { client, db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import { berechneNaechsteRechnungstranche } from '../../../../../lib/server/vereinskleider-rechnungstranchen';
import type { RequestHandler } from './$types';

class TrancheFehler extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
const idGueltig = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);
const rappen = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 ||
      Math.abs(v * 100 - Math.round(v * 100)) > 0.000001) throw new TrancheFehler('Ungültiger Betrag.');
  return Math.round(v * 100);
};

/**
 * Erstellt eine weitere Rechnung derselben Bestellung nur für bislang nicht
 * abgerechnete, bereits bepreiste Positionen. Die alte 1:1-Rechnungslogik
 * bleibt für Bestellungen ohne Rechnungstranchen bestehen.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body) || !idGueltig(body.verkaufId)) {
    return json({ fehler: 'Ungültige Bestell-ID.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const verkaufId = body.verkaufId as string;
  const session = client.startSession();
  try {
    const rechnung = await session.withTransaction(async () => {
      const verkaeufe = db.collection('vereinskleider_verkaeufe');
      const rechnungen = db.collection('vereinskleider_rechnungen');
      const _id = new ObjectId(verkaufId);
      const verkauf = await verkaeufe.findOne({ _id, vereinId }, { session });
      if (!verkauf) throw new TrancheFehler('Bestellung nicht gefunden.', 404);
      if (verkauf.rechnungId) throw new TrancheFehler('Für diese Bestellung existiert bereits ein vollständiger Beleg.');
      if (!Array.isArray(verkauf.positionen) || !verkauf.positionen.length ||
          rappen(verkauf.rabattTotal ?? 0) !== 0 ||
          (verkauf.rabatte ?? []).length > 0 || rappen(verkauf.zusaetzlicherRabatt ?? 0) !== 0) {
        throw new TrancheFehler('Rechnungstranchen sind nur für Bestellungen ohne Rabatte möglich.');
      }
      const vorherige = await rechnungen.find({ vereinId, verkaufId, rechnungstranche: true }, { session }).toArray();
      if (vorherige.some((r) => !Array.isArray(r.positionen) || r.status === 'storniert')) {
        throw new TrancheFehler('Bereits erstellte Rechnungen müssen zuerst geklärt werden.');
      }
      const abgerechnet = vorherige.flatMap((r) =>
        (r.positionen as { positionsIndex: number; menge: number }[]).map((p) => ({
          positionsIndex: p.positionsIndex, menge: p.menge
        }))
      );
      let tranche;
      try {
        tranche = berechneNaechsteRechnungstranche(
          verkauf.positionen.map((p, positionsIndex) => ({
            positionsIndex, menge: p.menge as number, einzelpreis: p.einzelpreis as number | null,
            preisOffen: p.preisOffen === true, storniertMenge: p.storniertMenge as number | undefined
          })), abgerechnet
        );
      } catch (e) {
        throw new TrancheFehler(e instanceof Error ? e.message : 'Ungültige Bestellpositionen.');
      }
      if (!tranche.positionen.length || tranche.gesamtbetrag <= 0) {
        throw new TrancheFehler('Es gibt keine weiteren verrechenbaren Positionen.');
      }
      const bisherVerrechnet = vorherige.reduce((sum, r) => sum + rappen(r.gesamtbetrag), 0);
      // Nur Zahlungen aus dem ursprünglichen Verkauf verbrauchen dessen Guthaben.\n      // Spätere direkte Rechnungseingänge dürfen nicht nochmals vom Verkauf abgezogen werden.\n      const bisherZugeordnet = vorherige.reduce((sum, r) => {\n        const eintraege = r.zahlungen as { betrag: number; quelle?: string }[] | undefined;\n        return sum + (Array.isArray(eintraege) && eintraege.length\n          ? eintraege.filter((z) => z.quelle === 'verkauf').reduce((teil, z) => teil + rappen(z.betrag), 0)\n          : rappen(r.bezahltBetrag));\n      }, 0);
      const bezahltGesamt = rappen(verkauf.bezahltBetrag ?? 0);
      const zahlungen = verkauf.zahlungen ?? [];
      if (!Array.isArray(zahlungen) || zahlungen.some((z) => rappen(z.betrag) <= 0) ||
          zahlungen.reduce((sum, z) => sum + rappen(z.betrag), 0) !== bezahltGesamt ||
          bisherZugeordnet > bezahltGesamt || bisherZugeordnet > bisherVerrechnet ||
          bezahltGesamt > rappen(verkauf.endbetrag)) {
        throw new TrancheFehler('Die Zahlungshistorie ist nicht konsistent.');
      }
      const gesamtRappen = rappen(tranche.gesamtbetrag);
      const neuBezahlt = Math.min(gesamtRappen, bezahltGesamt - bisherZugeordnet);\n      // Zahlungen chronologisch und centgenau der neuen Rechnung zuordnen.\n      // Es wird kein zweiter Zahlungseingang gebucht, sondern die bestehende\n      // Verkaufshistorie als Rechnungsnachweis übernommen.\n      let ueberspringen = bisherZugeordnet;\n      let zuordnen = neuBezahlt;\n      const zugeordneteZahlungen: { betrag: number; datum: Date; zahlungsart: string; quelle: 'verkauf' }[] = [];\n      for (const z of zahlungen) {\n        const wert = rappen(z.betrag);\n        const skip = Math.min(wert, ueberspringen);\n        ueberspringen -= skip;\n        const anteil = Math.min(wert - skip, zuordnen);\n        if (anteil > 0) {\n          const datum = new Date(z.datum);\n          if (Number.isNaN(datum.getTime()) || !['bar', 'twint', 'rechnung'].includes(z.zahlungsart)) {\n            throw new TrancheFehler('Ungültige Zahlungshistorie.');\n          }\n          zugeordneteZahlungen.push({ betrag: anteil / 100, datum, zahlungsart: z.zahlungsart, quelle: 'verkauf' });\n          zuordnen -= anteil;\n        }\n      }\n      if (zuordnen !== 0) throw new TrancheFehler('Zahlungszuordnung unvollständig.');
      const jetzt = new Date();
      const jahr = jetzt.getFullYear();
      const zaehler = await db.collection<Document & { _id: string; nummer: number }>('vereinskleider_rechnungsnummern').findOneAndUpdate(
        { _id: `${vereinId}:${jahr}` },
        { $inc: { nummer: 1 }, $setOnInsert: { vereinId, jahr } },
        { upsert: true, returnDocument: 'after', session }
      );
      if (!zaehler || typeof zaehler.nummer !== 'number') throw new TrancheFehler('Rechnungsnummer konnte nicht erstellt werden.', 500);
      const rechnungsnummer = `${jahr}-${String(zaehler.nummer).padStart(5, '0')}`;
      const rechnungId = new ObjectId();
      const positionen = tranche.positionen.map((p) => ({
        ...verkauf.positionen[p.positionsIndex], positionsIndex: p.positionsIndex,
        menge: p.menge, einzelpreis: p.einzelpreis, positionsbetrag: p.betrag, preisOffen: false
      }));
      const status = neuBezahlt === gesamtRappen ? 'bezahlt' :
        neuBezahlt > 0 ? 'teilweise_bezahlt' : 'offen';
      const dokument = {
        _id: rechnungId, vereinId, verkaufId, rechnungstranche: true,
        rechnungsnummer, empfaenger: verkauf.kaeufer, riegen: verkauf.riegen ?? [],
        zahlungsart: verkauf.zahlungsart, bemerkung: verkauf.bemerkung ?? '',
        positionen, rabatte: [], zusaetzlicherRabatt: 0,
        zwischentotal: tranche.gesamtbetrag, rabattTotal: 0,
        gesamtbetrag: tranche.gesamtbetrag, bezahltBetrag: neuBezahlt / 100,
        // Zahlungseingänge gehören zum Verkauf; die Tranche hält nur die
        // zugeordnete Summe. Keine zweite Zahlungsbuchung erzeugen.
        zahlungen: [],
        status, erstelltAm: jetzt, aktualisiertAm: jetzt,
        clubdeskExportStatus: 'nicht_exportiert' as const
      };
      const beansprucht = await verkaeufe.updateOne(
        { _id, vereinId, rechnungId: { $exists: false }, aktualisiertAm: verkauf.aktualisiertAm },
        { $addToSet: { trancheRechnungIds: rechnungId.toString() },
          $set: { aktualisiertAm: jetzt } }, { session }
      );
      if (beansprucht.modifiedCount !== 1) throw new TrancheFehler('Bestellung wurde zwischenzeitlich geändert.');
      await rechnungen.insertOne(dokument, { session });
      return { _id: rechnungId.toString(), rechnungsnummer, gesamtbetrag: tranche.gesamtbetrag,
        offenePreispositionen: tranche.offenePreispositionen };
    });
    return json({ erfolg: true, rechnung }, { status: 201 });
  } catch (e) {
    if (e instanceof TrancheFehler) return json({ fehler: e.message }, { status: e.status });
    console.error('Rechnungstranche:', e);
    return json({ fehler: 'Rechnungstranche konnte nicht erstellt werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
