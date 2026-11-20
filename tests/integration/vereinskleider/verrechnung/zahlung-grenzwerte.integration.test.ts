import { describe, expect, it, vi } from 'vitest';

// Diese Tests prüfen die Eingabegrenzen direkt am echten API-Handler.
// MongoDB wird absichtlich nicht verbunden: ungültige Daten müssen vor jedem DB-Zugriff abgewiesen werden.
vi.mock('../../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('Unerwarteter Datenbankzugriff'); } },
  client: { startSession: () => { throw new Error('Unerwartete Transaktion'); } }
}));
vi.mock('../../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: () => null
}));


const locals = { benutzer: { id: '0123456789abcdef01234567', vereinId: 'abcdefabcdefabcdefabcdef', rolle: 'admin' } };
const params = { id: '0123456789abcdef01234567' };
const request = (daten: unknown) => new Request('http://localhost/api/test', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten)
});
const aufrufen = (daten: unknown) => route0.PATCH({ locals, params, request: request(daten) } as never);
import * as route0 from '../../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';

// Ursprüngliche Datei: zahlung-grenzwerte.integration.test.ts
describe('zahlung-grenzwerte', () => {
  it('Betrag null', async () => {
    const antwort = await aufrufen({"betrag": 0, "datum": "2026-11-19", "zahlungsart": "bar", "zahlungId": "12345678-1234-1234-1234-123456789abc"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Betrag mit drei Dezimalen', async () => {
    const antwort = await aufrufen({"betrag": 1.001, "datum": "2026-11-19", "zahlungsart": "bar", "zahlungId": "12345678-1234-1234-1234-123456789abc"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Datum ungültig', async () => {
    const antwort = await aufrufen({"betrag": 1, "datum": "2026-02-30", "zahlungsart": "bar", "zahlungId": "12345678-1234-1234-1234-123456789abc"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Zahlungsart ungültig', async () => {
    const antwort = await aufrufen({"betrag": 1, "datum": "2026-11-19", "zahlungsart": "kreditkarte", "zahlungId": "12345678-1234-1234-1234-123456789abc"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('Zahlungs-ID ungültig', async () => {
    const antwort = await aufrufen({"betrag": 1, "datum": "2026-11-19", "zahlungsart": "bar", "zahlungId": "x"});
    expect(antwort.status).toBe(400);
    expect((await antwort.json()).fehler).toEqual(expect.any(String));
  });
  it('weist nicht-objektförmige Nutzdaten zurück', async () => {
    const antwort = await aufrufen(null);
    expect(antwort.status).toBe(400);
  });
});

