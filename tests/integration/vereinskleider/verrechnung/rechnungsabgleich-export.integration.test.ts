import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  daten: [] as Record<string, unknown>[],
  credits: [] as Record<string, unknown>[],
  pruefeBerechtigung: vi.fn()
}));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({ find: () => ({
    toArray: async () => m.daten,
    sort: () => ({ limit: () => ({ toArray: async () => name === 'vereinskleider_gutschriften' ? m.credits : m.daten }) })
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
  m.credits = [];
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

import { GET as exportGutschriften } from '../../../../src/routes/api/vereinskleider/gutschriften/export/+server';

describe('Issue #121 – Gutschriftenabgleich', () => {
  function vorbereiten(bezahlt: number, erstattet: number, status = 'offen') {
    const r = { ...rechnung('2026-00001',48,false), bezahltBetrag: bezahlt, gutgeschriebenBetrag: 48 };
    m.daten = [r];
    m.credits = [{ _id: new ObjectId(), vereinId: 'verein', rechnungId: r._id.toString(),
      rechnungsnummer: r.rechnungsnummer, betrag: 48, rueckerstattetBetrag: erstattet,
      bearbeitungsstatus: status, erstelltAm: new Date(), artikelname: 'Test', menge: 1 }];
  }
  async function rest() {
    const response = await exportGutschriften(event() as never);
    expect(response.status).toBe(200);
    return (await response.text()).split('\r\n').filter(Boolean).slice(1).map(z => z.split(';')[12]);
  }
  it.each([
    [0,0,'offen','0,00'], [20,0,'offen','20,00'],
    [20,20,'rueckerstattet','0,00'], [48,20,'teilweise_rueckerstattet','28,00'],
    [48,48,'rueckerstattet','0,00']
  ] as const)('berechnet bei Zahlung %s und Erstattung %s den korrekten Rest', async (bezahlt, erstattet, status, erwartet) => {
    vorbereiten(bezahlt,erstattet,status);
    expect(await rest()).toEqual(['"' + erwartet + '"']);
  });
  it('verteilt den Rechnungsrest ohne Doppelzählung', async () => {
    vorbereiten(30,0);
    m.credits = [{ ...m.credits[0], betrag: 24 }, { ...m.credits[0], _id: new ObjectId(), betrag: 24 }];
    expect(await rest()).toEqual(['"24,00"','"6,00"']);
  });
  it('verweigert inkonsistente Erstattungen', async () => {
    vorbereiten(20,21);
    expect((await exportGutschriften(event() as never)).status).toBe(409);
  });
  it('verweigert fehlende Rechnungszuordnung', async () => {
    vorbereiten(20,0);
    m.daten = [];
    expect((await exportGutschriften(event() as never)).status).toBe(409);
  });
  it('verweigert Zugriff ohne Berechtigung', async () => {
    m.pruefeBerechtigung.mockReturnValue(new Response('Verboten',{status:403}));
    expect((await exportGutschriften(event() as never)).status).toBe(403);
  });
});
