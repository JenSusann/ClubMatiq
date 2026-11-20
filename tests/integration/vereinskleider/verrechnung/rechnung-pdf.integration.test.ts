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
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => new Request('http://localhost/api', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const reset = () => { h.rows = {}; h.one = {}; h.fail = ''; h.count = 1; h.auth.mockReset(); h.auth.mockReturnValue(null); h.insert.mockReset(); h.insert.mockResolvedValue({insertedId:new ObjectId(id)}); h.update.mockReset(); h.update.mockResolvedValue({matchedCount:1,modifiedCount:1,deletedCount:1}); vi.spyOn(console,'error').mockImplementation(()=>{}); };
import { GET } from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
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