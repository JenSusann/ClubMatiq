import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('Datenbank darf bei diesen Tests nicht aufgerufen werden'); } }
}));
const admin = { id: 'test', vereinId: '507f1f77bcf86cd799439011', rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const leiter = { ...admin, rolle: 'leiter' };
function event(method: string, body: unknown, benutzer: unknown = admin, id?: string) {
  return {
    request: new Request('http://localhost/api/test', {
      method, ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    }),
    locals: { benutzer }, params: { id }
  } as any;
}
import * as route0 from '../../../src/routes/api/benutzer/+server.ts';

// Ursprüngliche Datei: paket11-benutzer-liste.integration.test.ts
describe('Paket 11 – Benutzerliste', () => {
  it('ohne Anmeldung 401', async () => {
    const response = await route0.GET(event('GET', null, null));
    expect(response.status).toBe(401);
  });
  it('Mitglied ohne Rechte 403', async () => {
    const response = await route0.GET(event('GET', null, mitglied));
    expect(response.status).toBe(403);
  });
  it('Leiter ohne Rechte 403', async () => {
    const response = await route0.GET(event('GET', null, leiter));
    expect(response.status).toBe(403);
  });
});

import * as route1 from '../../../src/routes/api/lieferanten/+server.ts';

// Ursprüngliche Datei: paket11-lieferanten.integration.test.ts
describe('Paket 11 – Lieferanten', () => {
  it('Mitglied darf nicht lesen 403', async () => {
    const response = await route1.GET(event('GET', null, mitglied));
    expect(response.status).toBe(403);
  });
  it('Name fehlt 400', async () => {
    const response = await route1.POST(event('POST', { name: '' }));
    expect(response.status).toBe(400);
  });
  it('ungueltige Mail 400', async () => {
    const response = await route1.POST(event('POST', { name: 'Test', email: 'keine-mail' }));
    expect(response.status).toBe(400);
  });
  it('ungueltige ID 400', async () => {
    const response = await route1.PATCH(event('PATCH', { id: 'falsch', name: 'Test' }));
    expect(response.status).toBe(400);
  });
  it('ungueltige ID 400', async () => {
    const response = await route1.DELETE(event('DELETE', { id: 'falsch' }));
    expect(response.status).toBe(400);
  });
});

import * as route2 from '../../../src/routes/api/vereinskleider/preise/+server.ts';

// Ursprüngliche Datei: paket11-preise.integration.test.ts
describe('Paket 11 – Vereinskleiderpreise', () => {
  it('ohne Anmeldung 401', async () => {
    const response = await route2.GET(event('GET', null, null));
    expect(response.status).toBe(401);
  });
  it('Mitglied darf keine Preise aendern 403', async () => {
    const response = await route2.PUT(event('PUT', {}, mitglied));
    expect(response.status).toBe(403);
  });
  it('ungueltige Artikel-ID 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: 'falsch' }));
    expect(response.status).toBe(400);
  });
  it('ungueltiger Preistyp 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: '507f1f77bcf86cd799439012', preistyp: 'gratis', druckkosten: 0, verkaufspreis: 1 }));
    expect(response.status).toBe(400);
  });
  it('negative Druckkosten 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: '507f1f77bcf86cd799439012', preistyp: 'fix', druckkosten: -1, verkaufspreis: 1 }));
    expect(response.status).toBe(400);
  });
  it('Fixpreis ohne Verkaufspreis 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: '507f1f77bcf86cd799439012', preistyp: 'fix', druckkosten: 0, verkaufspreis: null }));
    expect(response.status).toBe(400);
  });
});

import * as route3 from '../../../src/routes/api/rabatte/+server.ts';

// Ursprüngliche Datei: paket11-rabatte.integration.test.ts
describe('Paket 11 – Rabattregeln', () => {
  it('Mitglied darf nicht lesen 403', async () => {
    const response = await route3.GET(event('GET', null, mitglied));
    expect(response.status).toBe(403);
  });
  it('Rabattname fehlt 400', async () => {
    const response = await route3.POST(event('POST', { rabattart: 'prozent', geltungsbereich: 'warenkorb', wert: 10 }));
    expect(response.status).toBe(400);
  });
  it('Prozentrabatt ueber 100 400', async () => {
    const response = await route3.POST(event('POST', { name: 'Test', rabattart: 'prozent', geltungsbereich: 'warenkorb', wert: 101 }));
    expect(response.status).toBe(400);
  });
  it('ungueltiger Rabattwert 400', async () => {
    const response = await route3.POST(event('POST', { name: 'Test', rabattart: 'betrag', geltungsbereich: 'warenkorb', wert: -2 }));
    expect(response.status).toBe(400);
  });
  it('Artikelrabatt ohne Artikel 400', async () => {
    const response = await route3.POST(event('POST', { name: 'Test', rabattart: 'betrag', geltungsbereich: 'artikel', wert: 5, artikelIds: [] }));
    expect(response.status).toBe(400);
  });
});

import * as route4 from '../../../src/routes/api/registrieren/+server.ts';

// Ursprüngliche Datei: paket11-registrierung.integration.test.ts
describe('Paket 11 – Registrierung', () => {
  it('Pflichtfelder fehlen 400', async () => {
    const response = await route4.POST(event('POST', {}));
    expect(response.status).toBe(400);
  });
  it('ungueltige E-Mail 400', async () => {
    const response = await route4.POST(event('POST', { vereinsname: 'Verein', vorname: 'A', nachname: 'B', email: 'falsch', passwort: '123456789012' }));
    expect(response.status).toBe(400);
  });
  it('Passwort zu kurz 400', async () => {
    const response = await route4.POST(event('POST', { vereinsname: 'Verein', vorname: 'A', nachname: 'B', email: 'a@b.ch', passwort: 'kurz' }));
    expect(response.status).toBe(400);
  });
});

import * as route5 from '../../../src/routes/api/vereine/+server.ts';

// Ursprüngliche Datei: paket11-vereine.integration.test.ts
describe('Paket 11 – Vereinsverwaltung', () => {
  it('ohne Anmeldung 401', async () => {
    const response = await route5.GET(event('GET', null, null));
    expect(response.status).toBe(401);
  });
  it('mit ungueltiger Vereins-ID 400', async () => {
    const response = await route5.GET(event('GET', null, { ...admin, vereinId: 'falsch' }));
    expect(response.status).toBe(400);
  });
  it('ohne Anmeldung 401', async () => {
    const response = await route5.POST(event('POST', {}, null));
    expect(response.status).toBe(401);
  });
  it('direkte Vereinserstellung verweigert 403', async () => {
    const response = await route5.POST(event('POST', {}));
    expect(response.status).toBe(403);
  });
});

