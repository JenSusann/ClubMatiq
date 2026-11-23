import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { PDFDocument } from 'pdf-lib';
const m = vi.hoisted(() => ({ permission: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn((name: string) => ({ findOne: (...args: unknown[]) => m.findOne(name, ...args), find: (...args: unknown[]) => m.find(name, ...args) })) } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
const id='aaaaaaaaaaaaaaaaaaaaaaaa', gid='bbbbbbbbbbbbbbbbbbbbbbbb', groesseId='cccccccccccccccccccccccc';
const rechnung = () => ({ _id: new ObjectId(id), vereinId:'club', rechnungsnummer:'R-2026-1', empfaenger:'Test Person', erstelltAm:new Date('2026-11-01'), positionen:[{ artikelname:'Jacke', groesseId, menge:2, einzelpreis:30, positionsbetrag:60 }], zwischentotal:60, rabattTotal:0, gesamtbetrag:60, bezahltBetrag:0, status:'offen', zahlungsart:'rechnung' });
const gutschrift = () => ({ gutschriftnummer:'G-2026/1', rechnungsnummer:'R-2026-1', artikelname:'Jacke', groesseId, menge:1, einzelpreis:30, betrag:30, grund:'Falsche Grösse', erstelltAm:new Date('2026-11-03') });
function setup(r: any=rechnung(), g: any=gutschrift()) {
 m.findOne.mockImplementation(async (name:string) => name==='vereinskleider_rechnungen'?r:name==='vereinskleider_gutschriften'?g:name==='vereine'?{name:'Turnverein Weiningen'}:{bezeichnung:'M'});
 m.find.mockReturnValue({toArray:m.toArray}); m.toArray.mockResolvedValue([{_id:new ObjectId(groesseId),bezeichnung:'M'}]);
}
const call=(customId=id, credit?:string)=>GET({params:{id:customId},locals:{benutzer:{vereinId:'club'}},url:new URL(`http://localhost/api/pdf${credit===undefined?'':'?gutschriftId='+credit}`)} as any);
async function pdf(response: Response) { expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('application/pdf'); return PDFDocument.load(await response.arrayBuffer()); }
beforeEach(()=>{vi.resetAllMocks();m.permission.mockReturnValue(null);setup();});
describe('Rechnungs-, Quittungs- und Gutschrift-PDF',()=>{
 it('prüft Berechtigung',async()=>{m.permission.mockReturnValue(new Response('',{status:403}));expect((await call() as Response).status).toBe(403);});
 it('prüft Rechnungs-ID',async()=>{expect((await call('invalid') as Response).status).toBe(400);});
 it('liefert 404 bei fehlender Rechnung',async()=>{setup(null);expect((await call() as Response).status).toBe(404);});
 it('prüft Gutschrift-ID',async()=>{expect((await call(id,'invalid') as Response).status).toBe(400);});
 it('liefert 404 bei fehlender Gutschrift',async()=>{setup(rechnung(),null);expect((await call(id,gid) as Response).status).toBe(404);});
 it('erstellt offene Rechnung',async()=>{const r=await call() as Response;expect(r.headers.get('content-disposition')).toContain('Rechnung-');expect((await pdf(r)).getPageCount()).toBe(1);},15000);
 it.each(['bar','twint'])('erstellt bezahlte Quittung mit %s',async(zahlungsart)=>{setup({...rechnung(),bezahltBetrag:60,status:'bezahlt',zahlungsart});const r=await call() as Response;expect(r.headers.get('content-disposition')).toContain('Quittung-');await pdf(r);});
 it('erstellt bezahlte Überweisungsrechnung',async()=>{setup({...rechnung(),bezahltBetrag:60,status:'bezahlt'});await pdf(await call() as Response);});
 it('erstellt teilweise bezahlte Rechnung mit Zahlungen',async()=>{setup({...rechnung(),bezahltBetrag:20,status:'teilweise_bezahlt',zahlungen:[{betrag:20,datum:'2026-11-03',zahlungsart:'twint'},{betrag:0,datum:'2026-11-04',zahlungsart:'bar'},{betrag:4,datum:'ungültig',zahlungsart:'bar'}]});await pdf(await call() as Response);});
 it('erstellt stornierte Rechnung',async()=>{setup({...rechnung(),status:'storniert'});await pdf(await call() as Response);});
 it('erstellt Rechnung mit Gutschrift und Rückerstattung',async()=>{setup({...rechnung(),bezahltBetrag:60,gutgeschriebenBetrag:30,rabatte:[{name:'Mitgliederrabatt',betrag:5}],zusaetzlicherRabatt:2});await pdf(await call() as Response);});
 it('erstellt Gutschrift-PDF mit Grösse',async()=>{const r=await call(id,gid) as Response;expect(r.headers.get('content-disposition')).toContain('Gutschrift-G-2026_1.pdf');await pdf(r);});
 it('erstellt Gutschrift ohne Grösse und mit langem Grund',async()=>{setup(rechnung(),{...gutschrift(),groesseId:null,grund:'Grund '.repeat(200)});await pdf(await call(id,gid) as Response);});
 it('erstellt Gutschrift mit unbekannter Grösse',async()=>{setup(rechnung(),gutschrift());m.findOne.mockImplementation(async(name:string)=>name==='vereinskleider_rechnungen'?rechnung():name==='vereinskleider_gutschriften'?gutschrift():null);await pdf(await call(id,gid) as Response);});
 it('erstellt mehrseitige Rechnung mit langen Artikeln',async()=>{setup({...rechnung(),positionen:Array.from({length:50},(_,i)=>({artikelname:'Extrem langer Artikelname '.repeat(8)+i,groesseId:i%2?null:groesseId,menge:1,einzelpreis:1,positionsbetrag:1})),rabatte:Array.from({length:15},(_,i)=>({name:'Rabatt '+i,betrag:1}))});expect((await pdf(await call() as Response)).getPageCount()).toBeGreaterThan(1);});
 it('behandelt Datenbankfehler mit HTTP 500',async()=>{m.findOne.mockRejectedValue(new Error('offline'));expect((await call() as Response).status).toBe(500);});
});
