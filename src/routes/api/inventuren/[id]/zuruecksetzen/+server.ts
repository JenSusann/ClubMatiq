
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// POST: Offene Inventur zurücksetzen
// ========================================

export const POST: RequestHandler = async ({
  params,
  locals
}) => {
  // Nur Admin und Materialverantwortliche
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventur:abschliessen'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;
  const inventurId = params.id;

  if (!ObjectId.isValid(inventurId)) {
    return json(
      { fehler: 'Ungültige Inventur-ID.' },
      { status: 400 }
    );
  }

  const session = client.startSession();

  try {
    const ergebnis = {
      anzahlZurueckgesetzt: 0
    };

    await session.withTransaction(async () => {
      const inventuren = db.collection('inventuren');
      const positionen = db.collection('inventurpositionen');

      // ========================================
      // Inventur prüfen
      // ========================================

      const inventur = await inventuren.findOne(
        {
          _id: new ObjectId(inventurId),
          vereinId
        },
        { session }
      );

      if (!inventur) {
        throw new Error('Inventur nicht gefunden.');
      }

      if (inventur.status !== 'offen') {
        throw new Error(
          'Nur offene Inventuren können zurückgesetzt werden.'
        );
      }

      const jetzt = new Date();

      // ========================================
      // Inventur sperren und Version erhöhen
      // ========================================
      // Derselbe Inventurdatensatz wird auch
      // beim Speichern von Zählungen verändert.
      // Dadurch werden parallele Änderungen
      // innerhalb der Transaktion erkannt.

      const sperre = await inventuren.updateOne(
        {
          _id: new ObjectId(inventurId),
          vereinId,
          status: 'offen'
        },
        {
          $inc: {
            version: 1,
            anzahlZuruecksetzungen: 1
          },
          $set: {
            zuletztBearbeitetAm: jetzt,
            letzteZuruecksetzungAm: jetzt,
            letzteZuruecksetzungVon: locals.benutzer!.id
          }
        },
        { session }
      );

      if (sperre.modifiedCount !== 1) {
        throw new Error(
          'Die Inventur wurde zwischenzeitlich verändert.'
        );
      }

      // ========================================
      // Alle Zählungen zurücksetzen
      // ========================================

      const aktualisierung = await positionen.updateMany(
        {
          inventurId,
          vereinId
        },
        {
          $set: {
            istBestand: null,
            bemerkung: '',
            kontrolliertAm: null,
            kontrolliertVon: null
          }
        },
        { session }
      );

      ergebnis.anzahlZurueckgesetzt =
        aktualisierung.matchedCount;

      // ========================================
      // Vorgang protokollieren
      // ========================================

      await db.collection('inventurprotokoll').insertOne(
        {
          vereinId,
          inventurId,
          aktion: 'zurueckgesetzt',
          ausgefuehrtAm: jetzt,
          ausgefuehrtVon: locals.benutzer!.id,
          anzahlPositionen:
            aktualisierung.matchedCount,
          versionVorher: inventur.version ?? 0,
          versionNachher: (inventur.version ?? 0) + 1
        },
        { session }
      );
    });

    return json({
      erfolg: true,
      meldung:
        'Die Inventurzählung wurde erfolgreich zurückgesetzt.',
      anzahlZurueckgesetzt:
        ergebnis.anzahlZurueckgesetzt
    });
  } catch (error) {
    console.error('Inventur zurücksetzen:', error);

    return json(
      {
        fehler:
          error instanceof Error
            ? error.message
            : 'Inventur konnte nicht zurückgesetzt werden.'
      },
      { status: 409 }
    );
  } finally {
    await session.endSession();
  }
};
