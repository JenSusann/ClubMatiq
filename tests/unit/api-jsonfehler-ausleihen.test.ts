import { beforeEach, describe, expect, it, vi } from 'vitest';

const { find, sort, toArray } = vi.hoisted(() => ({
  find: vi.fn(), sort: vi.fn(), toArray: vi.fn()
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({ find })) },
  client: { startSession: vi.fn() }
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: vi.fn(() => null)
}));

import { PATCH as meldungPatch } from '../../src/routes/api/meldungen/[id]/+server';
import { PATCH as groessePatch } from '../../src/routes/api/groessen/[id]/+server';
import { PATCH as kategoriePatch } from '../../src/routes/api/kategorien/[id]/+server';
import { PATCH as lagerortPatch } from '../../src/routes/api/lagerorte/[id]/+server';
import { GET as ausleihenGet, POST as ausleihenPost } from '../../src/routes/api/ausleihen/+server';

const id = '507f1f77bcf86cd799439011';
const benutzer = { id, vereinId: 'verein-a', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const defekterRequest = () => ({ json: vi.fn().mockRejectedValue(new SyntaxError('Defektes JSON')) });

beforeEach(() => {
  vi.clearAllMocks();
  find.mockReturnValue({ sort });
  sort.mockReturnValue({ toArray });
});

describe('Paket 14 – JSON-Fehlerpfade (Callbacks)', () => {
  it('Schadensmeldung: abgefangener JSON-Parsingfehler ergibt 400', async () => {
    const res = await meldungPatch({ params: { id }, locals: { benutzer }, request: defekterRequest() } as never);
    expect(res.status).toBe(400);
    expect((await res.json()).fehler).toBe('Ungültige Meldungsdaten.');
  });
  it('Grössen: abgefangener JSON-Parsingfehler ergibt 400', async () => {
    const res = await groessePatch({ params: { id }, locals: { benutzer }, request: defekterRequest() } as never);
    expect(res.status).toBe(400);
  });
  it('Kategorien: abgefangener JSON-Parsingfehler ergibt 400', async () => {
    const res = await kategoriePatch({ params: { id }, locals: { benutzer }, request: defekterRequest() } as never);
    expect(res.status).toBe(400);
  });
  it('Lagerorte: abgefangener JSON-Parsingfehler ergibt 400', async () => {
    const res = await lagerortPatch({ params: { id }, locals: { benutzer }, request: defekterRequest() } as never);
    expect(res.status).toBe(400);
  });
  it('Ausleihen: abgefangener JSON-Parsingfehler ergibt 400', async () => {
    const res = await ausleihenPost({ locals: { benutzer }, request: defekterRequest() } as never);
    expect(res.status).toBe(400);
    expect((await res.json()).fehler).toBe('Ungültige Ausleihdaten.');
  });
});

describe('Paket 14 – Ausleihen-Liste', () => {
  it('wandelt MongoDB-IDs aller Ausleihen in Strings um und filtert nach Verein', async () => {
    toArray.mockResolvedValue([
      { _id: { toString: () => id }, vereinId: 'verein-a', person: 'Nathalie' },
      { _id: { toString: () => '507f191e810c19729de860ea' }, vereinId: 'verein-a', person: 'Laura' }
    ]);
    const res = await ausleihenGet({ locals: { benutzer } } as never);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.map((x: { _id: string }) => x._id)).toEqual([id, '507f191e810c19729de860ea']);
    expect(find).toHaveBeenCalledWith({ vereinId: 'verein-a' });
  });
  it('meldet einen Datenbankfehler beim Laden mit Status 500', async () => {
    toArray.mockRejectedValue(new Error('DB offline'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await ausleihenGet({ locals: { benutzer } } as never);
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
