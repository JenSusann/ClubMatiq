import type { ClientSession } from 'mongodb';
import { db } from './mongodb';

export type Bewegungsart = 'anlage' | 'ausleihe' | 'rueckgabe' | 'inventur' | 'verkauf' | 'wareneingang' | 'korrektur' | 'storno';
export type Lagerbewegung = {
  vereinId: string;
  artikelId: string;
  groesseId: string | null;
  art: Bewegungsart;
  mengeDelta: number;
  zeitpunkt: Date;
  benutzerId: string;
  referenzId: string;
  referenzTyp: string;
};

/** Ausschliesslich innerhalb derselben Transaktion wie die Bestandsänderung aufrufen. */
export async function protokolliereLagerbewegung(
  bewegung: Omit<Lagerbewegung, 'zeitpunkt'>,
  session: ClientSession
): Promise<void> {
  if (!session) throw new Error('Lagerbewegungen benötigen eine Datenbanktransaktion.');
  if (!Number.isSafeInteger(bewegung.mengeDelta) || bewegung.mengeDelta === 0) {
    throw new Error('Lagerbewegungen benötigen eine ganzzahlige Mengenänderung ungleich null.');
  }
  if (!bewegung.vereinId || !bewegung.artikelId || !bewegung.benutzerId || !bewegung.referenzId) {
    throw new Error('Unvollständige Lagerbewegung.');
  }
  await db.collection<Lagerbewegung>('lagerbewegungen').insertOne({
    ...bewegung,
    zeitpunkt: new Date()
  }, { session });
}
