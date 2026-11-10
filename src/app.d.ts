
declare global {
  namespace App {
    interface Locals {
      benutzer: {
        id: string;
        vereinId: string;
        vorname: string;
        nachname: string;
        email: string;
        rolle: 'admin' | 'mitglied';
      } | null;

      sessionId: string | null;
    }
  }
}

export {};
