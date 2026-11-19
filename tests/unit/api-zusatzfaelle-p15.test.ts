import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn(),
  insertOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn(),
  withTransaction: vi.fn(), endSession: vi.fn(), hash: vi.fn()
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({
    findOne: m.findOne, find: m.find, insertOne: m.insertOne,
    updateOne: m.updateOne, deleteOne: m.deleteOne
  })) },
  client: { startSession: vi.fn(() => ({ withTransaction: m.withTransaction, endSession: m.endSession })) }
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: vi.fn(() => null) }));
vi.mock('argon2', () => ({ hash: m.hash, argon2id: 2 }));

import { GET as lieferantenGet, POST as lieferantenPost, PATCH as lieferantenPatch, DELETE as lieferantenDelete } from '../../src/routes/api/lieferanten/+server';
import { GET as einladungGet, POST as einladungPost } from '../../src/routes/api/einladung/+server';
import { POST as rueckgabePost } from '../../src/routes/api/ausleihen/[id]/rueckgabe/+server';
import { POST as korrekturPost } from '../../src/routes/api/inventuren/[id]/korrigieren/+server';

const id = '507f1f77bcf86cd799439011';
const positionId = '507f191e810c19729de860ea';
const benutzer = { id, vereinId: 'verein-a', rolle: 'admin' };
const req = (value: unknown) => ({ json: vi.fn().mockResolvedValue(value) });
const defekt = () => ({ json: vi.fn().mockRejectedValue(new SyntaxError('JSON defekt')) });
const lieferant = { name: 'Testlieferant', kontaktperson: '', email: '', telefon: '', bemerkung: '' };
const token = 'a'.repeat(64);
const spyError = () => vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockReturnValue({ sort: m.sort });
  m.sort.mockReturnValue({ toArray: m.toArray });
  m.withTransaction.mockImplementation(async (cb: () => Promise<void>) => cb());
  m.endSession.mockResolvedValue(undefined);
  m.hash.mockResolvedValue('hashed-password');
});

describe('Paket 15 – Lieferanten', () => {
  it('GET führt Mapping-Callback aus und konvertiert Objekt-IDs', async () => {
    m.toArray.mockResolvedValue([{ _id: { toString: () => id }, ...lieferant }]);
    const res = await lieferantenGet({ locals: { benutzer } } as never);
    expect(res.status).toBe(200);
    expect((await res.json())[0]._id).toBe(id);
  });
  it('POST behandelt defektes JSON mit 400', async () => {
    const res = await lieferantenPost({ locals: { benutzer }, request: defekt() } as never);
    expect(res.status).toBe(400);
  });
  it('PATCH behandelt defektes JSON mit 400', async () => {
    const res = await lieferantenPatch({ locals: { benutzer }, request: defekt() } as never);
    expect(res.status).toBe(400);
  });
  it('DELETE behandelt defektes JSON mit 400', async () => {
    const res = await lieferantenDelete({ locals: { benutzer }, request: defekt() } as never);
    expect(res.status).toBe(400);
  });
  it('POST escaped Sonderzeichen im Lieferantennamen für Regex-Suche', async () => {
    m.findOne.mockResolvedValue(null);
    m.insertOne.mockResolvedValue({ insertedId: { toString: () => id } });
    const res = await lieferantenPost({ locals: { benutzer }, request: req({ ...lieferant, name: 'A+B (AG)' }) } as never);
    expect(res.status).toBe(201);
    const { db } = await import('../../src/lib/server/mongodb');
    expect(db.collection).toHaveBeenCalledWith('lieferanten');
    const query = m.findOne.mock.calls[0][0];
    expect(query.name.$regex).toContain('\\+');
    expect(query.name.$regex).toContain('\\(');
  });
});

describe('Paket 15 – Einladungen', () => {
  it('GET liefert 400 ohne Token (Default-Branch)', async () => {
    const res = await einladungGet({ url: new URL('http://localhost/api/einladung') } as never);
    expect(res.status).toBe(400);
  });
  it('POST behandelt ungültiges JSON mit 400', async () => {
    const res = await einladungPost({ request: defekt() } as never);
    expect(res.status).toBe(400);
  });
  it('POST führt Transaktions-Callback aus und erstellt Benutzer', async () => {
    m.findOne.mockResolvedValueOnce({ _id: id, vereinId: 'verein-a', email: 'test@example.ch', vorname: 'Test', nachname: 'User', rolle: 'mitglied' }).mockResolvedValueOnce(null);
    m.updateOne.mockResolvedValue({ modifiedCount: 1 });
    m.insertOne.mockResolvedValue({ insertedId: id });
    const res = await einladungPost({ request: req({ token, passwort: 'ein-sicheres-passwort-123' }) } as never);
    expect(res.status).toBe(200);
    expect(m.insertOne).toHaveBeenCalledTimes(1);
    expect(m.endSession).toHaveBeenCalledTimes(1);
  });
  it('POST behandelt bereits registrierte E-Mail mit 409', async () => {
    m.findOne.mockResolvedValueOnce({ _id: id, email: 'test@example.ch' }).mockResolvedValueOnce({ _id: positionId });
    const res = await einladungPost({ request: req({ token, passwort: 'ein-sicheres-passwort-123' }) } as never);
    expect(res.status).toBe(409);
    expect(m.endSession).toHaveBeenCalledTimes(1);
  });
});

describe('Paket 15 – Materialrückgabe', () => {
  it('behandelt ungültiges JSON mit 400 ohne Transaktion', async () => {
    const res = await rueckgabePost({ params: { id }, locals: { benutzer }, request: defekt() } as never);
    expect(res.status).toBe(400);
    expect(m.withTransaction).not.toHaveBeenCalled();
  });
  it('führt Transaktions-Callback bei Teilrückgabe ohne Grösse aus', async () => {
    m.findOne.mockResolvedValue({ _id: id, artikelId: id, groesseId: null, menge: 5, zurueckgegeben: 0, status: 'offen' });
    m.updateOne.mockResolvedValue({ modifiedCount: 1 });
    const res = await rueckgabePost({ params: { id }, locals: { benutzer }, request: req({ menge: 2 }) } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, status: 'teilweise', zurueckgegeben: 2, offen: 3 });
    expect(m.endSession).toHaveBeenCalledTimes(1);
  });
  it('führt Transaktions-Callback bei vollständiger Rückgabe mit Grösse aus', async () => {
    m.findOne.mockResolvedValue({ _id: id, artikelId: id, groesseId: positionId, menge: 3, zurueckgegeben: 1, status: 'teilweise' });
    m.updateOne.mockResolvedValue({ modifiedCount: 1 });
    const res = await rueckgabePost({ params: { id }, locals: { benutzer }, request: req({ menge: 2 }) } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, status: 'abgeschlossen', zurueckgegeben: 3, offen: 0 });
    expect(m.updateOne).toHaveBeenCalledTimes(3);
  });
  it('behandelt Fehler innerhalb der Transaktion mit 400', async () => {
    m.findOne.mockResolvedValue(null);
    const spy = spyError();
    try {
      const res = await rueckgabePost({ params: { id }, locals: { benutzer }, request: req({ menge: 1 }) } as never);
      expect(res.status).toBe(400);
      expect((await res.json()).fehler).toContain('nicht gefunden');
      expect(m.endSession).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });
});

describe('Paket 15 – Inventurkorrekturen', () => {
  it('behandelt defektes JSON mit 400', async () => {
    const res = await korrekturPost({ params: { id }, locals: { benutzer }, request: defekt() } as never);
    expect(res.status).toBe(400);
  });
  it('führt Transaktions-Callback bei nachträglicher Korrektur aus', async () => {
    m.findOne.mockResolvedValueOnce({ status: 'abgeschlossen', version: 0 })
      .mockResolvedValueOnce({ istBestand: 3, artikelId: id, groesseId: null });
    m.updateOne.mockResolvedValue({ matchedCount: 1 });
    m.insertOne.mockResolvedValue({ insertedId: id });
    const res = await korrekturPost({ params: { id }, locals: { benutzer }, request: req({ positionId, neuerIstBestand: 5, begruendung: 'Bestand nachgezählt', version: 0 }) } as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erfolg: true, differenz: 2, version: 1 });
    expect(m.endSession).toHaveBeenCalledTimes(1);
  });
  it('führt Fehlerpfad im Transaktions-Callback bei fehlender Inventur aus', async () => {
    m.findOne.mockResolvedValue(null);
    const spy = spyError();
    try {
      const res = await korrekturPost({ params: { id }, locals: { benutzer }, request: req({ positionId, neuerIstBestand: 5, begruendung: 'Bestand nachgezählt', version: 0 }) } as never);
      expect(res.status).toBe(409);
      expect(m.endSession).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });
});
