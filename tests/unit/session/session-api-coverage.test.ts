import { describe, expect, it } from 'vitest';
import { GET } from '../../../src/routes/api/session/+server';
import { POST } from '../../../src/routes/api/session/aktivitaet/+server';

describe.each([['GET session', GET], ['POST aktivitaet', POST]] as const)('%s', (_name, handler) => {
  const benutzer = { id: '507f1f77bcf86cd799439011', vereinId: 'verein-1' };
  const sessionFristen = { idleExpiresAt: 123456, absoluteExpiresAt: 234567 };
  const call = (locals: object) => handler({ locals } as Parameters<typeof handler>[0]);

  it('verweigert Zugriff ohne Benutzer', async () => {
    const response = await call({ sessionFristen });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ fehler: 'Nicht angemeldet.' });
  });

  it('verweigert Zugriff ohne Session-Fristen', async () => {
    const response = await call({ benutzer });
    expect(response.status).toBe(401);
  });

  it('liefert Session-Fristen ohne Cache-Freigabe', async () => {
    const response = await call({ benutzer, sessionFristen });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(sessionFristen);
  });
});
