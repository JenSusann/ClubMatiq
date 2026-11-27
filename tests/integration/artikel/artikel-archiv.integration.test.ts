import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  collection: vi.fn(), findOne: vi.fn(), find: vi.fn(), toArray: vi.fn(),
  startSession: vi.fn(), endSession: vi.fn(),
  updateOne: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn(), permission: vi.fn(() => null)
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection }, client: { startSession: m.startSession } }));
vi.mock('../../../src/lib/server/lagerbewegungen', () => ({ protokolliereLagerbewegung: vi.fn() }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { PATCH } from '../../../src/routes/api/artikel/[id]/archiv/+server';
import { DELETE } from '../../../src/routes/api/artikel/[id]/+server';
import { POST as AUSLEIHE } from '../../../src/routes/api/ausleihen/+server';

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
  m.collection.mockReturnValue({ findOne: m.findOne, find: m.find, updateOne: m.updateOne, deleteOne: m.deleteOne, deleteMany: m.deleteMany });
  m.findOne.mockResolvedValue({ _id: new ObjectId(id), vereinId: benutzer.vereinId, archiviert: false });
  m.find.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockResolvedValue([]);
  m.updateOne.mockResolvedValue({ modifiedCount: 1 });
  m.deleteOne.mockResolvedValue({ deletedCount: 1 });
  m.deleteMany.mockResolvedValue({ deletedCount: 1 });
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

describe('Issue #60 – Physische Löschsperre', () => {
  const loeschen = (artikelId = id) => DELETE({
    params: { id: artikelId }, locals: { benutzer }
  } as never);

  it('verhindert Löschen historisch verkaufter Artikel auch nach Abschluss', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id) })
      .mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ positionen: [{ artikelId: id }] });
    expect((await loeschen()).status).toBe(409);
    expect(m.deleteOne).not.toHaveBeenCalled();
    expect(m.deleteMany).not.toHaveBeenCalled();
    expect(m.findOne).toHaveBeenLastCalledWith(expect.objectContaining({
      vereinId: 'verein-1', 'positionen.artikelId': id
    }));
  });

  it('verhindert Löschung bei bestehenden Ausleihen', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id) })
      .mockResolvedValueOnce({ artikelId: id }).mockResolvedValueOnce(null);
    expect((await loeschen()).status).toBe(409);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });

  it('lässt das Löschen eines nicht referenzierten Artikels zu', async () => {
    m.findOne.mockResolvedValueOnce({ _id: new ObjectId(id) })
      .mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect((await loeschen()).status).toBe(200);
    expect(m.deleteOne).toHaveBeenCalledWith(expect.objectContaining({
      vereinId: 'verein-1'
    }), expect.any(Object));
  });

  it('verhindert Löschen eines vereinsfremden Artikels', async () => {
    m.findOne.mockResolvedValueOnce(null);
    expect((await loeschen()).status).toBe(404);
    expect(m.deleteOne).not.toHaveBeenCalled();
  });

  it('verhindert Löschzugriff ohne Berechtigung', async () => {
    m.permission.mockReturnValue(new Response('Verboten', { status: 403 }) as never);
    expect((await loeschen()).status).toBe(403);
    expect(m.findOne).not.toHaveBeenCalled();
  });
});

describe('Artikelarchiv – historische Daten und Fehlerpfade (#38)', () => {
  it.each([null,[],{},42,{archiviert:'true'}])('verwirft ungültigen Request %j', async body => {
    const r=await PATCH({params:{id},locals:{benutzer},request:new Request('http://localhost',{method:'PATCH',body:JSON.stringify(body)})} as never);
    expect(r.status).toBe(400); expect(m.findOne).not.toHaveBeenCalled();
  });
  it('verwirft fehlerhaftes JSON', async () => {
    expect((await PATCH({params:{id},locals:{benutzer},request:new Request('http://localhost',{method:'PATCH',body:'{'})} as never)).status).toBe(400);
  });
  it('blockiert Ausleihe ohne Rückgabehistorie', async () => {
    m.toArray.mockResolvedValueOnce([{menge:2}]).mockResolvedValueOnce([]);
    expect((await PATCH(ctx(true))).status).toBe(409);
  });
  it('akzeptiert abgeschlossene Ausleihen und historische Direktverkäufe', async () => {
    m.toArray.mockResolvedValueOnce([{menge:2,rueckgaben:[{menge:2},{}]},{}]).mockResolvedValueOnce([{}, {positionen:[{artikelId:'fremd',verkaufsart:'bestellung',menge:2},{artikelId:id,verkaufsart:'direkt',menge:2},{artikelId:id,verkaufsart:'bestellung',menge:2,uebergebenMenge:2},{artikelId:id,verkaufsart:'bestellung'}]}]);
    expect((await PATCH(ctx(true))).status).toBe(200);
  });
  it('blockiert Bestellung ohne Übergabemenge', async () => {
    m.toArray.mockResolvedValueOnce([]).mockResolvedValueOnce([{positionen:[{artikelId:id,verkaufsart:'bestellung',menge:2}]}]);
    expect((await PATCH(ctx(true))).status).toBe(409);
  });
  it('meldet Datenbankfehler ohne Statusänderung', async () => {
    m.findOne.mockRejectedValueOnce(new Error('DB')); expect((await PATCH(ctx(true))).status).toBe(500); expect(m.updateOne).not.toHaveBeenCalled();
  });
});
