import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { db } from './mongodb';

export type MailKonfiguration = {
  methode: 'resend' | 'smtp' | 'microsoft365';
  microsoft365?: { tenantId: string; clientId: string; absender: string };
  smtp?: { host: string; port: number; secure: boolean; benutzername: string; absender: string; geheimnis?: string };
};

function key(): Buffer {
  const wert = process.env.MAIL_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(wert)) throw new Error('MAIL_ENCRYPTION_KEY muss 32 Byte hexadezimal enthalten.');
  return Buffer.from(wert, 'hex');
}

export function verschluesseln(klartext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const inhalt = Buffer.concat([cipher.update(klartext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), inhalt].map((teil) => teil.toString('base64url')).join('.');
}

export function entschluesseln(wert: string): string {
  const [iv, tag, inhalt] = wert.split('.');
  if (!iv || !tag || !inhalt) throw new Error('Ungültiges verschlüsseltes SMTP-Geheimnis.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(inhalt, 'base64url')), decipher.final()]).toString('utf8');
}

export async function ladeMailKonfiguration(vereinId: string): Promise<MailKonfiguration> {
  const verein = await db.collection('vereine').findOne({ _id: new ObjectId(vereinId) });
  const mail = verein?.mailEinstellungen;
  if (mail?.methode === 'smtp') return { methode: 'smtp', smtp: mail.smtp };
  if (mail?.methode === 'microsoft365') return { methode: 'microsoft365', microsoft365: mail.microsoft365 };
  return { methode: 'resend' };
}
