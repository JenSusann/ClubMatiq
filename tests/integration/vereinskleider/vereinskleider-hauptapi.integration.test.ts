import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mock = vi.hoisted(() => {
  const collections: Record<string, any> = {};
  const session = { withTransaction: vi.fn(async (fn: () => Promise<unknown>) => fn()), endSession: vi.fn(async () => {}) };
  return { collections, session, permission: vi.fn<() => Response | null>(() => null) };
});
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => mock.collections[name] },
  client: { startSession: () => mock.session }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mock.permission }));


const ART = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const GRO = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RAB = 'cccccccccccccccccccccccc';
const RAB2 = 'dddddddddddddddddddddddd';
const id = () => new ObjectId();
const defaultInput = () => ({ verkaufsart: 'bestellung', kaeufer: 'Testperson', zahlungsart: 'twint', riegen: ['Aktive'], positionen: [{ artikelId: ART, groesseId: null, menge: 2 }] });
const req = (body: unknown) => new Request('http://localhost/api/vereinskleider', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const post = async (body: unknown) => route0.POST({ request: req(body), locals: { benutzer: { vereinId: 'verein-1' } } } as never);
const get = async (query = '') => route0.GET({ url: new URL(`http://localhost/api/vereinskleider${query}`), locals: { benutzer: { vereinId: 'verein-1' } } } as never);
const data = async (response: Response) => ({ status: response.status, body: await response.json() });
const collection = (name: string) => mock.collections[name];

beforeEach(() => {
  vi.clearAllMocks();
  mock.permission.mockReturnValue(null);
  mock.session.withTransaction.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  const artikel = { _id: new ObjectId(ART), name: 'Vereinsshirt', kategorieId: 'kat-1', istVereinskleidung: true, hatGroessen: false, menge: 10 };
  const cols: Record<string, any> = {
    artikel: { findOne: vi.fn(async () => artikel), updateOne: vi.fn(async () => ({ modifiedCount: 1 })) },
    artikelvarianten: { findOne: vi.fn(async () => ({ menge: 10 })), updateOne: vi.fn(async () => ({ modifiedCount: 1 })) },
    vereinskleider_preise: { findOne: vi.fn(async () => ({ preistyp: 'fix', verkaufspreis: 20 })) },
    rabattregeln: { find: vi.fn(() => ({ toArray: vi.fn(async () => []) })) },
    vereinskleider_verkaeufe: {
      insertOne: vi.fn(async () => ({ insertedId: id() })),
      aggregate: vi.fn(() => ({ toArray: vi.fn(async () => [{ eintraege: [], zaehler: [] }]) }))
    },
    vereinskleider_rechnungen: { find: vi.fn(() => ({ project() { return this; }, toArray: vi.fn(async () => []) })) }
  };
  Object.assign(mock.collections, cols);
});
import * as route0 from '../../../src/routes/api/vereinskleider/+server';
import { POST as stornierungPOST } from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 35-vereinskleider-hauptapi.integration.test.ts
describe('Paket 35 – Vereinskleider Haupt-API: Eingabe', () => {
  const invalid: Array<[string, (d: any) => unknown, string]> = [
    ['null', () => null, 'Ungültige Verkaufsdaten'],
    ['Array', () => [], 'Ungültige Verkaufsdaten'],
    ['Verkaufsart', d => ({ ...d, verkaufsart: 'falsch' }), 'Verkaufsart'],
    ['Käufer fehlt', d => ({ ...d, kaeufer: '' }), 'Käufer'],
    ['Käufer zu lang', d => ({ ...d, kaeufer: 'x'.repeat(201) }), 'Käufer'],
    ['Zahlungsart', d => ({ ...d, zahlungsart: 'karte' }), 'Zahlungsart'],
    ['Zahlungsbestätigung', d => ({ ...d, zahlungErhalten: 1 }), 'Zahlungsbestätigung'],
    ['Rechnung sofort bezahlt', d => ({ ...d, zahlungsart: 'rechnung', zahlungErhalten: true }), 'Rechnung'],
    ['Bemerkung falsch', d => ({ ...d, bemerkung: 5 }), 'Bemerkung'],
    ['Bemerkung zu lang', d => ({ ...d, bemerkung: 'x'.repeat(2001) }), 'Bemerkung'],
    ['Riegen leer', d => ({ ...d, riegen: [] }), 'Riege'],
    ['Riegen ungültig', d => ({ ...d, riegen: [42] }), 'Riege'],
    ['Riegen zu viele', d => ({ ...d, riegen: Array(31).fill('A') }), 'Riege'],
    ['Positionen fehlen', d => ({ ...d, positionen: [] }), 'Warenkorb'],
    ['Positionen zu viele', d => ({ ...d, positionen: Array(101).fill(d.positionen[0]) }), 'Warenkorb'],
    ['Position null', d => ({ ...d, positionen: [null] }), 'Warenkorbposition'],
    ['Artikel-ID', d => ({ ...d, positionen: [{ ...d.positionen[0], artikelId: 'x' }] }), 'Warenkorbposition'],
    ['Grösse undefiniert', d => ({ ...d, positionen: [{ artikelId: ART, menge: 2 }] }), 'Warenkorbposition'],
    ['Menge null', d => ({ ...d, positionen: [{ ...d.positionen[0], menge: 0 }] }), 'Warenkorbposition'],
    ['Menge zu hoch', d => ({ ...d, positionen: [{ ...d.positionen[0], menge: 10001 }] }), 'Warenkorbposition'],
    ['Menge gebrochen', d => ({ ...d, positionen: [{ ...d.positionen[0], menge: 1.5 }] }), 'Warenkorbposition'],
    ['Einzelpreis negativ', d => ({ ...d, positionen: [{ ...d.positionen[0], einzelpreis: -1 }] }), 'Warenkorbposition'],
    ['Einzelpreis Nachkommastellen', d => ({ ...d, positionen: [{ ...d.positionen[0], einzelpreis: 1.001 }] }), 'Warenkorbposition'],
    ['Rabatt-ID ungültig', d => ({ ...d, rabattIds: ['x'] }), 'Rabattregel'],
    ['Rabatt-ID doppelt', d => ({ ...d, rabattIds: [RAB, RAB] }), 'Rabattregel'],
    ['Rabatt-ID zu viele', d => ({ ...d, rabattIds: Array(31).fill(RAB) }), 'Rabattregel'],
    ['Zusatzrabatt negativ', d => ({ ...d, zusaetzlicherRabatt: -1 }), 'zusätzlicher Rabatt'],
    ['Zusatzrabatt ungenau', d => ({ ...d, zusaetzlicherRabatt: 1.001 }), 'zusätzlicher Rabatt']
  ];
  it.each(invalid)('%s', async (_name, mutate, message) => {
    const r = await data(await post(mutate(defaultInput())));
    expect(r.status).toBe(400);
    expect(r.body.fehler).toContain(message);
    expect(mock.session.withTransaction).not.toHaveBeenCalled();
  });
  it('behandelt kaputtes JSON', async () => {
    const response = await route0.POST({ request: new Request('http://localhost/api/vereinskleider', { method: 'POST', body: '{' }), locals: { benutzer: { vereinId: 'verein-1' } } } as never);
    expect(response.status).toBe(400);
  });
  it('gibt Berechtigungsantwort unverändert zurück', async () => {
    mock.permission.mockReturnValueOnce(new Response(null, { status: 403 }));
    expect((await post(defaultInput())).status).toBe(403);
    expect(mock.session.withTransaction).not.toHaveBeenCalled();
  });
});

describe('Paket 35 – Verkaufsabläufe und Lager', () => {
  const cases: Array<[string, () => void, number, string]> = [
    ['Artikel fehlt', () => collection('artikel').findOne.mockResolvedValue(null), 404, 'nicht gefunden'],
    ['kein Vereinskleid', () => collection('artikel').findOne.mockResolvedValue({ istVereinskleidung: false }), 400, 'Vereinskleidern'],
    ['Grössenabweichung', () => collection('artikel').findOne.mockResolvedValue({ istVereinskleidung: true, hatGroessen: true }), 400, 'Grössenzuordnung'],
    ['Verkaufspreis fehlt', () => collection('vereinskleider_preise').findOne.mockResolvedValue(null), 400, 'Verkaufspreis'],
    ['Fixpreis ungültig', () => collection('vereinskleider_preise').findOne.mockResolvedValue({ preistyp: 'fix', verkaufspreis: -1 }), 400, 'Fixpreis'],
    ['Preistyp unbekannt', () => collection('vereinskleider_preise').findOne.mockResolvedValue({ preistyp: 'anders', verkaufspreis: 20 }), 400, 'Preistyp'],
    ['variabler Preis ungültig', () => collection('vereinskleider_preise').findOne.mockResolvedValue({ preistyp: 'variabel', verkaufspreis: -1 }), 400, 'gültigen Preis'],
    ['Bestand reicht nicht', () => collection('artikel').findOne.mockResolvedValue({ _id: new ObjectId(ART), name: 'Vereinsshirt', kategorieId: 'kat-1', istVereinskleidung: true, hatGroessen: false, menge: 1 }), 409, 'Nicht genügend'],
    ['Bestandsupdate schlägt fehl', () => collection('artikel').updateOne.mockResolvedValue({ modifiedCount: 0 }), 409, 'zwischenzeitlich geändert']
  ];
  it.each(cases)('%s', async (_name, setup, status, message) => {
    setup();
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'direkt' }));
    expect(r.status).toBe(status);
    expect(r.body.fehler).toContain(message);
    expect(mock.session.endSession).toHaveBeenCalled();
  });
  it('meldet veralteten Fixpreis', async () => {
    const r = await data(await post({ ...defaultInput(), positionen: [{ artikelId: ART, groesseId: null, menge: 2, einzelpreis: 19 }] }));
    expect(r.status).toBe(409);
    expect(r.body.fehler).toContain('geändert');
  });
  it('verkauft direkt und speichert Zahlung', async () => {
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'direkt', zahlungErhalten: true }));
    expect(r.status).toBe(201);
    expect(r.body.verkauf.verkaufsart).toBe('direkt');
    expect(r.body.verkauf.zahlungsstatus).toBe('bezahlt');
    expect(r.body.verkauf.direktMenge).toBe(2);
    expect(collection('artikel').updateOne).toHaveBeenCalled();
  });
  it('erstellt reine Bestellung ohne Bestandsupdate', async () => {
    const r = await data(await post(defaultInput()));
    expect(r.status).toBe(201);
    expect(r.body.verkauf.bestellMenge).toBe(2);
    expect(collection('artikel').updateOne).not.toHaveBeenCalled();
  });
  it('teilt automatische Bestellung in direkt und offen auf', async () => {
    collection('artikel').findOne.mockResolvedValue({ _id: new ObjectId(ART), name: 'Vereinsshirt', kategorieId: 'kat-1', istVereinskleidung: true, hatGroessen: false, menge: 2 });
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'automatisch' }));
    expect(r.status).toBe(201);
    expect(r.body.verkauf.verkaufsart).toBe('gemischt');
    expect(r.body.verkauf.direktMenge).toBe(1);
    expect(r.body.verkauf.bestellMenge).toBe(1);
  });
  it('fasst doppelte Warenkorbpositionen bei der Bestandsprüfung zusammen', async () => {
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'automatisch', positionen: [{ artikelId: ART, groesseId: null, menge: 3 }, { artikelId: ART, groesseId: null, menge: 2 }] }));
    expect(r.status).toBe(201);
    expect(r.body.verkauf.direktMenge).toBe(5);
    expect(collection('artikel').updateOne).toHaveBeenCalledTimes(1);
  });
  it('verarbeitet aktive Grössenvariante und aktualisiert beide Bestände', async () => {
    collection('artikel').findOne.mockResolvedValue({ _id: new ObjectId(ART), name: 'Shirt', kategorieId: 'kat-1', istVereinskleidung: true, hatGroessen: true, menge: 10 });
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'direkt', positionen: [{ artikelId: ART, groesseId: GRO, menge: 2 }] }));
    expect(r.status).toBe(201);
    expect(collection('artikelvarianten').updateOne).toHaveBeenCalledTimes(1);
    expect(collection('artikel').updateOne).toHaveBeenCalledTimes(1);
  });
  it('lehnt fehlende Variante ab', async () => {
    collection('artikel').findOne.mockResolvedValue({ istVereinskleidung: true, hatGroessen: true });
    collection('artikelvarianten').findOne.mockResolvedValue(null);
    const r = await data(await post({ ...defaultInput(), positionen: [{ artikelId: ART, groesseId: GRO, menge: 2 }] }));
    expect(r.status).toBe(400);
    expect(r.body.fehler).toContain('Grössenvariante');
  });
  it('erkennt fehlgeschlagenes Variantenupdate', async () => {
    collection('artikel').findOne.mockResolvedValue({ istVereinskleidung: true, hatGroessen: true, name: 'Shirt', kategorieId: 'kat-1', menge: 10 });
    collection('artikelvarianten').updateOne.mockResolvedValue({ modifiedCount: 0 });
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'direkt', positionen: [{ artikelId: ART, groesseId: GRO, menge: 2 }] }));
    expect(r.status).toBe(409);
    expect(r.body.fehler).toContain('Grösse');
  });
  it('erkennt fehlgeschlagenes Artikelupdate bei Variante', async () => {
    collection('artikel').findOne.mockResolvedValue({ istVereinskleidung: true, hatGroessen: true, name: 'Shirt', kategorieId: 'kat-1', menge: 10 });
    collection('artikel').updateOne.mockResolvedValue({ modifiedCount: 0 });
    const r = await data(await post({ ...defaultInput(), verkaufsart: 'direkt', positionen: [{ artikelId: ART, groesseId: GRO, menge: 2 }] }));
    expect(r.status).toBe(409);
    expect(r.body.fehler).toContain('Artikelbestand');
  });
  it('fängt unerwartete Datenbankfehler ab und schliesst Session', async () => {
    collection('artikel').findOne.mockRejectedValue(new Error('db kaputt'));
    const r = await data(await post(defaultInput()));
    expect(r.status).toBe(500);
    expect(mock.session.endSession).toHaveBeenCalledTimes(1);
  });
});

describe('Paket 35 – Rabattregeln', () => {
  const regel = (overrides: Record<string, unknown> = {}) => ({ _id: new ObjectId(RAB), name: 'Rabatt', rabattart: 'prozent', wert: 10, geltungsbereich: 'warenkorb', aktiv: true, ...overrides });
  const setRules = (...rules: unknown[]) => collection('rabattregeln').find.mockReturnValue({ toArray: vi.fn(async () => rules) });
  const sell = (overrides: Record<string, unknown> = {}) => post({ ...defaultInput(), rabattIds: [RAB], ...overrides });
  it('wendet Prozent-Rabatt an', async () => {
    setRules(regel());
    const r = await data(await sell());
    expect(r.status).toBe(201);
    expect(r.body.verkauf.endbetrag).toBe(36);
    expect(r.body.verkauf.rabatte[0].betrag).toBe(4);
  });
  it('wendet Betragsrabatt mit Obergrenze an', async () => {
    setRules(regel({ rabattart: 'betrag', wert: 100 }));
    const r = await data(await sell());
    expect(r.status).toBe(201);
    expect(r.body.verkauf.endbetrag).toBe(0);
    expect(r.body.verkauf.zahlungsstatus).toBe('bezahlt');
  });
  it('wendet Fixpreis auf Artikel an', async () => {
    setRules(regel({ rabattart: 'fixpreis', geltungsbereich: 'artikel', artikelIds: [ART], wert: 12 }));
    const r = await data(await sell());
    expect(r.status).toBe(201);
    expect(r.body.verkauf.endbetrag).toBe(24);
  });
  it('begrenzt rabattierte Stückzahl', async () => {
    setRules(regel({ rabattart: 'prozent', maximaleMenge: 1, wert: 50 }));
    const r = await data(await sell());
    expect(r.status).toBe(201);
    expect(r.body.verkauf.endbetrag).toBe(30);
  });
  const invalid: Array<[string, unknown[], string, Record<string, unknown>?]> = [
    ['fehlende Regel', [], 'existiert nicht'],
    ['deaktivierte Regel', [regel({ aktiv: false })], 'nicht gültig'],
    ['zukünftige Regel', [regel({ gueltigAb: '2999-01-01' })], 'nicht gültig'],
    ['abgelaufene Regel', [regel({ gueltigBis: '2000-01-01' })], 'nicht gültig'],
    ['falsche Riege', [regel({ riegen: ['Jugend'] })], 'Riege'],
    ['kein passender Artikel', [regel({ geltungsbereich: 'artikel', artikelIds: [GRO] })], 'keine passende Position'],
    ['Fixpreis auf Warenkorb', [regel({ rabattart: 'fixpreis' })], 'Sonderpreise'],
    ['unbekannte Rabattart', [regel({ rabattart: 'anderes' })], 'Rabattart']
  ];
  it.each(invalid)('%s', async (_name, rules, message) => {
    setRules(...rules);
    const r = await data(await sell());
    expect(r.status).toBe(400);
    expect(r.body.fehler).toContain(message);
  });
  it('verweigert nicht kombinierbare Regeln', async () => {
    setRules(regel({ kombinierbar: false }), regel({ _id: new ObjectId(RAB2), name: 'Zweiter' }));
    const r = await data(await sell({ rabattIds: [RAB, RAB2] }));
    expect(r.status).toBe(400);
    expect(r.body.fehler).toContain('kombiniert');
  });
  it('verweigert Rabatte über Warenkorbwert', async () => {
    setRules(regel({ rabattart: 'betrag', wert: 30 }));
    const r = await data(await sell({ zusaetzlicherRabatt: 20 }));
    expect(r.status).toBe(400);
    expect(r.body.fehler).toContain('übersteigen');
  });
  it('wendet Kategorie-Rabatt an', async () => {
    setRules(regel({ geltungsbereich: 'kategorie', kategorieIds: ['kat-1'], rabattart: 'betrag', wert: 5 }));
    const r = await data(await sell());
    expect(r.status).toBe(201);
    expect(r.body.verkauf.endbetrag).toBe(35);
  });
});

describe('Paket 35 – Verkaufshistorie', () => {
  const invalid = ['?seite=0', '?seite=-1', '?seite=10001', '?seite=abc', '?art=foo', '?zahlung=foo', '?riege=' + 'x'.repeat(101), '?suche=' + 'x'.repeat(121), '?von=2024-99-99', '?bis=2024-02-30', '?von=2025-12-31&bis=2025-01-01', '?von=abc'];
  it.each(invalid)('verweigert ungültigen Filter %s', async (query) => {
    expect((await get(query)).status).toBe(400);
  });
  it('verweigert Zugriff', async () => {
    mock.permission.mockReturnValueOnce(new Response(null, { status: 403 }));
    expect((await get()).status).toBe(403);
  });
  it('liefert leere Liste und Pagination', async () => {
    const r = await data(await get());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ verkaeufe: [], gesamt: 0, seiten: 0, seite: 1, proSeite: 100 });
  });
  it('setzt kombinierte Filter und Zahlungsstatus', async () => {
    const r = await data(await get('?seite=2&art=gemischt&zahlung=bezahlt&riege=Aktive&von=2025-01-01&bis=2025-12-31'));
    expect(r.status).toBe(200);
    const pipeline = collection('vereinskleider_verkaeufe').aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toMatchObject({ vereinId: 'verein-1', verkaufsart: 'gemischt', riegen: 'Aktive' });
    expect(pipeline.at(-1).$facet.eintraege[1].$skip).toBe(100);
    expect(pipeline.some((x: any) => x.$match?.$expr)).toBe(true);
  });
  it.each(['offen', 'gutschrift'])('filtert Zahlungsstatus %s', async (zahlung) => {
    expect((await get(`?zahlung=${zahlung}`)).status).toBe(200);
    const pipeline = collection('vereinskleider_verkaeufe').aggregate.mock.calls[0][0];
    expect(pipeline.some((x: any) => x.$match && Object.keys(x.$match).some(k => k === '$expr' || k === 'rechnung.gutgeschriebenBetrag'))).toBe(true);
  });
  it('sucht Rechnungsnummern, Artikel und IDs', async () => {
    collection('vereinskleider_rechnungen').find.mockReturnValue({ project() { return this; }, toArray: vi.fn(async () => [{ verkaufId: ART }, { verkaufId: 'ungueltig' }]) });
    const r = await data(await get(`?suche=${ART}`));
    expect(r.status).toBe(200);
    const pipeline = collection('vereinskleider_verkaeufe').aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.$or.length).toBe(4);
  });
  it('liefert gefundene Einträge mit und ohne Rechnung', async () => {
    collection('vereinskleider_verkaeufe').aggregate.mockReturnValue({ toArray: vi.fn(async () => [{ eintraege: [{ _id: new ObjectId(ART), rechnung: { _id: new ObjectId(RAB), rechnungsnummer: 'R-1' } }, { _id: new ObjectId(GRO) }], zaehler: [{ anzahl: 201 }] }]) });
    const r = await data(await get('?seite=2'));
    expect(r.status).toBe(200);
    expect(r.body.gesamt).toBe(201);
    expect(r.body.seiten).toBe(3);
    expect(r.body.verkaeufe[0].rechnung._id).toBe(RAB);
    expect(r.body.verkaeufe[1].rechnung).toBeNull();
  });
  it('behandelt Aggregationsfehler', async () => {
    collection('vereinskleider_verkaeufe').aggregate.mockImplementation(() => { throw new Error('db'); });
    const r = await data(await get());
    expect(r.status).toBe(500);
  });
});



describe('Issue #34 – Erstbezug über mehrere Verkaufsvorgänge', () => {
  const MIT = 'eeeeeeeeeeeeeeeeeeeeeeee';
  const MIT2 = 'ffffffffffffffffffffffff';
  const ansprueche = new Map<string, Set<string>>();
  const regel = (rabattId: string) => ({ _id: new ObjectId(rabattId), name: 'Erstbezug',
    rabattart: 'fixpreis', wert: 0, geltungsbereich: 'artikel', artikelIds: [ART],
    maximaleMenge: 1, einmaligProMitglied: true, aktiv: true });
  const sell = (overrides: Record<string, unknown> = {}) => post({
    ...defaultInput(), mitgliedId: MIT, rabattIds: [RAB],
    positionen: [{ artikelId: ART, groesseId: null, menge: 1 }], ...overrides
  });
  beforeEach(() => {
    ansprueche.clear();
    mock.collections.clubdesk_mitglieder = {
      findOne: vi.fn(async (filter: any) => filter.vereinId === 'verein-1' &&
        [MIT, MIT2].includes(String(filter._id)) ? { _id: filter._id, vorname: 'Test', nachname: 'Mitglied', aktiv: true } : null),
      updateOne: vi.fn(async (filter: any, update: any) => {
        const key = filter.vereinId + ':' + String(filter._id);
        const ids = ansprueche.get(key) ?? new Set<string>();
        if (filter.erstbezugsRabattIds.$nin.some((x: string) => ids.has(x))) return { modifiedCount: 0 };
        ids.add(update.$addToSet.erstbezugsRabattIds);
        ansprueche.set(key, ids);
        return { modifiedCount: 1 };
      })
    };
    collection('rabattregeln').find.mockReturnValue({ toArray: async () => [regel(RAB)] });
  });
  it('erlaubt erneuten Erstbezug nach vollständiger Stornierung', async () => {
    const sales = collection('vereinskleider_verkaeufe');
    const verkaufId = new ObjectId();
    let gespeichert: any;
    sales.insertOne.mockImplementation(async (doc: any) => {
      gespeichert = { ...doc, _id: verkaufId };
      return { insertedId: verkaufId };
    });
    sales.findOne = vi.fn(async () => gespeichert);
    sales.updateOne = vi.fn(async (_filter: any, update: any) => {
      gespeichert = { ...gespeichert, ...update.$set };
      return { modifiedCount: 1 };
    });
    const members = collection('clubdesk_mitglieder');
    const claim = members.updateOne.getMockImplementation();
    members.updateOne.mockImplementation(async (filter: any, update: any) => {
      if (!update.$pullAll) return claim(filter, update);
      const ids = ansprueche.get(filter.vereinId + ':' + String(filter._id));
      if (!ids || !filter.erstbezugsRabattIds.$all.every((x: string) => ids.has(x))) return { modifiedCount: 0 };
      for (const x of update.$pullAll.erstbezugsRabattIds) ids.delete(x);
      return { modifiedCount: 1 };
    });
    expect((await sell()).status).toBe(201);
    expect((await sell()).status).toBe(409);
    const response = await stornierungPOST({
      request: req({ verkaufId: String(verkaufId), positionsIndex: 0, menge: 1, grund: 'Fehlbestellung' }),
      locals: { benutzer: { vereinId: 'verein-1', id: MIT } }
    } as never);
    expect(response.status).toBe(200);
    expect(gespeichert.status).toBe('storniert');
    expect(ansprueche.get('verein-1:' + MIT)?.has(ART)).toBe(false);
    expect((await sell()).status).toBe(201);
    expect(ansprueche.get('verein-1:' + MIT)?.has(ART)).toBe(true);
    expect((await sell()).status).toBe(409);
  });
  it('sperrt dieselbe Anspruchsgruppe auch bei einem anderen Artikel', async () => {
    const a = { ...regel(RAB), anspruchsgruppe: 'juko-tshirt' };
    const b = { ...regel(RAB2), anspruchsgruppe: 'juko-tshirt', artikelIds: [GRO] };
    collection('rabattregeln').find.mockImplementation((filter: any) => ({
      toArray: async () => filter.anspruchsgruppe ? [a, b] : filter._id.$in.some((id: any) => String(id) === RAB) ? [a] : [b]
    }));
    expect((await sell()).status).toBe(201);
    expect(ansprueche.get('verein-1:' + MIT)?.has('gruppe:juko-tshirt')).toBe(true);
    collection('artikel').findOne.mockResolvedValue({ _id: new ObjectId(GRO), name: 'Shirt B', kategorieId: 'kat-1', istVereinskleidung: true, hatGroessen: false, menge: 10, verkaufspreis: 20 });
    expect((await sell({ rabattIds: [RAB2], positionen: [{ artikelId: GRO, groesseId: null, menge: 1 }] })).status).toBe(409);
  });
  it('berücksichtigt einen früheren artikelbezogenen Anspruch', async () => {
    ansprueche.set('verein-1:' + MIT, new Set([GRO]));
    const a = { ...regel(RAB), anspruchsgruppe: 'juko-tshirt', artikelIds: [ART, GRO] };
    collection('rabattregeln').find.mockReturnValue({ toArray: async () => [a] });
    expect((await sell()).status).toBe(409);
  });
  it('erlaubt getrennte Anspruchsgruppen', async () => {
    const a = { ...regel(RAB), anspruchsgruppe: 'juko-tshirt' };
    collection('rabattregeln').find.mockReturnValue({ toArray: async () => [a] });
    expect((await sell()).status).toBe(201);
    const b = { ...regel(RAB2), anspruchsgruppe: 'juko-gwaendli' };
    collection('rabattregeln').find.mockReturnValue({ toArray: async () => [b] });
    expect((await sell({ rabattIds: [RAB2] })).status).toBe(201);
    expect(ansprueche.get('verein-1:' + MIT)).toEqual(new Set(['gruppe:juko-tshirt', 'gruppe:juko-gwaendli']));
  });
  it('verhindert zweiten Bezug nach erfolgreicher Bestellung', async () => {
    expect((await sell()).status).toBe(201);
    expect((await sell()).status).toBe(409);
    expect(collection('vereinskleider_verkaeufe').insertOne).toHaveBeenCalledTimes(1);
  });
  it('verhindert Umgehung durch eine neue Rabattregel', async () => {
    expect((await sell()).status).toBe(201);
    collection('rabattregeln').find.mockReturnValue({ toArray: async () => [regel(RAB2)] });
    expect((await sell({ rabattIds: [RAB2] })).status).toBe(409);
  });
  it('erlaubt denselben Erstbezug einem anderen Mitglied', async () => {
    expect((await sell()).status).toBe(201);
    expect((await sell({ mitgliedId: MIT2 })).status).toBe(201);
    expect(collection('vereinskleider_verkaeufe').insertOne).toHaveBeenCalledTimes(2);
  });
  it('verweigert ein nicht im Verein gefundenes Mitglied', async () => {
    expect((await sell({ mitgliedId: GRO })).status).toBe(409);
    expect(collection('clubdesk_mitglieder').findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-1', _id: new ObjectId(GRO) }), expect.anything());
    expect(collection('vereinskleider_verkaeufe').insertOne).not.toHaveBeenCalled();
  });
  it('verhindert zweiten Bezug bei anderer Kleidergrösse', async () => {
    collection('artikel').findOne.mockResolvedValue({ _id: new ObjectId(ART), name: 'Shirt', kategorieId: 'kat-1', istVereinskleidung: true, hatGroessen: true, menge: 10 });
    expect((await sell({ positionen: [{ artikelId: ART, groesseId: GRO, menge: 1 }] })).status).toBe(201);
    expect((await sell({ positionen: [{ artikelId: ART, groesseId: RAB2, menge: 1 }] })).status).toBe(409);
  });
});
