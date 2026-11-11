import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

// ========================================
// GET: Inventuren des Vereins laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventur:lesen'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  try {
    const inventuren = await db
      .collection('inventuren')
      .find({ vereinId })
      .sort({ erstelltAm: -1 })
      .toArray();

    return json(
      inventuren.map((inventur) => ({
        ...inventur,
        _id: inventur._id.toString()
      }))
    );
  } catch (error) {
    console.error('Fehler beim Laden der Inventuren:', error);

    return json(
      { fehler: 'Inventuren konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Neue Inventur erstellen
// ========================================

export const POST: RequestHandler = async ({ request, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(
    locals.benutzer,
    'inventur:erstellen'
  );

  if (berechtigungsfehler) {
    return berechtigungsfehler;
  }

  const vereinId = locals.benutzer!.vereinId;
  const daten: unknown = await request.json().catch(() => null);

  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Inventurdaten.' }, { status: 400 });
  }

  const eingabe = daten as Record<string, unknown>;
  const { name, typ, lagerortId } = eingabe;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 150
  ) {
    return json(
      { fehler: 'Bitte einen gültigen Inventurnamen eingeben.' },
      { status: 400 }
    );
  }

  if (typ !== 'gesamt' && typ !== 'lagerort') {
    return json({ fehler: 'Ungültiger Inventurtyp.' }, { status: 400 });
  }

  if (
    typ === 'lagerort' &&
    (typeof lagerortId !== 'string' || !ObjectId.isValid(lagerortId))
  ) {
    return json(
      { fehler: 'Bitte einen gültigen Lagerort auswählen.' },
      { status: 400 }
    );
  }

  try {
    let ausgewaehlterLagerortId: string | null = null;
    let lagerortName: string | null = null;

    // ========================================
    // Lagerort prüfen
    // ========================================

    if (typ === 'lagerort') {
      const lagerort = await db.collection('lagerorte').findOne({
        _id: new ObjectId(lagerortId as string),
        vereinId
      });

      if (!lagerort) {
        return json(
          { fehler: 'Der Lagerort existiert nicht in deinem Verein.' },
          { status: 404 }
        );
      }

      ausgewaehlterLagerortId = lagerort._id.toString();
      lagerortName = lagerort.name;
    }

    // ========================================
    // Inventarartikel laden
    // ========================================

    const artikelFilter: {
      vereinId: typeof vereinId;
      lagerortId?: string;
    } = { vereinId };

    if (ausgewaehlterLagerortId) {
      artikelFilter.lagerortId = ausgewaehlterLagerortId;
    }

    const artikel = await db
      .collection('artikel')
      .find(artikelFilter)
      .sort({ name: 1 })
      .toArray();

    if (artikel.length === 0) {
      return json(
        { fehler: 'Für diese Inventur sind keine Inventarartikel vorhanden.' },
        { status: 400 }
      );
    }

    // ========================================
    // Nur aktive Grössenvarianten laden
    // ========================================

    const artikelIdsMitGroessen = artikel
      .filter((eintrag) => eintrag.hatGroessen)
      .map((eintrag) => eintrag._id.toString());

    const varianten = artikelIdsMitGroessen.length
      ? await db
          .collection('artikelvarianten')
          .find({
            vereinId,
            artikelId: { $in: artikelIdsMitGroessen },
            // Alte Datensätze ohne aktiv-Feld gelten als aktiv.
            aktiv: { $ne: false }
          })
          .toArray()
      : [];

    // ========================================
    // Soll-Bestände als Momentaufnahme
    // ========================================

    const positionen = artikel.flatMap((eintrag) => {
      const artikelId = eintrag._id.toString();

      if (eintrag.hatGroessen) {
        return varianten
          .filter((variante) => variante.artikelId === artikelId)
          .map((variante) => ({
            artikelId,
            artikelName: eintrag.name,
            lagerortId: eintrag.lagerortId,
            groesseId: variante.groesseId,
            sollBestand: variante.menge,
            istBestand: null as number | null,
            einzelwert: variante.einzelwert ?? 0,
            bemerkung: '',
            kontrolliertAm: null as Date | null
          }));
      }

      return [
        {
          artikelId,
          artikelName: eintrag.name,
          lagerortId: eintrag.lagerortId,
          groesseId: null,
          sollBestand: eintrag.menge,
          istBestand: null as number | null,
          einzelwert: eintrag.einzelwert ?? 0,
          bemerkung: '',
          kontrolliertAm: null as Date | null
        }
      ];
    });

    if (positionen.length === 0) {
      return json(
        { fehler: 'Es konnten keine Inventurpositionen erstellt werden.' },
        { status: 400 }
      );
    }

    // Ein Artikel zählt nur, wenn er mindestens eine Inventurposition hat.
    const anzahlArtikel = new Set(
      positionen.map((position) => position.artikelId)
    ).size;

    // ========================================
    // Inventur vorbereiten
    // ========================================

    const inventurId = new ObjectId();
    const erstelltAm = new Date();

    const inventur = {
      _id: inventurId,
      vereinId,
      name: name.trim(),
      typ,
      lagerortId: ausgewaehlterLagerortId,
      lagerortName,
      status: 'offen',
      anzahlArtikel,
      anzahlPositionen: positionen.length,
      erstelltAm,
      erstelltVon: locals.benutzer!.id
    };

    // ========================================
    // Inventur und Positionen speichern
    // ========================================

    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        await db.collection('inventuren').insertOne(inventur, { session });

        await db.collection('inventurpositionen').insertMany(
          positionen.map((position) => ({
            ...position,
            inventurId: inventurId.toString(),
            vereinId
          })),
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return json(
      {
        erfolg: true,
        inventurId: inventurId.toString(),
        anzahlArtikel,
        anzahlPositionen: positionen.length
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Erstellen der Inventur:', error);

    return json(
      { fehler: 'Inventur konnte nicht erstellt werden.' },
      { status: 500 }
    );
  }
};
