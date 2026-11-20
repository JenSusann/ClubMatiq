import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('UNERWARTETER_DATENBANKZUGRIFF'); } },
  client: { startSession: () => { throw new Error('UNERWARTETE_TRANSAKTION'); } }
}));
const basis = { id: '507f1f77bcf86cd799439011', vereinId: '507f1f77bcf86cd799439011', rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
function ereignis(methode: string, daten: unknown, rolle: string | null, id?: string) {
  const benutzer = rolle === null ? null : { ...basis, rolle };
  const request = new Request('http://localhost/api/test', {
    method: methode,
    ...(methode === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) })
  });
  return { request, locals: { benutzer }, params: { id }, url: new URL(request.url) } as any;
}

import { GET as H0_GET, POST as H0_POST } from '../../../src/routes/api/meldungen/+server';
import { PATCH as H1_PATCH } from '../../../src/routes/api/meldungen/[id]/+server';
describe('Paket 16: schadensmeldungen-rechte', () => {
  it("Ohne Login keine Meldungen", async () => {
    const response = await H0_GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Ohne Login keine Schadensmeldung", async () => {
    const response = await H0_POST(ereignis("POST", {}, null, null));
    expect(response.status).toBe(401);
  });
  it("Mitglied darf Meldung nicht bearbeiten", async () => {
    const response = await H1_PATCH(ereignis("PATCH", {}, "mitglied", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(403);
  });
  it("Ohne Login kein Bearbeiten", async () => {
    const response = await H1_PATCH(ereignis("PATCH", {}, null, "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(401);
  });
});
