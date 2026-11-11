
import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../lib/server/mongodb';
import type { RequestHandler } from './$types';

// ========================================
// Zulässige Statuswerte
// ========================================

type Meldungsstatus =
  | 'offen'
  | 'in_bearbeitung'
  | 'erledigt';

const erlaubteStatus: Meldungsstatus[] = [
  'offen',
  'in_bearbeitung',
  'erledigt'
];

// ========================================
// PATCH: Schadensmeldung bearbeiten
// ========================================

export const PATCH: RequestHandler = async ({
  request,
  locals,
  params
}) => {
  // ========================================
  // 1. Anmeldung überprüfen
  // ========================================

  const benutzer = locals.benutzer;

  if (!benutzer) {
    return json(
      { fehler: 'Nicht angemeldet.' },
      { status: 401 }
    );
  }

  // ========================================
  // 2. Berechtigung überprüfen
  // ========================================

  const darfBearbeiten =
    benutzer.rolle === 'admin' ||
    benutzer.rolle === 'materialverantwortlich';

  if (!darfBearbeiten) {
    return json(
      {
        fehler:
          'Du hast keine Berechtigung, Schadensmeldungen zu bearbeiten.'
      },
      { status: 403 }
    );
  }

  // ========================================
  // 3. Meldungs-ID überprüfen
  // ========================================

  const meldungId = params.id;

  if (!ObjectId.isValid(meldungId)) {
    return json(
      { fehler: 'Ungültige Meldungs-ID.' },
      { status: 400 }
    );
  }

  // ========================================
  // 4. Eingaben lesen
  // ========================================

  const daten = await request.json().catch(() => null);

  if (
    !daten ||
    typeof daten !== 'object' ||
    Array.isArray(daten)
  ) {
    return json(
      { fehler: 'Ungültige Meldungsdaten.' },
      { status: 400 }
    );
  }

  const { status, bearbeitungsnotiz } = daten;

  // ========================================
  // 5. Status überprüfen
  // ========================================

  if (
    typeof status !== 'string' ||
    !erlaubteStatus.includes(
      status as Meldungsstatus
    )
  ) {
    return json(
      { fehler: 'Ungültiger Meldungsstatus.' },
      { status: 400 }
    );
  }

  // ========================================
  // 6. Bearbeitungsnotiz überprüfen
  // ========================================

  if (
    typeof bearbeitungsnotiz !== 'string' ||
    bearbeitungsnotiz.length > 2000
  ) {
    return json(
      {
        fehler:
          'Die Bearbeitungsnotiz darf maximal 2000 Zeichen enthalten.'
      },
      { status: 400 }
    );
  }

  // ========================================
  // 7. Meldung in MongoDB aktualisieren
  // ========================================

  try {
    const ergebnis = await db
      .collection('schadensmeldungen')
      .updateOne(
        {
          _id: new ObjectId(meldungId),

          // Wichtig: Nur Meldungen des eigenen Vereins
          vereinId: benutzer.vereinId
        },
        {
          $set: {
            status,
            bearbeitungsnotiz:
              bearbeitungsnotiz.trim(),
            aktualisiertAm: new Date(),
            bearbeitetVonId: benutzer.id,
            bearbeitetVonName:
              `${benutzer.vorname} ${benutzer.nachname}`
          }
        }
      );

    if (ergebnis.matchedCount === 0) {
      return json(
        {
          fehler:
            'Schadensmeldung nicht gefunden.'
        },
        { status: 404 }
      );
    }

    // ========================================
    // 8. Erfolg zurückgeben
    // ========================================

    return json({
      erfolg: true,
      meldung:
        'Schadensmeldung erfolgreich aktualisiert.'
    });
  } catch (error) {
    console.error(
      'Schadensmeldung bearbeiten:',
      error
    );

    return json(
      {
        fehler:
          'Schadensmeldung konnte nicht aktualisiert werden.'
      },
      { status: 500 }
    );
  }
};
