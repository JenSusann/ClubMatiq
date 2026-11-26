import { ObjectId, type ClientSession } from 'mongodb';
import { db } from './mongodb';

export type Bewegungsart = 'anlage' | 'ausleihe' | 'rueckgabe' | 'inventur' | 'verkauf' | 'wareneingang' | 'korrektur' | 'storno';
export type Lagerbewegung = {
  vereinId: string;
  artikelId: string;
  groesseId: string | null;
  art: Bewegungsart;
  mengeDelta: number;
  zeitpunkt: Date;
  artikelName?: string;
  groesseName?: string;
  benutzerName?: string;
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
  const { vereinId, artikelId, groesseId, benutzerId } = bewegung;
  // Dieselbe Session verwenden; keine parallelen Operationen innerhalb der Transaktion.
  const artikel = ObjectId.isValid(artikelId)
    ? await db.collection('artikel').findOne({ vereinId, _id: new ObjectId(artikelId) }, { session, projection: { name: 1 } })
    : null;
  const groesse = groesseId && ObjectId.isValid(groesseId)
    ? await db.collection('groessen').findOne({ vereinId, _id: new ObjectId(groesseId) }, { session, projection: { bezeichnung: 1 } })
    : null;
  const benutzer = ObjectId.isValid(benutzerId)
    ? await db.collection('benutzer').findOne({ vereinId, _id: new ObjectId(benutzerId) }, { session, projection: { vorname: 1, nachname: 1 } })
    : null;
  const name = [benutzer?.vorname, benutzer?.nachname].filter(Boolean).join(' ').trim();
  await db.collection<Lagerbewegung>('lagerbewegungen').insertOne({
    ...bewegung,
    ...(artikel?.name ? { artikelName: String(artikel.name) } : {}),
    ...(groesse?.bezeichnung ? { groesseName: String(groesse.bezeichnung) } : {}),
    ...(name ? { benutzerName: name } : {}),
    zeitpunkt: new Date()
  }, { session });
}
