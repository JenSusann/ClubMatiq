import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ObjectId} from 'mongodb';
const m=vi.hoisted(()=>({c:{} as Record<string,any>,permission:vi.fn(()=>null as Response|null),session:{withTransaction:vi.fn(async(fn:()=>Promise<unknown>)=>fn()),endSession:vi.fn(async()=>{})}}));
vi.mock('../../../../src/lib/server/mongodb',()=>({db:{collection:(n:string)=>m.c[n]},client:{startSession:()=>m.session}}));
vi.mock('../../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
const ID='507f1f77bcf86cd799439011', A='507f1f77bcf86cd799439012', B='507f1f77bcf86cd799439013', S='507f1f77bcf86cd799439014', V='507f1f77bcf86cd799439015';
const user={id:'u1',vereinId:V,rolle:'admin'};
const req=(x:unknown)=>new Request('http://localhost/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(x)});
const unpack=async(p:Promise<Response>|Response)=>{const r=await p;const t=await r.text();return {status:r.status,body:t?JSON.parse(t):null}};
beforeEach(()=>{vi.clearAllMocks();m.permission.mockReturnValue(null);m.session.withTransaction.mockImplementation(async(fn:()=>Promise<unknown>)=>fn());for(const k of Object.keys(m.c))delete m.c[k]});


import {PDFDocument} from 'pdf-lib';
const invoice=()=>({_id:new ObjectId(ID),vereinId:V,rechnungsnummer:'R-2026-001',empfaenger:'Test Person',riegen:['Aktive'],positionen:[{artikelname:'Shirt',groesseId:null,menge:2,einzelpreis:10,positionsbetrag:20}],zwischentotal:20,rabattTotal:0,gesamtbetrag:20,bezahltBetrag:0,erstelltAm:new Date('2026-11-01'),status:'offen',zahlungsart:'rechnung'});
const credit=()=>({gutschriftnummer:'G-2026-1',rechnungsnummer:'R-2026-001',artikelname:'Shirt',groesseId:null,menge:1,einzelpreis:10,betrag:10,grund:'Rückgabe',erstelltAm:new Date('2026-11-02')});
const get=(query='',id=ID)=>route0.GET({params:{id},locals:{benutzer:user},url:new URL('http://localhost/api?'+query)} as never);
function setup(r:any=invoice(),g:any=credit()){
 m.c.vereinskleider_rechnungen={findOne:vi.fn(async()=>r)};
 m.c.vereinskleider_gutschriften={findOne:vi.fn(async()=>g)};
 m.c.vereine={findOne:vi.fn(async()=>({name:'Turnverein Test'}))};
 m.c.groessen={findOne:vi.fn(async()=>({bezeichnung:'M'})),find:vi.fn(()=>({toArray:async()=>[{_id:new ObjectId(B),bezeichnung:'M'}]}))};
}
async function pdf(p:Response | Promise<Response>){const r=await p;expect(r.status).toBe(200);expect(r.headers.get('Content-Type')).toBe('application/pdf');const bytes=new Uint8Array(await r.arrayBuffer());expect(bytes.length).toBeGreaterThan(300);expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);return r;}
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

// Ursprüngliche Datei: 40-verrechnung-pdf.integration.test.ts
describe('Paket 40 – Rechnungs- und Gutschriften-PDF',()=>{
 it('Berechtigung',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await get()).status).toBe(403)});
 it('ungültige Rechnungs-ID',async()=>{expect((await get('','bad')).status).toBe(400)});
 it('Rechnung fehlt',async()=>{setup(null);expect((await get()).status).toBe(404)});
 it('ungültige Gutschrift-ID',async()=>{setup();expect((await get('gutschriftId=bad')).status).toBe(400)});
 it('Gutschrift fehlt',async()=>{setup(invoice(),null);expect((await get('gutschriftId='+B)).status).toBe(404)});
 it('offene Rechnung',async()=>{setup();await pdf(get())});
 it('bezahlte TWINT-Quittung',async()=>{setup({...invoice(),bezahltBetrag:20,status:'bezahlt',zahlungsart:'twint'});const r=await pdf(get());expect(r.headers.get('Content-Disposition')).toContain('Quittung')});
 it('bezahlte Bar-Quittung',async()=>{setup({...invoice(),bezahltBetrag:20,status:'bezahlt',zahlungsart:'bar'});await pdf(get())});
 it('bezahlte Überweisung',async()=>{setup({...invoice(),bezahltBetrag:20,status:'bezahlt',zahlungsart:'rechnung'});await pdf(get())});
 it('teilweise bezahlt',async()=>{setup({...invoice(),bezahltBetrag:5,status:'teilweise_bezahlt'});await pdf(get())});
 it('stornierte Rechnung',async()=>{setup({...invoice(),status:'storniert'});await pdf(get())});
 it('Rückerstattung offen',async()=>{setup({...invoice(),bezahltBetrag:20,gutgeschriebenBetrag:10});await pdf(get())});
 it('Rabatte und Zahlungen',async()=>{setup({...invoice(),rabatte:[{name:'Rabatt',betrag:2}],zusaetzlicherRabatt:1,zahlungen:[{betrag:5,datum:'2026-11-02',zahlungsart:'twint'},{betrag:0,datum:'bad',zahlungsart:'bar'}]});await pdf(get())});
 it('Grössenbezeichnung',async()=>{setup({...invoice(),positionen:[{artikelname:'Trikot',groesseId:B,menge:1,einzelpreis:20,positionsbetrag:20}]});await pdf(get())});
 it('mehrseitiges PDF',async()=>{setup({...invoice(),positionen:Array.from({length:70},(_,i)=>({artikelname:'Artikel '+i,groesseId:null,menge:1,einzelpreis:1,positionsbetrag:1}))});const r=await get();expect(r.status).toBe(200);expect((await PDFDocument.load(new Uint8Array(await r.arrayBuffer()))).getPageCount()).toBeGreaterThan(1)});
 it('Gutschrift ohne Grösse',async()=>{setup();const r=await pdf(get('gutschriftId='+B));expect(r.headers.get('Content-Disposition')).toContain('Gutschrift')});
 it('Gutschrift mit Grösse',async()=>{setup(invoice(),{...credit(),groesseId:B});await pdf(get('gutschriftId='+B))});
 it('Gutschrift ohne Vereinsnamen',async()=>{setup();m.c.vereine.findOne.mockResolvedValue(null);await pdf(get('gutschriftId='+B))});
 it('lange Gutschriftbegründung',async()=>{setup(invoice(),{...credit(),grund:'Sehr lange Begründung '.repeat(30)});await pdf(get('gutschriftId='+B))});
 it('Datenbankfehler',async()=>{setup();m.c.vereinskleider_rechnungen.findOne.mockRejectedValue(Error('db'));expect((await get()).status).toBe(500)});
});

