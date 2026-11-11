
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Preistyp = 'fix' | 'variabel';

type PreisEingabe = {
  artikelId?: unknown;
  groesseId?: unknown;
  preistyp?: unknown;
  druckkosten?: unknown;
  verkaufspreis?: unknown;
};

function gueltigerBetrag(wert: unknown): wert is number {
  return (
    typeof wert === 'number' &&
    Number.isFinite(wert) &&
    wert >= 0 &&
    Math.abs(Math.round(wert * 100) - wert * 100) < 0.000001
  );
}

// ========================================
// Eindeutigen Preisindex sicherstellen
// ========================================

async function preisCollectionVorbereiten() {
  const collection = db.collection('vereinskleider_preise');

  await collection.createIndex(
    {
      vereinId: 1,
      artikelId: 1,
      groesseId: 1
    },
    {
      unique: true,
      name: 'unique_vereinskleider_preis'
    }
  );

  return collection;
}

// ========================================
// GET: Vereinskleiderpreise laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventar:lesen'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  try {
    const collection = await preisCollectionVorbereiten();

    const preise = await collection
      .find({ vereinId })
      .toArray();

    return json(
      preise.map((preis) => ({
        _id: preis._id.toString(),
        artikelId: preis.artikelId,
        groesseId: preis.groesseId ?? null,
        preistyp: preis.preistyp,
        druckkosten: preis.druckkosten,
        verkaufspreis: preis.verkaufspreis ?? null
      }))
    );
  } catch (error) {
    console.error(
      'Fehler beim Laden der Vereinskleiderpreise:',
      error
    );

    return json(
      { fehler: 'Preise konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// ========================================
// PUT: Preis erstellen oder aktualisieren
// ========================================

export const PUT: RequestHandler = async ({
  request,
  locals
}) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventar:bearbeiten'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  const daten = (await request.json().catch(() => null)) as
    | PreisEingabe
    | null;

  if (
    !daten ||
    typeof daten !== 'object' ||
    Array.isArray(daten)
  ) {
    return json(
      { fehler: 'Ungültige Preisdaten.' },
      { status: 400 }
    );
  }

  const {
    artikelId,
    groesseId = null,
    preistyp,
    druckkosten,
    verkaufspreis
  } = daten;

  if (
    typeof artikelId !== 'string' ||
    !ObjectId.isValid(artikelId)
  ) {
    return json(
      { fehler: 'Ungültige Artikel-ID.' },
      { status: 400 }
    );
  }

  if (
    groesseId !== null &&
    (typeof groesseId !== 'string' ||
      !ObjectId.isValid(groesseId))
  ) {
    return json(
      { fehler: 'Ungültige Grössen-ID.' },
      { status: 400 }
    );
  }

  if (preistyp !== 'fix' && preistyp !== 'variabel') {
    return json(
      { fehler: 'Ungültiger Preistyp.' },
      { status: 400 }
    );
  }

  if (!gueltigerBetrag(druckkosten)) {
    return json(
      { fehler: 'Ungültige Druckkosten.' },
      { status: 400 }
    );
  }

  if (
    verkaufspreis !== null &&
    !gueltigerBetrag(verkaufspreis)
  ) {
    return json(
      { fehler: 'Ungültiger Verkaufspreis.' },
      { status: 400 }
    );
  }

  if (preistyp === 'fix' && verkaufspreis === null) {
    return json(
      {
        fehler:
          'Bei einem Fixpreis muss ein Verkaufspreis angegeben werden.'
      },
      { status: 400 }
    );
  }

  try {
    const artikel = await db.collection('artikel').findOne({
      _id: new ObjectId(artikelId),
      vereinId
    });

    if (!artikel) {
      return json(
        { fehler: 'Artikel nicht gefunden.' },
        { status: 404 }
      );
    }

    const kategorie = await db
      .collection('kategorien')
      .findOne({
        _id: new ObjectId(artikel.kategorieId),
        vereinId
      });

    if (
      !kategorie ||
      kategorie.name.trim().toLowerCase() !==
        'vereinskleider'
    ) {
      return json(
        {
          fehler:
            'Der Artikel gehört nicht zur Kategorie Vereinskleider.'
        },
        { status: 400 }
      );
    }

    // ========================================
    // Preiszuordnung überprüfen
    // ========================================

    if (artikel.hatGroessen && groesseId === null) {
      return json(
        {
          fehler:
            'Für Artikel mit Grössen muss eine Grössenvariante ausgewählt werden.'
        },
        { status: 400 }
      );
    }

    if (!artikel.hatGroessen && groesseId !== null) {
      return json(
        {
          fehler:
            'Dieser Artikel besitzt keine Grössenvarianten.'
        },
        { status: 400 }
      );
    }

    if (groesseId !== null) {
      const variante = await db
        .collection('artikelvarianten')
        .findOne({
          artikelId,
          groesseId,
          vereinId
        });

      if (!variante) {
        return json(
          {
            fehler:
              'Die ausgewählte Grössenvariante existiert nicht.'
          },
          { status: 404 }
        );
      }
    }

    const collection = await preisCollectionVorbereiten();

    const jetzt = new Date();

    await collection.updateOne(
      {
        vereinId,
        artikelId,
        groesseId
      },
      {
        $set: {
          preistyp,
          druckkosten,
          verkaufspreis,
          aktualisiertAm: jetzt
        },
        $setOnInsert: {
          vereinId,
          artikelId,
          groesseId,
          erstelltAm: jetzt
        }
      },
      { upsert: true }
    );

    return json({
      erfolg: true,
      meldung: 'Vereinskleiderpreis gespeichert.'
    });
  } catch (error) {
    console.error(
      'Fehler beim Speichern des Vereinskleiderpreises:',
      error
    );

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return json(
        {
          fehler:
            'Ein Preiseintrag existiert bereits oder doppelte Preise verhindern die Indexerstellung.'
        },
        { status: 409 }
      );
    }

    return json(
      {
        fehler: 'Preis konnte nicht gespeichert werden.'
      },
      { status: 500 }
    );
  }
};
