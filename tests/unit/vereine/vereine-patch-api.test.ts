import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({ findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: () => m } }));
import { PATCH } from '../../../src/routes/api/vereine/+server';

const id = new ObjectId();
const admin = { id: 'admin-1', vereinId: id.toHexString(), rolle: 'admin' };
const original = { _id: id, name: 'Alter Verein', kuerzel: 'AV' };
const call = (body: unknown = { name: 'Neuer Verein' }, benutzer: unknown = admin) =>
  PATCH({ locals: { benutzer }, request: { json: async () => body } } as never);

beforeEach(() => {
  vi.resetAllMocks();
  m.findOne.mockResolvedValue(original);
  m.updateOne.mockResolvedValue({ matchedCount: 1 });
});

describe('PATCH /api/vereine', () => {
  it('verweigert unangemeldete Benutzer', async () => {
    expect((await call({}, null)).status).toBe(401);
    expect(m.findOne).not.toHaveBeenCalled();
  });
  it.each(['materialverantwortlich', 'leiter', 'mitglied', 'unbekannt'])('verweigert Rolle %s', async rolle => {
    expect((await call({}, { ...admin, rolle })).status).toBe(403);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('verwirft ungültige Vereins-ID', async () => {
    expect((await call({}, { ...admin, vereinId: 'bad' })).status).toBe(400);
    expect(m.findOne).not.toHaveBeenCalled();
  });
  it('verwirft defektes JSON', async () => {
    expect((await PATCH({ locals: { benutzer: admin }, request: { json: async () => { throw Error('JSON'); } } } as never)).status).toBe(400);
  });
  it.each([null, {}, { name: ' ' }, { name: 'TV', kontakt: { email: 'bad' } }])('verwirft ungültige Eingabe %j', async body => {
    expect((await call(body)).status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('meldet fehlenden Verein', async () => {
    m.findOne.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
  it('speichert nur erlaubte Felder und sichert den ursprünglichen Aussteller', async () => {
    expect((await call({ name: 'Neuer Verein', vereinId: 'fremd', _id: 'fremd', logo: { url: 'bad' }, mailEinstellungen: { password: 'bad' } })).status).toBe(200);
    expect(m.findOne).toHaveBeenCalledWith({ _id: id });
    const [filter, update] = m.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: id, profilRevision: { $exists: false } });
    expect(update.$inc).toEqual({ profilRevision: 1 });
    expect(update.$set).toEqual({
      name: 'Neuer Verein', kuerzel: '',
      adresse: { strasse: '', plz: '', ort: '' },
      kontakt: { email: '', telefon: '', website: '' },
      ausstellerVorErsterAenderung: {
        name: 'Alter Verein', kuerzel: 'AV',
        adresse: { strasse: '', plz: '', ort: '' },
        kontakt: { email: '', telefon: '', website: '' }, logo: null
      },
      profilAktualisiertAm: expect.any(Date), profilAktualisiertVon: admin.id
    });
  });
  it('behält den ursprünglichen Aussteller bei weiteren Änderungen', async () => {
    await call();
    const snapshot = m.updateOne.mock.calls[0][1].$set.ausstellerVorErsterAenderung;
    m.findOne.mockResolvedValue({ ...original, name: 'Neuer Verein', profilRevision: 1, ausstellerVorErsterAenderung: snapshot });
    expect((await call({ name: 'Dritter Name' })).status).toBe(200);
    expect(m.updateOne.mock.calls[1][0]).toEqual({ _id: id, profilRevision: 1 });
    expect(m.updateOne.mock.calls[1][1].$set.ausstellerVorErsterAenderung).toEqual(snapshot);
  });
  it('meldet konkurrierende Profiländerungen', async () => {
    m.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect((await call()).status).toBe(409);
  });
  it('behandelt Datenbankfehler', async () => {
    m.updateOne.mockRejectedValue(new Error('DB'));
    expect((await call()).status).toBe(500);
  });
});
