import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
const m=vi.hoisted(()=>({ findOne:vi.fn(),find:vi.fn(),collection:vi.fn() }));
vi.mock('../../../../src/lib/server/mongodb',()=>({db:{collection:m.collection}}));
const id=new ObjectId().toString(); const vereinId=new ObjectId().toString();
const locals={benutzer:{id,vereinId,rolle:'admin'}};
const order={_id:new ObjectId(id),vereinId,lieferantId:null,lieferantName:'Testlieferant',status:'entwurf',positionen:[{artikelId:id,groesseId:null,artikelname:'Trainerjacke',menge:2}],erstelltAm:new Date('2026-11-19')};
const invoice={_id:new ObjectId(id),vereinId,rechnungsnummer:'R-2026-1',empfaenger:'Testmitglied',riegen:['Aktive'],positionen:[{artikelname:'Trainerjacke',groesseId:null,menge:2,einzelpreis:25,positionsbetrag:50}],zwischentotal:50,rabattTotal:0,gesamtbetrag:50,bezahltBetrag:0,erstelltAm:new Date('2026-11-19'),status:'offen',zahlungsart:'rechnung'};
beforeEach(()=>{vi.clearAllMocks();m.findOne.mockImplementation(async(query)=>null);m.find.mockReturnValue({toArray:async()=>[],project:()=>({toArray:async()=>[]})});m.collection.mockImplementation(()=>({findOne:m.findOne,find:m.find}));});
import * as route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

// Ursprüngliche Datei: 22-pdf-combined-duplicate.integration.test.ts
describe('combined-duplicate',()=>{it('prüft PDF-Handler',async()=>{
await expect(route0.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:[id,id]})})} as never)).rejects.toMatchObject({status:400});
});});

import * as route1 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

// Ursprüngliche Datei: 22-pdf-combined-invalid-input.integration.test.ts
describe('combined-invalid-input',()=>{it('prüft PDF-Handler',async()=>{
await expect(route1.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:['invalid']})})} as never)).rejects.toMatchObject({status:400});
});});

import * as route2 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

// Ursprüngliche Datei: 22-pdf-combined-missing.integration.test.ts
describe('combined-missing',()=>{it('prüft PDF-Handler',async()=>{
await expect(route2.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:[id]})})} as never)).rejects.toMatchObject({status:404});
});});

import * as route3 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

// Ursprüngliche Datei: 22-pdf-combined-success.integration.test.ts
describe('combined-success',()=>{it('prüft PDF-Handler',async()=>{m.collection.mockImplementation((name:string)=>({findOne:vi.fn(async()=>name==='lieferanten'?{name:'Lieferant'}:name==='vereine'?{name:'Turnverein'}:null),find:vi.fn(()=>({toArray:async()=>[{...order,lieferantId:id}],project:()=>({toArray:async()=>[]})}))}));
const response=await route3.POST({locals,request:new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bestellungIds:[id]})})} as never);expect(response.status).toBe(200);expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
});});

import * as route4 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-invoice-invalid-credit.integration.test.ts
describe('invoice-invalid-credit',()=>{it('prüft PDF-Handler',async()=>{m.findOne.mockResolvedValueOnce(invoice);
const response=await route4.GET({locals,params:{id},url:new URL('http://localhost?gutschriftId=invalid')} as never);expect(response.status).toBe(400);
});});

import * as route5 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-invoice-invalid-id.integration.test.ts
describe('invoice-invalid-id',()=>{it('prüft PDF-Handler',async()=>{
const response=await route5.GET({locals,params:{id:'invalid'},url:new URL('http://localhost')} as never);expect(response.status).toBe(400);
});});

import * as route6 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-invoice-missing-credit.integration.test.ts
describe('invoice-missing-credit',()=>{it('prüft PDF-Handler',async()=>{m.findOne.mockResolvedValueOnce(invoice);
const response=await route6.GET({locals,params:{id},url:new URL('http://localhost?gutschriftId='+id)} as never);expect(response.status).toBe(404);
});});

import * as route7 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-invoice-missing.integration.test.ts
describe('invoice-missing',()=>{it('prüft PDF-Handler',async()=>{
const response=await route7.GET({locals,params:{id},url:new URL('http://localhost')} as never);expect(response.status).toBe(404);
});});

import * as route8 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-invoice-success.integration.test.ts
describe('invoice-success',()=>{it('prüft PDF-Handler',async()=>{m.collection.mockImplementation((name:string)=>({findOne:vi.fn(async()=>name==='vereinskleider_rechnungen'?invoice:name==='vereine'?{name:'Turnverein'}:null),find:m.find}));
const response=await route8.GET({locals,params:{id},url:new URL('http://localhost')} as never);expect(response.status).toBe(200);expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
});});

import * as route9 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-single-empty.integration.test.ts
describe('single-empty',()=>{it('prüft PDF-Handler',async()=>{m.findOne.mockResolvedValueOnce({...order,positionen:[]});
await expect(route9.GET({locals,params:{id}} as never)).rejects.toMatchObject({status:409});
});});

import * as route10 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-single-invalid-id.integration.test.ts
describe('single-invalid-id',()=>{it('prüft PDF-Handler',async()=>{
await expect(route10.GET({locals,params:{id:'invalid'}} as never)).rejects.toMatchObject({status:400});
});});

import * as route11 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-single-missing.integration.test.ts
describe('single-missing',()=>{it('prüft PDF-Handler',async()=>{
await expect(route11.GET({locals,params:{id}} as never)).rejects.toMatchObject({status:404});
});});

import * as route12 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

// Ursprüngliche Datei: 22-pdf-single-success.integration.test.ts
describe('single-success',()=>{it('prüft PDF-Handler',async()=>{m.collection.mockImplementation((name:string)=>({findOne:vi.fn(async()=>name==='vereinskleider_sammelbestellungen'?order:name==='vereine'?{name:'Turnverein'}:null),find:m.find}));
const response=await route12.GET({locals,params:{id}} as never);expect(response.status).toBe(200);const bytes=await response.arrayBuffer();expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
});});

