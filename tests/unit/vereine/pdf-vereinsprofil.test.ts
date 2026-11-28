import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zeichneVereinsprofil } from '../../../src/lib/server/pdf-vereinsprofil';
import { erstelleAusstellerdaten } from '../../../src/lib/server/vereinseinstellungen';

const abruf = vi.fn();
const logo = { url: 'https://res.cloudinary.com/testclub/image/upload/v123/logo.webp', publicId: 'logo' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64');
beforeEach(() => {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'testclub');
  vi.stubGlobal('fetch', abruf);
  abruf.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function render(profil: unknown) {
  const pdf = await PDFDocument.create();
  const seite = pdf.addPage([595,842]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = vi.spyOn(seite, 'drawText');
  const bild = vi.spyOn(seite, 'drawImage');
  const y = await zeichneVereinsprofil(pdf, seite, erstelleAusstellerdaten(profil), normal, fett, 48, 785, 499, String);
  const bytes = await pdf.save();
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  return { y, text, bild };
}
describe('PDF Vereinsprofil', () => {
  it('rendert Altvereine ohne optionale Daten', async () => {
    const r = await render({ name: 'TV Alt' });
    expect(r.text.mock.calls.map(c => c[0])).toEqual(['TV Alt']);
    expect(r.y).toBe(737);
    expect(abruf).not.toHaveBeenCalled();
  });
  it('rendert alle vorhandenen Kontaktfelder', async () => {
    const r = await render({ name: 'TV', adresse: { strasse: 'Dorfstrasse 1', plz: '8104', ort: 'Weiningen' }, kontakt: { email: 'tv@example.ch', telefon: '044 123 45 67', website: 'https://example.ch' } });
    expect(r.text.mock.calls.map(c => c[0])).toEqual(['TV','Dorfstrasse 1','8104 Weiningen','tv@example.ch','044 123 45 67','https://example.ch']);
    expect(r.y).toBeLessThan(737);
  });
  it('bettet ein Cloudinary-Logo als PNG ein', async () => {
    abruf.mockResolvedValue(new Response(png));
    const r = await render({ name: 'TV', logo });
    expect(abruf).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
    expect(String(abruf.mock.calls[0][0])).toContain('/testclub/image/upload/c_limit,w_480,h_480,f_png/v123/logo.webp');
    expect(r.bild).toHaveBeenCalledTimes(1);
    expect(r.y).toBeLessThanOrEqual(709);
  });
  it.each(['https://example.org/logo.png','https://res.cloudinary.com/fremd/image/upload/logo.png','http://res.cloudinary.com/testclub/image/upload/logo.png','https://res.cloudinary.com/testclub/raw/upload/logo.png'])('verweigert fremde Logo-URL %s', async url => {
    const r = await render({ name: 'TV', logo: { ...logo, url } });
    expect(abruf).not.toHaveBeenCalled();
    expect(r.bild).not.toHaveBeenCalled();
  });
  it('erzeugt PDF bei Netzwerkfehler', async () => {
    abruf.mockRejectedValue(Error('Netzwerk'));
    expect((await render({ name: 'TV', logo })).bild).not.toHaveBeenCalled();
  });
  it('erzeugt PDF bei HTTP-Fehler', async () => {
    abruf.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await render({ name: 'TV', logo })).bild).not.toHaveBeenCalled();
  });
  it('verwirft zu grosse Bildantwort', async () => {
    abruf.mockResolvedValue(new Response(new Uint8Array(2 * 1024 * 1024 + 1)));
    expect((await render({ name: 'TV', logo })).bild).not.toHaveBeenCalled();
  });
  it('verwirft defekte Bilddaten', async () => {
    abruf.mockResolvedValue(new Response('kein Bild'));
    expect((await render({ name: 'TV', logo })).bild).not.toHaveBeenCalled();
  });
  it('bricht lange Kontaktfelder um', async () => {
    const r = await render({ name: 'TV', kontakt: { website: 'https://example.ch/' + 'a'.repeat(450) } });
    expect(r.text.mock.calls.length).toBeGreaterThan(2);
  });
});
