import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
const { datasets, calls } = vi.hoisted(() => ({ datasets: {} as Record<string, any[]>, calls: [] as any[] }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    find: (filter: any) => { calls.push({ name, filter }); const rows = (datasets[name] ?? []).filter((row: any) => Object.entries(filter).every(([key, value]) => key === 'vereinId' ? row.vereinId === value : true));
      const cursor: any = { project: () => cursor, sort: () => cursor, limit: () => cursor, toArray: async () => rows }; return cursor; },
    findOne: async (filter: any) => { calls.push({ name, filter }); return (datasets[name] ?? []).find((row: any) => row.vereinId === filter.vereinId && String(row._id) === String(filter._id)) ?? null; }
  }) }
}));
const admin = { id: new ObjectId().toString(), vereinId: 'verein-test-10', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const locals = (rolle: string | null = 'admin') => ({ benutzer: rolle === null ? null : { ...admin, rolle } });
beforeEach(() => { for (const key of Object.keys(datasets)) delete datasets[key]; calls.length = 0; });


const run = (handler: (event: never) => Response | Promise<Response>, rolle: string | null = 'admin') => handler({ locals: locals(rolle) } as any);
import * as route0 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: paket10-gutschriften-lesepfad.integration.test.ts
describe('Paket 10 – Gutschriften Lesepfad', () => {
 it('liefert leere Gutschriftenliste', async () => { const d=await (await run(route0.GET, )).json(); expect(d.gutschriften).toEqual([]); expect(d.begrenzt).toBe(false); });
 it('zeigt nur eigene Gutschriften und serialisiert die ID', async () => { const id=new ObjectId(); datasets.vereinskleider_gutschriften=[{_id:id,vereinId:admin.vereinId,betrag:20},{_id:new ObjectId(),vereinId:'fremd',betrag:50}]; const d=await (await run(route0.GET, )).json(); expect(d.gutschriften).toHaveLength(1); expect(d.gutschriften[0]._id).toBe(id.toString()); });
 it('verweigert Leiterrolle den Zugriff', async () => expect((await run(route0.GET, 'leiter')).status).toBe(403));
});

import * as route1 from '../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: paket10-rechnungsuebersicht-lesepfad.integration.test.ts
describe('Paket 10 – Verrechnungsübersicht Lesepfad', () => {
 it('liefert leere Rechnungsübersicht', async () => { const r=await run(route1.GET, ); expect(r.status).toBe(200); const d=await r.json(); expect(d.rechnungen).toEqual([]); expect(d.unverrechneteVerkaeufe).toEqual([]); expect(d.begrenzt).toBe(false); });
 it('serialisiert eigene Rechnungs-IDs und grenzt fremde Rechnungen aus', async () => { const id=new ObjectId(); datasets.vereinskleider_rechnungen=[{_id:id,vereinId:admin.vereinId,gesamtbetrag:15},{_id:new ObjectId(),vereinId:'fremd',gesamtbetrag:99}]; const d=await (await run(route1.GET, )).json(); expect(d.rechnungen).toHaveLength(1); expect(d.rechnungen[0]._id).toBe(id.toString()); expect(d.rechnungen[0].gesamtbetrag).toBe(15); });
 it('meldet 401 ohne Benutzer', async () => expect((await run(route1.GET, null)).status).toBe(401));
});

import * as route2 from '../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: paket10-sammelbedarf-lesepfad.integration.test.ts
describe('Paket 10 – Sammelbestellungsbedarf Lesepfad', () => {
 it('lädt eine leere Bedarfsübersicht', async () => { const r=await run(route2.GET, ); expect(r.status).toBe(200); const d=await r.json(); expect(d.bedarf).toEqual([]); expect(d.sammelbestellungen).toEqual([]); });
 it('übergibt bei jeder Abfrage die eigene Verein-ID', async () => { await run(route2.GET, ); expect(calls.length).toBe(5); expect(calls.every(x=>x.filter.vereinId===admin.vereinId)).toBe(true); });
 it('verweigert nicht angemeldeten Benutzern den Zugriff', async () => expect((await run(route2.GET, null)).status).toBe(401));
});

import * as route3 from '../../../src/routes/api/vereinskleider/bestellungen/historie/+server';

// Ursprüngliche Datei: paket10-uebergabehistorie-lesepfad.integration.test.ts
describe('Paket 10 – Übergabehistorie Lesepfad', () => {
 it('liefert leere Historie ohne Übergaben', async () => { const r=await run(route3.GET, ); expect(r.status).toBe(200); expect((await r.json()).historie).toEqual([]); });
 it('sortiert Übergaben absteigend und ignoriert ungültige Mengen', async () => { const id=new ObjectId(); datasets.vereinskleider_verkaeufe=[{_id:id,vereinId:admin.vereinId,kaeufer:'Person',positionen:[{artikelname:'Shirt',artikelId:'a'}],uebergaben:[{positionsIndex:0,menge:1,uebergebenAm:'2026-01-01'},{positionsIndex:0,menge:3,uebergebenAm:'2026-03-01'},{positionsIndex:0,menge:0,uebergebenAm:'2026-04-01'}]}]; const r=await run(route3.GET, ); const d=await r.json(); expect(d.historie).toHaveLength(2); expect(d.historie.map((x:any)=>x.menge)).toEqual([3,1]); });
 it('verhindert Zugriff ohne Anmeldung', async () => expect((await run(route3.GET, null)).status).toBe(401));
 it('verhindert Zugriff für Mitglieder', async () => expect((await run(route3.GET, 'mitglied')).status).toBe(403));
});

