import { describe, expect, it } from 'vitest';
import { load } from '../../src/routes/mail-einstellungen/+page.server';

const benutzer = { id: '1', vereinId: '507f1f77bcf86cd799439011', rolle: 'admin', email: 'admin@verein.ch' };
const kontext = (rolle?: string) => ({
  locals: { benutzer: rolle ? { ...benutzer, rolle } : null }
}) as never;

describe('E-Mail-Einstellungen: serverseitiger Seitenzugriff (Unit)', () => {
  it('lässt Administratoren auf die Einstellungsseite', () => {
    expect(load(kontext('admin'))).toEqual({});
  });

  it.each(['mitglied', 'leiter', 'materialverantwortlich'])('verweigert %s den Direktzugriff mit HTTP 403', (rolle) => {
    expect(() => load(kontext(rolle))).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('leitet nicht angemeldete Benutzer zur Anmeldung weiter', () => {
    expect(() => load(kontext())).toThrowError(expect.objectContaining({ status: 303, location: '/anmelden' }));
  });
});
