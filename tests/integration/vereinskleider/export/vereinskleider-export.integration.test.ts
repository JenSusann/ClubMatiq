import { describe, expect, it, vi } from 'vitest';

const locals = { benutzer: { id: 'test', vereinId: 'verein', rolle: 'admin' } };
const event = (fetchMock: ReturnType<typeof vi.fn>) => ({
  locals, url: new URL('http://localhost/api/vereinskleider/export?suche=jacke'),
  fetch: fetchMock
});
import * as route0 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 21-export-api-fehler.integration.test.ts
describe('21-export-api-fehler', () => {
  it('prüft den Exportablauf', async () => {
    const responses = [[500, {"fehler": "Historie nicht verf\u00fcgbar"}]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route0.GET(event(fetchMock) as never);
    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

import * as route1 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 21-export-datenkonflikt.integration.test.ts
describe('21-export-datenkonflikt', () => {
  it('prüft den Exportablauf', async () => {
    const responses = [[200, {"gesamt": 2, "verkaeufe": [], "seiten": 1}]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route1.GET(event(fetchMock) as never);
    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

import * as route2 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 21-export-leere-excel.integration.test.ts
describe('21-export-leere-excel', () => {
  it('prüft den Exportablauf', async () => {
    const responses = [[200, {"gesamt": 0, "verkaeufe": [], "seiten": 0}], [200, []]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route2.GET(event(fetchMock) as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheet');
  });
});

import * as route3 from '../../../../src/routes/api/vereinskleider/export/+server';

// Ursprüngliche Datei: 21-export-zu-viele-verkaeufe.integration.test.ts
describe('21-export-zu-viele-verkaeufe', () => {
  it('prüft den Exportablauf', async () => {
    const responses = [[200, {"gesamt": 10001, "verkaeufe": [], "seiten": 1}]];
    const fetchMock = vi.fn();
    for (const [status, data] of responses) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
        status, headers: { 'content-type': 'application/json' }
      }));
    }
    const response = await route3.GET(event(fetchMock) as never);
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

