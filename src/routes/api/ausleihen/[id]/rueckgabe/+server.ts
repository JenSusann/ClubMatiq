
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// POST: Materialrückgabe erfassen
// ========================================

export const POST: RequestHandler = async ({
  params,
  request,
  locals
}) => {
  // Anmeldung überprüfen
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const vereinId = locals.benutzer.vereinId;
  const ausleiheId = params.id;

  if (!ausleiheId || !ObjectId.isValid(ausleiheId)) {
    return json(
      { fehler: 'Ungültige Ausleihe-ID.' },
      { status: 400 }
    );
  }

  // Rückgabemenge prüfen
  const daten = await request.json().catch(() => null);
  const menge = daten?.menge;

  if (
    typeof menge !== 'number' ||
    !Number.isInteger(menge) ||
    menge <= 0
  ) {
    return json(
      {
        fehler: 'Bitte eine gültige Rückgabemenge angeben.'
      },
      { status: 400 }
    );
  }

  const session = client.startSession();

  try {
    let rueckgabeErgebnis = {
      erfolg: false,
      status: '',
      zurueckgegeben: 0,
      offen: 0
    };

    await session.withTransaction(async () => {
      const ausleihenCollection = db.collection<{
        _id: ObjectId;
        vereinId: string;
        artikelId: string;
        groesseId: string | null;
        person: string;
        menge: number;
        ausleihdatum: string;
        rueckgabedatum: string;
        bemerkung: string;
        status: string;
        zurueckgegeben: number;
        rueckgaben?: {
          menge: number;
          datum: Date;
        }[];
        letzteRueckgabeAm?: Date;
        abgeschlossenAm?: Date;
      }>('ausleihen');

      // ========================================
      // Ausleihe des eigenen Vereins laden
      // ========================================

      const ausleihe = await ausleihenCollection.findOne(
        {
          _id: new ObjectId(ausleiheId),
          vereinId
        },
        { session }
      );

      if (!ausleihe) {
        throw new Error(
          'Ausleihe wurde nicht gefunden.'
        );
      }

      const bereitsZurueckgegeben =
        ausleihe.zurueckgegeben ?? 0;

      const nochOffen =
        ausleihe.menge - bereitsZurueckgegeben;

      if (
        ausleihe.status === 'abgeschlossen' ||
        nochOffen <= 0
      ) {
        throw new Error(
          'Diese Ausleihe ist bereits abgeschlossen.'
        );
      }

      if (menge > nochOffen) {
        throw new Error(
          `Es können maximal ${nochOffen} Stück zurückgegeben werden.`
        );
      }

      const neuerRueckgabestand =
        bereitsZurueckgegeben + menge;

      const neuerStatus =
        neuerRueckgabestand === ausleihe.menge
          ? 'abgeschlossen'
          : 'teilweise';

      const jetzt = new Date();

      // ========================================
      // Ausleihe aktualisieren
      // ========================================

      // Die Bedingungen verhindern doppelte
      // Rückbuchungen bei gleichzeitigen Anfragen.
      const aktualisierung =
        await ausleihenCollection.updateOne(
          {
            _id: new ObjectId(ausleiheId),
            vereinId,
            zurueckgegeben: bereitsZurueckgegeben,
            status: ausleihe.status
          },
          {
            $set: {
              zurueckgegeben: neuerRueckgabestand,
              status: neuerStatus,
              letzteRueckgabeAm: jetzt,
              ...(neuerStatus === 'abgeschlossen'
                ? { abgeschlossenAm: jetzt }
                : {})
            },
            $push: {
              rueckgaben: {
                menge,
                datum: jetzt
              }
            }
          },
          { session }
        );

      if (aktualisierung.modifiedCount !== 1) {
        throw new Error(
          'Die Ausleihe wurde zwischenzeitlich verändert. Bitte erneut versuchen.'
        );
      }

      // ========================================
      // Lagerbestand des Vereins erhöhen
      // ========================================

      if (ausleihe.groesseId) {
        // Bestand der Grössenvariante erhöhen
        const variante = await db
          .collection('artikelvarianten')
          .updateOne(
            {
              artikelId: ausleihe.artikelId,
              groesseId: ausleihe.groesseId,
              vereinId
            },
            {
              $inc: { menge }
            },
            { session }
          );

        if (variante.modifiedCount !== 1) {
          throw new Error(
            'Artikelgrösse wurde nicht gefunden.'
          );
        }

        // Gesamtbestand des Artikels erhöhen
        const artikel = await db
          .collection('artikel')
          .updateOne(
            {
              _id: new ObjectId(ausleihe.artikelId),
              vereinId
            },
            {
              $inc: { menge }
            },
            { session }
          );

        if (artikel.modifiedCount !== 1) {
          throw new Error(
            'Artikel wurde nicht gefunden.'
          );
        }
      } else {
        // Artikel ohne Grössen
        const artikel = await db
          .collection('artikel')
          .updateOne(
            {
              _id: new ObjectId(ausleihe.artikelId),
              vereinId
            },
            {
              $inc: { menge }
            },
            { session }
          );

        if (artikel.modifiedCount !== 1) {
          throw new Error(
            'Artikel wurde nicht gefunden.'
          );
        }
      }

      // ========================================
      // Ergebnis zurückgeben
      // ========================================

      rueckgabeErgebnis = {
        erfolg: true,
        status: neuerStatus,
        zurueckgegeben: neuerRueckgabestand,
        offen: ausleihe.menge - neuerRueckgabestand
      };
    });

    return json(rueckgabeErgebnis);
  } catch (error) {
    console.error('Materialrückgabe:', error);

    return json(
      {
        fehler:
          error instanceof Error
            ? error.message
            : 'Materialrückgabe konnte nicht gespeichert werden.'
      },
      { status: 400 }
    );
  } finally {
    await session.endSession();
  }
};
