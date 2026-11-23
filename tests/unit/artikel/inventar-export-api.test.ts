import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collections: {} as Record<string, any>,
  session: { withTransaction: vi.fn(), endSession: vi.fn() }
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => m.collections[name] },
  client: { startSession: () => m.session }
}));
const oid = '507f1f77bcf86cd799439011';
const user = (rolle = 'admin') => ({ id: 'u1', vereinId: 'v1', rolle, vorname: 'Anna', nachname: 'Muster' });
const req = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
const ctx = (body: unknown, rolle = 'admin') => ({ request: req(body), locals: { benutzer: user(rolle) } }) as any;
const read = (r: Response) => r.json();
beforeEach(() => {
  vi.clearAllMocks();
  m.session.withTransaction.mockImplementation(async (fn: () => Promise<void>) => fn());
  m.session.endSession.mockResolvedValue(undefined);
  m.collections = {};
});

import { GET } from '../../../src/routes/api/export/inventar/+server';
const setup=(data:Record<string,unknown[]>={})=>{
 const calls:Record<string,any>={};
 for(const name of ['artikel','kategorien','lagerorte','groessen','artikelvarianten','lieferanten']){
  const toArray=vi.fn().mockResolvedValue(data[name]??[]);
  const sort=vi.fn().mockReturnValue({toArray});
  calls[name]={find:vi.fn().mockReturnValue({sort,toArray})};
 }
 m.collections=calls;return calls;
};
const get=(query='',rolle='admin')=>GET({locals:{benutzer:user(rolle)},url:new URL('http://localhost/api/export/inventar?'+query)} as any);
const data={artikel:[{_id:'a',name:'Ball',kategorieId:'k',lagerortId:'l',lieferantId:'f',menge:2,einzelwert:12.5,hatGroessen:false}],kategorien:[{_id:'k',name:'Sport'}],lagerorte:[{_id:'l',name:'Halle'}],lieferanten:[{_id:'f',name:'Lieferant'}]};
describe('Inventar CSV-Export',()=>{
 it('verlangt Anmeldung',async()=>{setup();expect((await GET({locals:{},url:new URL('http://localhost/')} as any)).status).toBe(401)});
 it.each(['mitglied','leiter'])('verweigert %s den Export',async rolle=>{setup();expect((await get('',rolle)).status).toBe(403)});
 it('verwirft ungültigen Modus',async()=>{setup();expect((await get('modus=pdf')).status).toBe(400)});
 it.each(['admin','materialverantwortlich'])('exportiert CSV für %s',async rolle=>{
  const cols=setup(data);const r=await get('',rolle);expect(r.status).toBe(200);expect(r.headers.get('content-type')).toContain('text/csv');
  const csv=await r.text();expect(csv).toContain('"Ball"');expect(csv).toContain('"25,00"');expect(csv).toContain('"Lieferant"');
  for(const col of Object.values(cols))expect(col.find).toHaveBeenCalledWith({vereinId:'v1'});
 });
 it('filtert Kategorie und Lagerort',async()=>{setup(data);expect(await (await get('kategorie=Andere')).text()).not.toContain('"Ball"');expect(await (await get('lagerort=Andere')).text()).not.toContain('"Ball"')});
 it('sucht im Inventarmodus auch Lieferanten',async()=>{setup(data);expect(await (await get('suche=lieferant')).text()).toContain('"Ball"')});
 it('exportiert fehlende Preise im Bewertungsmodus',async()=>{
  setup({artikel:[{_id:'a',name:'Shirt',hatGroessen:true}],artikelvarianten:[{artikelId:'a',groesseId:'s',menge:2,einzelwert:null}],groessen:[{_id:'s',bezeichnung:'S'}]});
  const csv=await (await get('modus=bewertung&nurFehlende=true')).text();expect(csv).toContain('"Shirt"');expect(csv).toContain('"Ja"');expect(csv).toContain('"S"');
 });
 it('überspringt Varianten ohne Bestand in Bewertung',async()=>{
  setup({artikel:[{_id:'a',name:'Shirt',hatGroessen:true}],artikelvarianten:[{artikelId:'a',groesseId:'s',menge:0,einzelwert:12}]});
  expect(await (await get('modus=bewertung')).text()).not.toContain('"Shirt"');
 });
 it('exportiert Artikel ohne Varianten im Inventarmodus',async()=>{
  setup({artikel:[{_id:'a',name:'Shirt',hatGroessen:true}]});
  expect(await (await get()).text()).toContain('"Shirt"');
 });
 it('schützt vor Excel-Formelinjektion und escaped Anführungszeichen',async()=>{
  setup({artikel:[{_id:'a',name:'=SUM(1+1) "x"',hatGroessen:false,menge:1,einzelwert:1}]});
  const csv=await (await get()).text();expect(csv).toContain("'=SUM(1+1)");expect(csv).toContain('""x""');
 });
 it('behandelt Datenbankfehler',async()=>{const cols=setup();cols.artikel.find.mockImplementation(()=>{throw Error('db')});expect((await get()).status).toBe(500)});
});


const edgeBase = {
  artikel: [{ _id: 'a1', name: 'Ball', kategorieId: 'k1', lagerortId: 'l1', lieferantId: 'f1', menge: 2, einzelwert: 5, hatGroessen: false }],
  kategorien: [{ _id: 'k1', name: 'Sport' }],
  lagerorte: [{ _id: 'l1', name: 'Halle' }],
  lieferanten: [{ _id: 'f1', name: 'Muster AG' }],
  groessen: [{ _id: 's1', bezeichnung: 'XL' }],
  artikelvarianten: []
};
type Data = Record<string, any[]>;
function edgeSetup(overrides: Data = {}) {
  const daten: Data = { ...edgeBase, ...overrides };
  const collections: Record<string, any> = {};
  for (const name of ['artikel', 'kategorien', 'lagerorte', 'lieferanten', 'groessen', 'artikelvarianten']) {
    const toArray = vi.fn().mockResolvedValue(daten[name]);
    collections[name] = { find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray }), toArray }) };
  }
  m.collections = collections;
  return collections;
}
async function edgeCsv(query = '') {
  const result = await GET({ locals: { benutzer: { rolle: 'admin', vereinId: 'v1' } }, url: new URL(`http://localhost/api/export/inventar?${query}`) } as any);
  expect(result.status).toBe(200);
  return result.text();
}
const edgeShirt = { _id: 'a1', name: 'Shirt', kategorieId: 'k1', lagerortId: 'l1', lieferantId: 'f1', hatGroessen: true };
const edgeVariant = (menge: unknown, einzelwert: unknown, groesseId: unknown = 's1') => ({ artikelId: 'a1', groesseId, menge, einzelwert });

describe('Inventar-Export – zusätzliche CSV-Randfälle', () => {
 beforeEach(() => { vi.clearAllMocks(); edgeSetup(); });

describe('Coverage P16 – CSV Inventar/Bewertung Branches', () => {
  it.each([
    ['ohne Kategorie', { kategorien: [] }, 'Unbekannt'],
    ['ohne Lagerort', { lagerorte: [] }, 'Unbekannt'],
    ['ohne Lieferant', { lieferanten: [] }, 'Nicht zugeordnet'],
    ['ohne Kategorie-ID', { artikel: [{ ...edgeBase.artikel[0], kategorieId: undefined }] }, 'Unbekannt'],
    ['ohne Lagerort-ID', { artikel: [{ ...edgeBase.artikel[0], lagerortId: undefined }] }, 'Unbekannt'],
    ['ohne Lieferanten-ID', { artikel: [{ ...edgeBase.artikel[0], lieferantId: undefined }] }, 'Nicht zugeordnet'],
  ] as const)('%s', async (_name, override, expected) => {
    edgeSetup(override as unknown as Data);
    expect(await edgeCsv()).toContain(`"${expected}"`);
  });

  it.each([
    ['ohne Namen', { name: undefined }, '""'],
    ['ohne Menge', { menge: undefined }, '"0"'],
    ['ohne Einzelwert', { einzelwert: undefined }, '"Ja"'],
    ['Einzelwert null', { einzelwert: null }, '"Ja"'],
    ['Einzelwert negativ', { einzelwert: -1 }, '"Ja"'],
    ['Einzelwert String', { einzelwert: '4' }, '"Ja"'],
    ['Einzelwert Infinity', { einzelwert: Infinity }, '"Ja"'],
    ['Einzelwert NaN', { einzelwert: NaN }, '"Ja"'],
    ['Einzelwert null bei Nullbestand', { menge: 0, einzelwert: null }, '"Nein"'],
    ['Einzelwert null bei Negativbestand', { menge: -1, einzelwert: null }, '"Nein"'],
  ] as const)('%s', async (_name, changes, expected) => {
    edgeSetup({ artikel: [{ ...edgeBase.artikel[0], ...changes }] });
    expect(await edgeCsv()).toContain(expected);
  });

  it('ignoriert nicht zugehörige Varianten und erkennt fehlende Grösse', async () => {
    edgeSetup({ artikel: [edgeShirt], artikelvarianten: [edgeVariant(2, 3, 'nicht-da'), { ...edgeVariant(2, 3), artikelId: 'fremd' }] });
    const result = await edgeCsv();
    expect(result).toContain('"Unbekannt"');
    expect(result).toContain('"6,00"');
    expect(result.match(/"Shirt"/g)).toHaveLength(1);
  });

  it.each([
    ['ohne Variantenmenge', edgeVariant(undefined, 3), '"0"'],
    ['ohne Variantenpreis', edgeVariant(3, undefined), '"Ja"'],
    ['mit Variantenpreis null', edgeVariant(3, null), '"Ja"'],
    ['mit Variantenpreis null und Menge null', edgeVariant(null, null), '"Nein"'],
    ['mit gültigem Nullpreis', edgeVariant(3, 0), '"0,00"'],
    ['mit ungültigem negativem Preis', edgeVariant(3, -5), '"Ja"'],
    ['mit ungültigem Textpreis', edgeVariant(3, '3'), '"Ja"'],
  ] as const)('%s', async (_name, v, expected) => {
    edgeSetup({ artikel: [edgeShirt], artikelvarianten: [v] });
    expect(await edgeCsv()).toContain(expected);
  });

  it('zeigt grössenlose Artikel ohne Varianten im Inventarmodus trotz Suchfilter nicht als Treffer an', async () => {
    edgeSetup({ artikel: [edgeShirt], artikelvarianten: [] });
    expect(await edgeCsv('suche=nomatch')).toContain('"Shirt"');
  });

  it('zeigt grössenlose Artikel ohne Varianten im Bewertungsmodus nicht an', async () => {
    edgeSetup({ artikel: [edgeShirt], artikelvarianten: [] });
    expect(await edgeCsv('modus=bewertung')).not.toContain('"Shirt"');
  });

  it('findet im Bewertungsmodus über Grösse statt Artikelname', async () => {
    edgeSetup({ artikel: [edgeShirt], artikelvarianten: [edgeVariant(2, 3)] });
    expect(await edgeCsv('modus=bewertung&suche=xl')).toContain('"Shirt"');
    expect(await edgeCsv('modus=bewertung&suche=unauffindbar')).not.toContain('"Shirt"');
  });

  it('findet Lieferant im Inventarmodus, nicht aber im Bewertungsmodus', async () => {
    expect(await edgeCsv('suche=muster')).toContain('"Ball"');
    expect(await edgeCsv('modus=bewertung&suche=muster')).not.toContain('"Ball"');
  });

  it.each(['ball', 'sport', 'halle'])('findet Inventar über %s', async suche => {
    expect(await edgeCsv(`suche=${suche}`)).toContain('"Ball"');
  });

  it('berücksichtigt Filter in Kombination und ohne Suchbegriff', async () => {
    expect(await edgeCsv('kategorie=Sport&lagerort=Halle')).toContain('"Ball"');
    expect(await edgeCsv('kategorie=Sport&lagerort=Anders')).not.toContain('"Ball"');
  });

  it('nurFehlende gilt nur im Bewertungsmodus', async () => {
    expect(await edgeCsv('nurFehlende=true')).toContain('"Ball"');
    expect(await edgeCsv('modus=bewertung&nurFehlende=true')).not.toContain('"Ball"');
    edgeSetup({ artikel: [{ ...edgeBase.artikel[0], einzelwert: null }] });
    expect(await edgeCsv('modus=bewertung&nurFehlende=true')).toContain('"Ball"');
  });

  it('filtert nichtpositive Varianten in Bewertung, aber nicht im Inventar', async () => {
    edgeSetup({ artikel: [edgeShirt], artikelvarianten: [edgeVariant(-2, 3)] });
    expect(await edgeCsv('modus=bewertung')).not.toContain('"Shirt"');
    expect(await edgeCsv('modus=inventar')).toContain('"Shirt"');
  });

  it.each(['=1+1', '+SUM(1)', '@cmd', '-1+2', '\t=1+1', '  =1+1', '\r=1+1'])('schützt Formeltext %s', async name => {
    edgeSetup({ artikel: [{ ...edgeBase.artikel[0], name }] });
    expect(await edgeCsv()).toContain(`'${name}`);
  });

  it('schützt numerische negative Werte nicht mit einem Apostroph', async () => {
    edgeSetup({ artikel: [{ ...edgeBase.artikel[0], menge: -2, einzelwert: 3 }] });
    expect(await edgeCsv()).toContain('"-2"');
  });

  it('escapt doppelte Anführungszeichen im Namen', async () => {
    edgeSetup({ artikel: [{ ...edgeBase.artikel[0], name: 'Test "Spezial"' }] });
    expect(await edgeCsv()).toContain('"Test ""Spezial"""');
  });
});

});
