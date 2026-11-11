
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// GET: Inventur mit Positionen laden
// ========================================

export const GET: RequestHandler = async ({
  params,
  locals
}) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventur:lesen'
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

  try {
    const inventur = await db
      .collection('inventuren')
      .findOne({
        _id: new ObjectId(inventurId),
        vereinId
      });

    if (!inventur) {
      return json(
        { fehler: 'Inventur nicht gefunden.' },
        { status: 404 }
      );
    }

    const positionen = await db
      .collection('inventurpositionen')
      .find({
        inventurId,
        vereinId
      })
      .sort({
        artikelName: 1,
        groesseId: 1
      })
      .toArray();

    return json({
      inventur: {
        ...inventur,
        _id: inventur._id.toString(),
        version: inventur.version ?? 0
      },
      positionen: positionen.map((position) => ({
        ...position,
        _id: position._id.toString(),
        differenz:
          typeof position.istBestand === 'number'
            ? position.istBestand - position.sollBestand
            : null
      }))
    });
  } catch (error) {
    console.error(
      'Fehler beim Laden der Inventur:',
      error
    );

    return json(
      {
        fehler: 'Inventur konnte nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// PATCH: Inventurposition sicher speichern
// ========================================

export const PATCH: RequestHandler = async ({
  params,
  request,
  locals
}) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventur:zaehlen'
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

  const daten: unknown = await request
    .json()
    .catch(() => null);

  if (
    !daten ||
    typeof daten !== 'object' ||
    Array.isArray(daten)
  ) {
    return json(
      { fehler: 'Ungültige Eingabedaten.' },
      { status: 400 }
    );
  }

  const eingabe = daten as Record<string, unknown>;
  const { positionId, istBestand, bemerkung } = eingabe;

  if (
    typeof positionId !== 'string' ||
    !ObjectId.isValid(positionId)
  ) {
    return json(
      { fehler: 'Ungültige Inventurposition.' },
      { status: 400 }
    );
  }

  if (
    istBestand !== null &&
    (
      typeof istBestand !== 'number' ||
      !Number.isSafeInteger(istBestand) ||
      istBestand < 0
    )
  ) {
    return json(
      {
        fehler:
          'Der Ist-Bestand muss eine ganze Zahl ab 0 oder null sein.'
      },
      { status: 400 }
    );
  }

  if (
    bemerkung !== undefined &&
    (
      typeof bemerkung !== 'string' ||
      bemerkung.length > 1000
    )
  ) {
    return json(
      {
        fehler:
          'Die Bemerkung darf maximal 1000 Zeichen enthalten.'
      },
      { status: 400 }
    );
  }

  const session = client.startSession();

  try {
    type SpeicherErgebnis = {
      positionId: string;
      istBestand: number | null;
      differenz: number | null;
      bemerkung: string;
      version: number;
    };

    const ergebnisDaten: {
      wert: SpeicherErgebnis | null;
    } = {
      wert: null
    };

    await session.withTransaction(async () => {
      // ========================================
      // Inventur prüfen
      // ========================================

      const inventur = await db
        .collection('inventuren')
        .findOne(
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
          'Diese Inventur ist nicht mehr offen.'
        );
      }

      // ========================================
      // Inventurposition prüfen
      // ========================================

      const position = await db
        .collection('inventurpositionen')
        .findOne(
          {
            _id: new ObjectId(positionId),
            inventurId,
            vereinId
          },
          { session }
        );

      if (!position) {
        throw new Error(
          'Inventurposition nicht gefunden.'
        );
      }

      const aktualisierteBemerkung =
        bemerkung === undefined
          ? position.bemerkung ?? ''
          : bemerkung.trim();

      const jetzt = new Date();

      // ========================================
      // Gemeinsame Inventurversion erhöhen
      // ========================================

      const versionAktualisierung = await db
        .collection('inventuren')
        .updateOne(
          {
            _id: new ObjectId(inventurId),
            vereinId,
            status: 'offen'
          },
          {
            $inc: { version: 1 },
            $set: { zuletztBearbeitetAm: jetzt }
          },
          { session }
        );

      if (versionAktualisierung.modifiedCount !== 1) {
        throw new Error(
          'Die Inventur wurde zwischenzeitlich verändert.'
        );
      }

      // ========================================
      // Position speichern
      // ========================================

      const aktualisierung = await db
        .collection('inventurpositionen')
        .updateOne(
          {
            _id: new ObjectId(positionId),
            inventurId,
            vereinId
          },
          {
            $set: {
              istBestand,
              bemerkung: aktualisierteBemerkung,
              kontrolliertAm:
                istBestand === null ? null : jetzt,
              kontrolliertVon:
                istBestand === null
                  ? null
                  : locals.benutzer!.id
            }
          },
          { session }
        );

      if (aktualisierung.matchedCount !== 1) {
        throw new Error(
          'Inventurposition konnte nicht gespeichert werden.'
        );
      }

      ergebnisDaten.wert = {
        positionId,
        istBestand: istBestand as number | null,
        differenz:
          istBestand === null
            ? null
            : (istBestand as number) - position.sollBestand,
        bemerkung: aktualisierteBemerkung,
        version: (inventur.version ?? 0) + 1
      };
    });

    const gespeichert = ergebnisDaten.wert;

    if (!gespeichert) {
      throw new Error(
        'Inventurposition konnte nicht gespeichert werden.'
      );
    }

    return json({
      erfolg: true,
      ...gespeichert
    });
  } catch (error) {
    console.error(
      'Inventurposition speichern:',
      error
    );

    return json(
      {
        fehler:
          error instanceof Error
            ? error.message
            : 'Inventurposition konnte nicht gespeichert werden.'
      },
      { status: 409 }
    );
  } finally {
    await session.endSession();
  }
};
