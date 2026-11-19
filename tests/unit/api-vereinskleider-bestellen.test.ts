import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({ find: vi.fn(), sort: vi.fn(), limit: vi.fn(), toArray: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({ find: mocks.find })) }
}));
import { GET } from '../../src/routes/api/vereinskleider/bestellungen/+server';

const vereinId = 'verein-test';
const admin = { id: 'admin', rolle: 'admin', vereinId };
const vorgangId = new ObjectId();
const basis = () => ({
  artikelId: new ObjectId().toString(), groesseId: null, artikelname: 'Vereinsjacke',
  menge: 5, einzelpreis: 39.5, verkaufsart: 'bestellung' as const
});
const vorgang = (positionen: unknown[] = [basis()], zusatz: Record<string, unknown> = {}) => ({
  _id: vorgangId, erstelltAm: new Date('2026-11-01'), kaeufer: 'Jennifer',
  riegen: ['Aktivriege'], zahlungsart: 'rechnung', zahlungsstatus: 'offen', positionen, ...zusatz
});
let vorgaenge: Record<string, unknown>[];
function kontext(query = '', benutzer: typeof admin | null = admin) {
  return {
    locals: { benutzer },
    url: new URL(`http://localhost/api/vereinskleider/bestellungen${query ? `?${query}` : ''}`)
  } as Parameters<typeof GET>[0];
}
async function ausfuehren(query = '', benutzer: typeof admin | null = admin) {
  const response = await GET(kontext(query, benutzer));
  return { response, daten: await response.json() };
}
beforeEach(() => {
  vi.resetAllMocks();
  vorgaenge = [vorgang()];
  mocks.find.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockImplementation(async () => vorgaenge);
});

describe('ClubMatiq Vereinskleider-Bestellungen', () => {
  it('verweigert den Zugriff ohne Anmeldung', async () => {
    const { response } = await ausfuehren('', null);
    expect(response.status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it.each(['falsch', 'Offen', '123', ''])('prüft den Statusfilter %s', async (status) => {
    if (!status) return;
    const { response, daten } = await ausfuehren(`status=${status}`);
    expect(response.status).toBe(400);
    expect(daten.fehler).toBe('Ungültiger Statusfilter.');
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('fragt nur Bestellungen des eigenen Vereins ab und begrenzt auf 1000', async () => {
    await ausfuehren();
    expect(mocks.find).toHaveBeenCalledWith({ vereinId, 'positionen.verkaufsart': 'bestellung' });
    expect(mocks.sort).toHaveBeenCalledWith({ erstelltAm: -1 });
    expect(mocks.limit).toHaveBeenCalledWith(1000);
  });

  it('liefert offene Bestellungen mit korrekten Standardwerten', async () => {
    const { response, daten } = await ausfuehren();
    expect(response.status).toBe(200);
    expect(daten.anzahl).toBe(1);
    expect(daten.begrenzt).toBe(false);
    expect(daten.bestellungen[0]).toMatchObject({
      vorgangId: vorgangId.toString(), positionsIndex: 0, kaeufer: 'Jennifer',
      artikelname: 'Vereinsjacke', bestellt: 5, urspruenglichBestellt: 5,
      uebergeben: 0, reserviert: 0, storniert: 0, nochFehlend: 5,
      offen: 5, einzelpreis: 39.5, status: 'offen', zahlungsstatus: 'offen'
    });
  });

  it('ignoriert Direktverkaufspositionen und behält den Originalindex', async () => {
    vorgaenge = [vorgang([{ ...basis(), verkaufsart: 'direkt' }, basis()])];
    const { daten } = await ausfuehren();
    expect(daten.anzahl).toBe(1);
    expect(daten.bestellungen[0].positionsIndex).toBe(1);
  });

  it('verarbeitet fehlende Positionslisten', async () => {
    vorgaenge = [vorgang([], { positionen: null })];
    const { daten } = await ausfuehren('status=alle');
    expect(daten.bestellungen).toEqual([]);
  });

  it('berechnet teilweise übergebene und reservierte Mengen', async () => {
    vorgaenge = [vorgang([{ ...basis(), uebergebenMenge: 2, reserviertMenge: 1, storniertMenge: 3 }])];
    const { daten } = await ausfuehren();
    expect(daten.bestellungen[0]).toMatchObject({
      bestellt: 5, urspruenglichBestellt: 8, uebergeben: 2, reserviert: 1,
      storniert: 3, offen: 3, nochFehlend: 2, status: 'teilweise'
    });
  });

  it('zeigt teilweise Bestellungen auch beim Standardfilter offen', async () => {
    vorgaenge = [vorgang([{ ...basis(), uebergebenMenge: 1 }])];
    expect((await ausfuehren()).daten.anzahl).toBe(1);
    expect((await ausfuehren('status=teilweise')).daten.anzahl).toBe(1);
    expect((await ausfuehren('status=abgeschlossen')).daten.anzahl).toBe(0);
  });

  it('erkennt vollständig übergebene Bestellungen', async () => {
    vorgaenge = [vorgang([{ ...basis(), uebergebenMenge: 5 }])];
    expect((await ausfuehren()).daten.anzahl).toBe(0);
    const { daten } = await ausfuehren('status=abgeschlossen');
    expect(daten.bestellungen[0]).toMatchObject({ status: 'abgeschlossen', offen: 0, nochFehlend: 0 });
  });

  it('erkennt vollständig stornierte Bestellungen', async () => {
    vorgaenge = [vorgang([{ ...basis(), menge: 0, storniertMenge: 5 }])];
    const { daten } = await ausfuehren('status=storniert');
    expect(daten.bestellungen[0]).toMatchObject({ status: 'storniert', urspruenglichBestellt: 5, storniert: 5 });
    expect((await ausfuehren()).daten.anzahl).toBe(0);
  });

  it('liefert mit status=alle alle gültigen Status', async () => {
    vorgaenge = [vorgang([
      basis(), { ...basis(), uebergebenMenge: 1 },
      { ...basis(), uebergebenMenge: 5 }, { ...basis(), menge: 0, storniertMenge: 5 }
    ])];
    const { daten } = await ausfuehren('status=alle');
    expect(daten.bestellungen.map((p: { status: string }) => p.status)).toEqual([
      'offen', 'teilweise', 'abgeschlossen', 'storniert'
    ]);
  });

  it.each([
    { menge: -1 }, { menge: 1.5 }, { menge: Number.MAX_SAFE_INTEGER + 1 },
    { menge: 0, storniertMenge: 0 }, { storniertMenge: -1 },
    { storniertMenge: 1.2 }, { menge: Number.MAX_SAFE_INTEGER, storniertMenge: 1 },
    { uebergebenMenge: -1 }, { uebergebenMenge: 1.5 }, { uebergebenMenge: 6 },
    { reserviertMenge: -1 }, { reserviertMenge: 1.5 }, { reserviertMenge: 6 },
    { uebergebenMenge: 3, reserviertMenge: 3 }
  ])('ignoriert ungültige Bestellmengen: %j', async (aenderung) => {
    vorgaenge = [vorgang([{ ...basis(), ...aenderung }])];
    const { response, daten } = await ausfuehren('status=alle');
    expect(response.status).toBe(200);
    expect(daten.anzahl).toBe(0);
  });

  it('sucht unabhängig von Gross-/Kleinschreibung nach Käufer', async () => {
    expect((await ausfuehren('suche=JENNIFER')).daten.anzahl).toBe(1);
  });

  it('sucht nach Artikelname', async () => {
    expect((await ausfuehren('suche=jacke')).daten.anzahl).toBe(1);
  });

  it('sucht nach Riege und entfernt Leerzeichen', async () => {
    expect((await ausfuehren('suche=%20AKTIVRIEGE%20')).daten.anzahl).toBe(1);
  });

  it('filtert nicht passende Suchbegriffe heraus', async () => {
    expect((await ausfuehren('suche=unbekannt')).daten.anzahl).toBe(0);
  });

  it('verwendet Ersatzwerte bei fehlenden Vorgangsfeldern', async () => {
    vorgaenge = [vorgang([basis()], { kaeufer: null, riegen: null, zahlungsstatus: null })];
    const { daten } = await ausfuehren();
    expect(daten.bestellungen[0]).toMatchObject({ kaeufer: '', riegen: [], zahlungsstatus: 'offen' });
  });

  it('meldet eine Begrenzung bei genau 1000 Vorgängen', async () => {
    vorgaenge = Array.from({ length: 1000 }, () => vorgang());
    const { daten } = await ausfuehren();
    expect(daten.begrenzt).toBe(true);
    expect(daten.anzahl).toBe(1000);
  });

  it('liefert bei leerer Datenbank eine leere Liste', async () => {
    vorgaenge = [];
    const { daten } = await ausfuehren();
    expect(daten).toEqual({ bestellungen: [], anzahl: 0, begrenzt: false });
  });

  it('behandelt Datenbankfehler mit HTTP 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mocks.toArray.mockRejectedValue(new Error('Datenbank nicht erreichbar'));
      const { response, daten } = await ausfuehren();
      expect(response.status).toBe(500);
      expect(daten.fehler).toBe('Bestellungen konnten nicht geladen werden.');
    } finally {
      spy.mockRestore();
    }
  });
});
