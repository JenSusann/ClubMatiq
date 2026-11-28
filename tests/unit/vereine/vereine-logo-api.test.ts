import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({ findOne: vi.fn(), updateOne: vi.fn(), upload: vi.fn(), config: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: () => m } }));
vi.mock('cloudinary', () => ({ v2: { config: m.config, uploader: { upload_stream: m.upload } } }));
import { POST, DELETE } from '../../../src/routes/api/vereine/logo/+server';

const id = new ObjectId();
const admin = { id: 'admin', vereinId: id.toHexString(), rolle: 'admin' };
const alt = { url: 'https://example.org/alt.png', publicId: 'alt' };
const neu = { secure_url: 'https://example.org/neu.png', public_id: 'neu', format: 'png' };
const original = { _id: id, name: 'TV', logo: alt, profilRevision: 2 };
const png = () => new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'logo.png', { type: 'image/png' });
const post = (datei: File | null = png(), benutzer: unknown = admin) => {
  const form = new FormData();
  if (datei) form.append('logo', datei);
  form.append('vereinId', new ObjectId().toHexString());
  return POST({ locals: { benutzer }, request: { formData: async () => form } } as never);
};
const entfernen = (benutzer: unknown = admin) => DELETE({ locals: { benutzer } } as never);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('MONGODB_DB_NAME', 'clubmatiq_test');
  m.findOne.mockResolvedValue(original);
  m.updateOne.mockResolvedValue({ matchedCount: 1 });
  m.upload.mockImplementation((_opts, cb) => ({ on: vi.fn(), end: () => cb(null, neu) }));
});
afterEach(() => vi.unstubAllEnvs());

describe('Vereinslogo API', () => {
  it('verweigert unangemeldete Benutzer', async () => {
    expect((await post(png(), null)).status).toBe(401);
    expect((await entfernen(null)).status).toBe(401);
    expect(m.findOne).not.toHaveBeenCalled();
  });
  it.each(['materialverantwortlich', 'leiter', 'mitglied', 'unbekannt'])('verweigert Rolle %s', async rolle => {
    expect((await post(png(), { ...admin, rolle })).status).toBe(403);
    expect((await entfernen({ ...admin, rolle })).status).toBe(403);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('sperrt Änderungen in der Demo', async () => {
    vi.stubEnv('MONGODB_DB_NAME', 'clubmatiq_demo');
    expect((await post()).status).toBe(403);
    expect((await entfernen()).status).toBe(403);
  });
  it('verwirft ungültige Vereins-ID', async () => {
    expect((await post(png(), { ...admin, vereinId: 'bad' })).status).toBe(400);
  });
  it.each([
    null,
    new File([], 'leer.png', { type: 'image/png' }),
    new File(['abc'], 'fake.png', { type: 'image/png' }),
    new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'gross.png', { type: 'image/png' })
  ])('verwirft ungültige Datei %#', async datei => {
    expect((await post(datei)).status).toBe(400);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('verwirft defekte Formulardaten', async () => {
    expect((await POST({ locals: { benutzer: admin }, request: { formData: async () => { throw Error('form'); } } } as never)).status).toBe(400);
  });
  it('meldet fehlenden Verein', async () => {
    m.findOne.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('speichert Logo nur im eigenen Verein und bewahrt den alten Aussteller', async () => {
    const antwort = await post();
    expect(antwort.status).toBe(201);
    expect(await antwort.json()).toEqual({ erfolg: true, logo: { url: neu.secure_url } });
    expect(m.findOne).toHaveBeenCalledWith({ _id: id });
    expect(m.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: 'clubmatiq/' + admin.vereinId + '/logos', overwrite: false, allowed_formats: ['png'] }), expect.any(Function));
    expect(m.updateOne).toHaveBeenCalledWith({ _id: id, profilRevision: 2 }, expect.objectContaining({
      $set: expect.objectContaining({ logo: { url: neu.secure_url, publicId: 'neu' }, ausstellerVorErsterAenderung: expect.objectContaining({ logo: alt }) }),
      $inc: { profilRevision: 1 }
    }));
  });
  it('entfernt Logo ohne historischen Aussteller zu überschreiben', async () => {
    const snapshot = { name: 'Alt', logo: alt };
    m.findOne.mockResolvedValue({ ...original, ausstellerVorErsterAenderung: snapshot });
    expect((await entfernen()).status).toBe(200);
    expect(m.updateOne.mock.calls[0][1].$set).toMatchObject({ logo: null, ausstellerVorErsterAenderung: snapshot });
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('verwirft abweichendes erkanntes Bildformat', async () => {
    m.upload.mockImplementation((_opts, cb) => ({ on: vi.fn(), end: () => cb(null, { ...neu, format: 'jpg' }) }));
    expect((await post()).status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('meldet konkurrierende Änderungen', async () => {
    m.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect((await post()).status).toBe(409);
  });
  it('behandelt Uploadfehler', async () => {
    m.upload.mockImplementation((_opts, cb) => ({ on: vi.fn(), end: () => cb(Error('upload')) }));
    expect((await post()).status).toBe(500);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('behandelt DB-Schreibfehler', async () => {
    m.updateOne.mockRejectedValue(Error('DB'));
    expect((await post()).status).toBe(500);
  });
});
