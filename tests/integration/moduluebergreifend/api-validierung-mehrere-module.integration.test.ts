import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => { throw new Error('UNERWARTETER_DATENBANKZUGRIFF'); } },
  client: { startSession: () => { throw new Error('UNERWARTETE_TRANSAKTION'); } }
}));
import * as suite0_route0 from '../../../src/routes/api/artikel/+server';
import * as suite0_route1 from '../../../src/routes/api/ausleihen/+server';
import * as suite0_route2 from '../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';
import * as suite0_route3 from '../../../src/routes/api/inventuren/+server';
import * as suite0_route4 from '../../../src/routes/api/meldungen/+server';
import * as suite0_route5 from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import * as suite0_route6 from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import * as suite0_route7 from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';
import * as suite0_route8 from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import * as suite0_route9 from '../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';
import * as suite0_route10 from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';
import * as suite0_route11 from '../../../src/routes/api/ausleihen/+server';
import * as suite0_route12 from '../../../src/routes/api/inventuren/[id]/abschliessen/+server';
import * as suite0_route13 from '../../../src/routes/api/inventuren/+server';
import * as suite0_route14 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';
import * as suite0_route15 from '../../../src/routes/api/inventuren/+server';
import * as suite0_route16 from '../../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';
import * as suite0_route17 from '../../../src/routes/api/benutzer/einladen/+server';
import * as suite0_route18 from '../../../src/routes/api/benutzer/+server';
import * as suite0_route19 from '../../../src/routes/api/mitglieder/+server';
import * as suite0_route20 from '../../../src/routes/api/meldungen/[id]/+server';
import * as suite0_route21 from '../../../src/routes/api/vereine/+server';
import * as suite0_route22 from '../../../src/routes/api/lieferanten/+server';
import * as suite0_route23 from '../../../src/routes/api/vereinskleider/preise/+server';
import * as suite0_route24 from '../../../src/routes/api/vereinskleider/preise/+server';
import * as suite0_route25 from '../../../src/routes/api/rabatte/+server';
import * as suite0_route26 from '../../../src/routes/api/rabatte/+server';
import * as suite0_route27 from '../../../src/routes/api/vereinskleider/sammelbestellungen/+server';

describe('api-validierung-mehrere-module', () => {
const route0 = suite0_route0;
const route1 = suite0_route1;
const route2 = suite0_route2;
const route3 = suite0_route3;
const route4 = suite0_route4;
const route5 = suite0_route5;
const route6 = suite0_route6;
const route7 = suite0_route7;
const route8 = suite0_route8;
const route9 = suite0_route9;
const route10 = suite0_route10;
const route11 = suite0_route11;
const route12 = suite0_route12;
const route13 = suite0_route13;
const route14 = suite0_route14;
const route15 = suite0_route15;
const route16 = suite0_route16;
const route17 = suite0_route17;
const route18 = suite0_route18;
const route19 = suite0_route19;
const route20 = suite0_route20;
const route21 = suite0_route21;
const route22 = suite0_route22;
const route23 = suite0_route23;
const route24 = suite0_route24;
const route25 = suite0_route25;
const route26 = suite0_route26;
const route27 = suite0_route27;
const basis = { id: '507f1f77bcf86cd799439011', vereinId: '507f1f77bcf86cd799439011', rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
function ereignis(methode: string, daten: unknown, rolle: string | null, id?: string | null) {
  const benutzer = rolle === null ? null : { ...basis, rolle };
  const request = new Request('http://localhost/api/test', {
    method: methode,
    ...(methode === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) })
  });
  return { request, locals: { benutzer }, params: { id }, url: new URL(request.url) } as any;
}


// Ursprüngliche Datei: paket13-artikel-validierung.integration.test.ts
describe('Paket 13: artikel-validierung', () => {
  it("Artikelname fehlt", async () => {
    const response = await route0.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Kategorie fehlt", async () => {
    const response = await route0.POST(ereignis("POST", {"name": "Test"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Negativer Einzelwert", async () => {
    const response = await route0.POST(ereignis("POST", {"name": "Test", "kategorieId": "507f1f77bcf86cd799439012", "lagerortId": "507f1f77bcf86cd799439012", "einzelwert": -1}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Grössenflag muss Boolean sein", async () => {
    const response = await route0.POST(ereignis("POST", {"name": "Test", "kategorieId": "507f1f77bcf86cd799439012", "lagerortId": "507f1f77bcf86cd799439012", "einzelwert": 1, "hatGroessen": "ja"}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket13-ausleihe-validierung.integration.test.ts
describe('Paket 13: ausleihe-validierung', () => {
  it("Artikel fehlt", async () => {
    const response = await route1.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Person fehlt", async () => {
    const response = await route1.POST(ereignis("POST", {"artikelId": "507f1f77bcf86cd799439012"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Menge Null", async () => {
    const response = await route1.POST(ereignis("POST", {"artikelId": "507f1f77bcf86cd799439012", "person": "A", "menge": 0}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Ungültiges Datum", async () => {
    const response = await route1.POST(ereignis("POST", {"artikelId": "507f1f77bcf86cd799439012", "person": "A", "menge": 1, "ausleihdatum": "2026-02-30", "rueckgabedatum": "2026-03-01"}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket13-bestellungen-uebergabe.integration.test.ts
describe('Paket 13: bestellungen-uebergabe', () => {
  it("Vorgang fehlt", async () => {
    const response = await route2.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Negativer Positionsindex", async () => {
    const response = await route2.POST(ereignis("POST", {"vorgangId": "507f1f77bcf86cd799439012", "positionsIndex": -1, "menge": 1}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Zu grosse Menge", async () => {
    const response = await route2.POST(ereignis("POST", {"vorgangId": "507f1f77bcf86cd799439012", "positionsIndex": 0, "menge": 10001}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket13-inventur-validierung.integration.test.ts
describe('Paket 13: inventur-validierung', () => {
  it("Inventurname fehlt", async () => {
    const response = await route3.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Inventurtyp falsch", async () => {
    const response = await route3.POST(ereignis("POST", {"name": "Test", "typ": "falsch"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Lagerort fehlt", async () => {
    const response = await route3.POST(ereignis("POST", {"name": "Test", "typ": "lagerort"}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket13-meldungen-validierung.integration.test.ts
describe('Paket 13: meldungen-validierung', () => {
  it("Artikel fehlt", async () => {
    const response = await route4.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Beschreibung fehlt", async () => {
    const response = await route4.POST(ereignis("POST", {"artikelId": "507f1f77bcf86cd799439012"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Zu viele Fotos", async () => {
    const response = await route4.POST(ereignis("POST", {"artikelId": "507f1f77bcf86cd799439012", "beschreibung": "Test", "fotos": [1, 2, 3, 4]}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Fremdes Foto", async () => {
    const response = await route4.POST(ereignis("POST", {"artikelId": "507f1f77bcf86cd799439012", "beschreibung": "Test", "fotos": [{"url": "https://example.com/x", "publicId": "fremd"}]}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket14-gutschriften-rechte.integration.test.ts
describe('Paket 14: gutschriften-rechte', () => {
  it("Mitglied darf Gutschriften nicht lesen", async () => {
    const response = await route5.GET(ereignis("GET", null, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Ohne Login keine Gutschriften", async () => {
    const response = await route5.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
});



// Ursprüngliche Datei: paket14-rechnung-erstellen.integration.test.ts
describe('Paket 14: rechnung-erstellen', () => {
  it("Verkaufs-ID fehlt", async () => {
    const response = await route6.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Verkaufs-ID ungültig", async () => {
    const response = await route6.POST(ereignis("POST", {"verkaufId": "x"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Mitglied darf nicht verrechnen", async () => {
    const response = await route6.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket14-rechnung-zahlungsvalidierung.integration.test.ts
describe('Paket 14: rechnung-zahlungsvalidierung', () => {
  it("Ungültige Rechnungs-ID", async () => {
    const response = await route7.PATCH(ereignis("PATCH", {}, "admin", "falsch"));
    expect(response.status).toBe(400);
  });
  it("Zahlungsdaten fehlen", async () => {
    const response = await route7.PATCH(ereignis("PATCH", {}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
  it("Negativer Betrag", async () => {
    const response = await route7.PATCH(ereignis("PATCH", {"betrag": -1}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
  it("Ungültiges Zahlungsdatum", async () => {
    const response = await route7.PATCH(ereignis("PATCH", {"betrag": 1, "datum": "2026-02-30"}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
  it("Nicht unterstützte Zahlungsart", async () => {
    const response = await route7.PATCH(ereignis("PATCH", {"betrag": 1, "datum": "2026-11-19", "zahlungsart": "kreditkarte"}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket14-stornierung-validierung.integration.test.ts
describe('Paket 14: stornierung-validierung', () => {
  it("Stornierungsdaten fehlen", async () => {
    const response = await route8.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Positionsindex negativ", async () => {
    const response = await route8.POST(ereignis("POST", {"verkaufId": "507f1f77bcf86cd799439012", "positionsIndex": -1, "menge": 1, "grund": "Test"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Stornomenge Null", async () => {
    const response = await route8.POST(ereignis("POST", {"verkaufId": "507f1f77bcf86cd799439012", "positionsIndex": 0, "menge": 0, "grund": "Test"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Stornierungsgrund fehlt", async () => {
    const response = await route8.POST(ereignis("POST", {"verkaufId": "507f1f77bcf86cd799439012", "positionsIndex": 0, "menge": 1, "grund": ""}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket14-uebergabe-rechte.integration.test.ts
describe('Paket 14: uebergabe-rechte', () => {
  it("Mitglied darf nicht übergeben", async () => {
    const response = await route9.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Ohne Login keine Übergabe", async () => {
    const response = await route9.POST(ereignis("POST", {}, null, null));
    expect(response.status).toBe(401);
  });
});



// Ursprüngliche Datei: paket14-zahlung-rechte.integration.test.ts
describe('Paket 14: zahlung-rechte', () => {
  it("Mitglied darf nicht buchen", async () => {
    const response = await route10.PATCH(ereignis("PATCH", {}, "mitglied", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(403);
  });
  it("Ohne Login keine Zahlung", async () => {
    const response = await route10.PATCH(ereignis("PATCH", {}, null, "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(401);
  });
});



// Ursprüngliche Datei: paket15-ausleihe-rechte.integration.test.ts
describe('Paket 15: ausleihe-rechte', () => {
  it("Mitglied darf nicht ausleihen", async () => {
    const response = await route11.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Mitglied darf Ausleihen nicht lesen", async () => {
    const response = await route11.GET(ereignis("GET", null, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Ohne Login keine Ausleihen", async () => {
    const response = await route11.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
});



// Ursprüngliche Datei: paket15-inventur-abschluss-rechte.integration.test.ts
describe('Paket 15: inventur-abschluss-rechte', () => {
  it("Ohne Login kein Abschluss", async () => {
    const response = await route12.POST(ereignis("POST", {}, null, "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(401);
  });
  it("Leiter darf nicht abschliessen", async () => {
    const response = await route12.POST(ereignis("POST", {}, "leiter", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(403);
  });
  it("Ungültige Inventur-ID", async () => {
    const response = await route12.POST(ereignis("POST", {}, "admin", "falsch"));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket15-inventur-erstellen-rechte.integration.test.ts
describe('Paket 15: inventur-erstellen-rechte', () => {
  it("Ohne Login keine Inventur", async () => {
    const response = await route13.POST(ereignis("POST", {}, null, null));
    expect(response.status).toBe(401);
  });
  it("Mitglied darf nicht erstellen", async () => {
    const response = await route13.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Leiter darf nicht erstellen", async () => {
    const response = await route13.POST(ereignis("POST", {}, "leiter", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket15-inventur-korrekturverlauf.integration.test.ts
describe('Paket 15: inventur-korrekturverlauf', () => {
  it("Ohne Login kein Verlauf", async () => {
    const response = await route14.GET(ereignis("GET", null, null, "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(401);
  });
  it("Leiter darf Verlauf nicht lesen", async () => {
    const response = await route14.GET(ereignis("GET", null, "leiter", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(403);
  });
  it("Ungültige Inventur-ID", async () => {
    const response = await route14.GET(ereignis("GET", null, "admin", "falsch"));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket15-inventur-listenrechte.integration.test.ts
describe('Paket 15: inventur-listenrechte', () => {
  it("Ohne Login keine Liste", async () => {
    const response = await route15.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Mitglied darf Inventuren nicht lesen", async () => {
    const response = await route15.GET(ereignis("GET", null, "mitglied", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket15-inventur-reset-rechte.integration.test.ts
describe('Paket 15: inventur-reset-rechte', () => {
  it("Ohne Login kein Reset", async () => {
    const response = await route16.POST(ereignis("POST", {}, null, "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(401);
  });
  it("Leiter darf nicht zurücksetzen", async () => {
    const response = await route16.POST(ereignis("POST", {}, "leiter", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(403);
  });
  it("Ungültige Inventur-ID", async () => {
    const response = await route16.POST(ereignis("POST", {}, "admin", "falsch"));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket16-benutzereinladungen.integration.test.ts
describe('Paket 16: benutzereinladungen', () => {
  it("Ohne Login keine Einladung", async () => {
    const response = await route17.POST(ereignis("POST", {}, null, null));
    expect(response.status).toBe(401);
  });
  it("Leiter darf nicht einladen", async () => {
    const response = await route17.POST(ereignis("POST", {}, "leiter", null));
    expect(response.status).toBe(403);
  });
  it("Pflichtfelder fehlen", async () => {
    const response = await route17.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Ungültige Rolle", async () => {
    const response = await route17.POST(ereignis("POST", {"vorname": "A", "nachname": "B", "email": "a@b.ch", "rolle": "superadmin"}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket16-benutzerverwaltung-rechte.integration.test.ts
describe('Paket 16: benutzerverwaltung-rechte', () => {
  it("Ohne Login keine Benutzer", async () => {
    const response = await route18.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Materialverantwortliche dürfen keine Benutzer verwalten", async () => {
    const response = await route18.GET(ereignis("GET", null, "materialverantwortlich", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket16-mitglieder-rechte.integration.test.ts
describe('Paket 16: mitglieder-rechte', () => {
  it("Mitglied darf Liste nicht sehen", async () => {
    const response = await route19.GET(ereignis("GET", null, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Leiter darf Liste nicht sehen", async () => {
    const response = await route19.GET(ereignis("GET", null, "leiter", null));
    expect(response.status).toBe(403);
  });
  it("Ohne Login keine Mitglieder", async () => {
    const response = await route19.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Mitglied darf nicht importieren", async () => {
    const response = await route19.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket16-schadensmeldung-status.integration.test.ts
describe('Paket 16: schadensmeldung-status', () => {
  it("Ungültige Meldungs-ID", async () => {
    const response = await route20.PATCH(ereignis("PATCH", {}, "admin", "falsch"));
    expect(response.status).toBe(400);
  });
  it("Status fehlt", async () => {
    const response = await route20.PATCH(ereignis("PATCH", {}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
  it("Unbekannter Status", async () => {
    const response = await route20.PATCH(ereignis("PATCH", {"status": "verloren", "bearbeitungsnotiz": ""}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
  it("Notiz muss Text sein", async () => {
    const response = await route20.PATCH(ereignis("PATCH", {"status": "offen", "bearbeitungsnotiz": 42}, "admin", "507f1f77bcf86cd799439012"));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket16-vereinsdaten-rechte.integration.test.ts
describe('Paket 16: vereinsdaten-rechte', () => {
  it("Ohne Login kein Verein", async () => {
    const response = await route21.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Ohne Login keine Vereinserstellung", async () => {
    const response = await route21.POST(ereignis("POST", {}, null, null));
    expect(response.status).toBe(401);
  });
});



// Ursprüngliche Datei: paket17-lieferanten-rechte.integration.test.ts
describe('Paket 17: lieferanten-rechte', () => {
  it("Ohne Login keine Lieferanten", async () => {
    const response = await route22.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Leiter darf keine Lieferanten erstellen", async () => {
    const response = await route22.POST(ereignis("POST", {}, "leiter", null));
    expect(response.status).toBe(403);
  });
  it("Mitglied darf Lieferanten nicht ändern", async () => {
    const response = await route22.PATCH(ereignis("PATCH", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Mitglied darf Lieferanten nicht löschen", async () => {
    const response = await route22.DELETE(ereignis("DELETE", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket17-preis-randfaelle.integration.test.ts
describe('Paket 17: preis-randfaelle', () => {
  it("Negativer Verkaufspreis", async () => {
    const response = await route23.PUT(ereignis("PUT", {"artikelId": "507f1f77bcf86cd799439012", "preistyp": "fix", "druckkosten": 0, "verkaufspreis": -1}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Zu viele Dezimalstellen", async () => {
    const response = await route23.PUT(ereignis("PUT", {"artikelId": "507f1f77bcf86cd799439012", "preistyp": "variabel", "druckkosten": 0, "verkaufspreis": 1.234}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Ungültige Grössen-ID", async () => {
    const response = await route23.PUT(ereignis("PUT", {"artikelId": "507f1f77bcf86cd799439012", "groesseId": "ungültig", "preistyp": "fix", "druckkosten": 0, "verkaufspreis": 1}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket17-preisrechte.integration.test.ts
describe('Paket 17: preisrechte', () => {
  it("Ohne Login keine Preise", async () => {
    const response = await route24.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Ohne Login keine Preisänderung", async () => {
    const response = await route24.PUT(ereignis("PUT", {}, null, null));
    expect(response.status).toBe(401);
  });
  it("Leiter darf Preise nicht ändern", async () => {
    const response = await route24.PUT(ereignis("PUT", {}, "leiter", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket17-rabatt-randfaelle.integration.test.ts
describe('Paket 17: rabatt-randfaelle', () => {
  it("Ungültiges Datum", async () => {
    const response = await route25.POST(ereignis("POST", {"name": "Test", "rabattart": "prozent", "geltungsbereich": "warenkorb", "wert": 10, "gueltigAb": "2026-02-30"}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Maximale Menge Null", async () => {
    const response = await route25.POST(ereignis("POST", {"name": "Test", "rabattart": "prozent", "geltungsbereich": "warenkorb", "wert": 10, "maximaleMenge": 0}, "admin", null));
    expect(response.status).toBe(400);
  });
  it("Kombinierbar muss Boolean sein", async () => {
    const response = await route25.POST(ereignis("POST", {"name": "Test", "rabattart": "prozent", "geltungsbereich": "warenkorb", "wert": 10, "kombinierbar": "ja"}, "admin", null));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket17-rabatt-rechte.integration.test.ts
describe('Paket 17: rabatt-rechte', () => {
  it("Ohne Login keine Rabatte", async () => {
    const response = await route26.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Mitglied darf keine Rabatte erstellen", async () => {
    const response = await route26.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Leiter darf keine Rabatte verwalten", async () => {
    const response = await route26.GET(ereignis("GET", null, "leiter", null));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket17-sammelbestellung-rechte.integration.test.ts
describe('Paket 17: sammelbestellung-rechte', () => {
  it("Ohne Login keine Sammelbestellungen", async () => {
    const response = await route27.GET(ereignis("GET", null, null, null));
    expect(response.status).toBe(401);
  });
  it("Mitglied darf keine Sammelbestellungen erstellen", async () => {
    const response = await route27.POST(ereignis("POST", {}, "mitglied", null));
    expect(response.status).toBe(403);
  });
  it("Leere Sammelbestellung", async () => {
    const response = await route27.POST(ereignis("POST", {}, "admin", null));
    expect(response.status).toBe(400);
  });
});


});
import * as suite1_route0 from '../../../src/routes/api/inventuren/[id]/korrekturhistorie/+server';
import * as suite1_route1 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';
import * as suite1_route2 from '../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/pdf/+server';
import * as suite1_route3 from '../../../src/routes/api/vereinskleider/sammelbestellungen/pdf/+server';
import * as suite1_route4 from '../../../src/routes/api/meldungen/[id]/+server';
import * as suite1_route5 from '../../../src/routes/api/meldungen/+server';
import * as suite1_route6 from '../../../src/routes/api/vereinskleider/export/+server';

describe('api-validierungen', () => {
const route0 = suite1_route0;
const route1 = suite1_route1;
const route2 = suite1_route2;
const route3 = suite1_route3;
const route4 = suite1_route4;
const route5 = suite1_route5;
const route6 = suite1_route6;
const admin = { id: '507f1f77bcf86cd799439011', vereinId: '507f1f77bcf86cd799439012', rolle: 'admin', aktiv: true };
const mitglied = { ...admin, rolle: 'mitglied' };
const oid = '507f1f77bcf86cd799439013';
function ereignis(methode: string, pfad: string, daten: unknown, benutzer: unknown = admin, id = oid) {
  const url = new URL('http://localhost' + pfad);
  return { params: { id }, locals: { benutzer }, url,
    request: new Request(url, { method: methode, headers: { 'content-type': 'application/json' },
      ...(methode !== 'GET' ? { body: JSON.stringify(daten) } : {}) }) } as any;
}


// Ursprüngliche Datei: inventur-korrekturhistorie-validierung.integration.test.ts
describe('inventur-korrekturhistorie-validierung', () => {
  it('Mitglied darf Historie nicht lesen', async () => {
    const antwort = await route0.GET(ereignis('GET', '/api/inventuren/' + oid + '/korrekturhistorie', null, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige Inventur-ID', async () => {
    const antwort = await route0.GET(ereignis('GET', '/api/inventuren/falsch/korrekturhistorie', null, admin, 'falsch'));
    expect(antwort.status).toBe(400);
  });
});



// Ursprüngliche Datei: sammelbestellung-aendern-validierung.integration.test.ts
describe('sammelbestellung-aendern-validierung', () => {
  it('kein Zugriff fuer Mitglied', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'bestellen' }, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige ID', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/falsch', { aktion: 'bestellen' }, admin, 'falsch'));
    expect(antwort.status).toBe(400);
  });
  it('ungueltiger Body', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, []));
    expect(antwort.status).toBe(400);
  });
  it('ungueltige Aktion', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'loeschen' }));
    expect(antwort.status).toBe(400);
  });
  it('Wareneingang ohne Positionen', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'wareneingang', positionen: [] }));
    expect(antwort.status).toBe(400);
  });
  it('Wareneingang mit falscher Artikel-ID', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'wareneingang', positionen: [{ artikelId: 'falsch', groesseId: null, menge: 1 }] }));
    expect(antwort.status).toBe(400);
  });
  it('Wareneingang mit negativer Menge', async () => {
    const antwort = await route1.PATCH(ereignis('PATCH', '/api/vereinskleider/sammelbestellungen/' + oid, { aktion: 'wareneingang', positionen: [{ artikelId: oid, groesseId: null, menge: -1 }] }));
    expect(antwort.status).toBe(400);
  });
});



// Ursprüngliche Datei: sammelbestellung-einzelpdf-validierung.integration.test.ts
describe('sammelbestellung-einzelpdf-validierung', () => {
  it('Mitglied darf kein PDF erstellen', async () => {
    const antwort = await route2.GET(ereignis('GET', '/api/vereinskleider/sammelbestellungen/' + oid + '/pdf', null, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige ID wird abgelehnt', async () => {
    await expect(route2.GET(ereignis('GET', '/api/vereinskleider/sammelbestellungen/falsch/pdf', null, admin, 'falsch'))).rejects.toMatchObject({ status: 400 });
  });
});



// Ursprüngliche Datei: sammelbestellung-sammelpdf-validierung.integration.test.ts
describe('sammelbestellung-sammelpdf-validierung', () => {
  it('Mitglied darf nicht exportieren', async () => {
    const antwort = await route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: [oid] }, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige Daten werden abgelehnt', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', []))).rejects.toMatchObject({ status: 400 });
  });
  it('keine IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: [] }))).rejects.toMatchObject({ status: 400 });
  });
  it('ungueltige IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: ['falsch'] }))).rejects.toMatchObject({ status: 400 });
  });
  it('doppelte IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: [oid, oid] }))).rejects.toMatchObject({ status: 400 });
  });
  it('maximal 50 IDs', async () => {
    await expect(route3.POST(ereignis('POST', '/api/vereinskleider/sammelbestellungen/pdf', { bestellungIds: Array.from({length: 51}, (_,i) => i.toString(16).padStart(24,'0')) }))).rejects.toMatchObject({ status: 400 });
  });
});



// Ursprüngliche Datei: schadensmeldungen-status.integration.test.ts
describe('schadensmeldungen-status', () => {
  it('nicht angemeldet', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, {}, null));
    expect(antwort.status).toBe(401);
  });
  it('Mitglied darf nicht bearbeiten', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, {}, mitglied));
    expect(antwort.status).toBe(403);
  });
  it('ungueltige Meldungs-ID', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/falsch', {}, admin, 'falsch'));
    expect(antwort.status).toBe(400);
  });
  it('ungueltige Nutzdaten', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, []));
    expect(antwort.status).toBe(400);
  });
  it('ungueltiger Status', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, { status: 'geloescht', bearbeitungsnotiz: '' }));
    expect(antwort.status).toBe(400);
  });
  it('Notiz muss String sein', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, { status: 'offen', bearbeitungsnotiz: null }));
    expect(antwort.status).toBe(400);
  });
  it('Notiz zu lang', async () => {
    const antwort = await route4.PATCH(ereignis('PATCH', '/api/meldungen/' + oid, { status: 'erledigt', bearbeitungsnotiz: 'x'.repeat(2001) }));
    expect(antwort.status).toBe(400);
  });
});



// Ursprüngliche Datei: schadensmeldungen-validierung.integration.test.ts
describe('schadensmeldungen-validierung', () => {
  it('Anmeldung erforderlich', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', {}, null));
    expect(antwort.status).toBe(401);
  });
  it('ungueltige Nutzdaten', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', []));
    expect(antwort.status).toBe(400);
  });
  it('Artikel-ID erforderlich', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: 'falsch', beschreibung: 'Defekt' }));
    expect(antwort.status).toBe(400);
  });
  it('Beschreibung erforderlich', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: '   ' }));
    expect(antwort.status).toBe(400);
  });
  it('Beschreibung maximal 2000 Zeichen', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'x'.repeat(2001) }));
    expect(antwort.status).toBe(400);
  });
  it('hoechstens drei Fotos', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'Defekt', fotos: [1,2,3,4] }));
    expect(antwort.status).toBe(400);
  });
  it('keine fremden Cloudinary-Ordner', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'Defekt', fotos: [{ url: 'https://res.cloudinary.com/test/a.jpg', publicId: 'andererverein/schadensmeldungen/bild' }] }));
    expect(antwort.status).toBe(400);
  });
  it('keine doppelten Fotos', async () => {
    const antwort = await route5.POST(ereignis('POST', '/api/meldungen', { artikelId: oid, beschreibung: 'Defekt', fotos: Array(2).fill({ url: 'https://res.cloudinary.com/demo/image/upload/x', publicId: `clubmatiq/${admin.vereinId}/schadensmeldungen/bild` }) }));
    expect(antwort.status).toBe(400);
  });
});



// Ursprüngliche Datei: vereinskleider-export-berechtigung.integration.test.ts
describe('vereinskleider-export-berechtigung', () => {
  it('Mitglied darf Export nicht ausfuehren', async () => {
    const antwort = await route6.GET(ereignis('GET', '/api/vereinskleider/export', null, mitglied));
    expect(antwort.status).toBe(403);
  });
});


});
import * as suite2_route0 from '../../../src/routes/api/benutzer/+server.ts';
import * as suite2_route1 from '../../../src/routes/api/lieferanten/+server.ts';
import * as suite2_route2 from '../../../src/routes/api/vereinskleider/preise/+server.ts';
import * as suite2_route3 from '../../../src/routes/api/rabatte/+server.ts';
import * as suite2_route4 from '../../../src/routes/api/registrieren/+server.ts';
import * as suite2_route5 from '../../../src/routes/api/vereine/+server.ts';

describe('benutzer-2', () => {
const route0 = suite2_route0;
const route1 = suite2_route1;
const route2 = suite2_route2;
const route3 = suite2_route3;
const route4 = suite2_route4;
const route5 = suite2_route5;
const admin = { id: 'test', vereinId: '507f1f77bcf86cd799439011', rolle: 'admin', vorname: 'Test', nachname: 'Admin' };
const mitglied = { ...admin, rolle: 'mitglied' };
const leiter = { ...admin, rolle: 'leiter' };
function event(method: string, body: unknown, benutzer: unknown = admin, id?: string) {
  return {
    request: new Request('http://localhost/api/test', {
      method, ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    }),
    locals: { benutzer }, params: { id }
  } as any;
}


// Ursprüngliche Datei: paket11-benutzer-liste.integration.test.ts
describe('Paket 11 – Benutzerliste', () => {
  it('ohne Anmeldung 401', async () => {
    const response = await route0.GET(event('GET', null, null));
    expect(response.status).toBe(401);
  });
  it('Mitglied ohne Rechte 403', async () => {
    const response = await route0.GET(event('GET', null, mitglied));
    expect(response.status).toBe(403);
  });
  it('Leiter ohne Rechte 403', async () => {
    const response = await route0.GET(event('GET', null, leiter));
    expect(response.status).toBe(403);
  });
});



// Ursprüngliche Datei: paket11-lieferanten.integration.test.ts
describe('Paket 11 – Lieferanten', () => {
  it('Mitglied darf nicht lesen 403', async () => {
    const response = await route1.GET(event('GET', null, mitglied));
    expect(response.status).toBe(403);
  });
  it('Name fehlt 400', async () => {
    const response = await route1.POST(event('POST', { name: '' }));
    expect(response.status).toBe(400);
  });
  it('ungueltige Mail 400', async () => {
    const response = await route1.POST(event('POST', { name: 'Test', email: 'keine-mail' }));
    expect(response.status).toBe(400);
  });
  it('ungueltige ID 400', async () => {
    const response = await route1.PATCH(event('PATCH', { id: 'falsch', name: 'Test' }));
    expect(response.status).toBe(400);
  });
  it('ungueltige ID 400', async () => {
    const response = await route1.DELETE(event('DELETE', { id: 'falsch' }));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket11-preise.integration.test.ts
describe('Paket 11 – Vereinskleiderpreise', () => {
  it('ohne Anmeldung 401', async () => {
    const response = await route2.GET(event('GET', null, null));
    expect(response.status).toBe(401);
  });
  it('Mitglied darf keine Preise aendern 403', async () => {
    const response = await route2.PUT(event('PUT', {}, mitglied));
    expect(response.status).toBe(403);
  });
  it('ungueltige Artikel-ID 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: 'falsch' }));
    expect(response.status).toBe(400);
  });
  it('ungueltiger Preistyp 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: '507f1f77bcf86cd799439012', preistyp: 'gratis', druckkosten: 0, verkaufspreis: 1 }));
    expect(response.status).toBe(400);
  });
  it('negative Druckkosten 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: '507f1f77bcf86cd799439012', preistyp: 'fix', druckkosten: -1, verkaufspreis: 1 }));
    expect(response.status).toBe(400);
  });
  it('Fixpreis ohne Verkaufspreis 400', async () => {
    const response = await route2.PUT(event('PUT', { artikelId: '507f1f77bcf86cd799439012', preistyp: 'fix', druckkosten: 0, verkaufspreis: null }));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket11-rabatte.integration.test.ts
describe('Paket 11 – Rabattregeln', () => {
  it('Mitglied darf nicht lesen 403', async () => {
    const response = await route3.GET(event('GET', null, mitglied));
    expect(response.status).toBe(403);
  });
  it('Rabattname fehlt 400', async () => {
    const response = await route3.POST(event('POST', { rabattart: 'prozent', geltungsbereich: 'warenkorb', wert: 10 }));
    expect(response.status).toBe(400);
  });
  it('Prozentrabatt ueber 100 400', async () => {
    const response = await route3.POST(event('POST', { name: 'Test', rabattart: 'prozent', geltungsbereich: 'warenkorb', wert: 101 }));
    expect(response.status).toBe(400);
  });
  it('ungueltiger Rabattwert 400', async () => {
    const response = await route3.POST(event('POST', { name: 'Test', rabattart: 'betrag', geltungsbereich: 'warenkorb', wert: -2 }));
    expect(response.status).toBe(400);
  });
  it('Artikelrabatt ohne Artikel 400', async () => {
    const response = await route3.POST(event('POST', { name: 'Test', rabattart: 'betrag', geltungsbereich: 'artikel', wert: 5, artikelIds: [] }));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket11-registrierung.integration.test.ts
describe('Paket 11 – Registrierung', () => {
  it('Pflichtfelder fehlen 400', async () => {
    const response = await route4.POST(event('POST', {}));
    expect(response.status).toBe(400);
  });
  it('ungueltige E-Mail 400', async () => {
    const response = await route4.POST(event('POST', { vereinsname: 'Verein', vorname: 'A', nachname: 'B', email: 'falsch', passwort: '123456789012' }));
    expect(response.status).toBe(400);
  });
  it('Passwort zu kurz 400', async () => {
    const response = await route4.POST(event('POST', { vereinsname: 'Verein', vorname: 'A', nachname: 'B', email: 'a@b.ch', passwort: 'kurz' }));
    expect(response.status).toBe(400);
  });
});



// Ursprüngliche Datei: paket11-vereine.integration.test.ts
describe('Paket 11 – Vereinsverwaltung', () => {
  it('ohne Anmeldung 401', async () => {
    const response = await route5.GET(event('GET', null, null));
    expect(response.status).toBe(401);
  });
  it('mit ungueltiger Vereins-ID 400', async () => {
    const response = await route5.GET(event('GET', null, { ...admin, vereinId: 'falsch' }));
    expect(response.status).toBe(400);
  });
  it('ohne Anmeldung 401', async () => {
    const response = await route5.POST(event('POST', {}, null));
    expect(response.status).toBe(401);
  });
  it('direkte Vereinserstellung verweigert 403', async () => {
    const response = await route5.POST(event('POST', {}));
    expect(response.status).toBe(403);
  });
});


});
