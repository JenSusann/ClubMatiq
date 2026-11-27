import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '../../../scripts/backup-crypto.mjs';

describe('Backup AES-256-GCM', () => {
  const key = randomBytes(32);
  const data = Buffer.from('ClubMatiq synthetic backup');
  it('restores exact bytes', () => {
    expect(decrypt(encrypt(data,key),key)).toEqual(data);
  });
  it('rejects wrong keys', () => {
    expect(() => decrypt(encrypt(data,key),randomBytes(32))).toThrow();
  });
  it('rejects modified ciphertext', () => {
    const archive = encrypt(data,key);
    archive[archive.length-1] ^= 1;
    expect(() => decrypt(archive,key)).toThrow();
  });
  it('rejects modified authentication tags', () => {
    const archive = encrypt(data,key);
    archive[17] ^= 1;
    expect(() => decrypt(archive,key)).toThrow();
  });
  it('rejects truncated archives', () => {
    expect(() => decrypt(encrypt(data,key).subarray(0,20),key)).toThrow();
  });
  it('uses different nonces for repeated backups', () => {
    expect(encrypt(data,key)).not.toEqual(encrypt(data,key));
  });
});
