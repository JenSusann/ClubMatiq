import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export async function loadKey() {
  const path = process.env.CLUBMATIQ_BACKUP_KEY_FILE;
  if (!path) throw new Error('CLUBMATIQ_BACKUP_KEY_FILE fehlt.');
  const hex = (await readFile(path,'utf8')).trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Backup-Schlüssel ungültig.');
  return Buffer.from(hex,'hex');
}
const magic = Buffer.from('CMBA1');
/**
 * @param {Buffer} data
 * @param {Buffer} key
 * @returns {Buffer}
 */
export function encrypt(data,key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(magic);
  const body = Buffer.concat([cipher.update(data),cipher.final()]);
  return Buffer.concat([magic,iv,cipher.getAuthTag(),body]);
}
/**
 * @param {Buffer} data
 * @param {Buffer} key
 * @returns {Buffer}
 */
export function decrypt(data,key) {
  if (data.length < 33 || !data.subarray(0,5).equals(magic)) throw new Error('Backup-Format ungültig.');
  const cipher = createDecipheriv('aes-256-gcm',key,data.subarray(5,17));
  cipher.setAAD(magic);
  cipher.setAuthTag(data.subarray(17,33));
  return Buffer.concat([cipher.update(data.subarray(33)),cipher.final()]);
}
