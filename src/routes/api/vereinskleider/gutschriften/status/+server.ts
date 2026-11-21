import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { client, db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

class StatusFehler extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
const idGueltig = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const geld = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 ||
      !Number.isSafeInteger(Math.round(v * 100)) ||
      Math.abs(v * 100 - Math.round(v * 100)) > 0.000001) {
    throw new StatusFehler('Ungültiger Geldbetrag.', 400);
  }
  return Math.round(v * 100);
};

/** Dokumentiert eine bereits ausgeführte Auszahlung – führt selbst keine Zahlung aus. */
export const PATCH: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verkauf:verwalten');
  if (zugriff) return zugriff;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body) || !idGueltig(body.gutschriftId) ||
      !['erledigt', 'rueckerstattet'].includes(String(body.aktion))) {
    return json({ fehler: 'Ungültige Statusänderung.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const session = client.startSession();
  try {
    const ergebnis = await session.withTransaction(async () => {
      const gutschriften = db.collection('vereinskleider_gutschriften');
      const rechnungen = db.collection('vereinskleider_rechnungen');
      const _id = new ObjectId(body.gutschriftId as string);
      const g = await gutschriften.findOne({ _id, vereinId }, { session });
      if (!g) throw new StatusFehler('Gutschrift nicht gefunden.', 404);
      if (!idGueltig(g.rechnungId)) throw new StatusFehler('Rechnungsreferenz ungültig.');
      const rechnung = await rechnungen.findOne({
        _id: new ObjectId(g.rechnungId), vereinId
      }, { session });
      if (!rechnung) throw new StatusFehler('Zugehörige Rechnung fehlt.');
      const gesamt = geld(rechnung.gesamtbetrag);
      const bezahlt = geld(rechnung.bezahltBetrag ?? 0);
      const gutgeschrieben = geld(rechnung.gutgeschriebenBetrag ?? 0);
      const betrag = geld(g.betrag);
      if (gutgeschrieben > gesamt || bezahlt > gesamt || betrag > gutgeschrieben) {
        throw new StatusFehler('Rechnungs- und Gutschriftbeträge sind inkonsistent.');
      }
      // Rückerstattungen werden über alle Gutschriften einer Rechnung abgeglichen.
      // Bereits ausbezahlte Beträge dürfen niemals erneut ausgezahlt werden.
      const alle = await gutschriften.find({ vereinId, rechnungId: g.rechnungId }, { session }).toArray();
      if (!alle.some((eintrag) => eintrag._id.toString() === _id.toString())) {
        throw new StatusFehler('Gutschrift ist nicht mehr verfügbar.');
      }
      const summeGutschriften = alle.reduce((summe, eintrag) => summe + geld(eintrag.betrag), 0);
      if (summeGutschriften !== gutgeschrieben) {
        throw new StatusFehler('Gutschriften stimmen nicht mit der Rechnung überein.');
      }
      const bereitsGesamt = alle.reduce((summe, eintrag) => summe + geld(eintrag.rueckerstattetBetrag ?? 0), 0);
      const bereits = geld(g.rueckerstattetBetrag ?? 0);
      const ueberzahlung = Math.max(0, bezahlt - (gesamt - gutgeschrieben));
      if (bereitsGesamt > ueberzahlung || bereits > betrag) {
        throw new StatusFehler('Bereits dokumentierte Rückerstattung ist inkonsistent.');
      }
      if (g.bearbeitungsstatus === 'erledigt' || g.bearbeitungsstatus === 'rueckerstattet') {
        throw new StatusFehler('Gutschrift ist bereits abgeschlossen.');
      }
      const jetzt = new Date();
      let status: 'erledigt' | 'rueckerstattet' | 'teilweise_rueckerstattet';
      let rueckerstattetNeu = bereits;
      const historie = Array.isArray(g.rueckerstattungen) ? [...g.rueckerstattungen] : [];
      if (body.aktion === 'erledigt') {
        if (ueberzahlung > bereitsGesamt) {
          throw new StatusFehler('Es besteht noch eine offene Rückerstattung auf der Rechnung.');
        }
        status = bereits > 0 ? 'rueckerstattet' : 'erledigt';
      } else {
        if (typeof body.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.datum) ||
            !['bank', 'twint', 'bar'].includes(String(body.zahlungsart)) ||
            typeof body.bemerkung !== 'string' || body.bemerkung.length > 1000) {
          throw new StatusFehler('Datum, Zahlungsweg oder Bemerkung ungültig.', 400);
        }
        const datum = new Date(body.datum + 'T12:00:00Z');
        if (Number.isNaN(datum.getTime()) || datum.toISOString().slice(0, 10) !== body.datum) {
          throw new StatusFehler('Ungültiges Rückerstattungsdatum.', 400);
        }
        const auszahlung = geld(body.betrag);
        const rechnungsRest = ueberzahlung - bereitsGesamt;
        if (auszahlung <= 0 || auszahlung > rechnungsRest || auszahlung > betrag - bereits) {
          throw new StatusFehler('Rückerstattung überschreitet den offenen Betrag der Gutschrift oder Rechnung.');
        }
        rueckerstattetNeu += auszahlung;
        historie.push({
          betrag: auszahlung / 100, datum, zahlungsart: body.zahlungsart,
          bemerkung: body.bemerkung.trim(), erfasstAm: jetzt,
          erfasstVon: locals.benutzer!.id ?? null
        });
        status = rueckerstattetNeu === betrag ? 'rueckerstattet' : 'teilweise_rueckerstattet';
      }
      const abgeschlossen = status !== 'teilweise_rueckerstattet';
      const rueckerstattungOffen = (ueberzahlung - bereitsGesamt - (rueckerstattetNeu - bereits)) / 100;
      const update = await gutschriften.updateOne({
        _id, vereinId, bearbeitungsstatus: g.bearbeitungsstatus === undefined
          ? { $exists: false } : g.bearbeitungsstatus,
        rueckerstattetBetrag: g.rueckerstattetBetrag === undefined
          ? { $exists: false } : g.rueckerstattetBetrag
      }, { $set: {
        bearbeitungsstatus: status, rueckerstattetBetrag: rueckerstattetNeu / 100,
        rueckerstattungen: historie, abgeschlossenAm: abgeschlossen ? jetzt : null,
        abgeschlossenVon: abgeschlossen ? (locals.benutzer!.id ?? null) : null
      } }, { session });
      if (update.modifiedCount !== 1) throw new StatusFehler('Gutschrift wurde zwischenzeitlich geändert.');
      // Den verbleibenden Rückerstattungsbetrag auf der Rechnung ausweisen.
      const rechnungsUpdate = await rechnungen.updateOne({
        _id: rechnung._id, vereinId, bezahltBetrag: rechnung.bezahltBetrag,
        gutgeschriebenBetrag: rechnung.gutgeschriebenBetrag === undefined
          ? { $exists: false } : rechnung.gutgeschriebenBetrag
      }, { $set: {
        rueckerstattungOffen,
        aktualisiertAm: jetzt
      } }, { session });
      if (rechnungsUpdate.modifiedCount !== 1) throw new StatusFehler('Rechnung wurde zwischenzeitlich geändert.');
      return { status, rueckerstattungOffen };
    });
    return json({ erfolg: true, ...ergebnis });
  } catch (e) {
    if (e instanceof StatusFehler) return json({ fehler: e.message }, { status: e.status });
    console.error('Gutschriftstatus:', e);
    return json({ fehler: 'Gutschrift konnte nicht abgeschlossen werden.' }, { status: 500 });
  } finally {
    await session.endSession();
  }
};
