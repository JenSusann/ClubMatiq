
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Preistyp = 'fix' | 'variabel';

type PreisEingabe = {
  artikelId?: unknown;
  groesseId?: unknown;
  preistyp?: unknown;
  druckkosten?: unknown;
  verkaufspreis?: unknown;
  preisOffen?: unknown;
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
        verkaufspreis: preis.verkaufspreis ?? null,
        preisOffen: preis.preisOffen === true || (preis.preistyp === 'variabel' && preis.verkaufspreis == null)
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
    verkaufspreis,
    preisOffen = false
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

  if (typeof preisOffen !== 'boolean') {
    return json({ fehler: 'Ungültige Preis-offen-Einstellung.' }, { status: 400 });
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

  if (preisOffen && verkaufspreis !== null) {
    return json({ fehler: 'Bei offenem Preis darf noch kein Verkaufspreis hinterlegt sein.' }, { status: 400 });
  }

  if (preistyp === 'fix' && verkaufspreis === null && !preisOffen) {
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

    if (artikel.istVereinskleidung !== true) {
      return json(
        {
          fehler:
            'Der Artikel ist nicht als Vereinskleidung gekennzeichnet.'
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
          preisOffen,
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

 // Gemeinsame Preiserfassung für alle aktiven Grössen.
export const POST: RequestHandler = async ({ request, locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'inventar:bearbeiten');
  if (fehler) return fehler;
  const vereinId = locals.benutzer!.vereinId;
  const d = await request.json().catch(() => null);
  if (!d || typeof d.artikelId !== 'string' || !ObjectId.isValid(d.artikelId) ||
      !['fix','variabel'].includes(d.preistyp) || !gueltigerBetrag(d.verkaufspreis) ||
      (d.druckkosten !== undefined && !gueltigerBetrag(d.druckkosten))) {
    return json({ fehler: 'Ungültige gemeinsame Preisdaten.' }, { status: 400 });
  }
  try {
    const collection = await preisCollectionVorbereiten();
    const session = client.startSession();
    try {
      return await session.withTransaction(async () => {
        const artikel = await db.collection('artikel').findOne({
          _id: new ObjectId(d.artikelId), vereinId, istVereinskleidung: true, hatGroessen: true, archiviert: { $ne: true }
        }, { session });
        if (!artikel) return json({ fehler: 'Kleiderartikel mit Grössen nicht gefunden.' }, { status: 404 });
        const varianten = await db.collection('artikelvarianten').find({
          artikelId: d.artikelId, vereinId, aktiv: { $ne: false }
        }, { session }).toArray();
        const ids = [...new Set(varianten.map(v => String(v.groesseId)))];
        if (!ids.length) return json({ fehler: 'Keine aktiven Grössen vorhanden.' }, { status: 409 });
        const jetzt = new Date();
        for (const groesseId of ids) {
          await collection.updateOne({ vereinId, artikelId: d.artikelId, groesseId }, {
            $set: { preistyp: d.preistyp, verkaufspreis: d.verkaufspreis, preisOffen: false, aktualisiertAm: jetzt,
              ...(d.druckkosten !== undefined ? { druckkosten: d.druckkosten } : {}) },
            $setOnInsert: { vereinId, artikelId: d.artikelId, groesseId, erstelltAm: jetzt,
              ...(d.druckkosten === undefined ? { druckkosten: 0 } : {}) }
          }, { upsert: true, session });
        }
        return json({ erfolg: true, anzahl: ids.length });
      });
    } finally { await session.endSession(); }
  } catch (error) {
    console.error('Gemeinsame Preiserfassung fehlgeschlagen:', error);
    return json({ fehler: 'Preise konnten nicht gemeinsam gespeichert werden.' }, { status: 500 });
  }
};
