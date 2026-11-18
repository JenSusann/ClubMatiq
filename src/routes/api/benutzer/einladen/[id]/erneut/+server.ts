import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import 'dotenv/config';
import { db } from '../../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../../lib/server/berechtigungen';
import { erstelleEinladungstoken, berechneAblaufdatum, type Einladung } from '../../../../../../lib/server/einladungen';
import { versendeEinladung } from '../../../../../../lib/server/email';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  if (!ObjectId.isValid(params.id)) return json({ fehler: 'Ungültige Einladung.' }, { status: 400 });
  const vereinId = locals.benutzer!.vereinId;
  const einladungen = db.collection<Einladung>('einladungen');
  const einladung = await einladungen.findOne({ _id: new ObjectId(params.id), vereinId, status: 'offen' });
  if (!einladung) return json({ fehler: 'Offene Einladung nicht gefunden.' }, { status: 404 });
  if (einladung.versendetAm && Date.now() - einladung.versendetAm.getTime() < 60_000) {
    return json({ fehler: 'Bitte warte eine Minute vor dem erneuten Versand.' }, { status: 429 });
  }
  const { token, tokenHash } = erstelleEinladungstoken();
  const ablaufdatum = berechneAblaufdatum();
  const basisUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  const verein = await db.collection('vereine').findOne({ _id: new ObjectId(vereinId) });
  try {
    const versand = await versendeEinladung({
      email: einladung.email, vorname: einladung.vorname,
      verein: typeof verein?.name === 'string' ? verein.name : 'deinem Verein',
      link: `${basisUrl}/einladung?token=${encodeURIComponent(token)}`,
      ablaufdatum
    });
    await einladungen.updateOne({ _id: einladung._id, vereinId, status: 'offen' }, {
      $set: { tokenHash, ablaufdatum, versendetAm: new Date(), resendId: versand.id }
    });
    return json({ erfolg: true, nachricht: 'Einladung erneut versendet.' });
  } catch (error) {
    console.error('Einladung erneut versenden fehlgeschlagen:', error);
    return json({ fehler: 'E-Mail konnte nicht versendet werden.' }, { status: 502 });
  }
};
