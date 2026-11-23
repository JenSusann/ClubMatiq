import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { constructor, database } = vi.hoisted(() => ({
  constructor: vi.fn(),
  database: vi.fn()
}));

// Verhindert, dass dotenv die absichtlich entfernte URI aus .env wiederherstellt.
vi.mock('dotenv/config', () => ({}));
vi.mock('mongodb', () => ({
  MongoClient: class {
    constructor(uri: string) { constructor(uri); }
    db(name: string) { return database(name); }
  }
}));

describe('MongoDB-Konfiguration (isolierte Modulimporte)', () => {
  const original = process.env.MONGODB_URI;
  beforeEach(() => {
    vi.resetModules();
    constructor.mockClear();
    database.mockReset();
    database.mockReturnValue({ name: 'mock-db' });
  });
  afterEach(() => {
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });

  it('meldet einen klaren Fehler bei fehlender MONGODB_URI', async () => {
    delete process.env.MONGODB_URI;
    await expect(import('../../../src/lib/server/mongodb')).rejects.toThrow('MONGODB_URI fehlt in der .env-Datei');
    expect(constructor).not.toHaveBeenCalled();
  });

  it('erzeugt Client und clubmatiq-Datenbank bei gültiger URI', async () => {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
    const modul = await import('../../../src/lib/server/mongodb');
    expect(constructor).toHaveBeenCalledWith('mongodb://127.0.0.1:27017');
    expect(database).toHaveBeenCalledWith('clubmatiq');
    expect(modul.db).toEqual({ name: 'mock-db' });
    expect(modul.client).toBeDefined();
  });
});
