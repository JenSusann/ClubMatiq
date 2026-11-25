import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const h = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>, one: {} as Record<string, any>,
  fail: '' as string, count: 1,
  auth: vi.fn(() => null as Response | null),
  insert: vi.fn(async () => ({ insertedId: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa') })),
  update: vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1, deletedCount: 1 })),
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    find: () => ({ project() { return this; }, sort() { return this; }, toArray: async () => { if (h.fail === name) throw new Error('DB-Ausfall'); return h.rows[name] ?? []; } }),
    findOne: async () => { if (h.fail === name) throw new Error('DB-Ausfall'); return h.one[name] ?? null; },
    insertOne: h.insert, updateOne: h.update, updateMany: h.update, deleteOne: h.update,
    countDocuments: async () => h.count
  }) },
  client: { startSession: () => ({ withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }) }
}));
import { GET as suite0_GET } from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';

describe('rechnung-pdf', () => {
const GET = suite0_GET;
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };

beforeEach(reset);
const rechnung = () => ({ _id: new ObjectId(id), vereinId: 'verein-1', rechnungsnummer: 'R-1', empfaenger: 'Max Muster', positionen: [{artikelname:'Shirt',groesseId:null,menge:2,einzelpreis:15,positionsbetrag:30}], zwischentotal:30,rabattTotal:0,gesamtbetrag:30,erstelltAm:new Date('2026-11-01') });
const call = (gutschriftId?: string) => GET({locals,params:{id},url:new URL('http://localhost/api'+(gutschriftId===undefined?'':'?gutschriftId='+gutschriftId))} as any);
describe('Rechnungs- und Gutschriften-PDF',()=>{
 it('prüft Berechtigung und Rechnungs-ID',async()=>{h.auth.mockReturnValue(new Response('Verboten',{status:403}));expect((await call()).status).toBe(403);h.auth.mockReturnValue(null);expect((await GET({locals,params:{id:'falsch'},url:new URL('http://localhost')} as any)).status).toBe(400);});
 it('meldet fehlende Rechnung und DB-Ausfall',async()=>{expect((await call()).status).toBe(404);h.fail='vereinskleider_rechnungen';expect((await call()).status).toBe(500);});
 it.each([{status:'offen',bezahltBetrag:0},{status:'bezahlt',bezahltBetrag:30,zahlungsart:'twint'},{status:'bezahlt',bezahltBetrag:30,zahlungsart:'bar'},{status:'storniert',bezahltBetrag:0},{status:'teilweise_bezahlt',bezahltBetrag:10},{status:'bezahlt',bezahltBetrag:40,gutgeschriebenBetrag:5},{status:'offen',rabatte:[{name:'Rabatt',betrag:2}],zusaetzlicherRabatt:1},{status:'bezahlt',bezahltBetrag:30,zahlungen:[{betrag:30,datum:'2026-11-01',zahlungsart:'rechnung'},{betrag:-2,datum:'ungültig',zahlungsart:'bar'}]}])('erstellt PDF für Status $status und Zahlungsvarianten',async(variation)=>{h.one.vereinskleider_rechnungen={...rechnung(),...variation};expect((await call()).headers.get('content-type')).toBe('application/pdf');});
 it('prüft Gutschriften-ID und nicht vorhandene Gutschrift',async()=>{h.one.vereinskleider_rechnungen=rechnung();expect((await call('abc')).status).toBe(400);expect((await call(id2)).status).toBe(404);});
 it('erstellt Gutschrift mit unbekannter Grösse',async()=>{h.one.vereinskleider_rechnungen=rechnung();h.one.vereinskleider_gutschriften={gutschriftnummer:'G/2026',rechnungsnummer:'R-1',erstelltAm:new Date(),artikelname:'Shirt',groesseId:id3,menge:1,einzelpreis:15,betrag:15,grund:'Retour'};expect((await call(id2)).headers.get('content-type')).toBe('application/pdf');});
});

describe('Paket 16: Rechnungs-PDF – Randfälle',()=>{
  it('erstellt mehrseitige Rechnung mit Grössen und mehreren Rabatten',async()=>{
    h.one.vereinskleider_rechnungen={...rechnung(),
      positionen:Array.from({length:45},(_,i)=>({artikelname:'Lang benannter Vereinsartikel '+i,groesseId:id2,menge:1,einzelpreis:10,positionsbetrag:10})),
      zwischentotal:450,gesamtbetrag:440,rabatte:[{name:'Vereinsrabatt',betrag:10}],
      bezahltBetrag:100,zahlungen:[{betrag:100,datum:'2026-11-10',zahlungsart:'bar'}]};
    h.rows.groessen=[{_id:new ObjectId(id2),bezeichnung:'M'}];
    const r=await call();expect(r.status).toBe(200);
    const {PDFDocument}=await import('pdf-lib');
    expect((await PDFDocument.load(await r.arrayBuffer())).getPageCount()).toBeGreaterThan(1);
  });
  it('erstellt Gutschrift mit gültiger Grösse und sehr langem Grund',async()=>{
    h.one.vereinskleider_rechnungen=rechnung();
    h.one.vereinskleider_gutschriften={gutschriftnummer:'G-2026-1',rechnungsnummer:'R-1',erstelltAm:new Date('2026-11-01'),
      artikelname:'Trainingsjacke',groesseId:id2,menge:1,einzelpreis:15,betrag:15,grund:'Rueckgabe '.repeat(90)};
    h.one.groessen={bezeichnung:'L'};
    h.one.vereine={name:'TV Weiningen'};
    const r=await call(id3);expect(r.headers.get('content-type')).toBe('application/pdf');
  });
  it('berücksichtigt Zahlungen mit ungültigen Datumswerten und alternative Zahlungsarten',async()=>{
    h.one.vereinskleider_rechnungen={...rechnung(),bezahltBetrag:30,status:'bezahlt',zahlungsart:'rechnung',
      zahlungen:[{betrag:30,datum:new Date('2026-11-02'),zahlungsart:'twint'},{betrag:2,datum:'invalid',zahlungsart:'bar'}]};
    expect((await call()).status).toBe(200);
  });
});

});
import { GET as suite1_GET } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';

describe('sammelbestellung-einzel-pdf', () => {
const GET = suite1_GET;
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };

beforeEach(reset);
const call=(key=id)=>GET({locals,params:{id:key}} as any);
const order=(positionen:any[])=>({_id:new ObjectId(id),vereinId:'verein-1',lieferantId:id2,lieferantName:'Lieferant',status:'bestellt',erstelltAm:new Date('2026-11-01'),bemerkung:'Test',positionen});
const position={artikelId:id3,groesseId:null,artikelname:'Shirt',menge:2};
describe('Einzelbestellung PDF',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await call()).status).toBe(403);});
 it('weist ungültige ID zurück',async()=>{await expect(call('abc')).rejects.toMatchObject({status:400});});
 it('weist fehlende Bestellung zurück',async()=>{await expect(call()).rejects.toMatchObject({status:404});});
 it('weist leere Positionen zurück',async()=>{h.one.vereinskleider_sammelbestellungen=order([]);await expect(call()).rejects.toMatchObject({status:409});});
 it('weist ungültige Menge zurück',async()=>{h.one.vereinskleider_sammelbestellungen=order([{...position,menge:0}]);await expect(call()).rejects.toMatchObject({status:409});});
 it('erstellt PDF mit Fallback-Namen und Bemerkung',async()=>{h.one.vereinskleider_sammelbestellungen=order([position]);const r=await call();expect(r.headers.get('content-type')).toBe('application/pdf');});
 it('erstellt PDF mit Grössenbezeichnung',async()=>{h.one.vereinskleider_sammelbestellungen=order([{...position,groesseId:id3}]);h.rows.groessen=[{_id:new ObjectId(id3),bezeichnung:'M'}];h.one.lieferanten={name:'Lieferant'};h.one.vereine={name:'TV Weiningen'};expect((await call()).status).toBe(200);});
 it('meldet Datenbankfehler',async()=>{h.fail='vereinskleider_sammelbestellungen';await expect(call()).rejects.toMatchObject({status:500});});
});

describe('Paket 16: Einzel-PDF – Randfälle',()=>{
  it('erstellt mehrseitige Bestellung mit langen Namen und ohne Bemerkung',async()=>{
    const viele=Array.from({length:70},(_,i)=>({...position,artikelname:'Langer Artikelname '.repeat(15)+i,groesseId:id2,menge:1}));
    h.one.vereinskleider_sammelbestellungen={...order(viele),bemerkung:''};
    h.rows.groessen=[{_id:new ObjectId(id2),bezeichnung:'Sehr lange Groesse '.repeat(6)}];
    const r=await call();expect(r.status).toBe(200);
    const {PDFDocument}=await import('pdf-lib');
    expect((await PDFDocument.load(await r.arrayBuffer())).getPageCount()).toBeGreaterThan(1);
  });
  it('erstellt PDF mit unbekannter Groesse und ohne Lieferantenstammsatz',async()=>{
    h.one.vereinskleider_sammelbestellungen={...order([{...position,groesseId:id2}]),bemerkung:''};
    expect((await call()).status).toBe(200);
  });
});

});
import { POST as suite2_POST } from '../../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';

describe('sammelbestellung-gesamt-pdf', () => {
const POST = suite2_POST;
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };

beforeEach(reset);
const call=(v:unknown)=>POST({locals,request:post(v)} as any);
const position={artikelId:id3,groesseId:null,artikelname:'Shirt',menge:2};
const order=(key=id,lieferantId=id2,positionen:any[]=[position])=>({_id:new ObjectId(key),vereinId:'verein-1',lieferantId,positionen,erstelltAm:new Date('2026-11-01')});
describe('Gesamtbestellungen PDF',()=>{
 it('prüft Berechtigung',async()=>{h.auth.mockReturnValue(new Response('',{status:403}));expect((await call({bestellungIds:[id]})).status).toBe(403);});
 it.each([null,{},[],{bestellungIds:[]},{bestellungIds:['abc']},{bestellungIds:[id,id]},{bestellungIds:Array(51).fill(id)}])('validiert Auswahl %#',async(v)=>{await expect(call(v)).rejects.toMatchObject({status:400});});
 it('weist fehlende Bestellung zurück',async()=>{await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:404});});
 it('weist verschiedene Lieferanten zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id),order(id3,id3)];await expect(call({bestellungIds:[id,id3]})).rejects.toMatchObject({status:409});});
 it('weist fehlenden Lieferanten zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order()];await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});});
 it('weist leere Positionen zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[])];h.one.lieferanten={name:'Lieferant'};await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});});
 it('weist ungültige Bestellmenge zurück',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,menge:0}])];h.one.lieferanten={name:'Lieferant'};await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});});
 it('erstellt Gesamt-PDF mit aggregierten Positionen',async()=>{h.rows.vereinskleider_sammelbestellungen=[order(id),order(id3)];h.one.lieferanten={name:'Lieferant'};h.one.vereine={name:'TV Weiningen'};expect((await call({bestellungIds:[id,id3]})).headers.get('content-type')).toBe('application/pdf');});
 it('meldet Datenbankfehler',async()=>{h.fail='vereinskleider_sammelbestellungen';await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:500});});
});

describe('Paket 16: Gesamt-PDF – Randfälle',()=>{
  it('verweigert ungültige Lieferanten-ID',async()=>{
    h.rows.vereinskleider_sammelbestellungen=[order(id,'ungueltig')];
    await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});
  });
  it('verweigert ungültige Artikel-ID und Grössen-ID',async()=>{
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,artikelId:'falsch'}])];
    h.one.lieferanten={name:'A'};
    await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,groesseId:'falsch'}])];
    await expect(call({bestellungIds:[id]})).rejects.toMatchObject({status:409});
  });
  it('verweigert Überlauf beim Zusammenführen',async()=>{
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,[{...position,menge:Number.MAX_SAFE_INTEGER}]),order(id3,id2,[position])];
    h.one.lieferanten={name:'A'};
    await expect(call({bestellungIds:[id,id3]})).rejects.toMatchObject({status:409});
  });
  it('erstellt mehrseitiges PDF mit langen Artikeln und Grössen',async()=>{
    const viele=Array.from({length:65},(_,i)=>({...position,artikelId:(i+1).toString(16).padStart(24,'0'),groesseId:id2,artikelname:'Sehr langer Artikelname '.repeat(12)+i,menge:i+1}));
    h.rows.vereinskleider_sammelbestellungen=[order(id,id2,viele)];
    h.one.lieferanten={name:'Lieferant'};
    h.rows.groessen=[{_id:new ObjectId(id2),bezeichnung:'Extra lange Groessenbezeichnung '.repeat(4)}];
    const r=await call({bestellungIds:[id]});
    expect(r.status).toBe(200);
    const {PDFDocument}=await import('pdf-lib');
    expect((await PDFDocument.load(await r.arrayBuffer())).getPageCount()).toBeGreaterThan(1);
  });
});

});
