
import { json } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import { env } from 'node:process';
import { db } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// Cloudinary konfigurieren
// ========================================

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true
});

const MAX_DATEIGROESSE = 5 * 1024 * 1024;

const ERLAUBTE_DATEITYPEN = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

// ========================================
// POST: Foto hochladen
// ========================================

export const POST: RequestHandler = async ({
  request,
  locals
}) => {
  // ========================================
  // 1. Anmeldung überprüfen
  // ========================================

  const benutzer = locals.benutzer;

  if (!benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // ========================================
  // 2. Formulardaten lesen
  // ========================================

  let formular: FormData;

  try {
    formular = await request.formData();
  } catch {
    return json(
      { fehler: 'Ungültige Formulardaten.' },
      { status: 400 }
    );
  }

  const datei = formular.get('foto');

  if (!(datei instanceof File)) {
    return json(
      { fehler: 'Bitte ein Foto auswählen.' },
      { status: 400 }
    );
  }

  // ========================================
  // 3. Dateityp und Dateigrösse prüfen
  // ========================================

  if (!ERLAUBTE_DATEITYPEN.includes(datei.type)) {
    return json(
      {
        fehler:
          'Nur JPG-, PNG- und WebP-Bilder sind erlaubt.'
      },
      { status: 400 }
    );
  }

  if (datei.size === 0) {
    return json(
      { fehler: 'Die Bilddatei ist leer.' },
      { status: 400 }
    );
  }

  if (datei.size > MAX_DATEIGROESSE) {
    return json(
      {
        fehler:
          'Das Foto darf maximal 5 MB gross sein.'
      },
      { status: 400 }
    );
  }

  // ========================================
  // 4. Bildformat anhand der Datei prüfen
  // ========================================

  const dateipuffer = Buffer.from(
    await datei.arrayBuffer()
  );

  const istJPEG =
    dateipuffer.length >= 3 &&
    dateipuffer[0] === 0xff &&
    dateipuffer[1] === 0xd8 &&
    dateipuffer[2] === 0xff;

  const istPNG =
    dateipuffer.length >= 8 &&
    dateipuffer.subarray(0, 8).equals(
      Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10
      ])
    );

  const istWebP =
    dateipuffer.length >= 12 &&
    dateipuffer.toString('ascii', 0, 4) === 'RIFF' &&
    dateipuffer.toString('ascii', 8, 12) === 'WEBP';

  const bildtypGueltig =
    (datei.type === 'image/jpeg' && istJPEG) ||
    (datei.type === 'image/png' && istPNG) ||
    (datei.type === 'image/webp' && istWebP);

  if (!bildtypGueltig) {
    return json(
      {
        fehler:
          'Die Datei ist kein gültiges Bildformat.'
      },
      { status: 400 }
    );
  }

  // ========================================
  // 5. Upload zu Cloudinary
  // ========================================

  let hochgeladenesBild:
    | {
        secure_url: string;
        public_id: string;
      }
    | undefined;

  try {
    hochgeladenesBild = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder:
              `clubmatiq/${benutzer.vereinId}/schadensmeldungen`,
            resource_type: 'image',
            overwrite: false
          },
          (fehler, ergebnis) => {
            if (fehler) {
              reject(fehler);
              return;
            }

            if (!ergebnis) {
              reject(
                new Error(
                  'Cloudinary hat kein Ergebnis zurückgegeben.'
                )
              );
              return;
            }

            resolve({
              secure_url: ergebnis.secure_url,
              public_id: ergebnis.public_id
            });
          }
        );

      uploadStream.end(dateipuffer);
    });

    // ========================================
    // 6. Upload in MongoDB registrieren
    // ========================================

    await db.collection('bildUploads').insertOne({
      vereinId: benutzer.vereinId,
      benutzerId: benutzer.id,

      publicId: hochgeladenesBild.public_id,
      url: hochgeladenesBild.secure_url,

      verwendung: 'schadensmeldung',
      status: 'hochgeladen',

      meldungId: null,

      erstelltAm: new Date()
    });

    // ========================================
    // 7. Bildreferenz zurückgeben
    // ========================================

    return json(
      {
        erfolg: true,
        foto: {
          url: hochgeladenesBild.secure_url,
          publicId: hochgeladenesBild.public_id
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Cloudinary-Upload:', error);

    // Falls das Bild bereits hochgeladen wurde,
    // aber die MongoDB-Speicherung fehlschlägt,
    // versuchen wir es wieder zu entfernen.

    if (hochgeladenesBild) {
      try {
        await cloudinary.uploader.destroy(
          hochgeladenesBild.public_id,
          { resource_type: 'image' }
        );
      } catch (loeschFehler) {
        console.error(
          'Cloudinary-Bild konnte nicht bereinigt werden:',
          loeschFehler
        );
      }
    }

    return json(
      {
        fehler:
          'Das Foto konnte nicht hochgeladen werden.'
      },
      { status: 500 }
    );
  }
};
