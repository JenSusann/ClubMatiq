import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ collection: vi.fn(), permission: vi.fn<() => Response | null>(() => null), find: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: mocks.collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.permission }));

import { GET as inventarGET } from '../../../src/routes/api/inventar-uebersicht/+server';
import { GET as mitgliederGET } from '../../../src/routes/api/mitglieder/+server';
import { GET as bestellungenGET } from '../../../src/routes/api/vereinskleider/bestellungen/+server';

const id = (n: number) => n.toString(16).padStart(24, '0');
let data: Record<string, any[]>;
let errors: Record<string, Error>;
const cursor = (name: string) => ({
  sort() { return this; }, limit() { return this; }, project() { return this; },
  async toArray() { if (errors[name]) throw errors[name]; return data[name] ?? []; }
});
function event(query = '', loggedIn = true) {
  return { locals: { benutzer: loggedIn ? { vereinId: 'verein-1' } : null }, url: new URL('http://localhost/api/test' + query) } as never;
}
async function read(handler: (e: never) => Response | Promise<Response>, query = '', loggedIn = true) {
  const r = await handler(event(query, loggedIn));
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
}
beforeEach(() => {
  vi.clearAllMocks();
  data = {}; errors = {};
  mocks.permission.mockReturnValue(null);
  mocks.collection.mockImplementation((name: string) => ({ find: () => cursor(name) }));
});

describe('Paket 34 – Inventarübersicht', () => {
  it('verweigert Zugriff ohne Anmeldung', async () => { expect((await read(inventarGET, '', false)).status).toBe(401); });
  it('liefert leeres Inventar', async () => { expect((await read(inventarGET)).body).toEqual([]); });
  it('behandelt Datenbankfehler', async () => { errors.artikel = new Error('DB'); expect((await read(inventarGET)).status).toBe(500); });
  it('berechnet Artikel ohne Grössen mit Preis und Bestand', async () => {
    data.artikel = [{ _id: id(1), name: 'Ball', kategorieId: id(2), lagerortId: id(3), menge: 4, einzelwert: 15, mindestbestand: 5, hatGroessen: false }];
    data.kategorien = [{ _id: id(2), name: 'Sport' }]; data.lagerorte = [{ _id: id(3), name: 'Halle' }];
    const r = await read(inventarGET); expect(r.status).toBe(200);
    expect(r.body[0]).toMatchObject({ inventarwert: 60, gesamtmenge: 4, preisFehlt: false, unterMindestbestand: true, kategorie: 'Sport', lagerort: 'Halle' });
  });
  it.each([undefined, -1, Infinity, '15'] )('kennzeichnet ungültigen Preis %s', async (preis) => {
    data.artikel = [{ _id: id(1), name: 'Ball', menge: 2, einzelwert: preis, hatGroessen: false }];
    const r = await read(inventarGET); expect(r.body[0]).toMatchObject({ preisFehlt: true, inventarwert: 0, einzelwert: 0, kategorie: 'Unbekannt', lagerort: 'Unbekannt' });
  });
  it('markiert fehlenden Preis bei Nullbestand nicht', async () => {
    data.artikel = [{ _id: id(1), menge: 0, hatGroessen: false, mindestbestand: -2 }];
    expect((await read(inventarGET)).body[0]).toMatchObject({ preisFehlt: false, mindestbestand: 0, unterMindestbestand: false });
  });
  it('berechnet Varianten und sortiert nach Grössenreihenfolge', async () => {
    data.artikel = [{ _id: id(1), name: 'Trikot', hatGroessen: true, menge: 999 }];
    data.groessen = [{ _id: id(2), bezeichnung: 'S', sortierung: 2 }, { _id: id(3), bezeichnung: 'M', sortierung: 1 }];
    data.artikelvarianten = [
      { artikelId: id(1), groesseId: id(2), menge: 3, einzelwert: 20, mindestbestand: 5 },
      { artikelId: id(1), groesseId: id(3), menge: 1, einzelwert: null, mindestbestand: 2 }
    ];
    const r = await read(inventarGET); expect(r.body[0]).toMatchObject({ gesamtmenge: 4, inventarwert: 60, preisFehlt: true, unterMindestbestand: true });
    expect(r.body[0].varianten.map((v: any) => v.groesse)).toEqual(['M', 'S']);
  });
  it('ignoriert fremde Varianten und inaktive Mindestbestandswarnungen', async () => {
    data.artikel = [{ _id: id(1), hatGroessen: true }];
    data.artikelvarianten = [{ artikelId: id(2), groesseId: id(3), menge: 99 }, { artikelId: id(1), groesseId: id(3), menge: 1, aktiv: false, mindestbestand: 10 }];
    const r = await read(inventarGET); expect(r.body[0]).toMatchObject({ gesamtmenge: 1, unterMindestbestand: false });
    expect(r.body[0].varianten[0]).toMatchObject({ groesse: 'Unbekannt', sortierung: 9999, unterMindestbestand: false });
  });
});

describe('Paket 34 – Mitgliederliste', () => {
  it('respektiert Berechtigungen', async () => { mocks.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await read(mitgliederGET)).status).toBe(403); });
  it('liefert leere Liste', async () => { expect((await read(mitgliederGET)).body).toEqual([]); });
  it('filtert nach Name und ClubDesk-ID', async () => {
    data.clubdesk_mitglieder = [
      { _id: id(1), vorname: 'Anna', nachname: 'Meier', clubdeskId: 'CD42', aktiv: true },
      { _id: id(2), vorname: 'Peter', nachname: 'Muster', clubdeskId: 'CD99', aktiv: true }
    ];
    expect((await read(mitgliederGET, '?suche=MEIER')).body).toHaveLength(1);
    expect((await read(mitgliederGET, '?suche=CD99')).body[0].anzeigename).toBe('Peter Muster');
    expect((await read(mitgliederGET, '?suche=niemand')).body).toEqual([]);
  });
  it('begrenzt Ergebnis auf 50 Mitglieder', async () => {
    data.clubdesk_mitglieder = Array.from({ length: 60 }, (_, n) => ({ _id: id(n + 1), vorname: 'A', nachname: 'B', clubdeskId: String(n) }));
    expect((await read(mitgliederGET)).body).toHaveLength(50);
  });
});

describe('Paket 34 – Vereinskleiderbestellungen', () => {
  const pos = (x: Record<string, unknown> = {}) => ({ verkaufsart: 'bestellung', menge: 5, artikelname: 'Trikot', artikelId: id(1), groesseId: null, einzelpreis: 20, ...x });
  const sale = (positions: unknown[]) => ({ _id: id(5), erstelltAm: new Date('2026-01-01'), kaeufer: 'Anna Meier', riegen: ['Aktive'], positionen: positions });
  it('respektiert Berechtigungen', async () => { mocks.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await read(bestellungenGET)).status).toBe(403); });
  it('verwirft ungültigen Statusfilter', async () => { expect((await read(bestellungenGET, '?status=unbekannt')).status).toBe(400); });
  it('liefert leere Bestellungen', async () => { expect((await read(bestellungenGET)).body).toMatchObject({ anzahl: 0, begrenzt: false }); });
  it('behandelt Datenbankfehler', async () => { errors.vereinskleider_verkaeufe = new Error('DB'); expect((await read(bestellungenGET)).status).toBe(500); });
  it.each([
    ['offen', {}, 'offen'], ['teilweise', { uebergebenMenge: 2 }, 'teilweise'],
    ['abgeschlossen', { uebergebenMenge: 5 }, 'abgeschlossen'],
    ['storniert', { menge: 0, storniertMenge: 5 }, 'storniert']
  ])('berechnet Status %s', async (_label, values, expected) => {
    data.vereinskleider_verkaeufe = [sale([pos(values as Record<string, unknown>)])];
    const r = await read(bestellungenGET, '?status=alle');
    expect(r.body.bestellungen[0].status).toBe(expected);
  });
  it('zeigt teilweise offene Bestellungen im Standardfilter', async () => {
    data.vereinskleider_verkaeufe = [sale([pos({ uebergebenMenge: 2, reserviertMenge: 1 })])];
    const r = await read(bestellungenGET);
    expect(r.body.bestellungen[0]).toMatchObject({ offen: 3, nochFehlend: 2, reserviert: 1 });
  });
  it('filtert nach Käufer, Artikel und Riege', async () => {
    data.vereinskleider_verkaeufe = [sale([pos()])];
    for (const suche of ['anna', 'TRIKOT', 'aktive']) expect((await read(bestellungenGET, '?suche=' + suche)).body.anzahl).toBe(1);
    expect((await read(bestellungenGET, '?suche=nichtvorhanden')).body.anzahl).toBe(0);
  });
  it.each([{ menge: -1 }, { menge: 0 }, { menge: 2.5 }, { menge: 1, uebergebenMenge: 2 }, { menge: 2, reserviertMenge: 3 }, { menge: 1, storniertMenge: -1 }])('verwirft inkonsistente Position %j', async (values) => {
    data.vereinskleider_verkaeufe = [sale([pos(values)])];
    expect((await read(bestellungenGET, '?status=alle')).body.anzahl).toBe(0);
  });
  it('ignoriert Direktverkäufe und nicht vorhandene Positionen', async () => {
    data.vereinskleider_verkaeufe = [sale([pos({ verkaufsart: 'direkt' }), pos()]), { _id: id(6), positionen: null }];
    expect((await read(bestellungenGET)).body.anzahl).toBe(1);
  });
  it('kennzeichnet Limit von 1000 Vorgängen', async () => {
    data.vereinskleider_verkaeufe = Array.from({ length: 1000 }, (_, n) => ({ _id: id(n + 1), positionen: [] }));
    expect((await read(bestellungenGET)).body.begrenzt).toBe(true);
  });
});
