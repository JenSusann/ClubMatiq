import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collections: {} as Record<string, any>,
  session: { withTransaction: vi.fn(), endSession: vi.fn() }
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => m.collections[name] },
  client: { startSession: () => m.session }
}));
const oid = '507f1f77bcf86cd799439011';
const user = (rolle = 'admin') => ({ id: 'u1', vereinId: 'v1', rolle, vorname: 'Anna', nachname: 'Muster' });
const req = (body: unknown) => new Request('http://localhost/api/test', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
const ctx = (body: unknown, rolle = 'admin') => ({ request: req(body), locals: { benutzer: user(rolle) } }) as any;
const read = (r: Response) => r.json();
beforeEach(() => {
  vi.clearAllMocks();
  m.session.withTransaction.mockImplementation(async (fn: () => Promise<void>) => fn());
  m.session.endSession.mockResolvedValue(undefined);
  m.collections = {};
});

import { GET, POST } from '../../../src/routes/api/meldungen/+server';
const foto = { url: 'https://res.cloudinary.com/demo/image/upload/x', publicId: 'clubmatiq/v1/schadensmeldungen/f1' };
const setup = () => {
  const meld = { find: vi.fn((_filter: Record<string, unknown>) => ({sort: vi.fn(() => ({toArray: vi.fn().mockResolvedValue([{_id:oid, status:'offen'}])}))})), insertOne: vi.fn().mockResolvedValue({insertedId:oid}) };
  const artikel = { findOne: vi.fn().mockResolvedValue({ _id:oid, name:'Ball' }) };
  const uploads = { find: vi.fn(() => ({toArray: vi.fn().mockResolvedValue([foto])})), updateMany: vi.fn().mockResolvedValue({modifiedCount:1}) };
  m.collections = { schadensmeldungen:meld, artikel, bildUploads:uploads };
  return {meld,artikel,uploads};
};
describe('Schadensmeldungen – GET', () => {
  it('verlangt Anmeldung',async()=>{setup(); expect((await GET({locals:{}} as any)).status).toBe(401)});
  it.each(['admin','materialverantwortlich','mitglied'])('filtert für %s korrekt',async rolle=>{
    const {meld}=setup(); const r=await GET({locals:{benutzer:user(rolle)}} as any);
    expect(r.status).toBe(200);expect((await read(r))[0]._id).toBe(oid);
    const filter=meld.find.mock.calls[0][0];
    expect(filter.vereinId).toBe('v1');
    expect(filter.gemeldetVonId).toBe(rolle==='mitglied'?'u1':undefined);
  });
  it('behandelt Datenbankfehler',async()=>{const {meld}=setup();meld.find.mockImplementation(()=>{throw Error('db')});expect((await GET({locals:{benutzer:user()}} as any)).status).toBe(500)});
});
describe('Schadensmeldungen – POST',()=>{
  it('verlangt Anmeldung',async()=>{setup();expect((await POST({request:req({}) ,locals:{}} as any)).status).toBe(401)});
  it.each([null,[],42,'text'])('verwirft ungültige Daten %j',async body=>{setup();expect((await POST(ctx(body))).status).toBe(400)});
  it.each([undefined,null,23,'ungültig'])('verwirft Artikel-ID %j',async artikelId=>{setup();expect((await POST(ctx({artikelId,beschreibung:'Schaden'}))).status).toBe(400)});
  it.each([undefined,null,3,'   ','a'.repeat(2001)])('verwirft Beschreibung %j',async beschreibung=>{setup();expect((await POST(ctx({artikelId:oid,beschreibung}))).status).toBe(400)});
  it.each(['falsch',[1,2,3,4]])('verwirft Foto-Listen %j',async fotos=>{setup();expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos}))).status).toBe(400)});
  it.each([null,4,[],{}, {url:4,publicId:'x'}, {url:'http://example.com',publicId:foto.publicId}, {url:foto.url,publicId:'clubmatiq/andere/schadensmeldungen/x'}])('verwirft Foto %j',async bild=>{setup();expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos:[bild]}))).status).toBe(400)});
  it('verwirft doppelte Fotos',async()=>{setup();expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos:[foto,foto]}))).status).toBe(400)});
  it('liefert 404 für fremden Artikel',async()=>{const {artikel}=setup();artikel.findOne.mockResolvedValue(null);expect((await POST(ctx({artikelId:oid,beschreibung:'x'}))).status).toBe(404)});
  it('speichert Meldung ohne Foto mit korrektem Verein',async()=>{const {meld,artikel}=setup();const r=await POST(ctx({artikelId:oid,beschreibung:'  Kaputt  '}));expect(r.status).toBe(201);expect(artikel.findOne.mock.calls[0][0].vereinId).toBe('v1');expect(meld.insertOne.mock.calls[0][0]).toMatchObject({vereinId:'v1',beschreibung:'Kaputt',status:'offen',gemeldetVonId:'u1',fotos:[]});expect(m.session.endSession).toHaveBeenCalledOnce()});
  it('speichert registrierte Fotos',async()=>{const {uploads,meld}=setup();expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos:[foto]}))).status).toBe(201);expect(uploads.updateMany).toHaveBeenCalledOnce();expect(meld.insertOne.mock.calls[0][0].fotos).toEqual([foto])});
  it('verwirft fehlende Upload-Registrierung',async()=>{const {uploads}=setup();uploads.find.mockReturnValue({toArray:vi.fn().mockResolvedValue([])});expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos:[foto]}))).status).toBe(400);expect(m.session.endSession).toHaveBeenCalledOnce()});
  it('verwirft abweichende Upload-URL',async()=>{const {uploads}=setup();uploads.find.mockReturnValue({toArray:vi.fn().mockResolvedValue([{...foto,url:'https://res.cloudinary.com/demo/other'}])});expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos:[foto]}))).status).toBe(400)});
  it('verwirft fehlgeschlagene Reservierung',async()=>{const {uploads}=setup();uploads.updateMany.mockResolvedValue({modifiedCount:0});expect((await POST(ctx({artikelId:oid,beschreibung:'x',fotos:[foto]}))).status).toBe(400)});
  it('behandelt DB-Fehler bei Artikelabfrage',async()=>{const {artikel}=setup();artikel.findOne.mockRejectedValue(Error('db'));expect((await POST(ctx({artikelId:oid,beschreibung:'x'}))).status).toBe(500)});
  it('behandelt DB-Fehler in Transaktion',async()=>{const {meld}=setup();meld.insertOne.mockRejectedValue(Error('db'));expect((await POST(ctx({artikelId:oid,beschreibung:'x'}))).status).toBe(500);expect(m.session.endSession).toHaveBeenCalledOnce()});
});
