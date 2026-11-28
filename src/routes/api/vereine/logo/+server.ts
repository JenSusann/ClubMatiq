import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { env } from 'node:process';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { erstelleAusstellerdaten } from '../../../../lib/server/vereinseinstellungen';
import type { RequestHandler } from './$types';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true
});

const MAX = 5 * 1024 * 1024;
const formate: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
function signatur(puffer: Buffer, typ: string) {
  if (typ === 'image/jpeg') return puffer.length >= 3 && puffer[0] === 255 && puffer[1] === 216 && puffer[2] === 255;
  if (typ === 'image/png') return puffer.length >= 8 && puffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return typ === 'image/webp' && puffer.length >= 12 && puffer.toString('ascii',0,4) === 'RIFF' && puffer.toString('ascii',8,12) === 'WEBP';
}

async function aendereLogo(locals: App.Locals, request?: Request) {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verein:verwalten');
  if (zugriff) return zugriff;
  if (env.MONGODB_DB_NAME === 'clubmatiq_demo') return json({ fehler: 'Logoänderungen sind in der Demo deaktiviert.' }, { status: 403 });
  const benutzer = locals.benutzer!;
  if (!ObjectId.isValid(benutzer.vereinId)) return json({ fehler: 'Ungültige Vereins-ID.' }, { status: 400 });
  let puffer: Buffer | undefined;
  let typ = '';
  if (request) {
    try {
      const datei = (await request.formData()).get('logo');
      if (!(datei instanceof File) || !Object.hasOwn(formate, datei.type) || !datei.size || datei.size > MAX)
        return json({ fehler: 'Bitte ein JPG-, PNG- oder WebP-Bild mit maximal 5 MB auswählen.' }, { status: 400 });
      typ = datei.type;
      puffer = Buffer.from(await datei.arrayBuffer());
      if (!signatur(puffer, typ)) return json({ fehler: 'Ungültiges Bildformat.' }, { status: 400 });
    } catch { return json({ fehler: 'Ungültige Formulardaten.' }, { status: 400 }); }
  }
  let upload: { url: string; publicId: string } | null = null;
  let gespeichert = false;
  try {
    const vereine = db.collection('vereine');
    const _id = new ObjectId(benutzer.vereinId);
    const verein = await vereine.findOne({ _id });
    if (!verein) return json({ fehler: 'Verein nicht gefunden.' }, { status: 404 });
    if (puffer) {
      const bild = await new Promise<{ secure_url: string; public_id: string; format: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: `clubmatiq/${benutzer.vereinId}/logos`,
          resource_type: 'image', overwrite: false, unique_filename: true,
          allowed_formats: [formate[typ]]
        }, (fehler, ergebnis) => {
          if (fehler || !ergebnis) reject(fehler ?? new Error('Upload fehlgeschlagen.'));
          else resolve(ergebnis);
        });
        stream.on('error', reject);
        stream.end(puffer);
      });
      upload = { url: bild.secure_url, publicId: bild.public_id };
      if (bild.format !== formate[typ]) return json({ fehler: 'Bildformat stimmt nicht überein.' }, { status: 400 });
    }
    const update = await vereine.updateOne({
      _id, profilRevision: verein.profilRevision === undefined ? { $exists: false } : verein.profilRevision
    }, {
      $set: {
        logo: upload,
        ausstellerVorErsterAenderung: verein.ausstellerVorErsterAenderung ?? erstelleAusstellerdaten(verein),
        profilAktualisiertAm: new Date(), profilAktualisiertVon: benutzer.id
      },
      $inc: { profilRevision: 1 }
    });
    if (update.matchedCount !== 1) return json({ fehler: 'Verein wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
    gespeichert = true;
    return json({ erfolg: true, logo: upload ? { url: upload.url } : null }, { status: request ? 201 : 200 });
  } catch (error) {
    console.error('Vereinslogo:', error);
    return json({ fehler: 'Logo konnte nicht gespeichert werden.' }, { status: 500 });
  } finally {
    // Bei unklarem DB-Schreibausgang das Bild sicherheitshalber behalten:
    // historische Belege dürfen keine ungültigen Bildreferenzen erhalten.
    if (upload && !gespeichert) console.warn('Nicht bestätigter Logo-Upload; zur späteren Bereinigung:', upload.publicId);
  }
}
export const POST: RequestHandler = ({ locals, request }) => aendereLogo(locals, request);
export const DELETE: RequestHandler = ({ locals }) => aendereLogo(locals);
