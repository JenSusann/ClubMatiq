import { beforeEach, describe, expect, it, vi } from 'vitest';
const A='aaaaaaaaaaaaaaaaaaaaaaaa', B='bbbbbbbbbbbbbbbbbbbbbbbb';
const mock = vi.hoisted(() => ({ data: {} as Record<string,any>, error: '' }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: (name:string) => ({
  find: () => { if(mock.error===name) throw Error('DB error'); const result = mock.data[name] ?? []; const chain:any = {toArray:async()=>result,project:()=>chain,sort:()=>chain}; return chain; },
  insertOne: async () => ({insertedId:{toString:()=>B}})
}) } }));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung:()=>null }));
import {GET,POST} from '../../../../src/routes/api/vereinskleider/sammelbestellungen/+server';
const locals={benutzer:{vereinId:A}} as any;
const artikel={_id:{toString:()=>B},name:'Testartikel',menge:3,hatGroessen:false,lieferantId:A};
const lieferant={_id:{toString:()=>A},name:'Lieferant'};
const pos=(overrides={})=>({artikelId:B,groesseId:null,menge:2,...overrides});
const post=(positionen:any,bemerkung?:any)=>({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({positionen,...(bemerkung===undefined?{}:{bemerkung})})})}) as any;
beforeEach(()=>{mock.data={vereinskleider_verkaeufe:[],artikel:[artikel],artikelvarianten:[],vereinskleider_sammelbestellungen:[],lieferanten:[lieferant]};mock.error='';vi.spyOn(console,'error').mockImplementation(()=>{});});
describe('P15 Sammelbestellungen Übersicht',()=>{
  it('zeigt bestellbare Artikel auch ohne Kundenbedarf',async()=>{const r=await GET({locals} as any);expect(r.status).toBe(200);const data=await r.json();expect(data.bedarf).toHaveLength(1);expect(data.bedarf[0].bestand).toBe(3);});
  it('ignoriert ungueltige Kundenpositionen und Bestellmengen',async()=>{mock.data.vereinskleider_verkaeufe=[{positionen:[{...pos(),verkaufsart:'bestellung',uebergebenMenge:3},{...pos({menge:-2}),verkaufsart:'bestellung'},{...pos(),verkaufsart:'direkt'}]}];const r=await GET({locals} as any);expect(r.status).toBe(200);expect((await r.json()).bedarf[0].offen).toBe(0);});
  it('beruecksichtigt nur noch ausstehende Liefermengen',async()=>{mock.data.vereinskleider_sammelbestellungen=[{_id:{toString:()=>A},status:'bestellt',positionen:[{...pos({menge:5}),geliefertMenge:2}]}];const r=await GET({locals} as any);expect((await r.json()).bedarf[0].bereitsInSammelbestellungen).toBe(3);});
  it('500 bei Fehler beim Laden',async()=>{mock.error='artikel';expect((await GET({locals} as any)).status).toBe(500);});
});
describe('P15 Sammelbestellungen Erstellung',()=>{
  it.each([[],Array.from({length:101},()=>pos())])('400 bei ungueltiger Positionsanzahl',async positionen=>{expect((await POST(post(positionen))).status).toBe(400);});
  it.each([[pos({menge:0})],[pos({menge:10001})],[pos({artikelId:'invalid'})],[pos(),pos()]].map(positionen => [positionen] as const))('400 bei ungueltigen oder doppelten Positionen',async positionen=>{expect((await POST(post(positionen))).status).toBe(400);});
  it('400 bei ungueltiger Bemerkung',async()=>{expect((await POST(post([pos()],123))).status).toBe(400);});
  it('409 bei nicht mehr bestellbarem Artikel',async()=>{expect((await POST(post([pos({artikelId:A})]))).status).toBe(409);});
  it('409 bei fehlendem Standardlieferanten',async()=>{mock.data.lieferanten=[];expect((await POST(post([pos()]))).status).toBe(409);});
});
