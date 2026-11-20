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


const id=new ObjectId();
const run = (rolle: string | null = 'admin', inventurId=id.toString()) => route0.GET({ locals: locals(rolle), params: { id: inventurId } } as any);
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';

// Ursprüngliche Datei: paket10-inventurverlauf-lesepfad.integration.test.ts
describe('Paket 10 – Inventurverlauf Lesepfad', () => {
 it('lehnt ungültige Inventur-ID ab', async () => expect((await run('admin','ungültig')).status).toBe(400));
 it('gibt 404 bei fehlender Inventur zurück', async () => expect((await run()).status).toBe(404));
 it('liefert leeren Verlauf für vorhandene Inventur', async () => { datasets.inventuren=[{_id:id,vereinId:admin.vereinId}]; const r=await run(); expect(r.status).toBe(200); const d=await r.json(); expect(d.korrekturen).toEqual([]); expect(d.verlauf).toEqual([]); });
 it('verweigert Lesern ohne Abschlussrecht den Zugriff', async () => expect((await run('leiter')).status).toBe(403));
});

