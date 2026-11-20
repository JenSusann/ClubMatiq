import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../src/routes/api/vereinskleider/export/+server';
const benutzer={id:'1',vereinId:'v',rolle:'admin'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const ctx=(fetcher:ReturnType<typeof vi.fn>,query='')=>({locals:{benutzer},url:new URL('http://localhost/api/vereinskleider/export'+query),fetch:fetcher}) as never;
const sale={_id:'v1',erstelltAm:'2026-11-20T10:00:00Z',kaeufer:'Max',riegen:['Aktive'],endbetrag:30,bezahltBetrag:10,positionen:[{artikelname:'Trikot',groesseId:'g1',menge:2,einzelpreis:15,positionsbetrag:30}]};
beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{});});
describe('Paket 7 – Verkaufshistorie Excel Export',()=>{
 it('leitet API-Fehler der ersten Seite weiter',async()=>{const f=vi.fn().mockResolvedValue(reply({fehler:'Unzulässig'},403));const r=await GET(ctx(f));expect(r.status).toBe(403);});
 it('begrenzt Exporte auf 10000 Verkäufe',async()=>{const f=vi.fn().mockResolvedValue(reply({gesamt:10001,verkaeufe:[]}));expect((await GET(ctx(f))).status).toBe(400);});
 it('leitet Fehler einer Folgeseite weiter',async()=>{const f=vi.fn().mockResolvedValueOnce(reply({gesamt:2,seiten:2,verkaeufe:[sale]})).mockResolvedValueOnce(reply({fehler:'Seite nicht verfügbar'},503));expect((await GET(ctx(f))).status).toBe(503);});
 it('erkennt geänderte Gesamtzahl während Export',async()=>{const f=vi.fn().mockResolvedValue(reply({gesamt:2,seiten:1,verkaeufe:[sale]}));expect((await GET(ctx(f))).status).toBe(409);});
 it('exportiert leere Verkaufshistorie',async()=>{const f=vi.fn().mockResolvedValueOnce(reply({gesamt:0,seiten:0,verkaeufe:[]})).mockResolvedValueOnce(reply([]));const r=await GET(ctx(f));expect(r.status).toBe(200);expect(r.headers.get('content-type')).toContain('spreadsheetml');expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100);});
 it('exportiert mit Grössen und Filtern',async()=>{const f=vi.fn().mockResolvedValueOnce(reply({gesamt:1,seiten:1,verkaeufe:[sale]})).mockResolvedValueOnce(reply([{_id:'g1',bezeichnung:'M'}]));const r=await GET(ctx(f,'?suche=Trikot&art=bestellung&unbekannt=ignorieren'));expect(r.status).toBe(200);expect(String(f.mock.calls[0][0])).toContain('suche=Trikot');expect(String(f.mock.calls[0][0])).not.toContain('unbekannt');});
 it('exportiert trotz fehlgeschlagener Grössen-API',async()=>{const f=vi.fn().mockResolvedValueOnce(reply({gesamt:1,seiten:1,verkaeufe:[sale]})).mockResolvedValueOnce(reply({fehler:'X'},500));expect((await GET(ctx(f))).status).toBe(200);});
 it('fängt Netzwerkfehler ab',async()=>{const f=vi.fn().mockRejectedValue(new Error('Netzwerk'));expect((await GET(ctx(f))).status).toBe(500);});
 it('holt mehrere Seiten vollständig',async()=>{const f=vi.fn().mockResolvedValueOnce(reply({gesamt:2,seiten:2,verkaeufe:[sale]})).mockResolvedValueOnce(reply({verkaeufe:[{...sale,_id:'v2',positionen:[]}]})).mockResolvedValueOnce(reply([]));expect((await GET(ctx(f))).status).toBe(200);expect(f).toHaveBeenCalledTimes(3);});
});
