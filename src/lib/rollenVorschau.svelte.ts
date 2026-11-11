
import { getContext, setContext } from 'svelte';

export type Rolle =
  | 'admin'
  | 'materialverantwortlich'
  | 'leiter'
  | 'mitglied';

const ROLLEN_VORSCHAU_KEY = Symbol('clubmatiq-rollenvorschau');

export class RollenVorschau {
  rolle = $state<Rolle>('admin');

  wechseln(neueRolle: Rolle) {
    this.rolle = neueRolle;
  }

  zuruecksetzen() {
    this.rolle = 'admin';
  }
}

// Erstellt einen eigenen Zustand für das Layout
export function erstelleRollenVorschau(): RollenVorschau {
  const vorschau = new RollenVorschau();

  setContext(ROLLEN_VORSCHAU_KEY, vorschau);

  return vorschau;
}

// Gibt denselben Zustand an untergeordnete Seiten weiter
export function verwendeRollenVorschau(): RollenVorschau {
  const vorschau = getContext<RollenVorschau>(
    ROLLEN_VORSCHAU_KEY
  );

  if (!vorschau) {
    throw new Error(
      'Rollenvorschau wurde im Layout nicht initialisiert.'
    );
  }

  return vorschau;
}
