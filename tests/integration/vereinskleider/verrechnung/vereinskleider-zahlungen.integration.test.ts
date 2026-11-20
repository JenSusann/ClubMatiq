import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
vi.mock('../../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('MONGODB_TEST_URI fehlt');
  const client = new MongoClient(uri);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../../src/lib/server/mongodb';

const vereinId = new ObjectId().toString();
const fremdVerein = new ObjectId().toString();
const rechnungId = new ObjectId();
const fremdeRechnungId = new ObjectId();
const benutzer = { id: new ObjectId().toString(), vereinId, rolle: 'admin' };
const zahlungId = 'e04c9230-14b7-47b1-997b-8dfd5d934c19';
const basis = { betrag: 25, datum: '2026-11-18', zahlungsart: 'twint', zahlungId };
function event(id: string, body: unknown, user: unknown = benutzer) {
  return { params: { id }, locals: { benutzer: user }, request: new Request('http://localhost/api/vereinskleider/verrechnung/'+id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) } as never;
}
beforeAll(async () => {
  if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank!');
  await client.connect();
  await db.collection('vereinskleider_rechnungen').insertMany([
    { _id: rechnungId, vereinId, verkaufId: new ObjectId().toString(), status: 'offen', gesamtbetrag: 50, bezahltBetrag: 0, zahlungen: [] },
    { _id: fremdeRechnungId, vereinId: fremdVerein, verkaufId: new ObjectId().toString(), status: 'offen', gesamtbetrag: 50, bezahltBetrag: 0, zahlungen: [] }
  ]);
});
afterAll(async () => {
  await db.collection('vereinskleider_rechnungen').deleteMany({ _id: { $in: [rechnungId, fremdeRechnungId] } });
  await client.close();
});
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

// Ursprüngliche Datei: vereinskleider-zahlungen.integration.test.ts
describe('Vereinskleider-Zahlungseingänge', () => {
  it('401 ohne Anmeldung', async () => expect((await route0.PATCH(event(rechnungId.toString(), basis, null))).status).toBe(401));
  it('403 für Mitglied', async () => expect((await route0.PATCH(event(rechnungId.toString(), basis, { ...benutzer, rolle: 'mitglied' }))).status).toBe(403));
  it('400 für ungültige Rechnungs-ID', async () => expect((await route0.PATCH(event('ungueltig', basis))).status).toBe(400));
  it('400 für Betrag 0', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 0 }))).status).toBe(400));
  it('400 für mehr als zwei Dezimalstellen', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 1.234 }))).status).toBe(400));
  it('400 für ungültiges Datum', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, datum: '2026-02-30' }))).status).toBe(400));
  it('400 für ungültige Zahlungsart', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, zahlungsart: 'karte' }))).status).toBe(400));
  it('400 für fehlende Zahlungs-ID', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, zahlungId: '' }))).status).toBe(400));
  it('404 für fremden Verein', async () => expect((await route0.PATCH(event(fremdeRechnungId.toString(), basis))).status).toBe(404));
  it('verbucht 25 CHF und setzt teilweise bezahlt', async () => {
    const res = await route0.PATCH(event(rechnungId.toString(), basis));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, bereitsErfasst: false, bezahltBetrag: 25, status: 'teilweise_bezahlt' });
    const doc = await db.collection('vereinskleider_rechnungen').findOne({ _id: rechnungId });
    expect(doc?.zahlungen).toHaveLength(1);
  });
  it('ist idempotent bei wiederholter Zahlungs-ID', async () => {
    const res = await route0.PATCH(event(rechnungId.toString(), basis));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ bereitsErfasst: true, bezahltBetrag: 25 });
  });
  it('409 bei wiederverwendeter Zahlungs-ID mit anderen Daten', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 20 }))).status).toBe(409));
  it('409 bei Überzahlung', async () => expect((await route0.PATCH(event(rechnungId.toString(), { ...basis, betrag: 30, zahlungId: '8cc16ac2-0930-499e-94cf-87dff96093a8' }))).status).toBe(409));
  it('begleicht die Restforderung', async () => {
    const res = await route0.PATCH(event(rechnungId.toString(), { ...basis, zahlungId: '8cc16ac2-0930-499e-94cf-87dff96093a8' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ bezahltBetrag: 50, status: 'bezahlt' });
  });
});

