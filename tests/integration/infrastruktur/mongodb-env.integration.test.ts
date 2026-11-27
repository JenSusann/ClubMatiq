import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mongoClient, database, clientInstance } = vi.hoisted(() => {
  const database = { collection: vi.fn() };
  const clientInstance = { db: vi.fn(() => database) };
  return { database, clientInstance, mongoClient: vi.fn(function MongoClientMock() { return clientInstance; }) };
});

vi.mock('mongodb', () => ({ MongoClient: mongoClient }));

describe('MongoDB-Verbindung: beide Umgebungsvariablen-Branches', () => {
  beforeEach(() => {
    vi.stubEnv('MONGODB_DB_NAME', 'clubmatiq_test');
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('erstellt mit MONGODB_URI den Client und die Datenbank clubmatiq_test', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017');
    const mod = await import('../../../src/lib/server/mongodb');
    expect(mongoClient).toHaveBeenCalledWith('mongodb://127.0.0.1:27017');
    expect(clientInstance.db).toHaveBeenCalledWith('clubmatiq_test');
    expect(mod.client).toBe(clientInstance);
    expect(mod.db).toBe(database);
  });
  it.each(['', 'unbekannt'])('verweigert ungültigen Datenbanknamen %s', async (name) => {
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017');
    vi.stubEnv('MONGODB_DB_NAME', name);
    await expect(import('../../../src/lib/server/mongodb')).rejects.toThrow('MONGODB_DB_NAME');
  });
});
