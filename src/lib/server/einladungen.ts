
import { randomBytes, createHash } from 'node:crypto';
import { db } from './mongodb';

export type Einladungsstatus =
  | 'offen'
  | 'angenommen'
  | 'widerrufen';

export type Einladung = {
  vereinId: string;
  email: string;
  vorname: string;
  nachname: string;
  rolle: App.Benutzerrolle;
  tokenHash: string;
  erstelltAm: Date;
  ablaufdatum: Date;
  status: Einladungsstatus;
};

export function erstelleEinladungstoken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString('hex');

  const tokenHash = createHash('sha256')
    .update(token)
    .digest('hex');

  return {
    token,
    tokenHash
  };
}

export function berechneAblaufdatum(): Date {
  const siebenTage = 7 * 24 * 60 * 60 * 1000;

  return new Date(Date.now() + siebenTage);
}

export async function erstelleEinladungsIndizes(): Promise<void> {
  const einladungen = db.collection<Einladung>('einladungen');

  await einladungen.createIndex(
    { tokenHash: 1 },
    { unique: true }
  );

  await einladungen.createIndex({
    vereinId: 1,
    email: 1,
    status: 1
  });

  await einladungen.createIndex({
    ablaufdatum: 1
  });
}
