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

import { GET } from '../../../src/routes/api/inventar-uebersicht/+server';
const setup=(data:Record<string,unknown[]>={})=>{
 const calls:Record<string,any>={};
 for(const name of ['artikel','kategorien','lagerorte','groessen','artikelvarianten']){
  const toArray=vi.fn().mockResolvedValue(data[name]??[]);
  const sort=vi.fn().mockReturnValue({toArray});
  calls[name]={find:vi.fn().mockReturnValue({sort,toArray})};
 }
 m.collections=calls;return calls;
};
const get=()=>GET({locals:{benutzer:user()}} as any);
describe('Inventarübersicht',()=>{
 it('verlangt Anmeldung',async()=>{setup();expect((await GET({locals:{}} as any)).status).toBe(401)});
 it('liefert leere Übersicht',async()=>{setup();expect(await read(await get())).toEqual([])});
 it('filtert alle Collections nach Verein',async()=>{const cols=setup();await get();for(const col of Object.values(cols))expect(col.find).toHaveBeenCalledWith({vereinId:'v1'})});
 it('berechnet einfache Artikel und Mindestbestand',async()=>{
  setup({artikel:[{_id:'a',name:'Ball',kategorieId:'k',lagerortId:'l',menge:2,einzelwert:12,mindestbestand:3,hatGroessen:false}],kategorien:[{_id:'k',name:'Sport'}],lagerorte:[{_id:'l',name:'Halle'}]});
  const [a]=await read(await get());expect(a).toMatchObject({name:'Ball',kategorie:'Sport',lagerort:'Halle',gesamtmenge:2,inventarwert:24,preisFehlt:false,unterMindestbestand:true});
 });
 it('markiert fehlende Preise und unbekannte Stammdaten',async()=>{
  setup({artikel:[{_id:'a',name:'Ball',kategorieId:'x',lagerortId:'y',menge:2,einzelwert:null,hatGroessen:false}]});
  const [a]=await read(await get());expect(a).toMatchObject({kategorie:'Unbekannt',lagerort:'Unbekannt',einzelwert:0,preisFehlt:true,inventarwert:0});
 });
 it('berechnet Varianten, sortiert Grössen und erkennt Fehlbestände',async()=>{
  setup({artikel:[{_id:'a',name:'Shirt',hatGroessen:true,kategorieId:'k',lagerortId:'l'}],
   groessen:[{_id:'s',bezeichnung:'S',sortierung:2},{_id:'m',bezeichnung:'M',sortierung:1}],
   artikelvarianten:[{artikelId:'a',groesseId:'s',menge:2,einzelwert:10,mindestbestand:3},{artikelId:'a',groesseId:'m',menge:1,einzelwert:null,mindestbestand:0}]});
  const [a]=await read(await get());expect(a).toMatchObject({gesamtmenge:3,inventarwert:20,preisFehlt:true,unterMindestbestand:true});expect(a.varianten.map((v:any)=>v.groesse)).toEqual(['M','S']);
 });
 it('ignoriert deaktivierte Varianten bei Fehlbestand',async()=>{
  setup({artikel:[{_id:'a',hatGroessen:true}],artikelvarianten:[{artikelId:'a',groesseId:'x',menge:1,einzelwert:5,mindestbestand:4,aktiv:false}]});
  const [a]=await read(await get());expect(a.unterMindestbestand).toBe(false);expect(a.varianten[0].groesse).toBe('Unbekannt');
 });
 it('behandelt Datenbankfehler',async()=>{const cols=setup();cols.artikel.find.mockImplementation(()=>{throw Error('db')});expect((await get()).status).toBe(500)});
});
