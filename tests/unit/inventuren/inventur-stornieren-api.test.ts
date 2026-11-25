import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collections: {} as Record<string, any>, session: { withTransaction: vi.fn(), endSession: vi.fn() }, allowed: true }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (n: string) => m.collections[n] }, client: { startSession: () => m.session } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: () => m.allowed ? null : new Response('{}', { status: 403 }) }));
import { POST } from '../../../src/routes/api/inventuren/[id]/stornieren/+server';
const id = '507f1f77bcf86cd799439011', article = '507f1f77bcf86cd799439012', size = '507f1f77bcf86cd799439013', positionId = new ObjectId('507f1f77bcf86cd799439014');
const person = { id:'u1',vereinId:'v1' };
const pos = (overrides = {}) => ({ _id:positionId, artikelId:article, groesseId:null, sollBestand:10, istBestand:7, ...overrides });
const context = (body: unknown = {begruendung:'Inventur fehlerhaft'}, inventurId=id) => ({ params:{id:inventurId},locals:{benutzer:person},request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}) }) as any;
function setup(status='abgeschlossen', positions:any[]=[pos()], corrections:any[] = []) {
 const inventuren={findOne:vi.fn().mockResolvedValue({status,version:2,anzahlPositionen:positions.length,anzahlNachtraeglicheKorrekturen:corrections.length}),updateOne:vi.fn().mockResolvedValue({modifiedCount:1})};
 const inventurpositionen={find:vi.fn(() => ({toArray:vi.fn().mockResolvedValue(positions)}))};
 const inventurprotokoll={find:vi.fn(() => ({sort:vi.fn(() => ({toArray:vi.fn().mockResolvedValue(corrections)}))})),insertOne:vi.fn().mockResolvedValue({})};
 const artikel={updateOne:vi.fn().mockResolvedValue({matchedCount:1})};
 const artikelvarianten={updateOne:vi.fn().mockResolvedValue({matchedCount:1})};
 m.collections={inventuren,inventurpositionen,inventurprotokoll,artikel,artikelvarianten};return {inventuren,inventurpositionen,inventurprotokoll,artikel,artikelvarianten};
}
beforeEach(()=>{vi.clearAllMocks();m.allowed=true;m.session.withTransaction.mockImplementation(async(fn:()=>Promise<void>)=>fn());m.session.endSession.mockResolvedValue(undefined)});
const run=async(body?:unknown)=>POST(context(body));
const fail=async(message:string)=>{const r=await run();expect(r.status).toBe(409);expect((await r.json()).fehler).toContain(message);expect(m.session.endSession).toHaveBeenCalledOnce()};
describe('Inventur stornieren',()=>{
 it('verweigert ohne Berechtigung',async()=>{setup();m.allowed=false;expect((await run()).status).toBe(403)});
 it('verwirft ungültige ID',async()=>{setup();expect((await POST(context({begruendung:'gültiger Grund'},'invalid'))).status).toBe(400)});
 it.each([null,[],3,'text',{}, {begruendung:'kurz'}, {begruendung:'a'.repeat(1001)}])('verwirft ungültige Begründung %j',async body=>{setup();expect((await run(body)).status).toBe(400)});
 it('storniert offene Inventur ohne Bestandsänderung',async()=>{const c=setup('offen');const r=await run();expect(r.status).toBe(200);expect((await r.json()).anzahlRueckbuchungen).toBe(0);expect(c.artikel.updateOne).not.toHaveBeenCalled();expect(c.inventurprotokoll.insertOne.mock.calls[0][0]).toMatchObject({aktion:'storniert',statusVorher:'offen',versionVorher:2,versionNachher:3});expect(m.session.endSession).toHaveBeenCalledOnce()});
 it('bucht abgeschlossene Inventur zurück',async()=>{const c=setup();const r=await run();expect(r.status).toBe(200);expect((await r.json()).anzahlRueckbuchungen).toBe(1);expect(c.artikel.updateOne.mock.calls[0][1]).toEqual({$inc:{menge:3}})});
 it('überspringt Null-Deltas',async()=>{const c=setup('abgeschlossen',[pos({istBestand:10})]);expect((await run()).status).toBe(200);expect(c.artikel.updateOne).not.toHaveBeenCalled()});
 it('bucht negative Deltas nur bei genügend Bestand',async()=>{const c=setup('abgeschlossen',[pos({sollBestand:4,istBestand:7})]);expect((await run()).status).toBe(200);expect(c.artikel.updateOne.mock.calls[0][0].menge).toEqual({$gte:3})});
 it('bucht Grössenvarianten und Artikel zurück',async()=>{const c=setup('abgeschlossen',[pos({groesseId:size})]);expect((await run()).status).toBe(200);expect(c.artikelvarianten.updateOne).toHaveBeenCalledOnce();expect(c.artikel.updateOne).toHaveBeenCalledOnce()});
 it('summiert Deltas derselben Variante',async()=>{const c=setup('abgeschlossen',[pos({groesseId:size}),pos({_id:new ObjectId(),groesseId:size,sollBestand:8,istBestand:6})]);expect((await run()).status).toBe(200);expect(c.artikelvarianten.updateOne).toHaveBeenCalledOnce();expect(c.artikelvarianten.updateOne.mock.calls[0][1].$inc.menge).toBe(5)});
 it('storniert nachträglich korrigierte Inventur',async()=>{const correction={positionId:positionId.toString(),alterIstBestand:8,neuerIstBestand:7,differenz:-1};const c=setup('abgeschlossen',[pos()],[correction]);expect((await run()).status).toBe(200);expect(c.inventurprotokoll.insertOne).toHaveBeenCalledOnce()});
 it('meldet fehlende Inventur',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue(null);await fail('nicht gefunden')});
 it('meldet bereits stornierte Inventur',async()=>{setup('storniert');await fail('nicht mehr storniert')});
 it('meldet konkurrierende Änderung',async()=>{const c=setup();c.inventuren.updateOne.mockResolvedValue({modifiedCount:0});await fail('zwischenzeitlich')});
 it('meldet fehlende Positionen',async()=>{setup('abgeschlossen',[]);await fail('unvollständig')});
 it('meldet abweichende Positionsanzahl',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue({status:'abgeschlossen',anzahlPositionen:3});await fail('unvollständig')});
 it('meldet fehlende Korrekturen',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue({status:'abgeschlossen',anzahlNachtraeglicheKorrekturen:2});await fail('Korrekturprotokoll')});
 it.each([{positionId:3,alterIstBestand:1,neuerIstBestand:2,differenz:1},{positionId:positionId.toString(),alterIstBestand:-1,neuerIstBestand:2,differenz:3},{positionId:positionId.toString(),alterIstBestand:1,neuerIstBestand:2,differenz:4}])('meldet ungültige Korrektur %j',async correction=>{setup('abgeschlossen',[pos()],[correction]);await fail('Ungültiger Eintrag')});
 it('meldet unbekannte Korrekturposition',async()=>{setup('abgeschlossen',[pos()],[{positionId:new ObjectId().toString(),alterIstBestand:1,neuerIstBestand:2,differenz:1}]);await fail('fehlende Position')});
 it('meldet widersprüchliche Korrekturkette',async()=>{const c={positionId:positionId.toString(),alterIstBestand:8,neuerIstBestand:7,differenz:-1};setup('abgeschlossen',[pos()],[c,{...c,alterIstBestand:6,neuerIstBestand:7,differenz:1}]);await fail('Widersprüchliche')});
 it('meldet nicht übereinstimmenden Ist-Bestand',async()=>{setup('abgeschlossen',[pos()],[{positionId:positionId.toString(),alterIstBestand:8,neuerIstBestand:9,differenz:1}]);await fail('Ist-Bestand')});
 it.each([pos({sollBestand:-1}),pos({istBestand:null}),pos({artikelId:'x'})])('meldet ungültige Position %j',async p=>{setup('abgeschlossen',[p]);await fail('Ungültige Inventurposition')});
 it('meldet ungültige Grössen-ID',async()=>{setup('abgeschlossen',[pos({groesseId:'x'})]);await fail('Ungültige Grösse')});
 it('meldet gemischte Grössenstruktur',async()=>{setup('abgeschlossen',[pos(),pos({_id:new ObjectId(),groesseId:size})]);await fail('Inkonsistente')});
 it('meldet fehlende Variante',async()=>{const c=setup('abgeschlossen',[pos({groesseId:size})]);c.artikelvarianten.updateOne.mockResolvedValue({matchedCount:0});await fail('Artikelvariante')});
 it('meldet fehlenden Artikel',async()=>{const c=setup();c.artikel.updateOne.mockResolvedValue({matchedCount:0});await fail('Ein Artikel fehlt')});
 it('meldet Protokollierungsfehler',async()=>{const c=setup('offen');c.inventurprotokoll.insertOne.mockRejectedValue(Error('Protokoll fehlgeschlagen'));await fail('Protokoll fehlgeschlagen')});
 it('behandelt unbekannte Transaktionsfehler',async()=>{setup();m.session.withTransaction.mockRejectedValue('unknown');await fail('Inventur konnte nicht storniert werden')});
});


import { POST as resetPOST } from '../../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';
describe('Inventur zurücksetzen', () => {
const id='507f1f77bcf86cd799439011';
const context=(inventurId=id)=>({params:{id:inventurId},locals:{benutzer:{id:'u1',vereinId:'v1'}}}) as any;
function setup(){const inventuren={findOne:vi.fn().mockResolvedValue({status:'offen',version:3}),updateOne:vi.fn().mockResolvedValue({modifiedCount:1})};const inventurpositionen={updateMany:vi.fn().mockResolvedValue({matchedCount:4})};const inventurprotokoll={insertOne:vi.fn().mockResolvedValue({})};m.collections={inventuren,inventurpositionen,inventurprotokoll};return {inventuren,inventurpositionen,inventurprotokoll}}
beforeEach(()=>{vi.clearAllMocks();m.allowed=true;m.session.withTransaction.mockImplementation(async(fn:()=>Promise<void>)=>fn());m.session.endSession.mockResolvedValue(undefined)});
async function fails(msg:string){const r=await resetPOST(context());expect(r.status).toBe(409);expect((await r.json()).fehler).toContain(msg);expect(m.session.endSession).toHaveBeenCalledOnce()}
describe('Inventur zurücksetzen',()=>{
 it('prüft Berechtigung',async()=>{setup();m.allowed=false;expect((await resetPOST(context())).status).toBe(403)});
 it('prüft ID',async()=>{setup();expect((await resetPOST(context('invalid'))).status).toBe(400)});
 it('setzt Zählungen und protokolliert',async()=>{const c=setup();const r=await resetPOST(context());expect(r.status).toBe(200);expect((await r.json()).anzahlZurueckgesetzt).toBe(4);expect(c.inventurpositionen.updateMany.mock.calls[0][1].$set).toMatchObject({istBestand:null,bemerkung:'',kontrolliertAm:null,kontrolliertVon:null});expect(c.inventurprotokoll.insertOne.mock.calls[0][0]).toMatchObject({aktion:'zurueckgesetzt',anzahlPositionen:4,versionVorher:3,versionNachher:4});expect(m.session.endSession).toHaveBeenCalledOnce()});
 it('verwendet Version 0 als Standard',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue({status:'offen'});expect((await resetPOST(context())).status).toBe(200);expect(c.inventurprotokoll.insertOne.mock.calls[0][0]).toMatchObject({versionVorher:0,versionNachher:1})});
 it('meldet fehlende Inventur',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue(null);await fails('nicht gefunden')});
 it.each(['abgeschlossen','storniert'])('verweigert Status %s',async status=>{const c=setup();c.inventuren.findOne.mockResolvedValue({status});await fails('Nur offene')});
 it('erkennt konkurrierende Änderungen',async()=>{const c=setup();c.inventuren.updateOne.mockResolvedValue({modifiedCount:0});await fails('zwischenzeitlich')});
 it('meldet Fehler beim Zurücksetzen der Positionen',async()=>{const c=setup();c.inventurpositionen.updateMany.mockRejectedValue(Error('Update fehlgeschlagen'));await fails('Update fehlgeschlagen')});
 it('meldet Fehler beim Protokollieren',async()=>{const c=setup();c.inventurprotokoll.insertOne.mockRejectedValue(Error('Log fehlgeschlagen'));await fails('Log fehlgeschlagen')});
 it('meldet unerwartete Fehler',async()=>{setup();m.session.withTransaction.mockRejectedValue('unknown');await fails('Inventur konnte nicht zurückgesetzt werden')});
});

});


import { GET } from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';
describe('Inventur Korrekturhistorie', () => {
const id='507f1f77bcf86cd799439011',uid='507f1f77bcf86cd799439012',pid='507f1f77bcf86cd799439013';
const context=(inventurId=id)=>({params:{id:inventurId},locals:{benutzer:{id:uid,vereinId:'v1'}}}) as any;
function setup(inv:any={status:'abgeschlossen'},entries:any[]=[],positions:any[]=[],users:any[]=[]){const inventuren={findOne:vi.fn().mockResolvedValue(inv)};const inventurprotokoll={find:vi.fn(()=>({sort:vi.fn(()=>({toArray:vi.fn().mockResolvedValue(entries)}))}))};const inventurpositionen={find:vi.fn(()=>({project:vi.fn(()=>({toArray:vi.fn().mockResolvedValue(positions)}))}))};const benutzer={find:vi.fn(()=>({project:vi.fn(()=>({toArray:vi.fn().mockResolvedValue(users)}))}))};m.collections={inventuren,inventurprotokoll,inventurpositionen,benutzer};return {inventuren,inventurprotokoll,inventurpositionen,benutzer}}
beforeEach(()=>{vi.clearAllMocks();m.allowed=true});
const entry=(overrides:any={})=>({_id:new ObjectId(),aktion:'nachtraeglich_korrigiert',positionId:pid,ausgefuehrtVon:uid,ausgefuehrtAm:new Date('2026-01-02'),alterIstBestand:3,neuerIstBestand:5,differenz:2,begruendung:'Korrigiert',...overrides});
describe('Inventur-Korrekturhistorie',()=>{
 it('prüft Berechtigung',async()=>{setup();m.allowed=false;expect((await GET(context())).status).toBe(403)});
 it('prüft ID',async()=>{setup();expect((await GET(context('invalid'))).status).toBe(400)});
 it('meldet fehlende Inventur',async()=>{setup(null);expect((await GET(context())).status).toBe(404)});
 it('liefert leere Historie',async()=>{setup();const r=await GET(context());expect(r.status).toBe(200);expect(await r.json()).toEqual({korrekturen:[],verlauf:[]})});
 it('löst Artikel- und Benutzernamen auf',async()=>{const c=setup({erstelltVon:uid},[entry()],[{_id:new ObjectId(pid),artikelName:'Ball',groesseId:'s'}],[{_id:new ObjectId(uid),vorname:'Anna',nachname:'Muster'}]);const data=await (await GET(context())).json();expect(data.korrekturen[0]).toMatchObject({artikelName:'Ball',bearbeitetVon:'Anna Muster',groesseId:'s',differenz:2});expect(data.verlauf[0]).toMatchObject({aktion:'nachtraeglich_korrigiert',bearbeitetVon:'Anna Muster'});expect(c.benutzer.find).toHaveBeenCalledOnce()});
 it('verwendet unbekannte Namen und Artikel',async()=>{setup({},[entry({positionId:'unbekannt',ausgefuehrtVon:'n/a'})]);const data=await (await GET(context())).json();expect(data.korrekturen[0]).toMatchObject({artikelName:'Unbekannter Artikel',bearbeitetVon:'Unbekannter Benutzer'});expect(data.verlauf[0].bearbeitetVon).toBe('Unbekannter Benutzer')});
 it('ignoriert Einträge ohne gültiges Datum im Verlauf',async()=>{setup({},[entry({ausgefuehrtAm:null})]);const data=await (await GET(context())).json();expect(data.korrekturen).toHaveLength(1);expect(data.verlauf).toHaveLength(0)});
 it('ergänzt alte Ereignisse mit Metadaten und sortiert sie',async()=>{setup({erstelltAm:'2026-01-01',erstelltVon:uid,abgeschlossenAm:new Date('2026-01-02'),abgeschlossenVon:uid,anzahlKorrekturen:2,storniertAm:'2026-01-03',storniertVon:uid,stornierungsgrund:'Fehler'});const data=await (await GET(context())).json();expect(data.verlauf.map((x:any)=>x.aktion)).toEqual(['erstellt','abgeschlossen','storniert']);expect(data.verlauf[1].anzahlKorrekturen).toBe(2);expect(data.verlauf[2].begruendung).toBe('Fehler')});
 it('vermeidet doppelte alte Ereignisse',async()=>{setup({erstelltAm:'2026-01-01'},[entry({aktion:'erstellt',ausgefuehrtAm:'2026-01-01'})]);const data=await (await GET(context())).json();expect(data.verlauf).toHaveLength(1)});
 it('ignoriert ungültige historische Daten',async()=>{setup({erstelltAm:'kein datum',abgeschlossenAm:123,storniertAm:null});expect((await (await GET(context())).json()).verlauf).toHaveLength(0)});
 it('liefert optionale Verlaufsfelder oder null',async()=>{setup({},[entry({aktion:null,ausgefuehrtVon:null,positionId:null,begruendung:12,alterIstBestand:'3',neuerIstBestand:null,differenz:null,statusVorher:'offen',anzahlRueckbuchungen:2,anzahlKorrekturen:1,positionen:[{x:1}],artikelName:'Manuell'})]);const data=await (await GET(context())).json();expect(data.verlauf[0]).toMatchObject({aktion:'unbekannt',positionId:null,begruendung:null,alterIstBestand:null,neuerIstBestand:null,artikelName:'Manuell',anzahlRueckbuchungen:2,anzahlKorrekturen:1,positionen:[{x:1}]})});
 it('sortiert Ereignisse mit gleichem Datum nach ID',async()=>{const a=entry({_id:new ObjectId('507f1f77bcf86cd799439021'),aktion:'x'}),b=entry({_id:new ObjectId('507f1f77bcf86cd799439020'),aktion:'y'});setup({},[a,b]);const data=await (await GET(context())).json();expect(data.verlauf.map((x:any)=>x.aktion)).toEqual(['y','x'])});
 it('behandelt Datenbankfehler',async()=>{const c=setup();c.inventuren.findOne.mockRejectedValue(Error('db'));expect((await GET(context())).status).toBe(500)});
});

});
