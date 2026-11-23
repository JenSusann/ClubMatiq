import { beforeEach, describe, expect, it, vi } from 'vitest';

const berechtigung = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: berechtigung }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn() },
  client: { startSession: vi.fn() }
}));

import { GET } from '../../../src/routes/api/benutzer/einladen/+server';
import { POST } from '../../../src/routes/api/benutzer/einladen/+server';
import { POST as POSTErneut } from '../../../src/routes/api/benutzer/einladen/[id]/erneut/+server';

describe('API benutzer/einladen: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen', { method: 'GET' });
    const antwort = await GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await POST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});

describe('API benutzer/einladen/[id]/erneut: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen/507f1f77bcf86cd799439011/erneut', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await POSTErneut({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});
