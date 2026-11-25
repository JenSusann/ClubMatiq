/// <reference path="../../../src/app.d.ts" />
import { describe, expect, it } from 'vitest';
import {
  hatBerechtigung,
  pruefeBerechtigung,
  type Berechtigung
} from '../../../src/lib/server/berechtigungen';

type Benutzer = NonNullable<App.Locals['benutzer']>;

function testBenutzer(rolle: Benutzer['rolle']): Benutzer {
  return {
    id: 'test-benutzer',
    vereinId: 'test-verein',
    vorname: 'Test',
    nachname: 'Benutzer',
    email: 'test@example.com',
    rolle
  };
}

const alleBerechtigungen: Berechtigung[] = [
  'inventar:lesen',
  'inventar:bearbeiten',
  'ausleihen:lesen',
  'ausleihen:verwalten',
  'stammdaten:verwalten',
  'benutzer:verwalten',
  'inventur:lesen',
  'inventur:erstellen',
  'inventur:zaehlen',
  'inventur:abschliessen',
  'rabatte:verwalten',
  'verkauf:verwalten',
  'mitglieder:verwalten'
];

describe('ClubMatiq Berechtigungskonzept', () => {
  const erwarteteRechte: Record<Benutzer['rolle'], Berechtigung[]> = {
    admin: alleBerechtigungen,
    materialverantwortlich: alleBerechtigungen.filter(r => r !== 'benutzer:verwalten' && r !== 'mitglieder:verwalten'),
    leiter: ['inventar:lesen', 'ausleihen:lesen', 'ausleihen:verwalten', 'inventur:lesen', 'inventur:zaehlen'],
    mitglied: ['inventar:lesen']
  };
  it.each(Object.entries(erwarteteRechte).flatMap(([rolle, rechte]) => alleBerechtigungen.map(recht => ({ rolle: rolle as Benutzer['rolle'], recht, erlaubt: rechte.includes(recht) }))))('$rolle / $recht: $erlaubt', ({ rolle, recht, erlaubt }) => {
    const benutzer = testBenutzer(rolle);
    expect(hatBerechtigung(benutzer, recht)).toBe(erlaubt);
    expect(pruefeBerechtigung(benutzer, recht)?.status ?? null).toBe(erlaubt ? null : 403);
  });
  it.each(['constructor', '__proto__', 'toString'])('verweigert reservierte Objektschlüssel als Rolle: %s', rolle => {
    const benutzer = testBenutzer(rolle as Benutzer['rolle']);
    expect(hatBerechtigung(benutzer, 'inventar:lesen')).toBe(false);
    expect(pruefeBerechtigung(benutzer, 'inventar:lesen')?.status).toBe(403);
  });
  it('Administrator hat alle Berechtigungen', () => {
    const benutzer = testBenutzer('admin');

    for (const berechtigung of alleBerechtigungen) {
      expect(hatBerechtigung(benutzer, berechtigung)).toBe(true);
    }
  });

  it('Materialverantwortliche dürfen keine Benutzer verwalten', () => {
    const benutzer = testBenutzer('materialverantwortlich');

    expect(hatBerechtigung(benutzer, 'inventar:bearbeiten')).toBe(true);
    expect(hatBerechtigung(benutzer, 'benutzer:verwalten')).toBe(false);
  });

  it('Leitende dürfen Ausleihen verwalten, aber kein Inventar bearbeiten', () => {
    const benutzer = testBenutzer('leiter');

    expect(hatBerechtigung(benutzer, 'ausleihen:verwalten')).toBe(true);
    expect(hatBerechtigung(benutzer, 'inventar:bearbeiten')).toBe(false);
  });

  it('Mitglieder dürfen Inventar lesen, aber nicht bearbeiten', () => {
    const benutzer = testBenutzer('mitglied');

    expect(hatBerechtigung(benutzer, 'inventar:lesen')).toBe(true);
    expect(hatBerechtigung(benutzer, 'inventar:bearbeiten')).toBe(false);
  });

  it('Nicht angemeldete Benutzer haben keine Berechtigungen', () => {
    expect(hatBerechtigung(null, 'inventar:lesen')).toBe(false);
  });

  it('Nicht angemeldete Benutzer erhalten HTTP 401', () => {
    const antwort = pruefeBerechtigung(null, 'inventar:lesen');

    expect(antwort?.status).toBe(401);
  });

  it('Nicht berechtigte Benutzer erhalten HTTP 403', () => {
    const antwort = pruefeBerechtigung(
      testBenutzer('mitglied'),
      'benutzer:verwalten'
    );

    expect(antwort?.status).toBe(403);
  });

  it('Berechtigte Benutzer werden zugelassen', () => {
    const antwort = pruefeBerechtigung(
      testBenutzer('admin'),
      'benutzer:verwalten'
    );

    expect(antwort).toBeNull();
  });

  it('Unbekannte Benutzerrollen haben keine Berechtigungen', () => {
    const benutzer = {
        id: 'test-123',
        rolle: 'unbekannte_rolle'
    } as unknown as NonNullable<App.Locals['benutzer']>;

    expect(
        hatBerechtigung(benutzer, 'inventar:lesen')
    ).toBe(false);
   });

});
