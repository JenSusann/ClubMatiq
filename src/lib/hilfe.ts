export type HilfeAbschnitt = { titel: string; schritte?: string[]; text?: string };
export type HilfeArtikel = { slug: string; titel: string; gruppe: string; beschreibung: string; rollen: string; abschnitte: HilfeAbschnitt[] };

export const hilfeArtikel: HilfeArtikel[] = [
  { slug:'erste-schritte', titel:'Erste Schritte', gruppe:'Grundlagen', beschreibung:'Registrierung, Anmeldung und erste Einrichtung.', rollen:'Alle; Registrierung öffentlich', abschnitte:[
    {titel:'Verein registrieren', schritte:['Öffne die Registrierung über die öffentliche Startseite.','Gib Vereinsname, persönliche Angaben und ein sicheres Passwort ein.','Nach der Registrierung wird dein Verein erstellt und dein Konto als Administrator eingerichtet.']},
    {titel:'Nach der Anmeldung', text:'Im Dashboard siehst du die Kennzahlen und die Funktionen, die für deine Rolle freigeschaltet sind.'},
    {titel:'Empfohlene Reihenfolge', schritte:['Kategorien und Lagerorte in den Stammdaten erfassen.','Bei Vereinskleidern die benötigten Grössen erfassen.','Inventarartikel anlegen und Bestände prüfen.','Weitere Benutzer über die Benutzerverwaltung einrichten.']}
  ]},
  { slug:'rollen-berechtigungen', titel:'Rollen und Berechtigungen', gruppe:'Grundlagen', beschreibung:'Wer darf welche Funktionen verwenden?', rollen:'Alle; Verwaltung durch Administrator', abschnitte:[
    {titel:'Die vier Rollen', text:'Administrator: Verwaltung des Vereins und der Benutzer. Materialverantwortlich: Inventar, Ausleihen, Vereinskleider, Inventur und allgemeine Stammdaten. Leiter/in: Material ansehen und ausleihen sowie freigegebene Inventurfunktionen. Mitglied: Inventar ansehen und Schäden melden.'},
    {titel:'Wichtig', text:'Die sichtbaren Menüpunkte richten sich nach der Rolle. Serverseitige Berechtigungen werden unabhängig von der Navigation geprüft. Die Rollen-Vorschau des Administrators simuliert nur die Anzeige.'}
  ]},
  { slug:'inventar', titel:'Inventar verwalten', gruppe:'Material', beschreibung:'Artikel erfassen, suchen, bearbeiten und Mindestbestände kontrollieren.', rollen:'Lesen: alle; Bearbeiten: Administrator und Materialverantwortlich', abschnitte:[
    {titel:'Artikel erfassen', schritte:['Öffne Inventar und wähle die Funktion zum Erfassen eines Artikels.','Trage Name, Kategorie, Lagerort, Menge und gegebenenfalls Beschreibung und Wert ein.','Bei Kleidungsartikeln verwaltest du Bestände je Grösse.','Speichere den Artikel.']},
    {titel:'Mindestbestand', text:'Für normale Artikel und Grössenvarianten können Mindestbestände hinterlegt werden. Unterschreitet die vorhandene Menge den Grenzwert, erscheint eine Warnung. Der Wert 0 deaktiviert die Warnschwelle.'},
    {titel:'Suchen und exportieren', text:'Die Inventarübersicht unterstützt die Materialsuche und einen CSV-Export. Artikel mit unterschrittenem Mindestbestand lassen sich gezielt anzeigen.'}
  ]},
  { slug:'stammdaten', titel:'Stammdaten', gruppe:'Material', beschreibung:'Kategorien, Lagerorte, Grössen, Rabatte und Lieferanten.', rollen:'Administrator und Materialverantwortlich; Mitglieder nur Administrator', abschnitte:[
    {titel:'Allgemeine Stammdaten', schritte:['Öffne Stammdaten im Dashboard oder in der Navigation.','Wähle Kategorien, Lagerorte, Grössen, Rabatte oder Lieferanten.','Erfasse und verwalte die benötigten Einträge.']},
    {titel:'Mitgliederdaten', text:'Die ClubDesk-Mitgliederverwaltung und der CSV-Import sind ausschliesslich für Administratoren vorgesehen.'},
    {titel:'Referenzen', text:'Bereits verwendete Kategorien oder Lagerorte können je nach bestehender Referenz nicht gelöscht werden.'}
  ]},
  { slug:'ausleihen', titel:'Ausleihen und Rückgaben', gruppe:'Material', beschreibung:'Material ausgeben, offene Ausleihen verfolgen und Rückgaben erfassen.', rollen:'Administrator, Materialverantwortlich und Leiter/in', abschnitte:[
    {titel:'Ausleihe', schritte:['Öffne Ausleihen.','Wähle den Artikel und erfasse die benötigte Menge sowie die ausleihende Person.','Speichere die Ausleihe und kontrolliere sie in der Übersicht.']},
    {titel:'Rückgabe', schritte:['Öffne eine offene Ausleihe.','Erfasse die zurückgegebene Menge.','Prüfe den verbleibenden offenen Bestand.']}
  ]},
  { slug:'qr-code', titel:'QR-Codes', gruppe:'Material', beschreibung:'Artikel über QR-Codes schnell öffnen.', rollen:'Alle angemeldeten Rollen', abschnitte:[
    {titel:'Verwendung', text:'Über die QR-Code-Funktion kannst du Inventarartikel direkt aufrufen. Die verfügbaren Aktionen hängen von deinen Berechtigungen ab.'}
  ]},
  { slug:'vereinskleider', titel:'Vereinskleider', gruppe:'Verkauf', beschreibung:'Kleiderartikel, Bestellungen, Verkäufe und Rechnungen.', rollen:'Administrator und Materialverantwortlich', abschnitte:[
    {titel:'Kleider verwalten', schritte:['Erfasse Kleidungsartikel im Inventar mit den benötigten Grössen.','Kontrolliere die Bestände pro Grösse.','Öffne Vereinskleider, um Bestellungen und Verkäufe zu bearbeiten.']},
    {titel:'Bestellungen und Rechnungen', text:'Offene Kleiderbestellungen erscheinen im Dashboard. Für die Abrechnung stehen die im Modul Vereinskleider implementierten Rechnungsfunktionen zur Verfügung.'}
  ]},
  { slug:'inventur', titel:'Inventur', gruppe:'Kontrolle', beschreibung:'Bestände zählen und Abweichungen bearbeiten.', rollen:'Administrator und Materialverantwortlich; Zählen auch Leiter/in', abschnitte:[
    {titel:'Inventur durchführen', schritte:['Öffne Inventur.','Erstelle eine Inventur, sofern deine Rolle dies erlaubt.','Erfasse die gezählten Bestände.','Prüfe Abweichungen und schliesse die Inventur mit der erforderlichen Berechtigung ab.']}
  ]},
  { slug:'inventarbewertung', titel:'Inventarbewertung', gruppe:'Kontrolle', beschreibung:'Materialwerte für Buchhaltung und Auswertungen.', rollen:'Administrator und Materialverantwortlich', abschnitte:[
    {titel:'Bewertung', text:'Öffne die Inventarbewertung, um die gespeicherten Artikel- und Bestandswerte für die Buchhaltung auszuwerten. Kontrolliere die Einzelwerte vor der Verwendung im Jahresabschluss.'}
  ]},
  { slug:'schadensmeldungen', titel:'Schadensmeldungen', gruppe:'Kontrolle', beschreibung:'Schäden melden und den Bearbeitungsstand verfolgen.', rollen:'Alle angemeldeten Rollen', abschnitte:[
    {titel:'Schaden melden', schritte:['Öffne Schadensmeldungen.','Erfasse den betroffenen Artikel und eine Beschreibung.','Sende die Meldung ab.']},
    {titel:'Bearbeitung', text:'Administrator und Materialverantwortliche können Meldungen verwalten. Andere Rollen sehen die für sie freigegebenen Meldungen.'}
  ]},
  { slug:'mitglieder-import', titel:'Mitglieder aus ClubDesk importieren', gruppe:'Administration', beschreibung:'CSV-Dateien einlesen und Mitgliederdaten aktualisieren.', rollen:'Nur Administrator', abschnitte:[
    {titel:'CSV-Import', schritte:['Exportiere die Mitglieder in ClubDesk als CSV-Datei.','Öffne Stammdaten → Mitglieder.','Wähle die CSV-Datei und starte den Import.','Prüfe die Rückmeldung zu neuen und aktualisierten Mitgliedern.']},
    {titel:'Dateiformat', text:'Erforderlich sind die Spalten [Id], Vorname und Nachname. Weitere unterstützte Felder sind unter anderem Anrede, Adresse, PLZ, Ort und Status. Bereits bekannte ClubDesk-IDs werden aktualisiert; fehlende Einträge bleiben erhalten.'}
  ]},
  { slug:'benutzerverwaltung', titel:'Benutzerverwaltung', gruppe:'Administration', beschreibung:'Benutzer einladen und Rollen verwalten.', rollen:'Nur Administrator', abschnitte:[
    {titel:'Benutzer verwalten', text:'Öffne die Benutzerverwaltung, um Vereinsbenutzer und deren Rollen zu verwalten. Die Rolle bestimmt, welche Funktionen ein Benutzer verwenden darf.'}
  ]}
];
export const hilfeGruppen = ['Grundlagen','Material','Verkauf','Kontrolle','Administration'];
