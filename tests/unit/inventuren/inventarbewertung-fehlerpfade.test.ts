import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m=vi.hoisted(()=>({collection:vi.fn(),findOne:vi.fn(),speichern:vi.fn()}));
vi.mock('../../../src/lib/server/mongodb',()=>({db:{collection:m.collection}}));
vi.mock('../../../src/lib/server/inventarbewertung',()=>({bewertungSpeichern:m.speichern}));
import { POST } from '../../../src/routes/api/inventarbewertung/stichtage/+server';
import { GET } from '../../../src/routes/api/inventarbewertung/stichtage/[id]/+server';
const id=new ObjectId().toString();
const locals={benutzer:{id:'admin-a',vereinId:'verein-a',rolle:'admin'}};
const event=(format='json')=>({locals,params:{id},url:new URL('http://localhost/?format='+format)} as never);
beforeEach(()=>{vi.resetAllMocks();m.collection.mockReturnValue(m);vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
describe('Inventarbewertung – Fehlerpfade',()=>{
 it('meldet fehlgeschlagene Speicherung ohne interne Fehlerdetails',async()=>{
  m.speichern.mockRejectedValue(new Error('interner Datenbankfehler'));
  const res=await POST(event());
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({fehler:'Bewertungsaufnahme konnte nicht gespeichert werden.'});
  expect(m.speichern).toHaveBeenCalledWith('verein-a','admin-a');
 });
 it('meldet fehlgeschlagenen historischen Abruf',async()=>{
  m.findOne.mockRejectedValue(new Error('interner Datenbankfehler'));
  const res=await GET(event());
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({fehler:'Bewertungsaufnahme konnte nicht geladen werden.'});
  expect(m.findOne).toHaveBeenCalledWith({_id:new ObjectId(id),vereinId:'verein-a'});
 });
 it('meldet beschädigte historische Daten beim CSV-Export',async()=>{
  m.findOne.mockResolvedValue({aufgenommenAm:'ungueltig',zeilen:[]});
  expect((await GET(event('csv'))).status).toBe(500);
 });
 it('maskiert Formeln und Anführungszeichen und kennzeichnet fehlende Preise',async()=>{
  m.findOne.mockResolvedValue({aufgenommenAm:new Date('2026-11-27T23:30:00Z'),zeilen:[{artikel:'=1+1',kategorie:'A"B',lagerort:'Lager',groesse:'',menge:2,einzelwert:null,gesamtwert:null}]});
  const res=await GET(event('csv'));
  expect(res.status).toBe(200);
  const csv=await res.text();
  expect(csv).toContain('"\'=1+1";"A""B";"Lager";"";"2";"";"";"Ja";"2026-11-28"');
  expect(res.headers.get('cache-control')).toBe('no-store');
 });
});
