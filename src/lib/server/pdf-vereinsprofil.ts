import type { PDFDocument, PDFPage, PDFFont } from 'pdf-lib';
import { rgb } from 'pdf-lib';
import type { Ausstellerdaten } from './vereinseinstellungen';

export async function zeichneVereinsprofil(pdf: PDFDocument, seite: PDFPage, aussteller: Ausstellerdaten, normal: PDFFont, fett: PDFFont, x: number, y: number, breite: number, text: (wert: unknown) => string): Promise<number> {
  let logo = false;
  if (aussteller.logo && process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const url = new URL(aussteller.logo.url);
      const prefix = '/' + process.env.CLOUDINARY_CLOUD_NAME + '/image/upload/';
      if (url.origin === 'https://res.cloudinary.com' && url.pathname.startsWith(prefix) && !url.username && !url.password) {
        url.pathname = prefix + 'c_limit,w_480,h_480,f_png/' + url.pathname.slice(prefix.length);
        url.search = '';
        const antwort = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
        if (antwort.ok && antwort.body) {
          const reader = antwort.body.getReader();
          const teile: Uint8Array[] = [];
          let total = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              total += value.length;
              if (total > 2 * 1024 * 1024) throw new Error('Logo zu gross');
              teile.push(value);
            }
          } finally { await reader.cancel().catch(() => {}); }
          const bild = await pdf.embedPng(Buffer.concat(teile));
          const mass = bild.scaleToFit(90, 64);
          seite.drawImage(bild, { x: x + breite - mass.width, y: y + 12 - mass.height, ...mass });
          logo = true;
        }
      }
    } catch { /* PDF bleibt auch ohne erreichbares Logo verfügbar. */ }
  }
  const start = y;
  const max = breite - (logo ? 110 : 0);
  const zeile = (wert: string, font: PDFFont, size: number) => {
    let rest = text(wert);
    while (rest.length) {
      let n = rest.length;
      while (n > 1 && font.widthOfTextAtSize(rest.slice(0,n),size) > max) n--;
      seite.drawText(rest.slice(0,n), { x, y, font, size, color: rgb(0.13,0.19,0.29) });
      rest = rest.slice(n);
      y -= size + 4;
    }
  };
  zeile(aussteller.name, fett, 17);
  for (const wert of [aussteller.adresse.strasse, [aussteller.adresse.plz, aussteller.adresse.ort].filter(Boolean).join(' '), aussteller.kontakt.email, aussteller.kontakt.telefon, aussteller.kontakt.website]) {
    if (wert) zeile(wert, normal, 9);
  }
  return Math.min(y - 18, start - (logo ? 76 : 48));
}
