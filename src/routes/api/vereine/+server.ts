
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import { erstelleAusstellerdaten, validiereVereinseinstellungen } from '../../../lib/server/vereinseinstellungen';
import type { RequestHandler } from './$types';

// ========================================
// GET: Eigenen Verein laden
// ========================================

export const GET: RequestHandler = async ({ locals }) => {
  // Anmeldung überprüfen
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  const vereinId = locals.benutzer.vereinId;

  if (!ObjectId.isValid(vereinId)) {
    return json(
      { fehler: 'Ungültige Vereins-ID.' },
      { status: 400 }
    );
  }

  try {
    // Nur den eigenen Verein aus MongoDB laden
    const verein = await db
      .collection('vereine')
      .findOne({
        _id: new ObjectId(vereinId)
      });

    if (!verein) {
      return json(
        { fehler: 'Verein nicht gefunden.' },
        { status: 404 }
      );
    }

    // Array beibehalten, damit bestehende
    // Frontend-Aufrufe kompatibel bleiben
    return json([
      {
        _id: verein._id.toString(),
        name: verein.name,
        kuerzel: verein.kuerzel ?? '',
        erstelltAm: verein.erstelltAm,
        adresse: {
          strasse: verein.adresse?.strasse ?? '',
          plz: verein.adresse?.plz ?? '',
          ort: verein.adresse?.ort ?? ''
        },
        kontakt: {
          email: verein.kontakt?.email ?? '',
          telefon: verein.kontakt?.telefon ?? '',
          website: verein.kontakt?.website ?? ''
        },
        logo: typeof verein.logo?.url === 'string'
          ? { url: verein.logo.url }
          : null
      }
    ]);
  } catch (error) {
    console.error('Verein laden:', error);

    return json(
      { fehler: 'Verein konnte nicht geladen werden.' },
      { status: 500 }
    );
  }
};

// ========================================
// POST: Vereinserstellung deaktiviert
// ========================================

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // Neue Vereine werden ausschliesslich
  // über die Registrierung angelegt.
  return json(
    {
      fehler:
        'Neue Vereine können nur über die Registrierung erstellt werden.'
    },
    { status: 403 }
  );
};

/** Speichert ausschliesslich freigegebene Profilfelder des eigenen Vereins. */
export const PATCH: RequestHandler = async ({ locals, request }) => {
  const zugriff = pruefeBerechtigung(locals.benutzer, 'verein:verwalten');
  if (zugriff) return zugriff;
  const vereinId = locals.benutzer!.vereinId;
  if (!ObjectId.isValid(vereinId)) return json({ fehler: 'Ungültige Vereins-ID.' }, { status: 400 });
  let eingabe: unknown;
  try { eingabe = await request.json(); }
  catch { return json({ fehler: 'Ungültige JSON-Daten.' }, { status: 400 }); }
  const ergebnis = validiereVereinseinstellungen(eingabe);
  if (!ergebnis.erfolg) return json({ fehler: ergebnis.fehler }, { status: 400 });
  try {
    const vereine = db.collection('vereine');
    const _id = new ObjectId(vereinId);
    const verein = await vereine.findOne({ _id });
    if (!verein) return json({ fehler: 'Verein nicht gefunden.' }, { status: 404 });
    // Compare-and-set verhindert, dass parallele Profiländerungen den
    // ursprünglichen Aussteller überschreiben.
    const update = await vereine.updateOne({
      _id,
      profilRevision: verein.profilRevision === undefined ? { $exists: false } : verein.profilRevision
    }, {
      $set: {
        ...ergebnis.daten,
        ausstellerVorErsterAenderung: verein.ausstellerVorErsterAenderung ?? erstelleAusstellerdaten(verein),
        profilAktualisiertAm: new Date(),
        profilAktualisiertVon: locals.benutzer!.id
      },
      $inc: { profilRevision: 1 }
    });
    if (update.matchedCount !== 1) return json({ fehler: 'Verein wurde zwischenzeitlich geändert. Bitte neu laden.' }, { status: 409 });
    return json({ erfolg: true });
  } catch (error) {
    console.error('Verein aktualisieren:', error);
    return json({ fehler: 'Verein konnte nicht gespeichert werden.' }, { status: 500 });
  }
};
