import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  startSession: vi.fn(), endSession: vi.fn(),
  updateOne: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: m.startSession } }));
vi.mock('../../src/lib/server/lagerbewegungen', () => ({ protokolliereLagerbewegung: vi.fn() }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { PATCH } from '../../src/routes/api/artikel/[id]/archiv/+server';
import { POST as AUSLEIHE } from '../../src/routes/api/ausleihen/+server';

const id = new ObjectId().toHexString();
const benutzer = { id: 'user-1', vereinId: 'verein-1', rolle: 'admin', vorname: 'Test', nachname: 'Person' };
const ctx = (archiviert: unknown, artikelId = id) => ({
  params: { id: artikelId }, locals: { benutzer },
  request: new Request('http://localhost/api/artikel/archiv', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archiviert })
  })
}) as never;

beforeEach(() => {
  vi.clearAllMocks();
  m.collection.mockReturnValue({ findOne: m.findOne, find: m.find, updateOne: m.updateOne });
  m.findOne.mockResolvedValue({ _id: new ObjectId(id), vereinId: benutzer.vereinId, archiviert: false });
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockResolvedValue([]);
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.permission.mockReturnValue(null);
  m.startSession.mockReturnValue({ withTransaction: async (cb: () => Promise<void>) => cb(), endSession: m.endSession });
});

describe('Issue #60 – Artikelarchiv', () => {
  it('verweigert Archivierung ohne Berechtigung', async () => {
    m.permission.mockReturnValue(new Response('Verboten', { status: 403 }) as never);
    expect((await PATCH(ctx(true))).status).toBe(403);
    expect(m.findOne).not.toHaveBeenCalled();
  });
  it('prüft die Artikel-ID', async () => {
    expect((await PATCH(ctx(true, 'falsch'))).status).toBe(400);
  });
  it('verweigert fremde oder nicht vorhandene Artikel', async () => {
    m.findOne.mockResolvedValue(null);
    expect((await PATCH(ctx(true))).status).toBe(404);
    expect(m.findOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-1' }));
  });
  it('archiviert ohne Bestandsänderung und protokolliert die Person', async () => {
    expect((await PATCH(ctx(true))).status).toBe(200);
    expect(m.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-1', archiviert: { $ne: true } }),
      expect.objectContaining({ $set: expect.objectContaining({
        archiviert: true, archiviertVon: 'user-1', archiviertVonName: 'Test Person'
      }) })
    );
    expect(JSON.stringify(m.updateOne.mock.calls[0][1])).not.toContain('"menge"');
  });
  it('verhindert Archivierung bei offenen Ausleihen', async () => {
    m.toArray.mockResolvedValueOnce([{ menge: 2, rueckgaben: [{ menge: 1 }] }]).mockResolvedValueOnce([]);
    expect((await PATCH(ctx(true))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert Archivierung bei noch offenen Bestellungen', async () => {
    m.toArray.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      positionen: [{ artikelId: id, verkaufsart: 'bestellung', menge: 2, uebergebenMenge: 1 }]
    }]);
    expect((await PATCH(ctx(true))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('reaktiviert den Artikel ohne Bestandsänderung', async () => {
    m.findOne.mockResolvedValue({ archiviert: true });
    expect((await PATCH(ctx(false))).status).toBe(200);
    expect(m.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ archiviert: true }),
      expect.objectContaining({ $set: expect.objectContaining({ archiviert: false, archiviertAm: null }) })
    );
  });
  it('verhindert wiederholte Archivierung', async () => {
    m.findOne.mockResolvedValue({ archiviert: true });
    expect((await PATCH(ctx(true))).status).toBe(409);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert gleichzeitige widersprüchliche Statusänderung', async () => {
    m.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await PATCH(ctx(true))).status).toBe(409);
  });
});

describe('Issue #60 – Ausleihe archivierter Artikel', () => {
  it('verweigert eine neue Ausleihe ohne Lagerabgang', async () => {
    m.findOne.mockResolvedValue({ archiviert: true, hatGroessen: false, menge: 5 });
    const antwort = await AUSLEIHE({
      locals: { benutzer },
      request: new Request('http://localhost/api/ausleihen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artikelId: id, groesseId: null, person: 'Testperson', menge: 1,
          ausleihdatum: '2026-11-22', rueckgabedatum: '2026-11-29'
        })
      })
    } as never);
    expect(antwort.ok).toBe(false);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
});
