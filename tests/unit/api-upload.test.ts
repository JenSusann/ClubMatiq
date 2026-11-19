import { beforeEach, describe, expect, it, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';

const m = vi.hoisted(() => ({ config: vi.fn(), upload_stream: vi.fn(), destroy: vi.fn(), insertOne: vi.fn(), end: vi.fn() }));
vi.mock('cloudinary', () => ({ v2: { config: m.config, uploader: { upload_stream: m.upload_stream, destroy: m.destroy } } }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn(() => ({ insertOne: m.insertOne })) } }));
import { POST } from '../../src/routes/api/upload/+server';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const WEBP = Buffer.from('RIFF1234WEBPpayload');
const benutzer = { id: 'user-1', vereinId: 'verein-1' };
const file = (bytes: Uint8Array, type = 'image/jpeg') => new NodeFile([bytes], 'foto.jpg', { type });
const context = (foto?: unknown, user: unknown = benutzer, formError = false) => ({
  locals: { benutzer: user },
  request: { formData: formError ? vi.fn().mockRejectedValue(new Error('form')) : vi.fn().mockImplementation(async () => {
    const form = new FormData();
    if (foto !== undefined) form.set('foto', foto as string | Blob);
    return form;
  }) }
} as any);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('File', NodeFile);
  m.insertOne.mockResolvedValue({ insertedId: '1' });
  m.destroy.mockResolvedValue({ result: 'ok' });
  m.upload_stream.mockImplementation((_opts, cb) => {
    m.end.mockImplementation(() => cb(null, { secure_url: 'https://example.test/bild.jpg', public_id: 'clubmatiq/bild' }));
    return { end: m.end };
  });
});

describe('POST /api/upload', () => {
  it('verlangt Anmeldung vor FormData', async () => { const r = await POST(context(undefined, null)); expect(r.status).toBe(401); expect(m.upload_stream).not.toHaveBeenCalled(); });
  it('fängt ungültige Formulardaten ab', async () => { const r = await POST(context(undefined, benutzer, true)); expect(r.status).toBe(400); });
  it('verlangt eine Datei', async () => { const r = await POST(context()); expect(r.status).toBe(400); expect((await r.json()).fehler).toMatch(/Foto auswählen/); });
  it('verweigert Textdateien', async () => { const r = await POST(context(file(Buffer.from('hello'), 'text/plain'))); expect(r.status).toBe(400); });
  it('verweigert leere Bilder', async () => { const r = await POST(context(file(Buffer.alloc(0)))); expect(r.status).toBe(400); });
  it('verweigert Bilder über 5 MB', async () => { const r = await POST(context(file(Buffer.alloc(5 * 1024 * 1024 + 1)))); expect(r.status).toBe(400); });
  it.each([
    ['JPEG', JPEG, 'image/jpeg'], ['PNG', PNG, 'image/png'], ['WebP', WEBP, 'image/webp']
  ])('akzeptiert echtes %s', async (_label, bytes, type) => {
    const r = await POST(context(file(bytes as Buffer, type as string)));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ erfolg: true, foto: { url: 'https://example.test/bild.jpg', publicId: 'clubmatiq/bild' } });
    expect(m.upload_stream).toHaveBeenCalledWith({ folder: 'clubmatiq/verein-1/schadensmeldungen', resource_type: 'image', overwrite: false }, expect.any(Function));
    expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId: 'verein-1', benutzerId: 'user-1', publicId: 'clubmatiq/bild', status: 'hochgeladen', meldungId: null, erstelltAm: expect.any(Date) }));
  });
  it.each([
    ['falsche JPEG-Signatur', Buffer.from('fake'), 'image/jpeg'],
    ['zu kurze JPEG-Signatur', Buffer.from([0xff, 0xd8]), 'image/jpeg'],
    ['falsche PNG-Signatur', Buffer.from('not-a-png'), 'image/png'],
    ['zu kurze PNG-Signatur', Buffer.from([137, 80]), 'image/png'],
    ['falsche WebP-Signatur', Buffer.from('RIFF1234FAIL'), 'image/webp'],
    ['zu kurze WebP-Signatur', Buffer.from('RIFF'), 'image/webp'],
    ['JPEG-Inhalt als PNG', JPEG, 'image/png'],
    ['PNG-Inhalt als WebP', PNG, 'image/webp']
  ])('verweigert %s', async (_label, bytes, type) => { const r = await POST(context(file(bytes as Buffer, type as string))); expect(r.status).toBe(400); expect(m.upload_stream).not.toHaveBeenCalled(); });
  it('behandelt Cloudinary-Fehler', async () => { m.upload_stream.mockImplementation((_opts, cb) => ({ end: () => cb(new Error('Cloudinary offline'), null) })); const r = await POST(context(file(JPEG))); expect(r.status).toBe(500); expect(m.insertOne).not.toHaveBeenCalled(); expect(m.destroy).not.toHaveBeenCalled(); });
  it('behandelt fehlendes Cloudinary-Ergebnis', async () => { m.upload_stream.mockImplementation((_opts, cb) => ({ end: () => cb(null, null) })); const r = await POST(context(file(JPEG))); expect(r.status).toBe(500); expect(m.destroy).not.toHaveBeenCalled(); });
  it('entfernt hochgeladenes Bild nach Datenbankfehler', async () => { m.insertOne.mockRejectedValue(new Error('MongoDB offline')); const r = await POST(context(file(JPEG))); expect(r.status).toBe(500); expect(m.destroy).toHaveBeenCalledWith('clubmatiq/bild', { resource_type: 'image' }); });
  it('fängt auch Fehler bei der Bildbereinigung ab', async () => { m.insertOne.mockRejectedValue(new Error('DB')); m.destroy.mockRejectedValue(new Error('delete')); const r = await POST(context(file(JPEG))); expect(r.status).toBe(500); expect(m.destroy).toHaveBeenCalledOnce(); });
  it('behandelt synchronen Upload-Stream-Fehler', async () => { m.upload_stream.mockImplementation(() => { throw new Error('stream'); }); const r = await POST(context(file(JPEG))); expect(r.status).toBe(500); });
});
