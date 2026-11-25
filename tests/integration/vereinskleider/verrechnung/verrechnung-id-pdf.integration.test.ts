import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), project: vi.fn(), toArray: vi.fn() }));
vi.mock('../../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
import * as suite0_route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route1 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route2 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route3 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route4 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route5 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route6 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route7 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route8 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route9 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route10 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route11 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route12 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route13 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite0_route14 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

describe('verrechnung-id-pdf', () => {
const route0 = suite0_route0;
const route1 = suite0_route1;
const route2 = suite0_route2;
const route3 = suite0_route3;
const route4 = suite0_route4;
const route5 = suite0_route5;
const route6 = suite0_route6;
const route7 = suite0_route7;
const route8 = suite0_route8;
const route9 = suite0_route9;
const route10 = suite0_route10;
const route11 = suite0_route11;
const route12 = suite0_route12;
const route13 = suite0_route13;
const route14 = suite0_route14;
const id = '507f1f77bcf86cd799439011';
const vereinId = '507f191e810c19729de860ea';
const sizeId = '507f1f77bcf86cd799439012';
const invoice = (overrides = {}) => ({ _id: new ObjectId(id), vereinId, rechnungsnummer: 'RE-2026-100', empfaenger: 'Test Mitglied', riegen: ['Aktive'], positionen: [{ artikelname: 'Jacke', groesseId: null, menge: 2, einzelpreis: 20, positionsbetrag: 40 }], zwischentotal: 40, rabattTotal: 0, gesamtbetrag: 40, bezahltBetrag: 0, zahlungsart: 'rechnung', erstelltAm: new Date('2026-11-10T12:00:00Z'), status: 'offen', ...overrides });
const credit = (overrides = {}) => ({ _id: new ObjectId(), vereinId, rechnungId: id, rechnungsnummer: 'RE-2026-100', gutschriftnummer: 'GS-100', artikelname: 'Jacke', groesseId: null, menge: 1, einzelpreis: 20, betrag: 20, grund: 'Falsche Grösse', erstelltAm: new Date('2026-11-11T12:00:00Z'), ...overrides });
function setup(inv: unknown = invoice(), cr: unknown = null, size: unknown = null, club: unknown = { name: 'TV Weiningen' }) {
 m.collection.mockImplementation((name: string) => ({
  findOne: async () => name === 'vereinskleider_rechnungen' ? inv : name === 'vereinskleider_gutschriften' ? cr : name === 'vereine' ? club : name === 'groessen' ? size : null,
  find: () => ({ toArray: async () => size ? [size] : [] })
 }));
}
const event = (query = '') => ({ locals: { benutzer: { id, vereinId, rolle: 'admin' } }, params: { id }, url: new URL('http://localhost/api/pdf' + query) });
beforeEach(() => { vi.clearAllMocks(); });


// Ursprüngliche Datei: 27-pdf-gutschrift-langer-grund.integration.test.ts
describe('27-pdf-gutschrift-langer-grund', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), credit({ grund: 'Korrektur '.repeat(180) }), { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route0.GET(event('?gutschriftId=507f1f77bcf86cd799439013') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Gutschrift-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-gutschrift-mit-groesse.integration.test.ts
describe('27-pdf-gutschrift-mit-groesse', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), credit({ groesseId: sizeId }), { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route1.GET(event('?gutschriftId=507f1f77bcf86cd799439013') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Gutschrift-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-gutschrift-ohne-groesse.integration.test.ts
describe('27-pdf-gutschrift-ohne-groesse', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), credit(), { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route2.GET(event('?gutschriftId=507f1f77bcf86cd799439013') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Gutschrift-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-quittung-bar.integration.test.ts
describe('27-pdf-quittung-bar', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, zahlungsart: 'bar', status: 'bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route3.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Quittung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-quittung-twint.integration.test.ts
describe('27-pdf-quittung-twint', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, zahlungsart: 'twint', status: 'bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route4.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Quittung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-bezahlt.integration.test.ts
describe('27-pdf-rechnung-bezahlt', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, zahlungsart: 'rechnung', status: 'bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route5.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-groessen.integration.test.ts
describe('27-pdf-rechnung-groessen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ positionen: [{ artikelname: 'Shirt', groesseId: sizeId, menge: 1, einzelpreis: 20 }] }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route6.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-mehrseitig.integration.test.ts
describe('27-pdf-rechnung-mehrseitig', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ positionen: Array.from({ length: 50 }, (_, i) => ({ artikelname: 'Jacke ' + i, menge: 1, einzelpreis: 1 })) }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route7.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-offen.integration.test.ts
describe('27-pdf-rechnung-offen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice(), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route8.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-rabatte.integration.test.ts
describe('27-pdf-rechnung-rabatte', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ rabatte: [{ name: 'Mitgliederrabatt', betrag: 5 }], zusaetzlicherRabatt: 2, rabattTotal: 7, gesamtbetrag: 33 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route9.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-rueckerstattung.integration.test.ts
describe('27-pdf-rechnung-rueckerstattung', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 40, gutgeschriebenBetrag: 20 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route10.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-storniert.integration.test.ts
describe('27-pdf-rechnung-storniert', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ status: 'storniert', gutgeschriebenBetrag: 40 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route11.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-teilbezahlt.integration.test.ts
describe('27-pdf-rechnung-teilbezahlt', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ bezahltBetrag: 10, status: 'teilweise_bezahlt' }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route12.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-ungueltige-zahlungen.integration.test.ts
describe('27-pdf-rechnung-ungueltige-zahlungen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ zahlungen: [{ betrag: -1, datum: 'ungueltig', zahlungsart: 'bar' }, { betrag: 40, datum: '2026-11-10', zahlungsart: 'bar' }] }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route13.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });



// Ursprüngliche Datei: 27-pdf-rechnung-zahlungen.integration.test.ts
describe('27-pdf-rechnung-zahlungen', () => { it('erstellt ein valides PDF', async () => {
setup(invoice({ zahlungen: [{ betrag: 10, datum: '2026-11-10', zahlungsart: 'twint' }, { betrag: 30, datum: new Date('2026-11-11'), zahlungsart: 'bar' }], bezahltBetrag: 40 }), null, { _id: new ObjectId(sizeId), bezeichnung: 'M' });
const response = await route14.GET(event('') as never);
expect(response.status).toBe(200);
expect(response.headers.get('content-type')).toBe('application/pdf');
expect(response.headers.get('content-disposition')).toContain('Rechnung-');
const pdf = await PDFDocument.load(await response.arrayBuffer());
expect(pdf.getPageCount()).toBeGreaterThan(0);
}); });


});
import * as suite1_route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import * as suite1_route1 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import * as suite1_route2 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import * as suite1_route3 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import * as suite1_route4 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite1_route5 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite1_route6 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite1_route7 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite1_route8 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import * as suite1_route9 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import * as suite1_route10 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import * as suite1_route11 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import * as suite1_route12 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

describe('pdf-eingabepruefungen', () => {
const route0 = suite1_route0;
const route1 = suite1_route1;
const route2 = suite1_route2;
const route3 = suite1_route3;
const route4 = suite1_route4;
const route5 = suite1_route5;
const route6 = suite1_route6;
const route7 = suite1_route7;
const route8 = suite1_route8;
const route9 = suite1_route9;
const route10 = suite1_route10;
const route11 = suite1_route11;
const route12 = suite1_route12;
const id=new ObjectId().toString(); const vereinId=new ObjectId().toString();
const locals={benutzer:{id,vereinId,rolle:'admin'}};
const order={_id:new ObjectId(id),vereinId,lieferantId:null,lieferantName:'Testlieferant',status:'entwurf',positionen:[{artikelId:id,groesseId:null,artikelname:'Trainerjacke',menge:2}],erstelltAm:new Date('2026-11-19')};
const invoice={_id:new ObjectId(id),vereinId,rechnungsnummer:'R-2026-1',empfaenger:'Testmitglied',riegen:['Aktive'],positionen:[{artikelname:'Trainerjacke',groesseId:null,menge:2,einzelpreis:25,positionsbetrag:50}],zwischentotal:50,rabattTotal:0,gesamtbetrag:50,bezahltBetrag:0,erstelltAm:new Date('2026-11-19'),status:'offen',zahlungsart:'rechnung'};
beforeEach(()=>{vi.clearAllMocks();m.findOne.mockImplementation(async(query)=>null);m.find.mockReturnValue({toArray:async()=>[],project:()=>({toArray:async()=>[]})});m.collection.mockImplementation(()=>({findOne:m.findOne,find:m.find}));});


// Ursprüngliche Datei: 22-pdf-combined-duplicate.integration.test.ts
describe('combined-duplicate',()=>{it('prüft PDF-Handler',async()=>{
await expect(route0.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:[id,id]})})} as never)).rejects.toMatchObject({status:400});
});});



// Ursprüngliche Datei: 22-pdf-combined-invalid-input.integration.test.ts
describe('combined-invalid-input',()=>{it('prüft PDF-Handler',async()=>{
await expect(route1.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:['invalid']})})} as never)).rejects.toMatchObject({status:400});
});});



// Ursprüngliche Datei: 22-pdf-combined-missing.integration.test.ts
describe('combined-missing',()=>{it('prüft PDF-Handler',async()=>{
await expect(route2.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:[id]})})} as never)).rejects.toMatchObject({status:404});
});});



// Ursprüngliche Datei: 22-pdf-combined-success.integration.test.ts
describe('combined-success',()=>{it('prüft PDF-Handler',async()=>{m.collection.mockImplementation((name:string)=>({findOne:vi.fn(async()=>name==='lieferanten'?{name:'Lieferant'}:name==='vereine'?{name:'Turnverein'}:null),find:vi.fn(()=>({toArray:async()=>[{...order,lieferantId:id}],project:()=>({toArray:async()=>[]})}))}));
const response=await route3.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:[id]})})} as never);expect(response.status).toBe(200);expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
});});



// Ursprüngliche Datei: 22-pdf-invoice-invalid-credit.integration.test.ts
describe('invoice-invalid-credit',()=>{it('prüft PDF-Handler',async()=>{m.findOne.mockResolvedValueOnce(invoice);
const response=await route4.GET({locals,params:{id},url:new URL('http://localhost?gutschriftId=invalid')} as never);expect(response.status).toBe(400);
});});



// Ursprüngliche Datei: 22-pdf-invoice-invalid-id.integration.test.ts
describe('invoice-invalid-id',()=>{it('prüft PDF-Handler',async()=>{
const response=await route5.GET({locals,params:{id:'invalid'},url:new URL('http://localhost')} as never);expect(response.status).toBe(400);
});});



// Ursprüngliche Datei: 22-pdf-invoice-missing-credit.integration.test.ts
describe('invoice-missing-credit',()=>{it('prüft PDF-Handler',async()=>{m.findOne.mockResolvedValueOnce(invoice);
const response=await route6.GET({locals,params:{id},url:new URL('http://localhost?gutschriftId='+id)} as never);expect(response.status).toBe(404);
});});



// Ursprüngliche Datei: 22-pdf-invoice-missing.integration.test.ts
describe('invoice-missing',()=>{it('prüft PDF-Handler',async()=>{
const response=await route7.GET({locals,params:{id},url:new URL('http://localhost')} as never);expect(response.status).toBe(404);
});});



// Ursprüngliche Datei: 22-pdf-invoice-success.integration.test.ts
describe('invoice-success',()=>{it('prüft PDF-Handler',async()=>{m.collection.mockImplementation((name:string)=>({findOne:vi.fn(async()=>name==='vereinskleider_rechnungen'?invoice:name==='vereine'?{name:'Turnverein'}:null),find:m.find}));
const response=await route8.GET({locals,params:{id},url:new URL('http://localhost')} as never);expect(response.status).toBe(200);expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
});});



// Ursprüngliche Datei: 22-pdf-single-empty.integration.test.ts
describe('single-empty',()=>{it('prüft PDF-Handler',async()=>{m.findOne.mockResolvedValueOnce({...order,positionen:[]});
await expect(route9.GET({locals,params:{id}} as never)).rejects.toMatchObject({status:409});
});});



// Ursprüngliche Datei: 22-pdf-single-invalid-id.integration.test.ts
describe('single-invalid-id',()=>{it('prüft PDF-Handler',async()=>{
await expect(route10.GET({locals,params:{id:'invalid'}} as never)).rejects.toMatchObject({status:400});
});});



// Ursprüngliche Datei: 22-pdf-single-missing.integration.test.ts
describe('single-missing',()=>{it('prüft PDF-Handler',async()=>{
await expect(route11.GET({locals,params:{id}} as never)).rejects.toMatchObject({status:404});
});});



// Ursprüngliche Datei: 22-pdf-single-success.integration.test.ts
describe('single-success',()=>{it('prüft PDF-Handler',async()=>{m.collection.mockImplementation((name:string)=>({findOne:vi.fn(async()=>name==='vereinskleider_sammelbestellungen'?order:name==='vereine'?{name:'Turnverein'}:null),find:m.find}));
const response=await route12.GET({locals,params:{id}} as never);expect(response.status).toBe(200);const bytes=await response.arrayBuffer();expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
});});


});
import { POST as suite2_POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

describe('sammel-pdf', () => {
const POST = suite2_POST;
const id=new ObjectId().toHexString(), id2=new ObjectId().toHexString(), aid=new ObjectId().toHexString(), sid=new ObjectId().toHexString(), vid=new ObjectId().toHexString();
const benutzer={id:aid,vereinId:vid,rolle:'admin'};
const post=(body:unknown)=>POST({locals:{benutzer},request:new Request('http://localhost/api/vereinskleider/sammelbestellungen/pdf',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})} as never);
const doc=(idValue=id)=>({_id:new ObjectId(idValue),lieferantId:sid,positionen:[{artikelId:aid,groesseId:null,artikelname:'Ball',menge:2}],erstelltAm:new Date()});
let docs:ReturnType<typeof doc>[];
beforeEach(()=>{vi.resetAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{});docs=[doc()];m.collection.mockImplementation((name:string)=>({find:()=>({toArray:()=>Promise.resolve(name==='vereinskleider_sammelbestellungen'?docs:[]),project:()=>({toArray:()=>Promise.resolve([])})}),findOne:()=>Promise.resolve(name==='lieferanten'?{name:'Lieferant'}:name==='vereine'?{name:'Turnverein'}:null)}));});
async function status(body:unknown){try{return (await post(body)).status}catch(e){return (e as {status?:number}).status}}
describe('Paket 7 – Sammelbestellungen Gesamt-PDF',()=>{
 it.each([null,[],3])('ungültiger Body %j',async body=>{expect(await status(body)).toBe(400);});
 it.each([[],['ungültig'],Array(51).fill(id),[id,id]])('ungültige Auswahl %j',async bestellungIds=>{expect(await status({bestellungIds})).toBe(400);});
 it('fehlende Bestellung',async()=>{docs=[];expect(await status({bestellungIds:[id]})).toBe(404);});
 it('unterschiedliche Lieferanten',async()=>{docs=[doc(),{...doc(id2),lieferantId:id2}];expect(await status({bestellungIds:[id,id2]})).toBe(409);});
 it('fehlender Lieferant',async()=>{m.collection.mockImplementation((name:string)=>({find:()=>({toArray:()=>Promise.resolve(name==='vereinskleider_sammelbestellungen'?docs:[])}),findOne:()=>Promise.resolve(null)}));expect(await status({bestellungIds:[id]})).toBe(409);});
 it('leere Positionen',async()=>{docs=[{...doc(),positionen:[]}];expect(await status({bestellungIds:[id]})).toBe(409);});
 it('ungültige Positionsmenge',async()=>{docs=[{...doc(),positionen:[{artikelId:aid,groesseId:null,artikelname:'Ball',menge:0}]}];expect(await status({bestellungIds:[id]})).toBe(409);});
 it('erstellt PDF für eine Bestellung',async()=>{const r=await post({bestellungIds:[id]});expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('application/pdf');expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100);});
 it('gruppiert Positionen aus zwei Bestellungen',async()=>{docs=[doc(),doc(id2)];const r=await post({bestellungIds:[id,id2]});expect(r.status).toBe(200);});
 it('Datenbankfehler wird 500',async()=>{m.collection.mockImplementation(()=>{throw new Error('DB')});expect(await status({bestellungIds:[id]})).toBe(500);});
});

});
