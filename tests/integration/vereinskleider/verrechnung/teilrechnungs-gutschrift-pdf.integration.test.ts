import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({ invoice: null as Record<string, unknown> | null, credit: null as Record<string, unknown> | null }));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    findOne: async () => name === 'vereinskleider_rechnungen' ? m.invoice :
      name === 'vereinskleider_gutschriften' ? m.credit :
      name === 'vereine' ? { name: 'Turnverein' } : null
  }) }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: () => null }));
import { GET } from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

const vereinId = new ObjectId().toString();
const rechnungId = new ObjectId().toString();
const gutschriftId = new ObjectId().toString();
const basis = () => ({
  vereinId, rechnungsnummer: '2026-00002', empfaenger: 'Testmitglied',
  gesamtbetrag: 100, bezahltBetrag: 70, gutgeschriebenBetrag: 50,
  rueckerstattungOffen: 20, status: 'bezahlt', erstelltAm: new Date('2026-11-21'),
  positionen: [{ artikelname: 'Tasche', menge: 2, einzelpreis: 50, positionsbetrag: 100 }],
  zwischentotal: 100, rabattTotal: 0
});
const credit = () => ({
  vereinId, rechnungId, rechnungsnummer: '2026-00002',
  gutschriftnummer: 'GS-123456789012', artikelname: 'Tasche',
  menge: 1, einzelpreis: 50, betrag: 50, grund: 'Nicht benötigt',
  erstelltAm: new Date('2026-11-21')
});
const load = (creditId: string | null = gutschriftId) => GET({
  locals: { benutzer: { vereinId, rolle: 'admin' } },
  params: { id: rechnungId },
  url: new URL('http://localhost/api/vereinskleider/verrechnung/' + rechnungId +
    '/pdf' + (creditId ? '?gutschriftId=' + creditId : ''))
} as never);

beforeEach(() => { m.invoice = basis(); m.credit = credit(); });
describe('Issue #68 – Gutschrift-PDF einer Teilrechnung', () => {
  it('liefert ein separates PDF mit Gutschriftnummer', async () => {
    const response = await load();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('Gutschrift-GS-123456789012.pdf');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(500);
  });
  it('liefert die korrigierte Rechnung weiterhin als PDF', async () => {
    const response = await load(null);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
  });
  it('verweigert unbekannte Gutschriften', async () => {
    m.credit = null;
    expect((await load()).status).toBe(404);
  });
  it('verweigert Gutschriften mit ungültiger ID', async () => {
    expect((await load('falsch')).status).toBe(400);
  });
});
