import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collections: {} as Record<string, any>,
  session: { withTransaction: vi.fn(), endSession: vi.fn() }
}));
vi.mock('../../src/lib/server/mongodb', () => ({
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

import { GET } from '../../src/routes/api/export/inventar/+server';
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
