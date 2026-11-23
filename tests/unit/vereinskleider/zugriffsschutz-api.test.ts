import { beforeEach, describe, expect, it, vi } from 'vitest';
const berechtigung = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: berechtigung }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn() }, client: { startSession: vi.fn() } }));

import { GET as handler_0_GET } from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import { POST as handler_0_POST } from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import { PATCH as handler_1_PATCH } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';
import { GET as handler_2_GET } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/pdf/+server';
import { POST as handler_3_POST } from '../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import { GET as handler_4_GET } from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import { GET as handler_5_GET } from '../../../src/routes/api/vereinskleider/export/+server';
import { GET as handler_6_GET } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import { POST as handler_6_POST } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
beforeEach(() => { vi.clearAllMocks(); berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 })); });

describe('API vereinskleider/verrechnung: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/verrechnung', { method: 'GET' });
    const antwort = await handler_0_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/verrechnung', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await handler_0_POST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API vereinskleider/verrechnung/[id]: Zugriffsschutz', () => {

it('PATCH: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/verrechnung/507f1f77bcf86cd799439011', { method: 'PATCH', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await handler_1_PATCH({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API vereinskleider/verrechnung/[id]/pdf: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/verrechnung/507f1f77bcf86cd799439011/pdf', { method: 'GET' });
    const antwort = await handler_2_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API vereinskleider/sammelbestellungen/pdf: Zugriffsschutz', () => {

it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/sammelbestellungen/pdf', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await handler_3_POST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API vereinskleider/sammelbestellungen/[id]/pdf: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/sammelbestellungen/507f1f77bcf86cd799439011/pdf', { method: 'GET' });
    const antwort = await handler_4_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API vereinskleider/export: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/export', { method: 'GET' });
    const antwort = await handler_5_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API vereinskleider/stornierungen: Zugriffsschutz', () => {

it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/stornierungen', { method: 'GET' });
    const antwort = await handler_6_GET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/vereinskleider/stornierungen', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await handler_6_POST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});

