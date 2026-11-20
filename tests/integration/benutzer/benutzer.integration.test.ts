import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const m = vi.hoisted(() => ({ findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), send: vi.fn(), token: vi.fn(), ablauf: vi.fn(), startSession: vi.fn(), endSession: vi.fn(), withTransaction: vi.fn(), collection: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: m.startSession } }));
vi.mock('../../../src/lib/server/email', () => ({ versendeEinladung: m.send }));
vi.mock('../../../src/lib/server/einladungen', () => ({ erstelleEinladungstoken: m.token, berechneAblaufdatum: m.ablauf }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: vi.fn(() => null) }));
const event = (body?: unknown) => ({ params: { id }, locals: { benutzer: { id, vereinId, rolle: 'admin' } }, request: new Request('http://localhost/api/test', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body ?? {}) }) });
beforeEach(() => { vi.clearAllMocks(); m.collection.mockReturnValue(m); m.findOne.mockResolvedValue(null); m.find.mockReturnValue({ toArray: async () => [], sort: () => ({ toArray: async () => [] }) }); m.updateOne.mockResolvedValue({modifiedCount:1}); m.insertOne.mockResolvedValue({insertedId: new ObjectId(id)}); m.send.mockResolvedValue({id:'mail-123'}); m.token.mockReturnValue({token:'abc',tokenHash:'hash'}); m.ablauf.mockReturnValue(new Date('2027-12-01')); m.startSession.mockReturnValue({ withTransaction: async (fn: () => Promise<unknown>) => fn(), endSession:m.endSession }); });
import * as route0 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-array.integration.test.ts
describe('28-einladung-array', () => { it('prüft den Handler', async () => {
  
  const response = await route0.POST(event([]) as never); expect(response.status).toBe(400); 
}); });

import * as route1 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-bestehend.integration.test.ts
describe('28-einladung-bestehend', () => { it('prüft den Handler', async () => {
  m.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({status:'offen'});
  const response = await route1.POST(event({vorname:'Eva',nachname:'Muster',email:'EVA@EXAMPLE.CH',rolle:'mitglied'}) as never); expect(response.status).toBe(409); expect(m.insertOne).not.toHaveBeenCalled();
}); });

import * as route2 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-db-fehler.integration.test.ts
describe('28-einladung-db-fehler', () => { it('prüft den Handler', async () => {
  m.findOne.mockRejectedValueOnce(new Error('DB'));
  const response = await route2.POST(event({vorname:'Eva',nachname:'Muster',email:'EVA@EXAMPLE.CH',rolle:'mitglied'}) as never); expect(response.status).toBe(500); expect(m.insertOne).not.toHaveBeenCalled();
}); });

import * as route3 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-email-ungueltig.integration.test.ts
describe('28-einladung-email-ungueltig', () => { it('prüft den Handler', async () => {
  
  const response = await route3.POST(event({vorname:'Eva',nachname:'Muster',email:'abc',rolle:'mitglied'}) as never); expect(response.status).toBe(400); 
}); });

import * as route4 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-email-zu-lang.integration.test.ts
describe('28-einladung-email-zu-lang', () => { it('prüft den Handler', async () => {
  
  const response = await route4.POST(event({vorname:'Eva',nachname:'Muster',email:'a'.repeat(250)+'@example.ch',rolle:'mitglied'}) as never); expect(response.status).toBe(400); 
}); });

import * as route5 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-erfolgreich.integration.test.ts
describe('28-einladung-erfolgreich', () => { it('prüft den Handler', async () => {
  m.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({name:'TV Muster'});
  const response = await route5.POST(event({vorname:'Eva',nachname:'Muster',email:'EVA@EXAMPLE.CH',rolle:'mitglied'}) as never); expect(response.status).toBe(201); expect((await response.json()).einladung.versendet).toBe(true); expect(m.send).toHaveBeenCalledOnce();
}); });

import * as route6 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-liste-abgelaufen.integration.test.ts
describe('28-einladung-liste-abgelaufen', () => { it('prüft den Handler', async () => {
m.find.mockReturnValueOnce({sort:()=>({toArray:async()=>([{_id:new ObjectId(id),vorname:'Eva',nachname:'Muster',email:'e@example.ch',rolle:'mitglied',status:'offen',erstelltAm:new Date('2026-01-01'),ablaufdatum:new Date('2026-01-02')}])})}); const response = await route6.GET(event() as never); expect(response.status).toBe(200); expect((await response.json())[0].status).toBe('abgelaufen');
}); });

import * as route7 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-liste-db-fehler.integration.test.ts
describe('28-einladung-liste-db-fehler', () => { it('prüft den Handler', async () => {
m.find.mockImplementationOnce(()=>{throw new Error('DB')}); const response=await route7.GET(event() as never);expect(response.status).toBe(500);
}); });

import * as route8 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-liste-leer.integration.test.ts
describe('28-einladung-liste-leer', () => { it('prüft den Handler', async () => {
m.find.mockReturnValueOnce({sort:()=>({toArray:async()=>([])})}); const response = await route8.GET(event() as never); expect(response.status).toBe(200); expect(await response.json()).toEqual([]);
}); });

import * as route9 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-liste-versendet.integration.test.ts
describe('28-einladung-liste-versendet', () => { it('prüft den Handler', async () => {
m.find.mockReturnValueOnce({sort:()=>({toArray:async()=>([{_id:new ObjectId(id),vorname:'Eva',nachname:'Muster',email:'e@example.ch',rolle:'mitglied',status:'angenommen',erstelltAm:new Date('2026-01-01'),ablaufdatum:new Date('2027-01-02'),versendetAm:new Date('2026-01-01')}])})}); const response = await route9.GET(event() as never); expect(response.status).toBe(200); expect((await response.json())[0].versendet).toBe(true);
}); });

import * as route10 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-mail-fehler.integration.test.ts
describe('28-einladung-mail-fehler', () => { it('prüft den Handler', async () => {
  m.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({name:'TV Muster'}); m.send.mockRejectedValueOnce(new Error('SMTP'));
  const response = await route10.POST(event({vorname:'Eva',nachname:'Muster',email:'EVA@EXAMPLE.CH',rolle:'mitglied'}) as never); expect(response.status).toBe(201); expect((await response.json()).versandFehler).toBe(true);
}); });

import * as route11 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-nachname-zu-lang.integration.test.ts
describe('28-einladung-nachname-zu-lang', () => { it('prüft den Handler', async () => {
  
  const response = await route11.POST(event({vorname:'Eva',nachname:'a'.repeat(101),email:'eva@example.ch',rolle:'mitglied'}) as never); expect(response.status).toBe(400); 
}); });

import * as route12 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-namen-fehlen.integration.test.ts
describe('28-einladung-namen-fehlen', () => { it('prüft den Handler', async () => {
  
  const response = await route12.POST(event({email:'eva@example.ch',rolle:'mitglied'}) as never); expect(response.status).toBe(400); 
}); });

import * as route13 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-null.integration.test.ts
describe('28-einladung-null', () => { it('prüft den Handler', async () => {
  
  const response = await route13.POST(event(null) as never); expect(response.status).toBe(400); 
}); });

import * as route14 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-registriert.integration.test.ts
describe('28-einladung-registriert', () => { it('prüft den Handler', async () => {
  m.findOne.mockResolvedValueOnce({email:'eva@example.ch'});
  const response = await route14.POST(event({vorname:'Eva',nachname:'Muster',email:'EVA@EXAMPLE.CH',rolle:'mitglied'}) as never); expect(response.status).toBe(409); expect(m.insertOne).not.toHaveBeenCalled();
}); });

import * as route15 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-rolle-ungueltig.integration.test.ts
describe('28-einladung-rolle-ungueltig', () => { it('prüft den Handler', async () => {
  
  const response = await route15.POST(event({vorname:'Eva',nachname:'Muster',email:'eva@example.ch',rolle:'superadmin'}) as never); expect(response.status).toBe(400); 
}); });

import * as route16 from '../../../src/routes/api/benutzer/einladen/+server';

// Ursprüngliche Datei: 28-einladung-vorname-zu-lang.integration.test.ts
describe('28-einladung-vorname-zu-lang', () => { it('prüft den Handler', async () => {
  
  const response = await route16.POST(event({vorname:'a'.repeat(101),nachname:'Muster',email:'eva@example.ch',rolle:'mitglied'}) as never); expect(response.status).toBe(400); 
}); });

import * as route17 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-abschluss-update-fehler.integration.test.ts
describe('28-inventur-abschluss-update-fehler', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:null,sollBestand:5,istBestand:4}; const artikel={hatGroessen:false,menge:5};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})})); m.updateOne.mockResolvedValueOnce({modifiedCount:1}).mockResolvedValueOnce({modifiedCount:0}); const response=await route17.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('abgeschlossen');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route18 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-artikel-fehlt.integration.test.ts
describe('28-inventur-artikel-fehlt', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:null,sollBestand:5,istBestand:4}; const artikel=null;const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route18.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('existiert nicht');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route19 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-artikelid-ungueltig.integration.test.ts
describe('28-inventur-artikelid-ungueltig', () => { it('prüft den Handler', async () => {
m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue({status:'offen'}),find:()=>({toArray:async()=>[{artikelId:'abc',artikelName:'Jacke',istBestand:2}]})}));const response=await route19.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('Ungültige Artikel-ID');
}); });

import * as route20 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-bereits-abgeschlossen.integration.test.ts
describe('28-inventur-bereits-abgeschlossen', () => { it('prüft den Handler', async () => {
m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue({status:'abgeschlossen'}),find:()=>({toArray:async()=>[]})}));const response=await route20.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('bereits abgeschlossen');
}); });

import * as route21 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-bestand-konflikt.integration.test.ts
describe('28-inventur-bestand-konflikt', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:null,sollBestand:5,istBestand:4}; const artikel={hatGroessen:false,menge:9};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route21.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('verändert');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route22 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-groesse-deaktiviert.integration.test.ts
describe('28-inventur-groesse-deaktiviert', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:vereinId,sollBestand:5,istBestand:4}; const artikel={hatGroessen:true,menge:5};const variante={menge:5,aktiv:false}; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route22.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('deaktiviert');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route23 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-groesse-fehlt.integration.test.ts
describe('28-inventur-groesse-fehlt', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:vereinId,sollBestand:5,istBestand:4}; const artikel={hatGroessen:true,menge:5};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route23.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('existiert nicht');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route24 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-groessen-konflikt.integration.test.ts
describe('28-inventur-groessen-konflikt', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:vereinId,sollBestand:5,istBestand:4}; const artikel={hatGroessen:true,menge:5};const variante={menge:9,aktiv:true}; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route24.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('verändert');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route25 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-groessenverwaltung-geaendert.integration.test.ts
describe('28-inventur-groessenverwaltung-geaendert', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:vereinId,sollBestand:5,istBestand:4}; const artikel={hatGroessen:false,menge:5};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route25.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('Grössenverwaltung');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route26 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-mit-differenz.integration.test.ts
describe('28-inventur-mit-differenz', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:null,sollBestand:5,istBestand:4}; const artikel={hatGroessen:false,menge:5};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route26.POST(event() as never);expect(response.status).toBe(200);expect((await response.json()).anzahlKorrekturen).toBe(1);expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route27 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-mit-groesse.integration.test.ts
describe('28-inventur-mit-groesse', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:vereinId,sollBestand:5,istBestand:4}; const artikel={hatGroessen:true,menge:5};const variante={menge:5,aktiv:true}; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route27.POST(event() as never);expect(response.status).toBe(200);expect((await response.json()).anzahlKorrekturen).toBe(1);expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route28 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-nicht-gefunden.integration.test.ts
describe('28-inventur-nicht-gefunden', () => { it('prüft den Handler', async () => {
m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(null),find:()=>({toArray:async()=>[]})}));const response=await route28.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('Inventur nicht gefunden');
}); });

import * as route29 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-ohne-differenz.integration.test.ts
describe('28-inventur-ohne-differenz', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:null,sollBestand:5,istBestand:5}; const artikel={hatGroessen:false,menge:5};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})}));  const response=await route29.POST(event() as never);expect(response.status).toBe(200);expect((await response.json()).anzahlKorrekturen).toBe(0);expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route30 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-ohne-positionen.integration.test.ts
describe('28-inventur-ohne-positionen', () => { it('prüft den Handler', async () => {
m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue({status:'offen'}),find:()=>({toArray:async()=>[]})}));const response=await route30.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('keine Positionen');
}); });

import * as route31 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-ungezaehlt.integration.test.ts
describe('28-inventur-ungezaehlt', () => { it('prüft den Handler', async () => {
m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue({status:'offen'}),find:()=>({toArray:async()=>[{artikelId:id,artikelName:'Jacke',istBestand:null}]})}));const response=await route31.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('nicht gezählt');
}); });

import * as route32 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';

// Ursprüngliche Datei: 28-inventur-update-fehler.integration.test.ts
describe('28-inventur-update-fehler', () => { it('prüft den Handler', async () => {
const position={_id:new ObjectId(id),artikelId:id,artikelName:'Jacke',groesseId:null,sollBestand:5,istBestand:4}; const artikel={hatGroessen:false,menge:5};const variante=null; m.collection.mockImplementation((name:string)=>({...m,findOne: name==='inventuren'?vi.fn().mockResolvedValue({status:'offen',version:1}):name==='artikel'?vi.fn().mockResolvedValue(artikel):name==='artikelvarianten'?vi.fn().mockResolvedValue(variante):m.findOne,find:()=>({toArray:async()=>[position]})})); m.updateOne.mockResolvedValueOnce({modifiedCount:0}); const response=await route32.POST(event() as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('fehlgeschlagen');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route33 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-bereits-storniert.integration.test.ts
describe('28-storno-bereits-storniert', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},status:'storniert'};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route33.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('bereits storniert');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route34 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-bezahlt-ohne-beleg.integration.test.ts
describe('28-storno-bezahlt-ohne-beleg', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},bezahltBetrag:10};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route34.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('bezahlte');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route35 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-grund-fehlt.integration.test.ts
describe('28-storno-grund-fehlt', () => { it('prüft den Handler', async () => {
const response=await route35.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:''}) as never);expect(response.status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();
}); });

import * as route36 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-index-ungueltig.integration.test.ts
describe('28-storno-index-ungueltig', () => { it('prüft den Handler', async () => {
const response=await route36.POST(event({verkaufId:id,positionsIndex:-1,menge:1,grund:'Test'}) as never);expect(response.status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();
}); });

import * as route37 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-inkonsistente-menge.integration.test.ts
describe('28-storno-inkonsistente-menge', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},positionen:[{artikelId:id,groesseId:null,verkaufsart:'bestellung',menge:2,uebergebenMenge:3,einzelpreis:20,positionsbetrag:40}]};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route37.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('inkonsistent');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route38 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-kein-verkauf.integration.test.ts
describe('28-storno-kein-verkauf', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?null:name==='vereinskleider_rechnungen'?null:null)}));const response=await route38.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(404);expect((await response.json()).fehler).toContain('nicht gefunden');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route39 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-keine-daten.integration.test.ts
describe('28-storno-keine-daten', () => { it('prüft den Handler', async () => {
const response=await route39.POST(event(null) as never);expect(response.status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();
}); });

import * as route40 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-mit-rabatt.integration.test.ts
describe('28-storno-mit-rabatt', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},rabattTotal:5};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route40.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('Rabatten');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route41 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-mit-rechnung.integration.test.ts
describe('28-storno-mit-rechnung', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},rechnungId:vereinId,};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?{_id:new ObjectId(vereinId),vereinId,verkaufId:id,rechnungsnummer:'RE-1',status:'offen',gesamtbetrag:40,bezahltBetrag:0,positionen:[{artikelId:id,groesseId:null,verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40}]}:null)}));const response=await route41.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(200);expect((await response.json()).stornierung.gutschriftBetrag).toBe(20);expect(m.insertOne).toHaveBeenCalledOnce();expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route42 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-negative-menge.integration.test.ts
describe('28-storno-negative-menge', () => { it('prüft den Handler', async () => {
const response=await route42.POST(event({verkaufId:id,positionsIndex:0,menge:-1,grund:'Test'}) as never);expect(response.status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();
}); });

import * as route43 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-nicht-bestellung.integration.test.ts
describe('28-storno-nicht-bestellung', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},positionen:[{artikelId:id,groesseId:null,verkaufsart:'direkt',menge:2,einzelpreis:20,positionsbetrag:40}]};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route43.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('Bestellartikel');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route44 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-teilweise.integration.test.ts
describe('28-storno-teilweise', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route44.POST(event({verkaufId:id,positionsIndex:0,menge:1,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(200);expect((await response.json()).stornierung.status).toBe('offen');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route45 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-ungueltige-id.integration.test.ts
describe('28-storno-ungueltige-id', () => { it('prüft den Handler', async () => {
const response=await route45.POST(event({verkaufId:'abc',positionsIndex:0,menge:1,grund:'Test'}) as never);expect(response.status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();
}); });

import * as route46 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-vollstaendig.integration.test.ts
describe('28-storno-vollstaendig', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route46.POST(event({verkaufId:id,positionsIndex:0,menge:2,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(200);expect((await response.json()).stornierung.status).toBe('storniert');expect(m.endSession).toHaveBeenCalledOnce();
}); });

import * as route47 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: 28-storno-zu-viel.integration.test.ts
describe('28-storno-zu-viel', () => { it('prüft den Handler', async () => {
const verkauf={...{_id:new ObjectId(id),vereinId,status:'offen',endbetrag:40,zwischentotal:40,rabattTotal:0,positionen:[{artikelId:id,groesseId:null,artikelname:'Jacke',verkaufsart:'bestellung',menge:2,einzelpreis:20,positionsbetrag:40,reserviertMenge:1}],aktualisiertAm:new Date('2026-11-01')},};m.collection.mockImplementation((name:string)=>({...m,findOne:vi.fn().mockResolvedValue(name==='vereinskleider_verkaeufe'?verkauf:name==='vereinskleider_rechnungen'?null:null)}));const response=await route47.POST(event({verkaufId:id,positionsIndex:0,menge:3,grund:'Fehlbestellung'}) as never);expect(response.status).toBe(409);expect((await response.json()).fehler).toContain('Nur 2');expect(m.endSession).toHaveBeenCalledOnce();
}); });

