
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

type Variante = {
  groesseId: string;
  menge: number;
  einzelwert: number;
};

// ========================================
// GET: Einzelnen Inventarartikel laden
// ========================================

export const GET: RequestHandler = async ({ params }) => {
  try {
    const artikelId = params.id;

    if (!ObjectId.isValid(artikelId)) {
      return json(
        { fehler: 'Ungültige Artikel-ID.' },
        { status: 400 }
      );
    }

    const artikel = await db.collection('artikel').findOne({
      _id: new ObjectId(artikelId)
    });

    if (!artikel) {
      return json(
        { fehler: 'Inventarartikel nicht gefunden.' },
        { status: 404 }
      );
    }

    const varianten = artikel.hatGroessen
      ? await db.collection('artikelvarianten')
          .find({ artikelId })
          .toArray()
      : [];

    return json({
      ...artikel,
      _id: artikel._id.toString(),
      varianten: varianten.map((variante) => ({
        _id: variante._id.toString(),
        artikelId: variante.artikelId,
        groesseId: variante.groesseId,
        menge: variante.menge,
        einzelwert: variante.einzelwert ?? 0
      }))
    });
  } catch (error) {
    console.error('Fehler beim Laden:', error);

    return json(
      { fehler: 'Artikel konnte nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// ========================================
// PATCH: Inventarartikel bearbeiten
// ========================================

export const PATCH: RequestHandler = async ({ params, request }) => {
  const artikelId = params.id;

  if (!ObjectId.isValid(artikelId)) {
    return json(
      { fehler: 'Ungültige Artikel-ID.' },
      { status: 400 }
    );
  }

  const daten = await request.json().catch(() => null);

  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json(
      { fehler: 'Ungültige Artikeldaten.' },
      { status: 400 }
    );
  }

  const {
    name,
    kategorieId,
    lagerortId,
    menge,
    einzelwert,
    beschreibung,
    hatGroessen,
    varianten
  } = daten;

  // Allgemeine Angaben prüfen
  if (typeof name !== 'string' || !name.trim()) {
    return json(
      { fehler: 'Bitte eine Artikelbezeichnung eingeben.' },
      { status: 400 }
    );
  }

  if (
    typeof kategorieId !== 'string' ||
    typeof lagerortId !== 'string' ||
    !ObjectId.isValid(kategorieId) ||
    !ObjectId.isValid(lagerortId)
  ) {
    return json(
      { fehler: 'Ungültige Kategorie oder Lagerort.' },
      { status: 400 }
    );
  }

  if (
    typeof einzelwert !== 'number' ||
    !Number.isFinite(einzelwert) ||
    einzelwert < 0
  ) {
    return json(
      { fehler: 'Ungültiger Einzelwert.' },
      { status: 400 }
    );
  }

  if (
    typeof hatGroessen !== 'boolean' ||
    (beschreibung !== undefined &&
      typeof beschreibung !== 'string')
  ) {
    return json(
      { fehler: 'Ungültige Artikelangaben.' },
      { status: 400 }
    );
  }

  let gesamtmenge = 0;
  let gepruefteVarianten: Variante[] = [];

  if (hatGroessen) {
    if (!Array.isArray(varianten) || varianten.length === 0) {
      return json(
        { fehler: 'Bitte Grössenvarianten angeben.' },
        { status: 400 }
      );
    }

    for (const variante of varianten) {
      if (
        !variante ||
        typeof variante.groesseId !== 'string' ||
        !ObjectId.isValid(variante.groesseId) ||
        typeof variante.menge !== 'number' ||
        !Number.isInteger(variante.menge) ||
        variante.menge < 0 ||
        typeof variante.einzelwert !== 'number' ||
        !Number.isFinite(variante.einzelwert) ||
        variante.einzelwert < 0
      ) {
        return json(
          { fehler: 'Ungültige Grössenbestände oder Einzelwerte.' },
          { status: 400 }
        );
      }
    }

    gepruefteVarianten = varianten as Variante[];

    const ids = gepruefteVarianten.map((v) => v.groesseId);

    if (new Set(ids).size !== ids.length) {
      return json(
        { fehler: 'Eine Grösse wurde mehrfach angegeben.' },
        { status: 400 }
      );
    }

    gesamtmenge = gepruefteVarianten.reduce(
      (summe, v) => summe + v.menge,
      0
    );
  } else {
    if (
      typeof menge !== 'number' ||
      !Number.isInteger(menge) ||
      menge < 0
    ) {
      return json(
        { fehler: 'Ungültige Menge.' },
        { status: 400 }
      );
    }

    gesamtmenge = menge;
  }

  try {
    const objektId = new ObjectId(artikelId);

    const bestehenderArtikel = await db
      .collection('artikel')
      .findOne({ _id: objektId });

    if (!bestehenderArtikel) {
      return json(
        { fehler: 'Artikel nicht gefunden.' },
        { status: 404 }
      );
    }

    // Wechsel zwischen Artikel mit/ohne Grössen
    // vorerst nicht erlauben
    if (bestehenderArtikel.hatGroessen !== hatGroessen) {
      return json(
        {
          fehler:
            'Der Grössentyp eines bestehenden Artikels kann nicht geändert werden.'
        },
        { status: 400 }
      );
    }

    // Kategorie und Lagerort überprüfen
    const [kategorie, lagerort] = await Promise.all([
      db.collection('kategorien').findOne({
        _id: new ObjectId(kategorieId)
      }),
      db.collection('lagerorte').findOne({
        _id: new ObjectId(lagerortId)
      })
    ]);

    if (!kategorie || !lagerort) {
      return json(
        { fehler: 'Kategorie oder Lagerort existiert nicht.' },
        { status: 400 }
      );
    }

    // Grössen überprüfen
    if (hatGroessen) {
      const groessenIds = gepruefteVarianten.map(
        (v) => new ObjectId(v.groesseId)
      );

      const anzahlGroessen = await db
        .collection('groessen')
        .countDocuments({
          _id: { $in: groessenIds }
        });

      if (anzahlGroessen !== groessenIds.length) {
        return json(
          { fehler: 'Mindestens eine Grösse existiert nicht.' },
          { status: 400 }
        );
      }
    }

    // Hauptartikel aktualisieren
    await db.collection('artikel').updateOne(
      { _id: objektId },
      {
        $set: {
          name: name.trim(),
          kategorieId,
          lagerortId,
          menge: gesamtmenge,
          einzelwert: hatGroessen ? 0 : einzelwert,
          beschreibung: (beschreibung ?? '').trim(),
          aktualisiertAm: new Date()
        }
      }
    );

    // Grössenvarianten aktualisieren
    if (hatGroessen) {
      for (const variante of gepruefteVarianten) {
        await db.collection('artikelvarianten').updateOne(
          {
            artikelId,
            groesseId: variante.groesseId
          },
          {
            $set: {
              menge: variante.menge,
              einzelwert: variante.einzelwert
            },
            $setOnInsert: {
              artikelId,
              groesseId: variante.groesseId
            }
          },
          { upsert: true }
        );
      }
    }

    return json({
      erfolg: true,
      artikelId,
      gesamtmenge
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);

    return json(
      { fehler: 'Artikel konnte nicht aktualisiert werden.' },
      { status: 500 }
    );
  }
};


// ========================================
// DELETE: Inventarartikel löschen
// ========================================

export const DELETE: RequestHandler = async ({ params }) => {
  const artikelId = params.id;

  // Artikel-ID überprüfen
  if (!ObjectId.isValid(artikelId)) {
    return json(
      { fehler: 'Ungültige Artikel-ID.' },
      { status: 400 }
    );
  }

  try {
    const objektId = new ObjectId(artikelId);

    // Prüfen, ob der Artikel existiert
    const artikel = await db.collection('artikel').findOne({
      _id: objektId
    });

    if (!artikel) {
      return json(
        { fehler: 'Inventarartikel nicht gefunden.' },
        { status: 404 }
      );
    }

    // Prüfen, ob der Artikel bereits verwendet wird
    const [ausleihe, meldung] = await Promise.all([
      db.collection('ausleihen').findOne({ artikelId }),
      db.collection('meldungen').findOne({ artikelId })
    ]);

    if (ausleihe || meldung) {
      return json(
        {
          fehler:
            'Dieser Artikel kann nicht gelöscht werden, weil bereits Ausleihen oder Schadensmeldungen vorhanden sind.'
        },
        { status: 409 }
      );
    }

    // Artikel und Grössenvarianten gemeinsam löschen
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        await db.collection('artikelvarianten').deleteMany(
          { artikelId },
          { session }
        );

        const ergebnis = await db.collection('artikel').deleteOne(
          { _id: objektId },
          { session }
        );

        if (ergebnis.deletedCount !== 1) {
          throw new Error('Artikel konnte nicht gelöscht werden.');
        }
      });
    } finally {
      await session.endSession();
    }

    return json({
      erfolg: true,
      meldung: 'Inventarartikel wurde gelöscht.'
    });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);

    return json(
      { fehler: 'Inventarartikel konnte nicht gelöscht werden.' },
      { status: 500 }
    );
  }
};
