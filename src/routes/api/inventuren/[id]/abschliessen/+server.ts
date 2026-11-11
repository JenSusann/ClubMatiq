import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventur:abschliessen'
  );

  if (berechtigungsfehler) return berechtigungsfehler;

  const vereinId = locals.benutzer!.vereinId;
  const inventurId = params.id;

  if (!ObjectId.isValid(inventurId)) {
    return json({ fehler: 'Ungültige Inventur-ID.' }, { status: 400 });
  }

  const session = client.startSession();

  try {
    let anzahlKorrekturen = 0;

    await session.withTransaction(async () => {
      const inventur = await db.collection('inventuren').findOne(
        { _id: new ObjectId(inventurId), vereinId },
        { session }
      );

      if (!inventur) throw new Error('Inventur nicht gefunden.');
      if (inventur.status !== 'offen') {
        throw new Error('Diese Inventur wurde bereits abgeschlossen.');
      }

      const positionen = await db.collection('inventurpositionen')
        .find({ inventurId, vereinId }, { session })
        .toArray();

      if (positionen.length === 0) {
        throw new Error('Diese Inventur enthält keine Positionen.');
      }

      const offenePositionen = positionen.filter(
        (position) => position.istBestand === null
      );
      if (offenePositionen.length > 0) {
        throw new Error(`Es sind noch ${offenePositionen.length} Positionen nicht gezählt.`);
      }

      // Vor dem Buchen alle Bestände mit dem Inventur-Snapshot vergleichen.
      // Auch eine nach Inventurbeginn deaktivierte Grösse ist ein Konflikt.
      for (const position of positionen) {
        if (!ObjectId.isValid(position.artikelId)) {
          throw new Error(`Ungültige Artikel-ID bei "${position.artikelName}".`);
        }

        const artikel = await db.collection('artikel').findOne(
          { _id: new ObjectId(position.artikelId), vereinId },
          { session }
        );
        if (!artikel) {
          throw new Error(`Artikel "${position.artikelName}" existiert nicht mehr.`);
        }

        if (position.groesseId) {
          if (!artikel.hatGroessen) {
            throw new Error(
              `Die Grössenverwaltung von "${position.artikelName}" wurde seit Inventurbeginn verändert. Bitte Inventur überprüfen.`
            );
          }

          const variante = await db.collection('artikelvarianten').findOne(
            {
              artikelId: position.artikelId,
              groesseId: position.groesseId,
              vereinId
            },
            { session }
          );
          if (!variante) {
            throw new Error(`Eine Grösse von "${position.artikelName}" existiert nicht mehr.`);
          }
          if (variante.aktiv === false) {
            throw new Error(
              `Eine Grösse von "${position.artikelName}" wurde seit Inventurbeginn deaktiviert. ` +
              'Bitte die Grössenverwaltung und Inventur überprüfen, bevor du abschliesst.'
            );
          }
          if (variante.menge !== position.sollBestand) {
            throw new Error(
              `Der Bestand von "${position.artikelName}" hat sich seit Inventurbeginn verändert. Bitte Inventur überprüfen.`
            );
          }
        } else {
          if (artikel.hatGroessen) {
            throw new Error(
              `Die Grössenverwaltung von "${position.artikelName}" wurde seit Inventurbeginn verändert. Bitte Inventur überprüfen.`
            );
          }
          if (artikel.menge !== position.sollBestand) {
            throw new Error(
              `Der Bestand von "${position.artikelName}" hat sich seit Inventurbeginn verändert. Bitte Inventur überprüfen.`
            );
          }
        }
      }

      // Nur Differenzen übernehmen. Die Bedingung aktiv != false wird
      // zusätzlich beim Schreiben geprüft, nicht nur beim vorherigen Lesen.
      for (const position of positionen) {
        const differenz = position.istBestand - position.sollBestand;
        if (differenz === 0) continue;

        if (position.groesseId) {
          const varianteAktualisierung = await db.collection('artikelvarianten').updateOne(
            {
              artikelId: position.artikelId,
              groesseId: position.groesseId,
              vereinId,
              aktiv: { $ne: false },
              menge: position.sollBestand
            },
            { $inc: { menge: differenz } },
            { session }
          );
          if (varianteAktualisierung.modifiedCount !== 1) {
            throw new Error(`Bestandskorrektur für "${position.artikelName}" fehlgeschlagen.`);
          }

          const artikelAktualisierung = await db.collection('artikel').updateOne(
            { _id: new ObjectId(position.artikelId), vereinId, hatGroessen: true },
            { $inc: { menge: differenz } },
            { session }
          );
          if (artikelAktualisierung.modifiedCount !== 1) {
            throw new Error(`Gesamtbestand von "${position.artikelName}" konnte nicht aktualisiert werden.`);
          }
        } else {
          const artikelAktualisierung = await db.collection('artikel').updateOne(
            {
              _id: new ObjectId(position.artikelId),
              vereinId,
              hatGroessen: { $ne: true },
              menge: position.sollBestand
            },
            { $set: { menge: position.istBestand } },
            { session }
          );
          if (artikelAktualisierung.modifiedCount !== 1) {
            throw new Error(`Bestandskorrektur für "${position.artikelName}" fehlgeschlagen.`);
          }
        }
        anzahlKorrekturen++;
      }

      const jetzt = new Date();
      const versionVorher = inventur.version ?? 0;
      const abschluss = await db.collection('inventuren').updateOne(
        {
          _id: new ObjectId(inventurId),
          vereinId,
          status: 'offen',
          ...(typeof inventur.version === 'number'
            ? { version: versionVorher }
            : { version: { $exists: false } })
        },
        {
          $set: {
            status: 'abgeschlossen',
            abgeschlossenAm: jetzt,
            abgeschlossenVon: locals.benutzer!.id,
            anzahlKorrekturen,
            zuletztBearbeitetAm: jetzt
          },
          $inc: { version: 1 }
        },
        { session }
      );
      if (abschluss.modifiedCount !== 1) {
        throw new Error('Inventur konnte nicht abgeschlossen werden.');
      }

      // Originalzählung unveränderlich protokollieren.
      await db.collection('inventurprotokoll').insertOne(
        {
          vereinId,
          inventurId,
          aktion: 'abgeschlossen',
          ausgefuehrtAm: jetzt,
          ausgefuehrtVon: locals.benutzer!.id,
          anzahlPositionen: positionen.length,
          anzahlKorrekturen,
          positionen: positionen.map((position) => ({
            positionId: position._id.toString(),
            artikelId: position.artikelId,
            artikelName: position.artikelName,
            groesseId: position.groesseId ?? null,
            sollBestand: position.sollBestand,
            istBestand: position.istBestand,
            differenz: position.istBestand - position.sollBestand
          })),
          versionVorher,
          versionNachher: versionVorher + 1
        },
        { session }
      );
    });

    return json({
      erfolg: true,
      meldung: 'Inventur erfolgreich abgeschlossen.',
      anzahlKorrekturen
    });
  } catch (error) {
    console.error('Inventur abschliessen:', error);
    return json(
      {
        fehler: error instanceof Error
          ? error.message
          : 'Inventur konnte nicht abgeschlossen werden.'
      },
      { status: 409 }
    );
  } finally {
    await session.endSession();
  }
};
