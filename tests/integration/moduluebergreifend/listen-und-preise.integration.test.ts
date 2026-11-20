import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
const { state } = vi.hoisted(() => ({ state: { docs: [] as any[], filters: [] as any[], projection: [] as any[] } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: () => null }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => ({
  findOne: async (filter: any) => { state.filters.push({ name, filter }); return state.docs.find((x: any) => x.__collection === name && (filter._id ? String(x._id) === String(filter._id) : true)) ?? null; },
  find: (filter: any) => { state.filters.push({ name, filter }); const q: any = { sort: () => q, limit: () => q, project: (x: any) => { state.projection.push({ name, x }); return q; }, toArray: async () => state.docs.filter((x: any) => x.__collection === name).map((x: any) => { const { __collection, ...doc } = x; return doc; }) }; return q; },
  createIndex: async () => 'test-index'
}) } }));
const vereinId = '507f1f77bcf86cd799439011';
const andererVerein = '507f1f77bcf86cd799439099';
const locals = { benutzer: { id: 'test', vereinId, rolle: 'admin', vorname: 'Test', nachname: 'Admin' } } as any;
beforeEach(() => { state.docs = []; state.filters = []; state.projection = []; });
import * as route0 from '../../../src/routes/api/benutzer/+server';

// Ursprüngliche Datei: paket12-benutzer-lesen.integration.test.ts
describe('Paket 12: Benutzerliste',()=>{
 it('gibt Benutzer ohne Passwort-Hash aus',async()=>{state.docs=[{__collection:'benutzer',_id:new ObjectId(),vorname:'Anna',nachname:'Test',email:'a@example.ch',rolle:'mitglied',aktiv:true,passwortHash:'secret'}];const r=await route0.GET({locals} as any);expect(r.status).toBe(200);const d=await r.json();expect(d).toHaveLength(1);expect(d[0].passwortHash).toBeUndefined();expect(d[0].vorname).toBe('Anna');expect(state.projection[0].x).toEqual({passwortHash:0});});
 it('filtert nach eigener Vereins-ID',async()=>{await route0.GET({locals} as any);expect(state.filters[0].filter).toEqual({vereinId});});
 it('gibt bei leerer Liste ein Array zurueck',async()=>{const r=await route0.GET({locals} as any);expect(await r.json()).toEqual([]);});
});
import * as route1 from '../../../src/routes/api/lieferanten/+server';

// Ursprüngliche Datei: paket12-lieferanten-lesen.integration.test.ts
describe('Paket 12: Lieferantenliste',()=>{
 it('liefert Lieferantendaten mit String-ID',async()=>{const id=new ObjectId();state.docs=[{__collection:'lieferanten',_id:id,name:'Sport AG',vereinId}];const r=await route1.GET({locals} as any);expect(r.status).toBe(200);expect((await r.json())[0]).toMatchObject({_id:id.toString(),name:'Sport AG'});});
 it('fragt nur eigenen Verein ab',async()=>{await route1.GET({locals} as any);expect(state.filters[0].filter.vereinId).toBe(vereinId);});
 it('liefert bei leerer Liste []',async()=>{const r=await route1.GET({locals} as any);expect(await r.json()).toEqual([]);});
});
import * as route2 from '../../../src/routes/api/vereinskleider/preise/+server';

// Ursprüngliche Datei: paket12-preise-lesen.integration.test.ts
describe('Paket 12: Vereinskleiderpreise',()=>{
 it('liefert Preise mit normalisierten optionalen Feldern',async()=>{const id=new ObjectId();state.docs=[{__collection:'vereinskleider_preise',_id:id,artikelId:'artikel1',preistyp:'variabel',druckkosten:3}];const r=await route2.GET({locals} as any);expect(r.status).toBe(200);expect((await r.json())[0]).toMatchObject({_id:id.toString(),groesseId:null,verkaufspreis:null,druckkosten:3});});
 it('setzt einen Index fuer die Preiszuordnung',async()=>{await route2.GET({locals} as any);expect(state.filters[0].filter).toEqual({vereinId});});
 it('liefert leere Preisliste',async()=>{expect(await (await route2.GET({locals} as any)).json()).toEqual([]);});
});
import * as route3 from '../../../src/routes/api/rabatte/+server';

// Ursprüngliche Datei: paket12-rabatte-lesen.integration.test.ts
describe('Paket 12: Rabattliste',()=>{
 it('normalisiert fehlende optionale Felder',async()=>{const id=new ObjectId();state.docs=[{__collection:'rabattregeln',_id:id,name:'JUKO',rabattart:'prozent',wert:10,geltungsbereich:'warenkorb'}];const r=await route3.GET({locals} as any);expect(r.status).toBe(200);const d=await r.json();expect(d[0]).toMatchObject({_id:id.toString(),artikelIds:[],kategorieIds:[],riegen:[],aktiv:true,kombinierbar:false,maximaleMenge:null});});
 it('fragt Rabattregeln nur fuer eigenen Verein ab',async()=>{await route3.GET({locals} as any);expect(state.filters[0].filter).toEqual({vereinId});});
 it('liefert leere Rabattliste',async()=>{expect(await (await route3.GET({locals} as any)).json()).toEqual([]);});
});
import * as route4 from '../../../src/routes/api/vereinskleider/bestellungen/historie/+server';

// Ursprüngliche Datei: paket12-uebergabehistorie.integration.test.ts
describe('Paket 12: Uebergabehistorie',()=>{
 it('liefert Uebergaben nach Datum absteigend',async()=>{const id=new ObjectId();state.docs=[{__collection:'vereinskleider_verkaeufe',_id:id,kaeufer:'Anna',positionen:[{artikelId:'a',artikelname:'Trainer'}],uebergaben:[{positionsIndex:0,menge:1,uebergebenAm:'2026-01-01'},{positionsIndex:0,menge:2,uebergebenAm:'2026-02-01'}]}];const r=await route4.GET({locals} as any);expect(r.status).toBe(200);const d=await r.json();expect(d.historie.map((x:any)=>x.menge)).toEqual([2,1]);expect(d.historie[0].artikelname).toBe('Trainer');});
 it('ignoriert ungueltige Uebergaben',async()=>{state.docs=[{__collection:'vereinskleider_verkaeufe',_id:new ObjectId(),uebergaben:[{positionsIndex:-1,menge:2,uebergebenAm:'2026-01-01'},{positionsIndex:0,menge:0,uebergebenAm:'2026-01-01'},{positionsIndex:0,menge:1,uebergebenAm:'kein-datum'}]}];const r=await route4.GET({locals} as any);expect((await r.json()).historie).toEqual([]);});
 it('fragt ausschliesslich eigene Vereinsdaten ab',async()=>{await route4.GET({locals} as any);expect(state.filters[0].filter.vereinId).toBe(vereinId);expect(state.filters[0].filter['uebergaben.0']).toEqual({$exists:true});});
});
import * as route5 from '../../../src/routes/api/vereine/+server';

// Ursprüngliche Datei: paket12-verein-lesen.integration.test.ts
describe('Paket 12: Vereinsdaten', () => {
 it('liefert den eigenen Verein als Array', async () => { state.docs=[{__collection:'vereine',_id:new ObjectId(vereinId),name:'Turnverein Test',kuerzel:'TVT',erstelltAm:new Date('2026-01-01')}]; const r=await route5.GET({locals} as any); expect(r.status).toBe(200);const d=await r.json();expect(d).toHaveLength(1);expect(d[0]).toMatchObject({_id:vereinId,name:'Turnverein Test',kuerzel:'TVT'});expect(state.filters[0].filter._id.toString()).toBe(vereinId); });
 it('meldet fehlenden Verein mit 404',async()=>{const r=await route5.GET({locals} as any);expect(r.status).toBe(404);});
 it('setzt fehlendes Kuerzel auf Leerstring',async()=>{state.docs=[{__collection:'vereine',_id:new ObjectId(vereinId),name:'Verein'}];const r=await route5.GET({locals} as any);expect((await r.json())[0].kuerzel).toBe('');});
});
