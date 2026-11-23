import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  deleteMany: vi.fn(),
  deleteOne: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  pruefeBerechtigung: vi.fn(() => null)
}));

vi.mock('../../../src/lib/server/mongodb', () => ({
  db: {
    collection: (name: string) => ({
      findOne: (filter: unknown) => mocks.findOne(name, filter),
      deleteMany: (filter: unknown, options: unknown) => mocks.deleteMany(name, filter, options),
      deleteOne: (filter: unknown, options: unknown) => mocks.deleteOne(name, filter, options)
    })
  },
  client: { startSession: () => ({
    withTransaction: mocks.withTransaction,
    endSession: mocks.endSession
  }) }
}));

vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: mocks.pruefeBerechtigung
}));

import { DELETE } from '../../../src/routes/api/artikel/[id]/+server';

const artikelId = new ObjectId().toString();
const vereinId = new ObjectId().toString();

function event() {
  return { params: { id: artikelId }, locals: {
    benutzer: { id: new ObjectId().toString(), vereinId, rolle: 'admin' }
  }} as Parameters<typeof DELETE>[0];
}

describe('Artikel löschen – Bestell- und Verkaufsschutz (#60)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.pruefeBerechtigung.mockReturnValue(null);
    mocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) => callback());
    mocks.endSession.mockResolvedValue(undefined);
    mocks.deleteMany.mockResolvedValue({ deletedCount: 0 });
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.findOne.mockImplementation(async (collection: string) =>
      collection === 'artikel' ? { _id: new ObjectId(artikelId), vereinId } : null
    );
  });

  it.each(['offen', 'teilweise', 'abgeschlossen', 'storniert'])(
    'verhindert Löschen bei einer %s referenzierten Bestellung/Verkauf',
    async (status) => {
      mocks.findOne.mockImplementation(async (collection: string) => {
        if (collection === 'artikel') return { _id: new ObjectId(artikelId), vereinId };
        if (collection === 'vereinskleider_verkaeufe') return {
          vereinId, status, positionen: [{ artikelId, menge: 1 }]
        };
        return null;
      });

      const response = await DELETE(event());
      expect(response.status).toBe(409);
      expect((await response.json()).fehler).toMatch(/nicht gelöscht/);
      expect(mocks.deleteOne).not.toHaveBeenCalled();
      expect(mocks.deleteMany).not.toHaveBeenCalled();
      expect(mocks.findOne).toHaveBeenCalledWith('vereinskleider_verkaeufe', {
        vereinId, 'positionen.artikelId': artikelId
      });
    }
  );

  it('löscht einen Artikel ohne abhängige Referenzen', async () => {
    const response = await DELETE(event());
    expect(response.status).toBe(200);
    expect((await response.json()).erfolg).toBe(true);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
    expect(mocks.deleteOne).toHaveBeenCalledOnce();
  });

  it('verhindert Löschen bei vorhandener Ausleihe', async () => {
    mocks.findOne.mockImplementation(async (collection: string) => {
      if (collection === 'artikel') return { _id: new ObjectId(artikelId), vereinId };
      if (collection === 'ausleihen') return { artikelId, vereinId };
      return null;
    });
    const response = await DELETE(event());
    expect(response.status).toBe(409);
    expect(mocks.deleteOne).not.toHaveBeenCalled();
  });

  it('weist ungültige Artikel-IDs ab', async () => {
    const response = await DELETE({ ...event(), params: { id: 'ungueltig' } });
    expect(response.status).toBe(400);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});
