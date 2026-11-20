import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('UNERWARTETER_DATENBANKZUGRIFF'); } },
  client: { startSession: () => { throw new Error('UNERWARTETE_TRANSAKTION'); } }
}));
const basis = { id: '507f1f77bcf86cd799439011', vereinId: '507f1f77bcf86cd799439011', rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
function ereignis(methode: string, daten: unknown, rolle: string | null, id?: string | null) {
  const benutzer = rolle === null ? null : { ...basis, rolle };
  const request = new Request('http://localhost/api/test', {
    method: methode,
    ...(methode === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) })
  });
  return { request, locals: { benutzer }, params: { id }, url: new URL(request.url) } as any;
}

import { GET as H0_GET, POST as H0_POST } from '../../../src/routes/api/artikel/+server';
import { POST as H1_POST } from '../../../src/routes/api/inventuren/+server';
describe('Paket 13: berechtigungen-inventar', () => {
  it("Mitglied darf Artikel nicht erstellen", async () => {
    const response = await H0_POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Ohne Login keine Artikel", async () => {
    const response = await H0_GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Leiter darf Inventur nicht erstellen", async () => {
    const response = await H1_POST(ereignis("POST", {}, "leiter", null));
    expect(response.status).toBe(403);
  });
});
