import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const collections: Record<string, any> = {};
  const collection = (name: string) => collections[name] ?? (collections[name] = {
    findOne: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), findOneAndUpdate: vi.fn(),
    find: vi.fn(() => ({ sort: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: vi.fn(async () => []) , project: vi.fn(() => ({toArray:vi.fn(async()=>[])})) })) })) }))
  });
  const session = { withTransaction: vi.fn(async (fn: () => Promise<any>) => fn()), endSession: vi.fn() };
  return { collections, collection, session, permission: vi.fn(() => null) };
});
vi.mock('@sveltejs/kit', () => ({ json: (body: any, init?: any) => new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } }) }));
vi.mock('mongodb', () => ({ ObjectId: class { value: string; constructor(v?: string) { this.value = v ?? 'aaaaaaaaaaaaaaaaaaaaaaaa'; } toString() { return this.value; } } }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: () => m.session } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET, POST } from '../../src/routes/api/vereinskleider/verrechnung/+server';

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
