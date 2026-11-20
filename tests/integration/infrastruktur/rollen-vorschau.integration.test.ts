import { beforeEach, describe, expect, it, vi } from 'vitest';

const kontext = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('svelte', () => ({ getContext: kontext.get, setContext: kontext.set }));

// Vitest verwendet hier keine Svelte-Komponenten-Kompilierung.
// Die $state-Rune wird für diese isolierten Logiktests als Identitätsfunktion bereitgestellt.
vi.stubGlobal('$state', <T>(wert: T): T => wert);

import { RollenVorschau, erstelleRollenVorschau, verwendeRollenVorschau } from '../../../src/lib/rollenVorschau.svelte';

beforeEach(() => {
  vi.clearAllMocks();
  kontext.get.mockReturnValue(undefined);
});

describe('Rollenvorschau: Zustand und Svelte-Kontext', () => {
  it('startet mit Administratorrolle', () => {
    expect(new RollenVorschau().rolle).toBe('admin');
  });
  it.each(['materialverantwortlich', 'leiter', 'mitglied', 'admin'] as const)(
    'wechselt die Vorschau auf %s', (rolle) => {
      const vorschau = new RollenVorschau();
      vorschau.wechseln(rolle);
      expect(vorschau.rolle).toBe(rolle);
    }
  );
  it('setzt nach einem Rollenwechsel auf admin zurück', () => {
    const vorschau = new RollenVorschau();
    vorschau.wechseln('mitglied');
    vorschau.zuruecksetzen();
    expect(vorschau.rolle).toBe('admin');
  });
  it('kann mehrfach wechseln und zurücksetzen', () => {
    const vorschau = new RollenVorschau();
    vorschau.wechseln('leiter');
    vorschau.wechseln('materialverantwortlich');
    expect(vorschau.rolle).toBe('materialverantwortlich');
    vorschau.zuruecksetzen();
    expect(vorschau.rolle).toBe('admin');
  });
  it('erstellt eine neue Vorschau und registriert sie im Kontext', () => {
    const vorschau = erstelleRollenVorschau();
    expect(vorschau).toBeInstanceOf(RollenVorschau);
    expect(kontext.set).toHaveBeenCalledOnce();
    const [key, value] = kontext.set.mock.calls[0];
    expect(typeof key).toBe('symbol');
    expect(value).toBe(vorschau);
  });
  it('liefert aus dem Kontext dieselbe Instanz zurück', () => {
    const vorschau = new RollenVorschau();
    kontext.get.mockReturnValue(vorschau);
    expect(verwendeRollenVorschau()).toBe(vorschau);
    expect(kontext.get).toHaveBeenCalledOnce();
    expect(typeof kontext.get.mock.calls[0][0]).toBe('symbol');
  });
  it('verwendet beim Schreiben und Lesen denselben Kontextschlüssel', () => {
    erstelleRollenVorschau();
    kontext.get.mockReturnValue(new RollenVorschau());
    verwendeRollenVorschau();
    expect(kontext.get.mock.calls[0][0]).toBe(kontext.set.mock.calls[0][0]);
  });
  it('meldet verständlichen Fehler ohne initialisierten Kontext', () => {
    expect(() => verwendeRollenVorschau()).toThrow('Rollenvorschau wurde im Layout nicht initialisiert.');
  });
});
