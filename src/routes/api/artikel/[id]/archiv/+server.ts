import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const verweigert = pruefeBerechtigung(locals.benutzer, 'inventar:bearbeiten');
  if (verweigert) return verweigert;
  if (!ObjectId.isValid(params.id)) return json({ fehler: 'Ungültige Artikel-ID.' }, { status: 400 });
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten) ||
      typeof (daten as { archiviert?: unknown }).archiviert !== 'boolean') {
    return json({ fehler: 'Ungültige Aktion.' }, { status: 400 });
  }
  const archivieren = (daten as { archiviert: boolean }).archiviert;
  const vereinId = locals.benutzer!.vereinId;
  const artikelId = params.id;
  try {
    const artikel = await db.collection('artikel').findOne({ _id: new ObjectId(artikelId), vereinId });
    if (!artikel) return json({ fehler: 'Artikel nicht gefunden.' }, { status: 404 });
    if ((artikel.archiviert === true) === archivieren) return json({ fehler: 'Artikelstatus wurde bereits geändert.' }, { status: 409 });
    if (archivieren) {
      const [ausleihen, bestellungen] = await Promise.all([
        db.collection('ausleihen').find({ artikelId, vereinId }).toArray(),
        db.collection('vereinskleider_verkaeufe').find({
          vereinId, 'positionen.artikelId': artikelId
        }).toArray()
      ]);
      if (ausleihen.some((a) => {
        const ausgeliehen = Number(a.menge ?? 0);
        const rueckgaben = Array.isArray(a.rueckgaben)
          ? a.rueckgaben.reduce((summe: number, v: { menge?: number }) => summe + Number(v.menge ?? 0), 0)
          : 0;
        return ausgeliehen > rueckgaben;
      })) return json({ fehler: 'Offene Ausleihen müssen vor der Archivierung abgeschlossen werden.' }, { status: 409 });
      if (bestellungen.some((v) => Array.isArray(v.positionen) && v.positionen.some(
        (p: { artikelId?: string; verkaufsart?: string; menge?: number; uebergebenMenge?: number }) =>
          p.artikelId === artikelId && p.verkaufsart === 'bestellung' &&
          Number(p.menge ?? 0) > Number(p.uebergebenMenge ?? 0)
      ))) return json({ fehler: 'Offene Bestellungen müssen vor der Archivierung übergeben oder storniert werden.' }, { status: 409 });
    }
    const jetzt = new Date();
    const benutzer = locals.benutzer!;
    const ergebnis = await db.collection('artikel').updateOne({
      _id: new ObjectId(artikelId), vereinId, archiviert: archivieren ? { $ne: true } : true
    }, { $set: {
      archiviert: archivieren,
      archiviertAm: archivieren ? jetzt : null,
      archiviertVon: archivieren ? benutzer.id : null,
      archiviertVonName: archivieren ? [benutzer.vorname, benutzer.nachname].filter(Boolean).join(' ').trim() : null,
      aktualisiertAm: jetzt
    } });
    if (ergebnis.modifiedCount !== 1) return json({ fehler: 'Artikelstatus wurde zwischenzeitlich geändert.' }, { status: 409 });
    return json({ erfolg: true, archiviert: archivieren });
  } catch (error) {
    console.error('Artikelarchiv:', error);
    return json({ fehler: 'Artikelstatus konnte nicht geändert werden.' }, { status: 500 });
  }
};
