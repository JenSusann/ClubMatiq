import type { PageServerLoad } from './$types';
import { db } from '../lib/server/mongodb';

type Kennzahlen = {
  artikel: number;
  bestand: number;
  ausleihen: number | null;
  meldungen: number;
  unterMindestbestand: number;
  bestellungen: number | null;
};

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends('clubmatiq:dashboard');
  const benutzer = locals.benutzer;
  const rolle = benutzer?.rolle ?? 'mitglied';
  if (!benutzer) return { rolle, kennzahlen: null, kennzahlenFehler: null };

  const vereinId = benutzer.vereinId;
  const darfVerwalten = rolle === 'admin' || rolle === 'materialverantwortlich';
  const darfAusleihenSehen = rolle !== 'mitglied';

  try {
    const [artikel, varianten, ausleihen, meldungen, verkaufe] = await Promise.all([
      db.collection('artikel').find({ vereinId }, { projection: { _id: 1, menge: 1, hatGroessen: 1, mindestbestand: 1, mindestBestand: 1 } }).toArray(),
      db.collection('artikelvarianten').find({ vereinId }, { projection: { artikelId: 1, menge: 1 } }).toArray(),
      darfAusleihenSehen
        ? db.collection('ausleihen').find({ vereinId, status: 'offen' }, { projection: { _id: 1 } }).toArray()
        : Promise.resolve(null),
      db.collection('schadensmeldungen').countDocuments(darfVerwalten
        ? { vereinId, status: { $in: ['offen', 'in_bearbeitung'] } }
        : { vereinId, gemeldetVonId: benutzer.id, status: { $in: ['offen', 'in_bearbeitung'] } }),
      darfVerwalten
        ? db.collection('vereinskleider_verkaeufe').find({ vereinId, 'positionen.verkaufsart': 'bestellung' }, { projection: { positionen: 1 } }).toArray()
        : Promise.resolve(null)
    ]);

    const variantenMengen = new Map<string, number>();
    for (const variante of varianten) {
      const id = String(variante.artikelId);
      variantenMengen.set(id, (variantenMengen.get(id) ?? 0) + (Number(variante.menge) || 0));
    }

    let bestand = 0;
    let unterMindestbestand = 0;
    for (const eintrag of artikel) {
      const menge = eintrag.hatGroessen
        ? (variantenMengen.get(eintrag._id.toString()) ?? 0)
        : (Number(eintrag.menge) || 0);
      bestand += menge;
      const minimum = eintrag.mindestbestand ?? eintrag.mindestBestand;
      if (typeof minimum === 'number' && Number.isFinite(minimum) && minimum > 0 && menge < minimum) {
        unterMindestbestand++;
      }
    }

    let bestellungen: number | null = null;
    if (verkaufe !== null) {
      bestellungen = 0;
      for (const vorgang of verkaufe) {
        if (!Array.isArray(vorgang.positionen)) continue;
        for (const position of vorgang.positionen) {
          if (position.verkaufsart !== 'bestellung') continue;
          const menge = Number(position.menge);
          const uebergeben = Number(position.uebergebenMenge ?? 0);
          if (Number.isFinite(menge) && Number.isFinite(uebergeben) && menge > uebergeben) {
            bestellungen++;
          }
        }
      }
    }

    const kennzahlen: Kennzahlen = {
      artikel: artikel.length,
      bestand,
      ausleihen: ausleihen?.length ?? null,
      meldungen,
      unterMindestbestand,
      bestellungen
    };
    return { rolle, kennzahlen, kennzahlenFehler: null };
  } catch (error) {
    console.error('Dashboard-Kennzahlen:', error);
    return { rolle, kennzahlen: null, kennzahlenFehler: 'Kennzahlen konnten nicht geladen werden.' };
  }
};
