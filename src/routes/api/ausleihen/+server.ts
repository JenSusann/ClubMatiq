
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// GET: Materialausleihen des Vereins laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  // Berechtigung zum Anzeigen der Ausleihen prüfen
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'ausleihen:lesen'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  try {
    const ausleihen = await db
      .collection('ausleihen')
      .find({ vereinId })
      .sort({ erstelltAm: -1 })
      .toArray();

    return json(
      ausleihen.map((ausleihe) => ({
        ...ausleihe,
        _id: ausleihe._id.toString()
      }))
    );
  } catch (error) {
    console.error('Ausleihen laden:', error);

    return json(
      {
        fehler: 'Ausleihen konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Neue Materialausleihe erfassen
// ========================================

export const POST: RequestHandler = async ({
  request,
  locals
}) => {
  // Berechtigung zur Verwaltung der Ausleihen prüfen
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'ausleihen:verwalten'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  const daten = await request.json().catch(() => null);

  if (
    !daten ||
    typeof daten !== 'object' ||
    Array.isArray(daten)
  ) {
    return json(
      { fehler: 'Ungültige Ausleihdaten.' },
      { status: 400 }
    );
  }

  const {
    artikelId,
    groesseId,
    person,
    menge,
    ausleihdatum,
    rueckgabedatum,
    bemerkung
  } = daten;

  // ========================================
  // Eingaben überprüfen
  // ========================================

  if (
    typeof artikelId !== 'string' ||
    !ObjectId.isValid(artikelId)
  ) {
    return json(
      { fehler: 'Ungültiger Artikel.' },
      { status: 400 }
    );
  }

  if (
    typeof person !== 'string' ||
    !person.trim()
  ) {
    return json(
      {
        fehler: 'Bitte eine ausleihende Person angeben.'
      },
      { status: 400 }
    );
  }

  if (
    typeof menge !== 'number' ||
    !Number.isInteger(menge) ||
    menge <= 0
  ) {
    return json(
      {
        fehler:
          'Die Ausleihmenge muss grösser als 0 sein.'
      },
      { status: 400 }
    );
  }

  const istDatum = (wert: unknown): wert is string =>
    typeof wert === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(wert) &&
    !Number.isNaN(Date.parse(wert)) &&
    new Date(wert).toISOString().slice(0, 10) === wert;

  if (
    !istDatum(ausleihdatum) ||
    !istDatum(rueckgabedatum) ||
    rueckgabedatum < ausleihdatum
  ) {
    return json(
      {
        fehler:
          'Bitte gültige Ausleih- und Rückgabedaten angeben.'
      },
      { status: 400 }
    );
  }

  if (
    bemerkung !== undefined &&
    typeof bemerkung !== 'string'
  ) {
    return json(
      { fehler: 'Ungültige Bemerkung.' },
      { status: 400 }
    );
  }

  // ========================================
  // Ausleihe als Transaktion speichern
  // ========================================

  try {
    const session = client.startSession();

    try {
      let neueAusleiheId = '';

      await session.withTransaction(async () => {
        // Artikel muss zum Verein gehören
        const artikel = await db
          .collection('artikel')
          .findOne(
            {
              _id: new ObjectId(artikelId),
              vereinId
            },
            { session }
          );

        if (!artikel) {
          throw new Error(
            'Artikel nicht gefunden oder nicht verfügbar.'
          );
        }

        const hatGroessen =
          artikel.hatGroessen === true;

        // Grössenangaben überprüfen
        if (
          hatGroessen &&
          (
            typeof groesseId !== 'string' ||
            !ObjectId.isValid(groesseId)
          )
        ) {
          throw new Error(
            'Bitte eine gültige Grösse auswählen.'
          );
        }

        if (!hatGroessen && groesseId) {
          throw new Error(
            'Dieser Artikel hat keine Grössen.'
          );
        }

        // ========================================
        // Bestand des Vereins reduzieren
        // ========================================

        const bestandFilter = hatGroessen
          ? {
              artikelId,
              groesseId,
              vereinId
            }
          : {
              _id: new ObjectId(artikelId),
              vereinId
            };

        const bestandCollection = hatGroessen
          ? db.collection('artikelvarianten')
          : db.collection('artikel');

        const aktualisierung =
          await bestandCollection.updateOne(
            {
              ...bestandFilter,
              menge: { $gte: menge }
            },
            {
              $inc: { menge: -menge }
            },
            { session }
          );

        if (aktualisierung.modifiedCount !== 1) {
          throw new Error(
            'Nicht genügend Bestand für diese Ausleihe vorhanden.'
          );
        }

        // Gesamtbestand synchronisieren
        if (hatGroessen) {
          const gesamtAktualisierung = await db
            .collection('artikel')
            .updateOne(
              {
                _id: new ObjectId(artikelId),
                vereinId,
                menge: { $gte: menge }
              },
              {
                $inc: { menge: -menge }
              },
              { session }
            );

          if (
            gesamtAktualisierung.modifiedCount !== 1
          ) {
            throw new Error(
              'Gesamtbestand konnte nicht aktualisiert werden.'
            );
          }
        }

        // ========================================
        // Ausleihe mit Vereins-ID speichern
        // ========================================

        const ergebnis = await db
          .collection('ausleihen')
          .insertOne(
            {
              vereinId,
              artikelId,
              groesseId: hatGroessen
                ? groesseId
                : null,
              person: person.trim(),
              menge,
              ausleihdatum,
              rueckgabedatum,
              bemerkung: (bemerkung ?? '').trim(),
              status: 'offen',
              zurueckgegeben: 0,
              erstelltAm: new Date()
            },
            { session }
          );

        neueAusleiheId =
          ergebnis.insertedId.toString();
      });

      return json(
        {
          erfolg: true,
          ausleiheId: neueAusleiheId,
          meldung:
            'Materialausleihe erfolgreich erfasst.'
        },
        { status: 201 }
      );
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Ausleihe erfassen:', error);

    return json(
      {
        fehler:
          error instanceof Error
            ? error.message
            : 'Ausleihe konnte nicht gespeichert werden.'
      },
      { status: 400 }
    );
  }
};
