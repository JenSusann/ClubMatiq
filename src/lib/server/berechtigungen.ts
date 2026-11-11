
export type Benutzerrolle = App.Benutzerrolle;

export type Berechtigung =
  | 'inventar:lesen'
  | 'inventar:bearbeiten'
  | 'ausleihen:lesen'
  | 'ausleihen:verwalten'
  | 'stammdaten:verwalten'
  | 'benutzer:verwalten';

const rollenBerechtigungen: Record<
  Benutzerrolle,
  readonly Berechtigung[]
> = {
  admin: [
    'inventar:lesen',
    'inventar:bearbeiten',
    'ausleihen:lesen',
    'ausleihen:verwalten',
    'stammdaten:verwalten',
    'benutzer:verwalten'
  ],

  materialverantwortlich: [
    'inventar:lesen',
    'inventar:bearbeiten',
    'ausleihen:lesen',
    'ausleihen:verwalten',
    'stammdaten:verwalten'
  ],

  leiter: [
    'inventar:lesen',
    'ausleihen:lesen',
    'ausleihen:verwalten'
  ],

  mitglied: [
    'inventar:lesen'
  ]
};

export function hatBerechtigung(
  benutzer: App.Locals['benutzer'],
  berechtigung: Berechtigung
): boolean {
  if (!benutzer) {
    return false;
  }

  const berechtigungen =
    rollenBerechtigungen[benutzer.rolle];

  if (!berechtigungen) {
    return false;
  }

  return berechtigungen.includes(berechtigung);
}

export function pruefeBerechtigung(
  benutzer: App.Locals['benutzer'],
  berechtigung: Berechtigung
): Response | null {
  if (!benutzer) {
    return Response.json(
      {
        fehler: 'Nicht angemeldet.',
        code: 'NICHT_ANGEMELDET'
      },
      { status: 401 }
    );
  }

  if (!hatBerechtigung(benutzer, berechtigung)) {
    return Response.json(
      {
        fehler: 'Keine Berechtigung für diese Aktion.',
        code: 'KEINE_BERECHTIGUNG'
      },
      { status: 403 }
    );
  }

  return null;
}
