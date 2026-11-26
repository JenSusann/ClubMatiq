import { db } from '../../src/lib/server/mongodb';
import { bewertungSpeichern } from '../../src/lib/server/inventarbewertung';

// UTC-Termine für 23:55 Uhr in der Schweiz (Sommer- und Winterzeit).
export const config = { schedule: '55 21,22 * * *' };

export default async function () {
  const stunde = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23'
  }).format(new Date());
  if (stunde !== '23') return new Response('Ausserhalb des Aufnahmefensters');

  let fehler = 0;
  for await (const verein of db.collection('vereine').find({}, { projection: { _id: 1 } })) {
    try {
      await bewertungSpeichern(String(verein._id), 'system', true);
    } catch (error) {
      fehler++;
      console.error('Automatische Inventarbewertung fehlgeschlagen', String(verein._id), error);
    }
  }
  if (fehler) throw new Error(`Bewertungsaufnahme für ${fehler} Vereine fehlgeschlagen.`);
  return new Response('Automatische Inventarbewertung abgeschlossen');
}
