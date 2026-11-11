import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { db, client } from '../../../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../../../lib/server/berechtigungen';
import type { RequestHandler } from './$types';

type Position = {
  _id: ObjectId;
  artikelId: string;
  groesseId: string | null;
  sollBestand: number;
  istBestand: number | null;
};

function gueltigeMenge(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isSafeInteger(wert) && wert >= 0;
}

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
    return json({ fehler: 'Bitte eine Begründung angeben.' }, { status: 400 });
  }
  const eingabe = roh as Record<string, unknown>;
  const begruendung = typeof eingabe.begruendung === 'string' ? eingabe.begruendung.trim() : '';
  if (begruendung.length < 5 || begruendung.length > 1000) {
    return json({ fehler: 'Die Begründung muss zwischen 5 und 1000 Zeichen enthalten.' }, { status: 400 });
  }

  const session = client.startSession();
  const ergebnis = { vorherigerStatus: '', rueckbuchungen: 0 };

  try {
    await session.withTransaction(async () => {
      const inventuren = db.collection('inventuren');
      const positionenSammlung = db.collection('inventurpositionen');
      const artikelSammlung = db.collection('artikel');
      const variantenSammlung = db.collection('artikelvarianten');
      const _id = new ObjectId(inventurId);
      const inventur = await inventuren.findOne({ _id, vereinId }, { session });
      if (!inventur) throw new Error('Inventur nicht gefunden.');
      if (inventur.status !== 'offen' && inventur.status !== 'abgeschlossen') {
        throw new Error('Diese Inventur kann nicht mehr storniert werden.');
      }
      const statusVorher = inventur.status as 'offen' | 'abgeschlossen';
      const jetzt = new Date();

      // Die Inventur wird in derselben Transaktion gesperrt wie Zählungen
      // und der Abschluss. Konkurrierende Änderungen führen zu einem Konflikt.
      const sperre = await inventuren.updateOne(
        { _id, vereinId, status: statusVorher },
        {
          $set: {
            status: 'storniert',
            storniertAm: jetzt,
            storniertVon: locals.benutzer!.id,
            stornierungsgrund: begruendung,
            zuletztBearbeitetAm: jetzt
          },
          $inc: { version: 1 }
        },
        { session }
      );
      if (sperre.modifiedCount !== 1) {
        throw new Error('Die Inventur wurde zwischenzeitlich verändert.');
      }

      let rueckbuchungen = 0;
      if (statusVorher === 'abgeschlossen') {
        const positionen = (await positionenSammlung.find(
          { inventurId, vereinId }, { session }
        ).toArray()) as unknown as Position[];
        if (positionen.length === 0 ||
            (typeof inventur.anzahlPositionen === 'number' && positionen.length !== inventur.anzahlPositionen)) {
          throw new Error('Die Inventurpositionen sind unvollständig.');
        }

        // Nachträgliche Korrekturen müssen eine lückenlose Kette bilden.
        // Die letzte Korrektur muss mit dem aktuellen Ist-Bestand übereinstimmen.
        const korrekturen = await db.collection('inventurprotokoll')
          .find({ vereinId, inventurId, aktion: 'nachtraeglich_korrigiert' }, { session })
          .sort({ versionVorher: 1 })
          .toArray();

        if (typeof inventur.anzahlNachtraeglicheKorrekturen === 'number' &&
            inventur.anzahlNachtraeglicheKorrekturen !== korrekturen.length) {
          throw new Error('Das Korrekturprotokoll ist unvollständig. Stornierung abgebrochen.');
        }

        const korrekturenProPosition = new Map<string, typeof korrekturen>();
        for (const korrektur of korrekturen) {
          if (typeof korrektur.positionId !== 'string' ||
              !gueltigeMenge(korrektur.alterIstBestand) ||
              !gueltigeMenge(korrektur.neuerIstBestand) ||
              korrektur.neuerIstBestand - korrektur.alterIstBestand !== korrektur.differenz) {
            throw new Error('Ungültiger Eintrag im Korrekturprotokoll.');
          }
          const bisher = korrekturenProPosition.get(korrektur.positionId) ?? [];
          bisher.push(korrektur);
          korrekturenProPosition.set(korrektur.positionId, bisher);
        }

        const bekanntePositionen = new Set(positionen.map((position) => position._id.toString()));
        for (const [positionId, eintraege] of korrekturenProPosition) {
          if (!bekanntePositionen.has(positionId)) {
            throw new Error('Korrekturprotokoll verweist auf eine fehlende Position.');
          }
          for (let i = 1; i < eintraege.length; i++) {
            if (eintraege[i].alterIstBestand !== eintraege[i - 1].neuerIstBestand) {
              throw new Error('Widersprüchliche Korrekturhistorie.');
            }
          }
          const position = positionen.find((eintrag) => eintrag._id.toString() === positionId);
          if (!position || position.istBestand !== eintraege[eintraege.length - 1].neuerIstBestand) {
            throw new Error('Der Ist-Bestand stimmt nicht mit dem Korrekturprotokoll überein.');
          }
        }

        // Gesamte gebuchte Differenz zurücknehmen: Abschluss plus alle
        // nachträglichen Korrekturen. Spätere Ausleihen bleiben erhalten.
        // Deltas zuerst je Variante und Artikel zusammenfassen.
        const artikelDeltas = new Map<string, number>();
        const variantenDeltas = new Map<string, { artikelId: string; groesseId: string; delta: number }>();
        const artikelOhneGroessen = new Set<string>();
        const artikelMitGroessen = new Set<string>();

        for (const position of positionen) {
          if (!gueltigeMenge(position.sollBestand) || !gueltigeMenge(position.istBestand) ||
              typeof position.artikelId !== 'string' || !ObjectId.isValid(position.artikelId)) {
            throw new Error('Ungültige Inventurposition: Rückbuchung nicht möglich.');
          }
          const delta = position.sollBestand - position.istBestand;
          if (position.groesseId !== null) {
            if (typeof position.groesseId !== 'string' || !ObjectId.isValid(position.groesseId)) {
              throw new Error('Ungültige Grösse in der Inventurposition.');
            }
            artikelMitGroessen.add(position.artikelId);
            const schluessel = `${position.artikelId}:${position.groesseId}`;
            const bisher = variantenDeltas.get(schluessel);
            variantenDeltas.set(schluessel, {
              artikelId: position.artikelId,
              groesseId: position.groesseId,
              delta: (bisher?.delta ?? 0) + delta
            });
          } else {
            artikelOhneGroessen.add(position.artikelId);
          }
          artikelDeltas.set(position.artikelId, (artikelDeltas.get(position.artikelId) ?? 0) + delta);
          if (delta !== 0) rueckbuchungen++;
        }

        for (const artikelId of artikelOhneGroessen) {
          if (artikelMitGroessen.has(artikelId)) {
            throw new Error('Inkonsistente Grössenstruktur in der Inventur.');
          }
        }

        // Die gesamte Inventurwirkung einschliesslich späterer Korrekturen zurückbuchen.
        // Änderungen durch spätere Ausleihen/Rückgaben bleiben bestehen.
        for (const eintrag of variantenDeltas.values()) {
          if (eintrag.delta === 0) continue;
          const aktualisiert = await variantenSammlung.updateOne(
            {
              vereinId,
              artikelId: eintrag.artikelId,
              groesseId: eintrag.groesseId,
              ...(eintrag.delta < 0 ? { menge: { $gte: -eintrag.delta } } : {})
            },
            { $inc: { menge: eintrag.delta } },
            { session }
          );
          if (aktualisiert.matchedCount !== 1) {
            throw new Error('Eine Artikelvariante fehlt oder hat zu wenig Bestand für die Rückbuchung.');
          }
        }

        for (const [artikelId, delta] of artikelDeltas) {
          if (delta === 0) continue;
          const aktualisiert = await artikelSammlung.updateOne(
            {
              _id: new ObjectId(artikelId),
              vereinId,
              ...(delta < 0 ? { menge: { $gte: -delta } } : {})
            },
            { $inc: { menge: delta } },
            { session }
          );
          if (aktualisiert.matchedCount !== 1) {
            throw new Error('Ein Artikel fehlt oder hat zu wenig Bestand für die Rückbuchung.');
          }
        }
      }

      await db.collection('inventurprotokoll').insertOne({
        vereinId,
        inventurId,
        aktion: 'storniert',
        statusVorher,
        begruendung,
        ausgefuehrtAm: jetzt,
        ausgefuehrtVon: locals.benutzer!.id,
        anzahlRueckbuchungen: rueckbuchungen,
        versionVorher: inventur.version ?? 0,
        versionNachher: (inventur.version ?? 0) + 1
      }, { session });

      ergebnis.vorherigerStatus = statusVorher;
      ergebnis.rueckbuchungen = rueckbuchungen;
    });

    return json({
      erfolg: true,
      meldung: ergebnis.vorherigerStatus === 'abgeschlossen'
        ? 'Inventur storniert und Bestandskorrekturen rückgebucht.'
        : 'Offene Inventur storniert. Lagerbestände unverändert.',
      anzahlRueckbuchungen: ergebnis.rueckbuchungen
    });
  } catch (error) {
    console.error('Inventur stornieren:', error);
    return json({
      fehler: error instanceof Error ? error.message : 'Inventur konnte nicht storniert werden.'
    }, { status: 409 });
  } finally {
    await session.endSession();
  }
};
