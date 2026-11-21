import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  daten: [] as Record<string, unknown>[],
  pruefeBerechtigung: vi.fn()
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: () => ({ find: () => ({
    sort: () => ({ limit: () => ({ toArray: async () => m.daten }) })
  }) }) }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: m.pruefeBerechtigung
}));
import { GET } from '../../../../src/routes/api/vereinskleider/verrechnung/export/+server';

const event = () => ({ locals: { benutzer: { vereinId: 'verein', rolle: 'admin' } } });
const rechnung = (nummer: string, betrag: number, teilrechnung: boolean) => ({
  _id: new ObjectId(), vereinId: 'verein', verkaufId: 'verkauf-1',
  rechnungsnummer: nummer, rechnungstranche: teilrechnung,
  erstelltAm: new Date('2026-11-21T12:00:00Z'), empfaenger: 'Test',
  status: 'offen', gesamtbetrag: betrag, bezahltBetrag: 0
});
beforeEach(() => {
  m.daten = [];
  m.pruefeBerechtigung.mockReset();
});
describe('Issue #68 – Rechnungsabgleich mit mehreren Teilrechnungen', () => {
  it('exportiert zwei Rechnungen derselben Bestellung als separate Zeilen', async () => {
    m.daten = [rechnung('2026-00001', 28, true), rechnung('2026-00002', 50, true)];
    const res = await GET(event() as never);
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain('2026-00001');
    expect(csv).toContain('2026-00002');
    expect(csv).toContain('"28,00"');
    expect(csv).toContain('"50,00"');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3);
  });
  it('berechnet Gutschrift und Rückerstattung ohne negative Forderung', async () => {
    m.daten = [{ ...rechnung('2026-00003', 28, true), bezahltBetrag: 28, gutgeschriebenBetrag: 10 }];
    const res = await GET(event() as never);
    const csv = await res.text();
    expect(csv).toContain('"18,00"');
    expect(csv).toContain('"10,00"');
  });
  it('verhindert Export bei inkonsistenten Beträgen', async () => {
    m.daten = [{ ...rechnung('2026-00004', 28, true), gutgeschriebenBetrag: 40 }];
    expect((await GET(event() as never)).status).toBe(500);
  });
  it('prüft Berechtigungen', async () => {
    m.pruefeBerechtigung.mockReturnValue(new Response('Verboten', { status: 403 }));
    expect((await GET(event() as never)).status).toBe(403);
  });
});
