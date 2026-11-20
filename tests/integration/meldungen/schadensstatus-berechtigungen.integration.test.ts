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


const id=new ObjectId().toString();
const run = (rolle: string | null, data: unknown, meldungId=id) => route0.PATCH({ locals: locals(rolle), params:{id:meldungId}, request:new Request('http://localhost/api/meldungen/'+meldungId,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(data)}) } as any);
import * as route0 from '../../../src/routes/api/meldungen/[id]/+server';

// Ursprüngliche Datei: paket10-schadensstatus-berechtigungen.integration.test.ts
describe('Paket 10 – Schadensstatus Rechte und Validierung', () => {
 it('verweigert anonymen Benutzern die Bearbeitung', async () => expect((await run(null,{status:'offen',bearbeitungsnotiz:''})).status).toBe(401));
 it('verweigert Mitgliedern die Bearbeitung', async () => expect((await run('mitglied',{status:'offen',bearbeitungsnotiz:''})).status).toBe(403));
 it('verweigert Leitern die Bearbeitung', async () => expect((await run('leiter',{status:'offen',bearbeitungsnotiz:''})).status).toBe(403));
 it('validiert die ID vor der Datenbankoperation', async () => expect((await run('admin',{status:'offen',bearbeitungsnotiz:''},'falsch')).status).toBe(400));
 it('verwirft unbekannte Statuswerte', async () => expect((await run('admin',{status:'archiviert',bearbeitungsnotiz:''})).status).toBe(400));
});

