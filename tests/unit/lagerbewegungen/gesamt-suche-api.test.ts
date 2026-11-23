import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({ collection: vi.fn(), permission: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args) } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET } from '../../../src/routes/api/lagerbewegungen/gesamt/+server';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockReturnValue(null);
});

describe('Issue #66 – Suche vor Vorschaugrenze', () => {
  it('findet ältere Treffer hinter den ersten 200 Bewegungen', async () => {
    const artikelId = new ObjectId();
    const id = new ObjectId();
    const daten = Array.from({ length: 201 }, (_, i) => ({
      _id: new ObjectId(), artikelId: artikelId.toString(), zeitpunkt: new Date(2026, 0, 1),
      art: i === 200 ? 'inventur' : 'verkauf', mengeDelta: 1,
      referenzTyp: 'test', referenzId: i === 200 ? 'gesuchter-beleg' : 'andere-referenz'
    }));
    let limitAufgerufen = false;
    mocks.collection.mockImplementation((name: string) => {
      if (name === 'lagerbewegungen') return {
        find: () => ({
          sort() { return this; },
          limit() { limitAufgerufen = true; return this; },
          async *[Symbol.asyncIterator]() { yield* daten; }
        })
      };
      const rows = name === 'artikel' ? [{ _id: artikelId, name: 'Trainingsshirt' }]
        : name === 'groessen' ? [] : name === 'benutzer' ? [{ _id: id, vorname: 'Test', nachname: 'User' }] : [];
      return { find: () => ({ project: () => ({ toArray: async () => rows }) }) };
    });
    const response = await GET({
      locals: { benutzer: { id: id.toString(), vereinId: 'verein-1', rolle: 'admin' } },
      url: new URL('http://localhost/api/lagerbewegungen/gesamt?suche=gesuchter-beleg')
    } as never);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.bewegungen).toHaveLength(1);
    expect(result.bewegungen[0].referenzId).toBe('gesuchter-beleg');
    expect(limitAufgerufen).toBe(false);
  });
});
