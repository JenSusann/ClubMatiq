
import { json } from '@sveltejs/kit';
import 'dotenv/config';
import { versendeEinladung } from '../../../../lib/server/email';
import type { RequestHandler } from './$types';
import { db } from '../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import {
  erstelleEinladungstoken,
  berechneAblaufdatum,
  type Einladung
} from '../../../../lib/server/einladungen';

const erlaubteRollen: App.Benutzerrolle[] = [
  'admin',
  'materialverantwortlich',
  'leiter',
  'mitglied'
];

export const POST: RequestHandler = async ({ request, locals }) => {
  const fehler = pruefeBerechtigung(
    locals.benutzer,
    'benutzer:verwalten'
  );

  if (fehler) {
    return fehler;
  }

  let daten: unknown;

  try {
    daten = await request.json();
  } catch {
    return json(
      { fehler: 'Ungültige JSON-Daten.' },
      { status: 400 }
    );
  }

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

  const vorname =
    typeof eingabe.vorname === 'string'
      ? eingabe.vorname.trim()
      : '';

  const nachname =
    typeof eingabe.nachname === 'string'
      ? eingabe.nachname.trim()
      : '';

  const email =
    typeof eingabe.email === 'string'
      ? eingabe.email.trim().toLowerCase()
      : '';

  const rolle = eingabe.rolle;

  if (
    !vorname ||
    !nachname ||
    !email ||
    typeof rolle !== 'string'
  ) {
    return json(
      { fehler: 'Bitte alle Pflichtfelder ausfüllen.' },
      { status: 400 }
    );
  }

  if (
    vorname.length > 100 ||
    nachname.length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return json(
      { fehler: 'Ungültige Namen oder E-Mail-Adresse.' },
      { status: 400 }
    );
  }

  if (
    !erlaubteRollen.includes(
      rolle as App.Benutzerrolle
    )
  ) {
    return json(
      { fehler: 'Ungültige Benutzerrolle.' },
      { status: 400 }
    );
  }

  const vereinId = locals.benutzer!.vereinId;

  try {
    const bestehenderBenutzer = await db
      .collection('benutzer')
      .findOne({
        vereinId,
        email
      });

    if (bestehenderBenutzer) {
      return json(
        {
          fehler:
            'Diese E-Mail-Adresse ist in deinem Verein bereits registriert.'
        },
        { status: 409 }
      );
    }

    const einladungen = db.collection<Einladung>(
      'einladungen'
    );

    const bestehendeEinladung =
      await einladungen.findOne({
        vereinId,
        email,
        status: 'offen',
        ablaufdatum: { $gt: new Date() }
      });

    if (bestehendeEinladung) {
      return json(
        {
          fehler:
            'Für diese E-Mail-Adresse besteht bereits eine gültige Einladung.'
        },
        { status: 409 }
      );
    }

    const { token, tokenHash } = erstelleEinladungstoken();

    const einladung: Einladung = {
      vereinId,
      email,
      vorname,
      nachname,
      rolle: rolle as App.Benutzerrolle,
      tokenHash,
      erstelltAm: new Date(),
      ablaufdatum: berechneAblaufdatum(),
      status: 'offen'
    };

    const basisUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    const einladungsLink = `${basisUrl}/einladung?token=${encodeURIComponent(token)}`;
    const verein = await db.collection('vereine').findOne({
      _id: new (await import('mongodb')).ObjectId(vereinId)
    });
    const vereinsname = typeof verein?.name === 'string' ? verein.name : 'deinem Verein';

    const ergebnis = await einladungen.insertOne(einladung);
    let versendet = false;
    let versandFehler = false;
    try {
      const versand = await versendeEinladung({
        email, vorname, verein: vereinsname, link: einladungsLink,
        ablaufdatum: einladung.ablaufdatum, vereinId
      });
      await einladungen.updateOne(
        { _id: ergebnis.insertedId, vereinId },
        { $set: { versendetAm: new Date(), resendId: versand.id } }
      );
      versendet = true;
    } catch (error) {
      versandFehler = true;
      console.error('Einladungs-E-Mail fehlgeschlagen:', error);
    }

    return json(
      {
        erfolg: true,
        nachricht:
          versendet ? 'Die Einladung wurde per E-Mail versendet.' : 'Die Einladung wurde gespeichert, aber die E-Mail konnte nicht versendet werden.',
        einladung: {
          id: ergebnis.insertedId.toString(),
          email,
          rolle,
          status: 'offen',
          versendet
        },
        versandFehler
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'Fehler beim Erstellen der Einladung:',
      error
    );

    return json(
      {
        fehler:
          'Die Einladung konnte nicht erstellt werden.'
      },
      { status: 500 }
    );
  }
};


export const GET: RequestHandler = async ({ locals }) => {
  const fehler = pruefeBerechtigung(
    locals.benutzer,
    'benutzer:verwalten'
  );

  if (fehler) {
    return fehler;
  }

  const vereinId = locals.benutzer!.vereinId;

  try {
    const einladungen = await db
      .collection<Einladung>('einladungen')
      .find({ vereinId })
      .sort({ erstelltAm: -1 })
      .toArray();

    const jetzt = new Date();

    const ergebnis = einladungen.map((einladung) => ({
      id: einladung._id.toString(),
      vorname: einladung.vorname,
      nachname: einladung.nachname,
      email: einladung.email,
      rolle: einladung.rolle,
      status:
        einladung.status === 'offen' &&
        einladung.ablaufdatum <= jetzt
          ? 'abgelaufen'
          : einladung.status,
      erstelltAm: einladung.erstelltAm,
      ablaufdatum: einladung.ablaufdatum,
      versendet: Boolean(einladung.versendetAm),
      versendetAm: einladung.versendetAm ?? null
    }));

    return json(ergebnis);
  } catch (error) {
    console.error(
      'Fehler beim Laden der Einladungen:',
      error
    );

    return json(
      {
        fehler: 'Einladungen konnten nicht geladen werden.'
      },
      { status: 500 }
    );
  }
};
