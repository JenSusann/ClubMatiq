import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mongoClient, database, clientInstance } = vi.hoisted(() => {
  const database = { collection: vi.fn() };
  const clientInstance = { db: vi.fn(() => database) };
  return { database, clientInstance, mongoClient: vi.fn(function MongoClientMock() { return clientInstance; }) };
});

vi.mock('mongodb', () => ({ MongoClient: mongoClient }));

describe('MongoDB-Verbindung: beide Umgebungsvariablen-Branches', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('verweigert den Modulstart ohne MONGODB_URI', async () => {
    vi.stubEnv('MONGODB_URI', '');
    await expect(import('../../../src/lib/server/mongodb')).rejects.toThrow(
      'MONGODB_URI fehlt in der .env-Datei'
    );
    expect(mongoClient).not.toHaveBeenCalled();
  });

  it('erstellt mit MONGODB_URI den Client und die Datenbank clubmatiq', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017');
    const mod = await import('../../../src/lib/server/mongodb');
    expect(mongoClient).toHaveBeenCalledWith('mongodb://127.0.0.1:27017');
    expect(clientInstance.db).toHaveBeenCalledWith('clubmatiq');
    expect(mod.client).toBe(clientInstance);
    expect(mod.db).toBe(database);
  });
});
