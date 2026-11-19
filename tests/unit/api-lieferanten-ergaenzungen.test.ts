import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ collection: vi.fn(), permission: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { POST, PATCH, DELETE } from '../../src/routes/api/lieferanten/+server';

const id = '507f1f77bcf86cd799439011';
const benutzer = { vereinId: 'verein-a' };
const lieferanten = { findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() };
const artikel = { findOne: vi.fn() };
const sammel = { findOne: vi.fn() };
const event = (body: unknown, broken = false) => ({
  locals: { benutzer },
  request: { json: broken ? vi.fn().mockRejectedValue(new SyntaxError('JSON')) : vi.fn().mockResolvedValue(body) }
}) as never;

beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  m.collection.mockImplementation((name: string) => ({ lieferanten, artikel, vereinskleider_sammelbestellungen: sammel })[name]);
  lieferanten.findOne.mockResolvedValue(null);
  lieferanten.insertOne.mockResolvedValue({ insertedId: { toString: () => id } });
  lieferanten.updateOne.mockResolvedValue({ matchedCount: 1 });
  lieferanten.deleteOne.mockResolvedValue({ deletedCount: 1 });
  artikel.findOne.mockResolvedValue(null);
  sammel.findOne.mockResolvedValue(null);
});

describe('Paket 17 – Lieferanten: bisher fehlende Eingabe-Verzweigungen', () => {
  it('POST akzeptiert fehlende optionale Felder und setzt leere Strings ein', async () => {
    const res = await POST(event({ name: 'Ohne Kontakt' }));
    expect(res.status).toBe(201);
    expect(lieferanten.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ohne Kontakt', kontaktperson: '', email: '', telefon: '', bemerkung: ''
    }));
  });

  it.each(['kontaktperson', 'email', 'telefon', 'bemerkung'] as const)(
    'POST akzeptiert fehlendes optionales Feld %s', async (feld) => {
      const eingabe: Record<string, string> = { name: 'Test', kontaktperson: 'Kontakt', email: 'test@example.ch', telefon: '123', bemerkung: 'Text' };
      delete eingabe[feld];
      const res = await POST(event(eingabe));
      expect(res.status).toBe(201);
      expect(lieferanten.insertOne).toHaveBeenCalledWith(expect.objectContaining({ [feld]: '' }));
    }
  );

  it.each(['name', 'kontaktperson', 'email', 'telefon', 'bemerkung'] as const)(
    'POST akzeptiert explizit undefined für %s', async (feld) => {
      const eingabe = { name: 'Test', kontaktperson: 'Kontakt', email: 'test@example.ch', telefon: '123', bemerkung: 'Text', [feld]: undefined };
      const res = await POST(event(eingabe));
      expect(res.status).toBe(feld === 'name' ? 400 : 201);
    }
  );

  it('POST akzeptiert einen Namen mit genau 150 Zeichen', async () => {
    expect((await POST(event({ name: 'a'.repeat(150) }))).status).toBe(201);
  });

  it('POST akzeptiert optionale Felder an der Längengrenze', async () => {
    const res = await POST(event({ name: 'Test', kontaktperson: 'x'.repeat(150), telefon: '1'.repeat(60), bemerkung: 'z'.repeat(2000) }));
    expect(res.status).toBe(201);
  });

  it('POST fängt ungültiges JSON ab', async () => {
    expect((await POST(event(null, true))).status).toBe(400);
  });

  it('PATCH fängt ungültiges JSON ab', async () => {
    expect((await PATCH(event(null, true))).status).toBe(400);
  });

  it('DELETE fängt ungültiges JSON ab', async () => {
    expect((await DELETE(event(null, true))).status).toBe(400);
  });

  it('PATCH akzeptiert die ID in Grossbuchstaben und fehlende optionale Felder', async () => {
    const res = await PATCH(event({ id: id.toUpperCase(), name: 'Test' }));
    expect(res.status).toBe(200);
    expect(lieferanten.updateOne).toHaveBeenCalled();
  });

  it('DELETE akzeptiert die ID in Grossbuchstaben', async () => {
    expect((await DELETE(event({ id: id.toUpperCase() }))).status).toBe(200);
  });

  it('POST maskiert alle Sonderzeichen im Lieferantennamen', async () => {
    const name = 'A.+*?^${}()|[]\\ B';
    expect((await POST(event({ name }))).status).toBe(201);
    expect(lieferanten.findOne).toHaveBeenCalledWith(expect.objectContaining({ name: expect.objectContaining({ $options: 'i' }) }));
  });
});
