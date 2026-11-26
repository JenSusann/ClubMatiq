import { getContext, setContext } from 'svelte';

export type Bestaetigen = (text: string, aktion?: string, kritisch?: boolean) => Promise<boolean>;
const schluessel = Symbol('bestaetigung');

export function setzeBestaetigung(bestaetigen: Bestaetigen): void {
  setContext(schluessel, bestaetigen);
}

export function verwendeBestaetigung(): Bestaetigen {
  return getContext<Bestaetigen>(schluessel);
}
