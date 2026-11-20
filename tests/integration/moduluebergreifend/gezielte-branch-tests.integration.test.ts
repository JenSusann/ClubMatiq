import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const mocks = vi.hoisted(() => ({
  collection: vi.fn(), permission: vi.fn(() => null), withTransaction: vi.fn(), endSession: vi.fn(),
  findOne: vi.fn(), find: vi.fn(), aggregate: vi.fn(), countDocuments: vi.fn(),
  insertOne: vi.fn(), updateOne: vi.fn(), findOneAndUpdate: vi.fn(),
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: mocks.collection },
  client: { startSession: () => ({ withTransaction: mocks.withTransaction, endSession: mocks.endSession }) }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: mocks.permission }));
import { POST as salePOST, GET as saleGET } from '../../../src/routes/api/vereinskleider/+server';
import { POST as handoverPOST } from '../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';
import { GET as discountGET, POST as discountPOST, PUT as discountPUT } from '../../../src/routes/api/rabatte/+server';
const ID='507f1f77bcf86cd799439011', ART='507f191e810c19729de860ea', SIZE='507f1f77bcf86cd799439012';
const user={id:ID,vereinId:ID,rolle:'admin'};
const sale={verkaufsart:'bestellung',kaeufer:'Testperson',zahlungsart:'rechnung',riegen:['Aktive'],positionen:[{artikelId:ART,groesseId:null,menge:2}]};
const discount={name:'Aktion',rabattart:'prozent',wert:10,geltungsbereich:'warenkorb'};
const handover={vorgangId:ID,positionsIndex:0,menge:1};
function event(body:unknown, method='POST', query='') {
 const url = new URL('http://localhost/api/test'+query);
 const init: RequestInit = { method };
 if (method !== 'GET' && method !== 'HEAD') {
  init.headers = { 'content-type': 'application/json' };
  init.body = JSON.stringify(body);
 }
 return { locals: { benutzer: user }, request: new Request(url, init), url } as never;
}
function cursor(rows:any[]){return {sort:vi.fn().mockReturnThis(),project:vi.fn().mockReturnThis(),toArray:vi.fn().mockResolvedValue(rows)};}
function setup(){
 vi.resetAllMocks();mocks.permission.mockReturnValue(null);
 mocks.withTransaction.mockImplementation(async (fn:any)=>fn());mocks.endSession.mockResolvedValue(undefined);
 mocks.findOne.mockResolvedValue(null);mocks.find.mockImplementation(()=>cursor([]));
 mocks.aggregate.mockImplementation(()=>cursor([{eintraege:[],zaehler:[]}]));
 mocks.countDocuments.mockResolvedValue(1);mocks.insertOne.mockResolvedValue({insertedId:new ObjectId(ID)});
 mocks.updateOne.mockResolvedValue({matchedCount:1,modifiedCount:1});
 mocks.findOneAndUpdate.mockResolvedValue(null);
 mocks.collection.mockImplementation(()=>({findOne:mocks.findOne,find:mocks.find,aggregate:mocks.aggregate,countDocuments:mocks.countDocuments,insertOne:mocks.insertOne,updateOne:mocks.updateOne,findOneAndUpdate:mocks.findOneAndUpdate}));
}
beforeEach(setup);
async function check(handler:any, body:unknown, status:number, method='POST'){const response=await handler(event(body,method));expect(response.status).toBe(status);return response.json();}

describe('Paket 30 – Verkaufsvalidierung',()=>{
 const cases:[string,any,string][]=[
 ['null',null,'Ungültige Verkaufsdaten'],['array',[],'Ungültige Verkaufsdaten'],
 ['verkaufsart',{verkaufsart:'falsch'},'Ungültige Verkaufsart'],
 ['kaeufer',{kaeufer:'   '},'Käufer'],['kaeufer lang',{kaeufer:'x'.repeat(201)},'Käufer'],
 ['zahlung',{zahlungsart:'karte'},'Zahlungsart'],['zahlungErhalten',{zahlungErhalten:1},'Zahlungsbestätigung'],
 ['rechnung bezahlt',{zahlungErhalten:true},'Rechnung'],['bemerkung',{bemerkung:5},'Bemerkung'],
 ['riegen leer',{riegen:[]},'Riege'],['riegen ungueltig',{riegen:['']},'Riege'],
 ['positionen leer',{positionen:[]},'Warenkorb'],['positionen keine id',{positionen:[{artikelId:'abc',groesseId:null,menge:2}]},'Warenkorbposition'],
 ['positionen menge null',{positionen:[{artikelId:ART,groesseId:null,menge:0}]},'Warenkorbposition'],
 ['positionen menge zu gross',{positionen:[{artikelId:ART,groesseId:null,menge:10001}]},'Warenkorbposition'],
 ['positionen preis negativ',{positionen:[{artikelId:ART,groesseId:null,menge:1,einzelpreis:-1}]},'Warenkorbposition'],
 ['rabatt ids falsch',{rabattIds:['x']},'Rabattregel'],['rabatt ids doppelt',{rabattIds:[ID,ID]},'Rabattregel'],
 ['rabatt zusatz negativ',{zusaetzlicherRabatt:-1},'zusätzlicher Rabatt'],
 ];
 it.each(cases)('%s',async(_name,changes,fragment)=>{const body=changes===null||Array.isArray(changes)?changes:{...sale,...changes};const result=await check(salePOST,body,400);expect(result.fehler).toContain(fragment);expect(mocks.withTransaction).not.toHaveBeenCalled();});
 it('Artikel fehlt',async()=>{const result=await check(salePOST,sale,404);expect(result.fehler).toContain('nicht gefunden');});
 it('Artikel ist keine Vereinskleidung',async()=>{mocks.findOne.mockResolvedValue({name:'Ball',istVereinskleidung:false,hatGroessen:false});const r=await check(salePOST,sale,400);expect(r.fehler).toContain('Vereinskleidern');});
 it('Grössenstruktur stimmt nicht',async()=>{mocks.findOne.mockResolvedValue({name:'Shirt',istVereinskleidung:true,hatGroessen:true});const r=await check(salePOST,sale,400);expect(r.fehler).toContain('Grössenzuordnung');});
 it('Preis fehlt',async()=>{mocks.findOne.mockResolvedValueOnce({name:'Ball',istVereinskleidung:true,hatGroessen:false}).mockResolvedValueOnce(null);const r=await check(salePOST,sale,400);expect(r.fehler).toContain('Verkaufspreis');});
 it('Unbekannter Preistyp',async()=>{mocks.findOne.mockResolvedValueOnce({name:'Ball',istVereinskleidung:true,hatGroessen:false}).mockResolvedValueOnce({preistyp:'falsch'});const r=await check(salePOST,sale,400);expect(r.fehler).toContain('Preistyp');});
 it('Fixpreis ungueltig',async()=>{mocks.findOne.mockResolvedValueOnce({name:'Ball',istVereinskleidung:true,hatGroessen:false}).mockResolvedValueOnce({preistyp:'fix',verkaufspreis:-1});const r=await check(salePOST,sale,400);expect(r.fehler).toContain('Fixpreis');});
 it('Fixpreis wurde geändert',async()=>{mocks.findOne.mockResolvedValueOnce({name:'Ball',istVereinskleidung:true,hatGroessen:false}).mockResolvedValueOnce({preistyp:'fix',verkaufspreis:12});const r=await check(salePOST,{...sale,positionen:[{...sale.positionen[0],einzelpreis:13}]},409);expect(r.fehler).toContain('geändert');});
 it('Bestellung erfolgreich',async()=>{mocks.findOne.mockResolvedValueOnce({name:'Ball',kategorieId:ID,istVereinskleidung:true,hatGroessen:false}).mockResolvedValueOnce({preistyp:'fix',verkaufspreis:12});const r=await check(salePOST,sale,201);expect(r.verkauf.bestellMenge).toBe(2);expect(r.verkauf.endbetrag).toBe(24);});
 it('Automatischer Verkauf teilt Bestand',async()=>{mocks.findOne.mockResolvedValueOnce({name:'Ball',kategorieId:ID,istVereinskleidung:true,hatGroessen:false}).mockResolvedValueOnce({preistyp:'fix',verkaufspreis:12}).mockResolvedValueOnce({menge:2});const r=await check(salePOST,{...sale,verkaufsart:'automatisch',zahlungsart:'bar'},201);expect(r.verkauf.verkaufsart).toBe('gemischt');});
});

describe('Paket 30 – Verkaufshistorie',()=>{
 const invalid=['?seite=0','?seite=10001','?seite=1.5','?art=falsch','?zahlung=unbekannt','?riege='+('x'.repeat(101)),'?suche='+('x'.repeat(121)),'?von=2026-02-30','?von=2026-12-31&bis=2026-01-01','?bis=2026/01/01'];
 it.each(invalid)('ungueltiger Filter %s',async(query)=>{const r=await saleGET(event(null,'GET',query));expect(r.status).toBe(400);});
 it.each(['?zahlung=bezahlt','?zahlung=offen','?zahlung=gutschrift','?art=bestellung&riege=Aktive','?von=2026-01-01&bis=2026-01-31','?suche=Test','?suche='+ID,'?seite=2'])('gültiger Filter %s',async(query)=>{const r=await saleGET(event(null,'GET',query));expect(r.status).toBe(200);});
 it('liefert vorhandene Verkäufe mit Rechnungen',async()=>{mocks.aggregate.mockImplementation(()=>cursor([{eintraege:[{_id:new ObjectId(ID),rechnung:{_id:new ObjectId(ART)}}],zaehler:[{anzahl:1}]}]));const r=await saleGET(event(null,'GET'));expect(r.status).toBe(200);const body=await r.json();expect(body.gesamt).toBe(1);expect(body.verkaeufe[0].rechnung._id).toBe(ART);});
 it('Datenbankfehler liefert 500',async()=>{mocks.aggregate.mockImplementation(()=>({toArray:vi.fn().mockRejectedValue(new Error('DB'))}));const spy=vi.spyOn(console,'error').mockImplementation(()=>{});const r=await saleGET(event(null,'GET'));expect(r.status).toBe(500);spy.mockRestore();});
});

describe('Paket 30 – Übergabe',()=>{
 const bad:[string,any][]=[['null',null],['array',[]],['ID',{vorgangId:'abc'}],['Index',{positionsIndex:-1}],['Menge',{menge:0}],['Menge gross',{menge:10001}]];
 it.each(bad)('%s',async(_name,changes)=>{const body=changes===null||Array.isArray(changes)?changes:{...handover,...changes};await check(handoverPOST,body,400);});
 it('Vorgang fehlt',async()=>{const r=await check(handoverPOST,handover,404);expect(r.fehler).toContain('Vorgang');});
 const p={artikelId:ART,groesseId:null,menge:3,verkaufsart:'bestellung',uebergebenMenge:0,reserviertMenge:0};
 it('Position fehlt',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[]});const r=await check(handoverPOST,handover,400);expect(r.fehler).toContain('keine offene Bestellung');});
 it('Direktposition nicht übergebbar',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[{...p,verkaufsart:'direkt'}]});await check(handoverPOST,handover,400);});
 it('Ungültige Artikel-ID',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[{...p,artikelId:'x'}]});await check(handoverPOST,handover,400);});
 it('Inkonsistente Reservierung',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[{...p,reserviertMenge:5}]});await check(handoverPOST,handover,409);});
 it('Übergabemenge überschreitet offenen Bestand',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]});await check(handoverPOST,{...handover,menge:4},409);});
 it('Artikel fehlt',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]}).mockResolvedValueOnce(null);await check(handoverPOST,handover,404);});
 it('Grössenstruktur hat sich geändert',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]}).mockResolvedValueOnce({hatGroessen:true,menge:10});await check(handoverPOST,handover,409);});
 it('Lagerbestand ungueltig',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]}).mockResolvedValueOnce({hatGroessen:false,menge:-1});await check(handoverPOST,handover,409);});
 it('Übergabe erfolgreich',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]}).mockResolvedValueOnce({hatGroessen:false,menge:10});const r=await check(handoverPOST,handover,200);expect(r.uebergabe.offen).toBe(2);});
 it('Übergabe abgeschlossen',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]}).mockResolvedValueOnce({hatGroessen:false,menge:10});const r=await check(handoverPOST,{...handover,menge:3},200);expect(r.uebergabe.status).toBe('abgeschlossen');});
 it('Bestand wurde zwischenzeitlich geändert',async()=>{mocks.findOne.mockResolvedValueOnce({positionen:[p]}).mockResolvedValueOnce({hatGroessen:false,menge:10});mocks.updateOne.mockResolvedValue({modifiedCount:0});await check(handoverPOST,handover,409);});
});

describe('Paket 30 – Rabatte',()=>{
 const bad:[string,any,string][]=[
 ['null',null,'Ungültige Rabattdaten'],['array',[],'Ungültige Rabattdaten'],
 ['Name',{name:''},'Rabattnamen'],['Name lang',{name:'x'.repeat(121)},'Rabattnamen'],
 ['Art',{rabattart:'ungültig'},'Rabattart'],['Bereich',{geltungsbereich:'ungültig'},'Gültigkeitsbereich'],
 ['Wert negativ',{wert:-1},'Rabattwert'],['Wert Nachkommastellen',{wert:1.234},'Rabattwert'],
 ['Prozent >100',{wert:101},'100 %'],['Artikel IDs',{artikelIds:['abc']},'Artikel- oder Kategorie-IDs'],
 ['Artikel fehlen',{geltungsbereich:'artikel'},'mindestens einen Artikel'],
 ['Kategorie fehlen',{geltungsbereich:'kategorie'},'mindestens eine Kategorie'],
 ['Riegen',{riegen:['']},'Riegen'],['Max Menge',{maximaleMenge:0},'maximale Menge'],
 ['Datum ab',{gueltigAb:'2026-02-30'},'Gültigkeitszeitraum'],
 ['Datum bis',{gueltigBis:'2026-99-01'},'Gültigkeitszeitraum'],
 ['Datum Reihenfolge',{gueltigAb:'2026-12-31',gueltigBis:'2026-01-01'},'Gültigkeitszeitraum'],
 ['kombinierbar',{kombinierbar:1},'Kombinierbarkeit'],['aktiv',{aktiv:'ja'},'Aktivstatus']
 ];
 it.each(bad)('POST %s',async(_name,changes,fragment)=>{const body=changes===null||Array.isArray(changes)?changes:{...discount,...changes};const r=await check(discountPOST,body,400);expect(r.fehler).toContain(fragment);});
 it('POST erfolgreich',async()=>{const r=await check(discountPOST,discount,201);expect(r.name).toBe('Aktion');expect(r.aktiv).toBe(true);});
 it('POST Artikel eines anderen Vereins',async()=>{mocks.countDocuments.mockResolvedValue(0);const r=await check(discountPOST,{...discount,geltungsbereich:'artikel',artikelIds:[ART]},400);expect(r.fehler).toContain('Verein');});
 it('POST Kategorie eines anderen Vereins',async()=>{mocks.countDocuments.mockResolvedValue(0);await check(discountPOST,{...discount,geltungsbereich:'kategorie',kategorieIds:[ID]},400);});
 it('POST Artikelzuordnung erfolgreich',async()=>{const r=await check(discountPOST,{...discount,geltungsbereich:'artikel',artikelIds:[ART]},201);expect(r.artikelIds).toEqual([ART]);});
 it('GET leer',async()=>{const r=await discountGET(event(null,'GET'));expect(r.status).toBe(200);expect(await r.json()).toEqual([]);});
 it('GET mit Rabatt',async()=>{mocks.find.mockImplementation(()=>cursor([{_id:new ObjectId(ID),...discount}]));const r=await discountGET(event(null,'GET'));expect((await r.json())[0]._id).toBe(ID);});
 it('PUT ungültige ID',async()=>{await check(discountPUT,{...discount,_id:'x'},400,'PUT');});
 it('PUT nicht gefunden',async()=>{await check(discountPUT,{...discount,_id:ID},404,'PUT');});
 it('PUT erfolgreich',async()=>{mocks.findOneAndUpdate.mockResolvedValue({_id:new ObjectId(ID),...discount});const r=await check(discountPUT,{...discount,_id:ID},200,'PUT');expect(r.name).toBe('Aktion');});
 it('POST Datenbankfehler',async()=>{mocks.insertOne.mockRejectedValue(new Error('DB'));const spy=vi.spyOn(console,'error').mockImplementation(()=>{});await check(discountPOST,discount,500);spy.mockRestore();});
 it('PUT Datenbankfehler',async()=>{mocks.findOneAndUpdate.mockRejectedValue(new Error('DB'));const spy=vi.spyOn(console,'error').mockImplementation(()=>{});await check(discountPUT,{...discount,_id:ID},500,'PUT');spy.mockRestore();});
});
