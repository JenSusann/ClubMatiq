import { beforeEach, describe, expect, it, vi } from 'vitest';
const berechtigung = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: berechtigung }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn() }, client: { startSession: vi.fn() } }));

import { GET as handler_0_GET } from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';
import { GET as handler_1_GET } from '../../../src/routes/api/inventuren/[id]/pdf/+server';
import { POST as handler_2_POST } from '../../../src/routes/api/inventuren/[id]/stornieren/+server';
import { POST as handler_3_POST } from '../../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';
beforeEach(() => { vi.clearAllMocks(); berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 })); });

describe('API inventuren/[id]/korrekturhistorie: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/inventuren/507f1f77bcf86cd799439011/korrekturhistorie', { method: 'GET' });
    const antwort = await handler_0_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API inventuren/[id]/pdf: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/inventuren/507f1f77bcf86cd799439011/pdf', { method: 'GET' });
    const antwort = await handler_1_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API inventuren/[id]/stornieren: Zugriffsschutz', () => {

it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/inventuren/507f1f77bcf86cd799439011/stornieren', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await handler_2_POST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API inventuren/[id]/zuruecksetzen: Zugriffsschutz', () => {

it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/inventuren/507f1f77bcf86cd799439011/zuruecksetzen', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await handler_3_POST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});

