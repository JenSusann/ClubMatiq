import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const collections: Record<string, any> = {};
  const collection = (name: string) => collections[name] ?? (collections[name] = {
    findOne: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), findOneAndUpdate: vi.fn(),
    find: vi.fn(() => ({ sort: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(async () => []) , project: vi.fn(() => ({toArray:vi.fn(async()=>[])})) })) })) }))
  });
  const session = { withTransaction: vi.fn(async (fn: () => Promise<any>) => fn()), endSession: vi.fn() };
  return { collections, collection, session, permission: vi.fn<() => Response | null>(() => null) };
});
vi.mock('@sveltejs/kit', () => ({ json: (body: any, init?: any) => new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } }) }));
vi.mock('mongodb', () => ({ ObjectId: class { value: string; constructor(v?: string) { this.value = v ?? 'aaaaaaaaaaaaaaaaaaaaaaaa'; } toString() { return this.value; } } }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: () => m.session } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET, POST } from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import { PATCH } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const user = { benutzer: { vereinId: 'verein-1' } };
const sale = () => ({ _id: id, vereinId: 'verein-1', kaeufer: 'Muster', zahlungsart: 'bar', positionen: [{ artikelId: id, groesseId: null, artikelname: 'Shirt', menge: 2, einzelpreis: 10, positionsbetrag: 20, verkaufsart: 'direkt' }], zwischentotal: 20, rabattTotal: 0, endbetrag: 20, erstelltAm: new Date(), zahlungen: [] });
const post = (body: any) => POST({ locals: user, request: { json: async () => body } } as any);
const read = async (r: Response) => ({ status: r.status, data: await r.json() });
beforeEach(() => { vi.clearAllMocks(); for (const k of Object.keys(m.collections)) delete m.collections[k]; m.permission.mockReturnValue(null); m.session.withTransaction.mockImplementation(async (fn: any) => fn()); });

describe('Verrechnung GET', () => {
  it('verweigert fehlende Berechtigung', async () => { m.permission.mockReturnValue(new Response('Nein', {status:403})); expect((await GET({locals:user} as any)).status).toBe(403); });
  it('liefert leere Übersichten', async () => { const r = await read(await GET({locals:user} as any)); expect(r.status).toBe(200); expect(r.data).toMatchObject({rechnungen:[],unverrechneteVerkaeufe:[],begrenzt:false}); });
  it('meldet Datenbankfehler', async () => { m.collection('vereinskleider_rechnungen').find.mockImplementation(() => {throw Error('DB');}); expect((await GET({locals:user} as any)).status).toBe(500); });
});
describe('Verrechnung POST', () => {
  it('verweigert fehlende Berechtigung', async () => { m.permission.mockReturnValue(new Response('Nein',{status:403})); expect((await post({verkaufId:id})).status).toBe(403); });
  it.each([null, [], 'text', 3, {} , {verkaufId:'invalid'}])('verwirft ungültige Eingaben %s', async (body) => { expect((await post(body)).status).toBe(400); });
  it('liefert 404 für unbekannten Verkauf', async () => { m.collection('vereinskleider_verkaeufe').findOne.mockResolvedValue(null); expect((await post({verkaufId:id})).status).toBe(404); });
  it('verweigert doppelte Verrechnung', async () => { m.collection('vereinskleider_verkaeufe').findOne.mockResolvedValue({...sale(),rechnungId:id}); expect((await post({verkaufId:id})).status).toBe(409); });
  it.each([
    {positionen:[]}, {positionen:null}, {endbetrag:-1}, {zwischentotal:NaN}, {rabattTotal:-1},
    {positionen:[{...sale().positionen[0],menge:0}]}, {positionen:[{...sale().positionen[0],einzelpreis:-1}]},
    {positionen:[{...sale().positionen[0],positionsbetrag:1.001}]},
    {zahlungen:[{betrag:-1,datum:new Date(),zahlungsart:'bar'}]},
    {zahlungen:[{betrag:1,datum:'nonsense',zahlungsart:'bar'}]},
    {zahlungen:[{betrag:1,datum:new Date(),zahlungsart:'bank'}]},
    {zahlungen:'ungültig'}, {bezahltBetrag:3}, {zahlungsstatus:'bezahlt'},
  ])('verwirft inkonsistenten Verkauf %j', async (change) => { m.collection('vereinskleider_verkaeufe').findOne.mockResolvedValue({...sale(),...change}); expect((await post({verkaufId:id})).status).toBe(409); });
  it('verwirft fehlenden Rechnungsnummernzähler', async () => { m.collection('vereinskleider_verkaeufe').findOne.mockResolvedValue(sale()); m.collection('vereinskleider_rechnungsnummern').findOneAndUpdate.mockResolvedValue(null); expect((await post({verkaufId:id})).status).toBe(500); });
  it('verwirft parallele Verrechnung', async () => { m.collection('vereinskleider_verkaeufe').findOne.mockResolvedValue(sale()); m.collection('vereinskleider_rechnungsnummern').findOneAndUpdate.mockResolvedValue({nummer:1}); m.collection('vereinskleider_verkaeufe').updateOne.mockResolvedValue({modifiedCount:0}); expect((await post({verkaufId:id})).status).toBe(409); });
  it.each([{change:{},status:'offen'}, {change:{zahlungen:[{betrag:10,datum:new Date(),zahlungsart:'twint'}],bezahltBetrag:10},status:'teilweise_bezahlt'}, {change:{zahlungen:[{betrag:20,datum:new Date(),zahlungsart:'bar'}],bezahltBetrag:20},status:'bezahlt'}])('erstellt Rechnung mit Status $status', async ({change,status}) => { m.collection('vereinskleider_verkaeufe').findOne.mockResolvedValue({...sale(),...change}); m.collection('vereinskleider_rechnungsnummern').findOneAndUpdate.mockResolvedValue({nummer:7}); m.collection('vereinskleider_verkaeufe').updateOne.mockResolvedValue({modifiedCount:1}); const r=await read(await post({verkaufId:id})); expect(r.status).toBe(201); expect(m.collection('vereinskleider_rechnungen').insertOne).toHaveBeenCalledWith(expect.objectContaining({status}),expect.anything()); expect(m.session.endSession).toHaveBeenCalled(); });
  it('behandelt unerwartete DB-Fehler', async () => { m.collection('vereinskleider_verkaeufe').findOne.mockRejectedValue(Error('DB')); expect((await post({verkaufId:id})).status).toBe(500); expect(m.session.endSession).toHaveBeenCalled(); });
});

const paymentInvoiceId='aaaaaaaaaaaaaaaaaaaaaaaa';
const paymentUuid='12345678-1234-1234-1234-123456789012';
const paymentInput={betrag:10,datum:'2026-11-17',zahlungsart:'twint',zahlungId:paymentUuid};
const paymentInvoice=()=>({_id:paymentInvoiceId,vereinId:'verein-1',gesamtbetrag:100,bezahltBetrag:0,status:'offen',zahlungen:[]});
const patchPayment=(body:any=paymentInput, invoiceId=paymentInvoiceId)=>PATCH({locals:{benutzer:{vereinId:'verein-1'}},params:{id:invoiceId},request:{json:async()=>body}} as any);
const paymentResult=async(r:Response)=>({status:r.status,body:await r.json()});
describe('Zahlungseingänge – Detail-API',()=>{
beforeEach(()=>{vi.clearAllMocks();m.permission.mockReturnValue(null);m.session.withTransaction.mockImplementation(async(fn:any)=>fn());m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue(paymentInvoice());m.collection('vereinskleider_rechnungen').updateOne.mockResolvedValue({modifiedCount:1});});
describe('Zahlungseingang PATCH',()=>{
 it('prüft Berechtigung',async()=>{m.permission.mockReturnValue(new Response('Nein',{status:403}));expect((await patchPayment()).status).toBe(403);});
 it('prüft Rechnungs-ID',async()=>{expect((await patchPayment(paymentInput,'invalid')).status).toBe(400);});
 it.each([null,[],4,'text'])('verwirft ungültigen Body %j',async body=>{expect((await patchPayment(body)).status).toBe(400);});
 it.each([0,-1,1.001,NaN,Infinity,'10',null])('verwirft ungültigen Betrag %s',async betrag=>{expect((await patchPayment({...paymentInput,betrag})).status).toBe(400);});
 it.each(['2026-02-30','2026-13-01','2026-1-1','17.11.2026',null,123])('verwirft ungültiges Datum %s',async datum=>{expect((await patchPayment({...paymentInput,datum})).status).toBe(400);});
 it.each(['rechnung','cash','',null])('verwirft ungültige Zahlungsart %s',async zahlungsart=>{expect((await patchPayment({...paymentInput,zahlungsart})).status).toBe(400);});
 it.each(['x',null,123,'12345678-1234-1234'])('verwirft ungültige Zahlungs-ID %s',async zahlungId=>{expect((await patchPayment({...paymentInput,zahlungId})).status).toBe(400);});
 it('liefert 404 bei fehlender Rechnung',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue(null);expect((await patchPayment()).status).toBe(404);});
 it('verwirft ungültiges Zahlungsarray',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),zahlungen:{}});expect((await patchPayment()).status).toBe(409);});
 it('erkennt identische Zahlungs-ID idempotent',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),bezahltBetrag:10,status:'teilweise_bezahlt',zahlungen:[{zahlungId:paymentUuid,betrag:10,datum:new Date('2026-11-17T12:00:00Z'),zahlungsart:'twint'}]});const r=await paymentResult(await patchPayment());expect(r.status).toBe(200);expect(r.body.bereitsErfasst).toBe(true);expect(m.collection('vereinskleider_rechnungen').updateOne).not.toHaveBeenCalled();});
 it.each([{betrag:11},{zahlungsart:'bar'},{datum:'2026-11-18'}])('erkennt widersprüchliche Wiederholung %j',async change=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),zahlungen:[{...paymentInput,...change,datum:new Date(`${change.datum??paymentInput.datum}T12:00:00Z`)}]});expect((await patchPayment()).status).toBe(409);});
 it('sperrt stornierte Rechnungen',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),status:'storniert'});expect((await patchPayment()).status).toBe(409);});
 it.each([{gesamtbetrag:-1},{bezahltBetrag:101},{gutgeschriebenBetrag:101},{bezahltBetrag:1.001},{gesamtbetrag:NaN}])('erkennt ungültige Rechnungsbeträge %j',async change=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),...change});expect((await patchPayment()).status).toBe(409);});
 it('verhindert Überzahlung',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),gesamtbetrag:10,gutgeschriebenBetrag:5});expect((await patchPayment()).status).toBe(409);});
 it('verhindert Zahlung bei offener Rückerstattung',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),bezahltBetrag:80,gutgeschriebenBetrag:30});expect((await patchPayment()).status).toBe(409);});
 it.each([{betrag:10,status:'teilweise_bezahlt'},{betrag:100,status:'bezahlt'}])('erfasst Zahlung und setzt Status $status',async({betrag,status})=>{const r=await paymentResult(await patchPayment({...paymentInput,betrag}));expect(r.status).toBe(200);expect(r.body).toMatchObject({erfolg:true,bereitsErfasst:false,bezahltBetrag:betrag,status});expect(m.collection('vereinskleider_rechnungen').updateOne).toHaveBeenCalledOnce();expect(m.session.endSession).toHaveBeenCalled();});
 it('berücksichtigt Gutschriften',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockResolvedValue({...paymentInvoice(),gutgeschriebenBetrag:20});const r=await paymentResult(await patchPayment({...paymentInput,betrag:80}));expect(r.body.status).toBe('bezahlt');});
 it('meldet parallele Änderung',async()=>{m.collection('vereinskleider_rechnungen').updateOne.mockResolvedValue({modifiedCount:0});expect((await patchPayment()).status).toBe(409);});
 it('behandelt unerwarteten Datenbankfehler',async()=>{m.collection('vereinskleider_rechnungen').findOne.mockRejectedValue(Error('DB'));expect((await patchPayment()).status).toBe(500);expect(m.session.endSession).toHaveBeenCalled();});
});

});


import { GET as ExportRechnungen } from '../../../src/routes/api/vereinskleider/verrechnung/export/+server';
describe('Rechnungsabgleich – CSV und Finanzkonsistenz',()=>{
 const invoice={_id:id,rechnungsnummer:'R1',verkaufId:id,erstelltAm:'2026-11-26',empfaenger:'Muster "A"',status:'bezahlt',gesamtbetrag:100};
 const call=()=>ExportRechnungen({locals:user} as never);
 function rows(data:unknown[]){
  const limit=vi.fn(()=>({toArray:async()=>data}));const sort=vi.fn(()=>({limit}));
  m.collection('vereinskleider_rechnungen').find.mockReturnValue({sort});return {limit,sort};
 }
 it('verweigert fehlende Berechtigung',async()=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await call()).status).toBe(403);});
 it('begrenzt Export auf 10000 Rechnungen',async()=>{const {limit}=rows(Array(10001).fill(invoice));expect((await call()).status).toBe(409);expect(limit).toHaveBeenCalledWith(10001);});
 it.each([{gesamtbetrag:'100'},{gesamtbetrag:NaN},{gesamtbetrag:-1},{gesamtbetrag:0.001},{gesamtbetrag:Number.MAX_SAFE_INTEGER},{gutgeschriebenBetrag:101},{bezahltBetrag:101},{erstelltAm:'bad'},{rueckerstattungOffen:1}])('verweigert inkonsistente Rechnung %j',async patch=>{rows([{...invoice,...patch}]);expect((await call()).status).toBe(500);});
 it('exportiert Teilrechnung mit Rückerstattung und Buchungsreferenz',async()=>{
  const {sort,limit}=rows([{...invoice,rechnungstranche:true,gutgeschriebenBetrag:30,bezahltBetrag:100,rueckerstattungOffen:10,clubdeskVerbuchung:{datum:'2026-11-26',referenz:'B1',erfasstVonName:'Ada'}}]);
  const r=await call();expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');
  expect(await r.text()).toContain('"100,00";"30,00";"70,00";"100,00";"0,00";"10,00";"20,00";"Ja";"2026-11-26";"B1";"Ada"');
  expect(m.collection('vereinskleider_rechnungen').find).toHaveBeenCalledWith({vereinId:'verein-1'});expect(sort).toHaveBeenCalledWith({erstelltAm:-1});expect(limit).toHaveBeenCalledWith(10001);
 });
 it('berechnet offene Rückerstattung bei fehlendem historischem Feld',async()=>{rows([{...invoice,gutgeschriebenBetrag:30,bezahltBetrag:100}]);expect(await (await call()).text()).toContain('"70,00";"100,00";"0,00";"30,00";"0,00";"Nein"');});
 it('maskiert Empfänger und fehlende optionale Felder',async()=>{rows([invoice,{...invoice,empfaenger:null,status:undefined}]);const r=await call();expect(r.status).toBe(200);expect(await r.text()).toContain('"Muster ""A"""');});
 it('meldet Datenbankfehler',async()=>{m.collection('vereinskleider_rechnungen').find.mockImplementation(()=>{throw Error('DB');});expect((await call()).status).toBe(500);});
});
