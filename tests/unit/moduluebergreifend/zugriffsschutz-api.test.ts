import { beforeEach, describe, expect, it, vi } from 'vitest';

const berechtigung = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: berechtigung }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn() },
  client: { startSession: vi.fn() }
}));

import { GET as einladenGET, POST as einladenPOST } from '../../../src/routes/api/benutzer/einladen/+server';
import { POST as erneutPOST } from '../../../src/routes/api/benutzer/einladen/[id]/erneut/+server';
import { GET as mitgliederGET, POST as mitgliederPOST } from '../../../src/routes/api/mitglieder/+server';
import { GET as rabatteGET, POST as rabattePOST, PUT as rabattePUT } from '../../../src/routes/api/rabatte/+server';

describe('API benutzer/einladen: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen', { method: 'GET' });
    const antwort = await einladenGET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/benutzer/einladen', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await einladenPOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
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
    const antwort = await erneutPOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API mitglieder: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/mitglieder', { method: 'GET' });
    const antwort = await mitgliederGET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/mitglieder', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await mitgliederPOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});


describe('API rabatte: Zugriffsschutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    berechtigung.mockReturnValue(new Response(JSON.stringify({ fehler: 'Keine Berechtigung' }), { status: 403 }));
  });
  it('GET: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/rabatte', { method: 'GET' });
    const antwort = await rabatteGET({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('POST: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/rabatte', { method: 'POST', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await rabattePOST({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
  it('PUT: verweigert Zugriff bei fehlender Berechtigung', async () => {
    const request = new Request('http://localhost/api/rabatte', { method: 'PUT', body: JSON.stringify({}), headers: {"content-type": "application/json"} });
    const antwort = await rabattePUT({ request, locals: { benutzer: null }, params: { id: '507f1f77bcf86cd799439011' }, url: new URL(request.url) } as never);
    expect(antwort.status).toBe(403);
    expect(berechtigung).toHaveBeenCalled();
  });
});
