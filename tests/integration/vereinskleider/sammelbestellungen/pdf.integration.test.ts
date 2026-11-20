import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccccccccccc';
const store = vi.hoisted(() => ({ docs: {} as Record<string, any>, fail: '' }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => ({
  findOne: async () => { if (store.fail === name) throw Error('DB down'); const d = store.docs[name]; return Array.isArray(d) ? (d[0] ?? null) : (d ?? null); },
  find: () => ({ project: () => ({ toArray: async () => store.docs[name] ?? [] }), toArray: async () => store.docs[name] ?? [] })
}) } }));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: () => null }));
import { POST as gesamt } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import { GET as einzel } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import { GET as rechnung } from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
const locals = { benutzer: { vereinId: A } } as any;
const pos = (overrides = {}) => ({ artikelId: B, groesseId: null, artikelname: 'T-Shirt', menge: 2, ...overrides });
const best = (overrides = {}) => ({ _id: new ObjectId(B), vereinId: A, lieferantId: C, status: 'bestellt', positionen: [pos()], erstelltAm: new Date('2026-01-01'), ...overrides });
const bill = (overrides = {}) => ({ _id: new ObjectId(B), vereinId: A, rechnungsnummer: 'R-15', empfaenger: 'Test Person', positionen: [{ artikelname: 'Shirt', menge: 2, einzelpreis: 10 }], zwischentotal: 20, rabattTotal: 0, gesamtbetrag: 20, erstelltAm: new Date('2026-01-01'), status: 'offen', ...overrides });
const event = (id = B, query = '') => ({ params: { id }, locals, url: new URL('http://localhost/api/pdf' + query) }) as any;
const post = (ids: any) => ({ locals, request: new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bestellungIds: ids }) }) }) as any;
async function status(promise: Response | Promise<Response>) { try { return (await promise).status; } catch (e: any) { return e.status ?? e.statusCode; } }
beforeEach(() => { store.docs = { vereinskleider_sammelbestellungen: [best()], lieferanten: { name: 'Lieferant' }, vereine: { name: 'Turnverein' }, groessen: [], vereinskleider_rechnungen: bill(), vereinskleider_gutschriften: null }; store.fail = ''; vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('P15 Gesamt-PDF: Validierung, Lieferanten, Positionen und Layout', () => {
  it.each([[], [B, B], ['ungueltig'], Array.from({length: 51}, () => B)])('weist ungueltige ID-Listen ab', async ids => { expect(await status(gesamt(post(ids)))).toBe(400); });
  it('404 bei fehlender Bestellung', async () => { store.docs.vereinskleider_sammelbestellungen = []; expect(await status(gesamt(post([B])))).toBe(404); });
  it('409 bei fehlendem Lieferanten', async () => { store.docs.lieferanten = null; expect(await status(gesamt(post([B])))).toBe(409); });
  it('409 bei fehlender Lieferanten-ID', async () => { store.docs.vereinskleider_sammelbestellungen = [best({lieferantId: null})]; expect(await status(gesamt(post([B])))).toBe(409); });
  it('409 bei leeren Positionen', async () => { store.docs.vereinskleider_sammelbestellungen = [best({positionen: []})]; expect(await status(gesamt(post([B])))).toBe(409); });
  it.each([0,-1,1.5,Number.MAX_SAFE_INTEGER + 1])('409 bei ungueltiger Menge %s', async menge => { store.docs.vereinskleider_sammelbestellungen = [best({positionen: [pos({menge})]})]; expect(await status(gesamt(post([B])))).toBe(409); });
  it('erzeugt mehrseitige PDF mit langen Artikelnamen und Fallbacks', async () => { store.docs.vereinskleider_sammelbestellungen = [best({positionen: Array.from({length: 65}, (_,i) => pos({artikelId: B, groesseId: i % 2 ? null : C, artikelname: 'Sehr langes Artikelwort'.repeat(12) + i, menge: 1}))})]; const response = await gesamt(post([B])); expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('pdf'); expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(500); });
  it('500 bei Datenbankfehler', async () => { store.fail = 'lieferanten'; expect(await status(gesamt(post([B])))).toBe(500); });
});

describe('P15 Einzel-PDF: Daten und Sonderfaelle', () => {
  it('400 bei ungueltiger ID', async () => { expect(await status(einzel(event('invalid')))).toBe(400); });
  it('404 bei fehlender Bestellung', async () => { store.docs.vereinskleider_sammelbestellungen = null; expect(await status(einzel(event()))).toBe(404); });
  it('409 bei leerer Bestellung', async () => { store.docs.vereinskleider_sammelbestellungen = best({positionen: []}); expect(await status(einzel(event()))).toBe(409); });
  it.each([0,-1,1.1])('409 bei ungueltiger Menge %s', async menge => { store.docs.vereinskleider_sammelbestellungen = best({positionen: [pos({menge})]}); expect(await status(einzel(event()))).toBe(409); });
  it('PDF mit Bemerkung, Groessen-Fallback und Seitenumbruch', async () => { store.docs.vereinskleider_sammelbestellungen = best({bemerkung: 'Hinweis '.repeat(200), positionen: Array.from({length: 50}, (_,i) => pos({artikelname: 'Sehr lang '.repeat(18) + i, groesseId: C, menge: 1}))}); const r = await einzel(event()); expect(r.status).toBe(200); expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(500); });
  it('500 bei DB-Ausfall', async () => { store.fail = 'vereinskleider_sammelbestellungen'; expect(await status(einzel(event()))).toBe(500); });
});

describe('P15 Verrechnung-PDF: Rechnungen, Quittungen, Gutschriften', () => {
  it('400 bei ungueltiger Rechnungs-ID', async () => { expect((await rechnung(event('invalid'))).status).toBe(400); });
  it('404 bei fehlender Rechnung', async () => { store.docs.vereinskleider_rechnungen = null; expect((await rechnung(event())).status).toBe(404); });
  it('400 bei ungueltiger Gutschrift-ID', async () => { expect((await rechnung(event(B, '?gutschriftId=invalid'))).status).toBe(400); });
  it('404 bei fehlender Gutschrift', async () => { expect((await rechnung(event(B, '?gutschriftId=' + C))).status).toBe(404); });
  it.each([{status: 'offen'}, {status: 'bezahlt', bezahltBetrag: 20, zahlungsart: 'twint'}, {status: 'bezahlt', bezahltBetrag: 20, zahlungsart: 'bar'}, {status: 'storniert'}, {bezahltBetrag: 25, gutgeschriebenBetrag: 10}, {rabatte: [{name: 'Vereinsrabatt', betrag: 3}], zusaetzlicherRabatt: 2}, {zahlungen: [{betrag: 5, datum: '2026-02-01', zahlungsart: 'rechnung'}, {betrag: -2, datum: 'ungueltig', zahlungsart: 'bar'}]}])('erstellt PDF fuer Rechnungsvariante %#', async variation => { store.docs.vereinskleider_rechnungen = bill(variation); const r = await rechnung(event()); expect(r.status).toBe(200); expect(r.headers.get('content-type')).toContain('pdf'); });
  it('erzeugt Gutschrift mit Sonderzeichen und unbekannter Groesse', async () => { store.docs.vereinskleider_gutschriften = {gutschriftnummer: 'GS/15', rechnungsnummer: 'R-15', artikelname: 'Grösse', groesseId: C, menge: 1, einzelpreis: 10, betrag: 10, grund: 'Rueckgabe', erstelltAm: new Date('2026-01-02')}; const r = await rechnung(event(B, '?gutschriftId=' + C)); expect(r.status).toBe(200); expect(r.headers.get('content-disposition')).toContain('GS_15'); });
  it('500 bei Datenbankfehler', async () => { store.fail = 'vereinskleider_rechnungen'; expect((await rechnung(event())).status).toBe(500); });
});
