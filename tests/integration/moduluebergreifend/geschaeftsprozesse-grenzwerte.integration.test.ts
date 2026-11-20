import { describe, expect, it, vi } from 'vitest';

// Diese Tests prüfen die Eingabegrenzen direkt am echten API-Handler.
// MongoDB wird absichtlich nicht verbunden: ungültige Daten müssen vor jedem DB-Zugriff abgewiesen werden.
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('Unerwarteter Datenbankzugriff'); } },
  client: { startSession: () => { throw new Error('Unerwartete Transaktion'); } }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: () => null
}));


const locals = { benutzer: { id: '0123456789abcdef01234567', vereinId: 'abcdefabcdefabcdefabcdef', rolle: 'admin' } };
const params = { id: '0123456789abcdef01234567' };
const request = (daten: unknown) => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten)
});
const aufrufen = (handler: typeof route0.POST, daten: unknown) => handler({ locals, params, request: request(daten) } as never);
import * as route0 from '../../../src/routes/api/inventuren/[id]/korrigieren/+server';

// Ursprüngliche Datei: inventur-korrektur-grenzwerte.integration.test.ts
describe('inventur-korrektur-grenzwerte', () => {
  it('Position ungültig', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "x", "neuerIstBestand": 1, "begruendung": "Gültiger Grund", "version": 0});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('negativer Ist', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "0123456789abcdef01234567", "neuerIstBestand": -1, "begruendung": "Gültiger Grund", "version": 0});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Ist nicht ganzzahlig', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "0123456789abcdef01234567", "neuerIstBestand": 1.5, "begruendung": "Gültiger Grund", "version": 0});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Begründung zu kurz', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "0123456789abcdef01234567", "neuerIstBestand": 1, "begruendung": "abc", "version": 0});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Begründung zu lang', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "0123456789abcdef01234567", "neuerIstBestand": 1, "begruendung": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "version": 0});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Version negativ', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "0123456789abcdef01234567", "neuerIstBestand": 1, "begruendung": "Gültiger Grund", "version": -1});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Version nicht ganzzahlig', async () => {
    const antwort = await aufrufen(route0.POST, {"positionId": "0123456789abcdef01234567", "neuerIstBestand": 1, "begruendung": "Gültiger Grund", "version": 0.5});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(route0.POST, null);
    expect(antwort.status).toBe(400);
  });
});

import * as route1 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: inventur-stornierung-grenzwerte.integration.test.ts
describe('inventur-stornierung-grenzwerte', () => {
  it('Grund zu kurz', async () => {
    const antwort = await aufrufen(route1.POST, {"begruendung": "abc"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Grund nur Leerzeichen', async () => {
    const antwort = await aufrufen(route1.POST, {"begruendung": "       "});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Grund zu lang', async () => {
    const antwort = await aufrufen(route1.POST, {"begruendung": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('fehlender Grund', async () => {
    const antwort = await aufrufen(route1.POST, {});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(route1.POST, null);
    expect(antwort.status).toBe(400);
  });
});

import * as route2 from '../../../src/routes/api/vereinskleider/verrechnung/+server';

// Ursprüngliche Datei: rechnung-erstellen-grenzwerte.integration.test.ts
describe('rechnung-erstellen-grenzwerte', () => {
  it('Verkauf-ID ungültig', async () => {
    const antwort = await aufrufen(route2.POST, {"verkaufId": "ungültig"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Verkauf-ID fehlt', async () => {
    const antwort = await aufrufen(route2.POST, {});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Verkauf-ID Zahl', async () => {
    const antwort = await aufrufen(route2.POST, {"verkaufId": 42});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(route2.POST, null);
    expect(antwort.status).toBe(400);
  });
});

import * as route3 from '../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

// Ursprüngliche Datei: sammelbestellungen-grenzwerte.integration.test.ts
describe('sammelbestellungen-grenzwerte', () => {
  it('leere Positionen', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": []});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('mehr als 100 Positionen', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}]});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Bemerkung zu lang', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": [{}], "bemerkung": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('ungültige Artikel-ID', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": [{"artikelId": "x", "groesseId": null, "menge": 1}]});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge null', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": [{"artikelId": "0123456789abcdef01234567", "groesseId": null, "menge": 0}]});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge über 10000', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": [{"artikelId": "0123456789abcdef01234567", "groesseId": null, "menge": 10001}]});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('doppelte Position', async () => {
    const antwort = await aufrufen(route3.POST, {"positionen": [{"artikelId": "0123456789abcdef01234567", "groesseId": null, "menge": 1}, {"artikelId": "0123456789abcdef01234567", "groesseId": null, "menge": 1}]});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(route3.POST, null);
    expect(antwort.status).toBe(400);
  });
});

import * as route4 from '../../../src/routes/api/vereinskleider/stornierungen/+server';

// Ursprüngliche Datei: stornierungen-grenzwerte.integration.test.ts
describe('stornierungen-grenzwerte', () => {
  it('Verkauf-ID ungültig', async () => {
    const antwort = await aufrufen(route4.POST, {"verkaufId": "x", "positionsIndex": 0, "menge": 1, "grund": "Test"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('negative Position', async () => {
    const antwort = await aufrufen(route4.POST, {"verkaufId": "0123456789abcdef01234567", "positionsIndex": -1, "menge": 1, "grund": "Test"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge null', async () => {
    const antwort = await aufrufen(route4.POST, {"verkaufId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 0, "grund": "Test"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge über 10000', async () => {
    const antwort = await aufrufen(route4.POST, {"verkaufId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 10001, "grund": "Test"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('leerer Grund', async () => {
    const antwort = await aufrufen(route4.POST, {"verkaufId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 1, "grund": " "});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Grund zu lang', async () => {
    const antwort = await aufrufen(route4.POST, {"verkaufId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 1, "grund": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(route4.POST, null);
    expect(antwort.status).toBe(400);
  });
});

import * as route5 from '../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

// Ursprüngliche Datei: uebergaben-grenzwerte.integration.test.ts
describe('uebergaben-grenzwerte', () => {
  it('Vorgang ungültig', async () => {
    const antwort = await aufrufen(route5.POST, {"vorgangId": "x", "positionsIndex": 0, "menge": 1});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Position negativ', async () => {
    const antwort = await aufrufen(route5.POST, {"vorgangId": "0123456789abcdef01234567", "positionsIndex": -1, "menge": 1});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge null', async () => {
    const antwort = await aufrufen(route5.POST, {"vorgangId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 0});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge über 10000', async () => {
    const antwort = await aufrufen(route5.POST, {"vorgangId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 10001});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Menge nicht ganzzahlig', async () => {
    const antwort = await aufrufen(route5.POST, {"vorgangId": "0123456789abcdef01234567", "positionsIndex": 0, "menge": 1.5});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(route5.POST, null);
    expect(antwort.status).toBe(400);
  });
});

