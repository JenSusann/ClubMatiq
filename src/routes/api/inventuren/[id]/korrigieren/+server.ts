import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Eingabe = {
  positionId?: unknown;
  neuerIstBestand?: unknown;
  begruendung?: unknown;
  version?: unknown;
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const berechtigungsfehler = pruefeBerechtigung(locals.benutzer, 'inventur:abschliessen');
  if (berechtigungsfehler) return berechtigungsfehler;

  const inventurId = params.id;
  const vereinId = locals.benutzer!.vereinId;
  if (!ObjectId.isValid(inventurId)) {
    return json({ fehler: 'Ungültige Inventur-ID.' }, { status: 400 });
  }

  const roh: unknown = await request.json().catch(() => null);
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) {
    return json({ fehler: 'Ungültige Eingabedaten.' }, { status: 400 });
  }
  const eingabe = roh as Eingabe;
  if (typeof eingabe.positionId !== 'string' || !ObjectId.isValid(eingabe.positionId)) {
    return json({ fehler: 'Ungültige Inventurposition.' }, { status: 400 });
  }
  if (typeof eingabe.neuerIstBestand !== 'number' ||
      !Number.isSafeInteger(eingabe.neuerIstBestand) || eingabe.neuerIstBestand < 0) {
    return json({ fehler: 'Der neue Ist-Bestand muss eine ganze Zahl ab 0 sein.' }, { status: 400 });
  }
  const begruendung = typeof eingabe.begruendung === 'string' ? eingabe.begruendung.trim() : '';
  if (begruendung.length < 5 || begruendung.length > 1000) {
    return json({ fehler: 'Die Begründung muss 5 bis 1000 Zeichen enthalten.' }, { status: 400 });
  }
  if (typeof eingabe.version !== 'number' || !Number.isSafeInteger(eingabe.version) || eingabe.version < 0) {
    return json({ fehler: 'Bitte Inventur neu laden (Version fehlt).' }, { status: 400 });
  }

  const positionId = eingabe.positionId;
  const neuerIstBestand = eingabe.neuerIstBestand;
  const erwarteteVersion = eingabe.version;
  const session = client.startSession();
  const ergebnis: { wert: null | { alterIstBestand: number; neuerIstBestand: number; differenz: number; version: number } } = { wert: null };

  try {
    await session.withTransaction(async () => {
      const inventuren = db.collection('inventuren');
      const positionen = db.collection('inventurpositionen');
      const artikel = db.collection('artikel');
      const varianten = db.collection('artikelvarianten');
      const _id = new ObjectId(inventurId);

      const inventur = await inventuren.findOne({ _id, vereinId }, { session });
      if (!inventur) throw new Error('Inventur nicht gefunden.');
      if (inventur.status !== 'abgeschlossen') throw new Error('Nur abgeschlossene Inventuren können korrigiert werden.');
      if ((inventur.version ?? 0) !== erwarteteVersion) {
        throw new Error('Die Inventur wurde zwischenzeitlich verändert. Bitte neu laden.');
      }

      const position = await positionen.findOne({
        _id: new ObjectId(positionId), inventurId, vereinId
      }, { session });
      if (!position) throw new Error('Inventurposition nicht gefunden.');
      if (typeof position.istBestand !== 'number' || !Number.isSafeInteger(position.istBestand) || position.istBestand < 0) {
        throw new Error('Ungültiger bisheriger Ist-Bestand.');
      }
      if (typeof position.artikelId !== 'string' || !ObjectId.isValid(position.artikelId)) {
        throw new Error('Ungültige Artikel-ID in der Inventurposition.');
      }
      const alterIstBestand = position.istBestand;
      const differenz = neuerIstBestand - alterIstBestand;
      if (differenz === 0) throw new Error('Der neue Ist-Bestand entspricht dem bisherigen Wert.');
      if (!Number.isSafeInteger(differenz)) throw new Error('Die Bestandsdifferenz ist zu gross.');

      const jetzt = new Date();
      const sperre = await inventuren.updateOne(
        { _id, vereinId, status: 'abgeschlossen', version: erwarteteVersion },
        { $inc: { version: 1, anzahlNachtraeglicheKorrekturen: 1 }, $set: { zuletztBearbeitetAm: jetzt } },
        { session }
      );
      if (sperre.matchedCount !== 1) throw new Error('Die Inventur wurde zwischenzeitlich verändert.');

      if (position.groesseId !== null) {
        if (typeof position.groesseId !== 'string' || !ObjectId.isValid(position.groesseId)) {
          throw new Error('Ungültige Grösse in der Inventurposition.');
        }
        const variante = await varianten.updateOne(
          {
            vereinId, artikelId: position.artikelId, groesseId: position.groesseId,
            ...(differenz < 0 ? { menge: { $gte: -differenz } } : {})
          },
          { $inc: { menge: differenz } },
          { session }
        );
        if (variante.matchedCount !== 1) {
          throw new Error('Artikelvariante fehlt oder hat zu wenig Bestand.');
        }
      }

      const artikelErgebnis = await artikel.updateOne(
        {
          _id: new ObjectId(position.artikelId), vereinId,
          ...(differenz < 0 ? { menge: { $gte: -differenz } } : {})
        },
        { $inc: { menge: differenz } },
        { session }
      );
      if (artikelErgebnis.matchedCount !== 1) {
        throw new Error('Artikel fehlt oder hat zu wenig Bestand.');
      }

      const positionErgebnis = await positionen.updateOne(
        { _id: new ObjectId(positionId), inventurId, vereinId, istBestand: alterIstBestand },
        { $set: { istBestand: neuerIstBestand, zuletztKorrigiertAm: jetzt, zuletztKorrigiertVon: locals.benutzer!.id } },
        { session }
      );
      if (positionErgebnis.matchedCount !== 1) throw new Error('Inventurposition wurde zwischenzeitlich verändert.');

      await db.collection('inventurprotokoll').insertOne({
        vereinId, inventurId, positionId,
        artikelId: position.artikelId, groesseId: position.groesseId,
        aktion: 'nachtraeglich_korrigiert',
        alterIstBestand, neuerIstBestand, differenz,
        begruendung, ausgefuehrtAm: jetzt, ausgefuehrtVon: locals.benutzer!.id,
        versionVorher: erwarteteVersion, versionNachher: erwarteteVersion + 1
      }, { session });

      ergebnis.wert = { alterIstBestand, neuerIstBestand, differenz, version: erwarteteVersion + 1 };
    });

    if (!ergebnis.wert) throw new Error('Korrektur konnte nicht gespeichert werden.');
    return json({ erfolg: true, ...ergebnis.wert });
  } catch (error) {
    console.error('Inventur nachträglich korrigieren:', error);
    return json({
      fehler: error instanceof Error ? error.message : 'Inventurkorrektur fehlgeschlagen.'
    }, { status: 409 });
  } finally {
    await session.endSession();
  }
};
