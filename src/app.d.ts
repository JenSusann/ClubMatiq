
declare global {
  namespace App {
    type Benutzerrolle =
      | 'admin'
      | 'materialverantwortlich'
      | 'leiter'
      | 'mitglied';

    interface Locals {
      benutzer: {
        id: string;
        vereinId: string;
        vorname: string;
        nachname: string;
        email: string;
        rolle: Benutzerrolle;
      } | null;

      sessionId: string | null;
    }
  }
}

export {};
