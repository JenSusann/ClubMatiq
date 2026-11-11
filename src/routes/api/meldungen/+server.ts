
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

type Schadensstatus =
  | 'offen'
  | 'in_bearbeitung'
  | 'erledigt';

type Schadensfoto = {
  url: string;
  publicId: string;
};

// ========================================
// GET: Schadensmeldungen laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  const benutzer = locals.benutzer;

  if (!benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const darfAlleSehen =
    benutzer.rolle === 'admin' ||
    benutzer.rolle === 'materialverantwortlich';

  const filter = darfAlleSehen
    ? { vereinId: benutzer.vereinId }
    : {
        vereinId: benutzer.vereinId,
        gemeldetVonId: benutzer.id
      };

  try {
    const meldungen = await db
      .collection('schadensmeldungen')
      .find(filter)
      .sort({ erstelltAm: -1 })
      .toArray();

    return json(
      meldungen.map((meldung) => ({
        ...meldung,
        _id: meldung._id.toString()
      }))
    );
  } catch (error) {
    console.error('Schadensmeldungen laden:', error);

    return json(
      {
        fehler:
          'Schadensmeldungen konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Neue Schadensmeldung erfassen
// ========================================

export const POST: RequestHandler = async ({
  request,
  locals
}) => {
  const benutzer = locals.benutzer;

  if (!benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const daten = await request.json().catch(() => null);

  if (
    !daten ||
    typeof daten !== 'object' ||
    Array.isArray(daten)
  ) {
    return json(
      { fehler: 'Ungültige Meldungsdaten.' },
      { status: 400 }
    );
  }

  const { artikelId, beschreibung, fotos = [] } = daten;

  // ========================================
  // 1. Artikel überprüfen
  // ========================================

  if (
    typeof artikelId !== 'string' ||
    !ObjectId.isValid(artikelId)
  ) {
    return json(
      { fehler: 'Bitte einen gültigen Artikel auswählen.' },
      { status: 400 }
    );
  }

  // ========================================
  // 2. Beschreibung überprüfen
  // ========================================

  if (
    typeof beschreibung !== 'string' ||
    !beschreibung.trim()
  ) {
    return json(
      { fehler: 'Bitte den Schaden beschreiben.' },
      { status: 400 }
    );
  }

  if (beschreibung.trim().length > 2000) {
    return json(
      {
        fehler:
          'Die Beschreibung darf maximal 2000 Zeichen enthalten.'
      },
      { status: 400 }
    );
  }

  // ========================================
  // 3. Fotos überprüfen
  // ========================================

  if (!Array.isArray(fotos) || fotos.length > 3) {
    return json(
      {
        fehler:
          'Es dürfen maximal 3 Fotos hochgeladen werden.'
      },
      { status: 400 }
    );
  }

  const gueltigeFotos: Schadensfoto[] = [];

  const erwarteterOrdner =
    `clubmatiq/${benutzer.vereinId}/schadensmeldungen/`;

  for (const foto of fotos) {
    if (
      !foto ||
      typeof foto !== 'object' ||
      Array.isArray(foto) ||
      typeof foto.url !== 'string' ||
      typeof foto.publicId !== 'string'
    ) {
      return json(
        { fehler: 'Ungültige Bildreferenz.' },
        { status: 400 }
      );
    }

    if (
      !foto.publicId.startsWith(erwarteterOrdner) ||
      !foto.url.startsWith(
        'https://res.cloudinary.com/'
      )
    ) {
      return json(
        {
          fehler:
            'Das Foto gehört nicht zum vorgesehenen Vereinsordner.'
        },
        { status: 400 }
      );
    }

    gueltigeFotos.push({
      url: foto.url,
      publicId: foto.publicId
    });
  }

  const publicIds = gueltigeFotos.map(
    (foto) => foto.publicId
  );

  if (new Set(publicIds).size !== publicIds.length) {
    return json(
      { fehler: 'Ein Foto wurde mehrfach angegeben.' },
      { status: 400 }
    );
  }

  // ========================================
  // 4. Artikel im eigenen Verein suchen
  // ========================================

  try {
    const artikel = await db
      .collection('artikel')
      .findOne({
        _id: new ObjectId(artikelId),
        vereinId: benutzer.vereinId
      });

    if (!artikel) {
      return json(
        {
          fehler:
            'Artikel nicht gefunden oder gehört nicht zu deinem Verein.'
        },
        { status: 404 }
      );
    }

    // ========================================
    // 5. MongoDB-Transaktion starten
    // ========================================

    const session = client.startSession();

    try {
      const meldungId = new ObjectId();

      await session.withTransaction(async () => {
        // Prüfen, ob alle Fotos registriert sind.
        // Die Registrierung enthält Benutzer,
        // Verein und den Upload-Status.

        if (gueltigeFotos.length > 0) {
          const uploads = await db
            .collection('bildUploads')
            .find(
              {
                publicId: { $in: publicIds },
                vereinId: benutzer.vereinId,
                benutzerId: benutzer.id,
                verwendung: 'schadensmeldung',
                status: 'hochgeladen',
                meldungId: null
              },
              { session }
            )
            .toArray();

          if (uploads.length !== gueltigeFotos.length) {
            throw new Error(
              'FOTO_NICHT_BERECHTIGT'
            );
          }

          // Auch die tatsächliche URL muss
          // mit dem registrierten Upload
          // übereinstimmen.

          for (const foto of gueltigeFotos) {
            const registrierung = uploads.find(
              (upload) =>
                upload.publicId === foto.publicId &&
                upload.url === foto.url
            );

            if (!registrierung) {
              throw new Error(
                'FOTO_NICHT_BERECHTIGT'
              );
            }
          }

          // Fotos reservieren.
          // So können sie nicht gleichzeitig
          // mit einer anderen Meldung
          // verknüpft werden.

          const reservierung = await db
            .collection('bildUploads')
            .updateMany(
              {
                publicId: { $in: publicIds },
                vereinId: benutzer.vereinId,
                benutzerId: benutzer.id,
                status: 'hochgeladen',
                meldungId: null
              },
              {
                $set: {
                  status: 'verwendet',
                  meldungId: meldungId.toString(),
                  aktualisiertAm: new Date()
                }
              },
              { session }
            );

          if (
            reservierung.modifiedCount !==
            gueltigeFotos.length
          ) {
            throw new Error(
              'FOTO_NICHT_BERECHTIGT'
            );
          }
        }

        // ========================================
        // 6. Schadensmeldung speichern
        // ========================================

        const status: Schadensstatus = 'offen';

        await db
          .collection('schadensmeldungen')
          .insertOne(
            {
              _id: meldungId,
              vereinId: benutzer.vereinId,
              artikelId,
              artikelName: artikel.name,
              beschreibung: beschreibung.trim(),

              fotos: gueltigeFotos,

              gemeldetVonId: benutzer.id,
              gemeldetVonName:
                `${benutzer.vorname} ${benutzer.nachname}`,

              status,
              bearbeitungsnotiz: '',
              erstelltAm: new Date(),
              aktualisiertAm: new Date()
            },
            { session }
          );
      });

      return json(
        {
          erfolg: true,
          meldungId: meldungId.toString(),
          meldung:
            'Schadensmeldung erfolgreich erfasst.'
        },
        { status: 201 }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'FOTO_NICHT_BERECHTIGT'
      ) {
        return json(
          {
            fehler:
              'Mindestens ein Foto ist nicht registriert, gehört nicht zu dir oder wurde bereits verwendet.'
          },
          { status: 400 }
        );
      }

      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Schadensmeldung erfassen:', error);

    return json(
      {
        fehler:
          'Schadensmeldung konnte nicht gespeichert werden.'
      },
      { status: 500 }
    );
  }
};
