import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), findOne: vi.fn(), find: vi.fn() }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const sizeId = '507f1f77bcf86cd799439012';
const invoice = (overrides = {}) => ({ _id: new ObjectId(id), vereinId, rechnungsnummer: 'RE-2026-100', empfaenger: 'Test Mitglied', riegen: ['Aktive'], positionen: [{ artikelname: 'Jacke', groesseId: null, menge: 2, einzelpreis: 20, positionsbetrag: 40 }], zwischentotal: 40, rabattTotal: 0, gesamtbetrag: 40, bezahltBetrag: 0, zahlungsart: 'rechnung', erstelltAm: new Date('2026-11-10T12:00:00Z'), status: 'offen', ...overrides });
const credit = (overrides = {}) => ({ _id: new ObjectId(), vereinId, rechnungId: id, rechnungsnummer: 'RE-2026-100', gutschriftnummer: 'GS-100', artikelname: 'Jacke', groesseId: null, menge: 1, einzelpreis: 20, betrag: 20, grund: 'Falsche Grösse', erstelltAm: new Date('2026-11-11T12:00:00Z'), ...overrides });
function setup(inv: unknown = invoice(), cr: unknown = null, size: unknown = null, club: unknown = { name: 'TV Weiningen' }) {
 m.collection.mockImplementation((name: string) => ({
  findOne: async () => name === 'vereinskleider_rechnungen' ? inv : name === 'vereinskleider_gutschriften' ? cr : name === 'vereine' ? club : name === 'groessen' ? size : null,
  find: () => ({ toArray: async () => size ? [size] : [] })
 }));
}
const event = (query = '') => ({ locals: { benutzer: { id, vereinId, rolle: 'admin' } }, params: { id }, url: new URL('http://localhost/api/pdf' + query) });
beforeEach(() => { vi.clearAllMocks(); });
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-gutschrift-langer-grund.integration.test.ts
describe('27-pdf-gutschrift-langer-grund', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), credit({ grund: 'Korrektur '.repeat(180) }), { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route0.GET(event('?gutschriftId=507f1f77bcf86cd799439013') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Gutschrift-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route1 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-gutschrift-mit-groesse.integration.test.ts
describe('27-pdf-gutschrift-mit-groesse', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), credit({ groesseId: sizeId }), { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route1.GET(event('?gutschriftId=507f1f77bcf86cd799439013') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Gutschrift-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route2 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-gutschrift-ohne-groesse.integration.test.ts
describe('27-pdf-gutschrift-ohne-groesse', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), credit(), { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route2.GET(event('?gutschriftId=507f1f77bcf86cd799439013') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Gutschrift-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route3 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-quittung-bar.integration.test.ts
describe('27-pdf-quittung-bar', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, zahlungsart: 'bar', status: 'bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route3.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Quittung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route4 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-quittung-twint.integration.test.ts
describe('27-pdf-quittung-twint', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, zahlungsart: 'twint', status: 'bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route4.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Quittung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route5 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-bezahlt.integration.test.ts
describe('27-pdf-rechnung-bezahlt', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, zahlungsart: 'rechnung', status: 'bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route5.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route6 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-groessen.integration.test.ts
describe('27-pdf-rechnung-groessen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ positionen: [{ artikelname: 'Shirt', groesseId: sizeId, menge: 1, einzelpreis: 20 }] }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route6.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route7 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-mehrseitig.integration.test.ts
describe('27-pdf-rechnung-mehrseitig', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ positionen: Array.from({ length: 50 }, (_, i) => ({ artikelname: 'Jacke ' + i, menge: 1, einzelpreis: 1 })) }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route7.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route8 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-offen.integration.test.ts
describe('27-pdf-rechnung-offen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route8.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route9 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-rabatte.integration.test.ts
describe('27-pdf-rechnung-rabatte', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ rabatte: [{ name: 'Mitgliederrabatt', betrag: 5 }], zusaetzlicherRabatt: 2, rabattTotal: 7, gesamtbetrag: 33 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route9.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route10 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-rueckerstattung.integration.test.ts
describe('27-pdf-rechnung-rueckerstattung', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, gutgeschriebenBetrag: 20 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route10.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route11 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-storniert.integration.test.ts
describe('27-pdf-rechnung-storniert', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ status: 'storniert', gutgeschriebenBetrag: 40 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route11.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route12 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-teilbezahlt.integration.test.ts
describe('27-pdf-rechnung-teilbezahlt', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 10, status: 'teilweise_bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route12.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route13 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-ungueltige-zahlungen.integration.test.ts
describe('27-pdf-rechnung-ungueltige-zahlungen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ zahlungen: [{ betrag: -1, datum: 'ungueltig', zahlungsart: 'bar' }, { betrag: 40, datum: '2026-11-10', zahlungsart: 'bar' }] }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route13.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

import * as route14 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 27-pdf-rechnung-zahlungen.integration.test.ts
describe('27-pdf-rechnung-zahlungen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ zahlungen: [{ betrag: 10, datum: '2026-11-10', zahlungsart: 'twint' }, { betrag: 30, datum: new Date('2026-11-11'), zahlungsart: 'bar' }], bezahltBetrag: 40 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route14.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });

