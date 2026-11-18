<script lang="ts">
  import { onMount } from 'svelte';

  type Kategorie = { _id: string; name: string };
  type Groesse = { _id: string; bezeichnung: string; sortierung: number };
  type Variante = { _id: string; groesseId: string; menge: number; einzelwert: number; aktiv?: boolean };
  type Artikel = {
    _id: string;
    name: string;
    kategorieId: string;
    menge: number;
    einzelwert: number;
    hatGroessen: boolean;
    istVereinskleidung?: boolean;
    varianten?: Variante[];
  };
  type Preis = {
    artikelId: string;
    groesseId: string | null;
    preistyp: 'fix' | 'variabel';
    druckkosten: number;
    verkaufspreis: number | null;
  };
  type Rabattregel = {
    _id: string;
    name: string;
    rabattart: 'prozent' | 'betrag' | 'fixpreis';
    wert: number;
    geltungsbereich: 'warenkorb' | 'artikel' | 'kategorie';
    artikelIds: string[];
    kategorieIds: string[];
    riegen: string[];
    maximaleMenge: number | null;
    gueltigAb: string | null;
    gueltigBis: string | null;
    kombinierbar: boolean;
    aktiv: boolean;
  };
  type Mitglied = {
    _id: string;
    clubdeskId: string;
    vorname: string;
    nachname: string;
    anzeigename: string;
    status: string;
  };
  type Verkaufsart = 'automatisch' | 'direkt' | 'bestellung';
  type Position = {
    artikelId: string;
    groesseId: string | null;
    menge: number;
    einzelpreis: number;
  };

  let artikel = $state<Artikel[]>([]);
  let groessen = $state<Groesse[]>([]);
  let preise = $state<Preis[]>([]);
  let laden = $state(true);
  let fehler = $state('');
  let kategorieGefunden = $state(false);

  let artikelId = $state('');
  let groesseId = $state('');
  let menge = $state(1);
  let manuellerPreis = $state('');
  let positionen = $state<Position[]>([]);
  let positionsFehler = $state('');
  let kaeufer = $state('');
  let ausgewaehltesMitglied = $state<Mitglied | null>(null);
  let mitgliederVorschlaege = $state<Mitglied[]>([]);
  let mitgliederSucheLaeuft = $state(false);
  let mitgliederSucheFehler = $state('');
  let mitgliederListeOffen = $state(false);
  let mitgliederAnfrage = 0;

  async function mitgliederSuchen(): Promise<void> {
    const anfrage = ++mitgliederAnfrage;
    ausgewaehltesMitglied = null;
    mitgliederSucheFehler = '';
    speichernErfolg = '';
    const suchtext = kaeufer.trim();
    if (suchtext.length < 2) {
      mitgliederVorschlaege = [];
      mitgliederSucheLaeuft = false;
      mitgliederListeOffen = false;
      return;
    }
    mitgliederListeOffen = true;
    mitgliederSucheLaeuft = true;
    try {
      const antwort = await fetch(`/api/mitglieder?suche=${encodeURIComponent(suchtext)}`);
      if (!antwort.ok) throw new Error('Mitglieder konnten nicht geladen werden.');
      const ergebnis = (await antwort.json()) as Mitglied[];
      if (anfrage !== mitgliederAnfrage) return;
      mitgliederVorschlaege = ergebnis;
    } catch (e) {
      if (anfrage !== mitgliederAnfrage) return;
      mitgliederVorschlaege = [];
      mitgliederSucheFehler = e instanceof Error ? e.message : 'Mitgliedersuche fehlgeschlagen.';
    } finally {
      if (anfrage === mitgliederAnfrage) mitgliederSucheLaeuft = false;
    }
  }

  function mitgliedAuswaehlen(mitglied: Mitglied): void {
    ++mitgliederAnfrage;
    ausgewaehltesMitglied = mitglied;
    kaeufer = mitglied.anzeigename;
    mitgliederVorschlaege = [];
    mitgliederListeOffen = false;
    mitgliederSucheLaeuft = false;
    mitgliederSucheFehler = '';
  }
  let verkaufsart = $state<Verkaufsart>('automatisch');
  let zahlungsart = $state('rechnung');
  let zahlungErhalten = $state(false);
  let bemerkung = $state('');
  const riegenOptionen = ['Allround', 'GETU Meitli', 'GETU Buebe', 'Jugend Aerobic', 'KITU', 'Aktive'];
  let riegen = $state<string[]>([]);
  let speichernLaeuft = $state(false);
  let speichernFehler = $state('');
  let speichernErfolg = $state('');
  let zusaetzlicherRabatt = $state('0');
  let rabattregeln = $state<Rabattregel[]>([]);
  let rabattId = $state('');

  const gesamtpreis = $derived(positionen.reduce((summe, p) => summe + p.menge * p.einzelpreis, 0));
  const gesamtmenge = $derived(positionen.reduce((summe, p) => summe + p.menge, 0));
  const bereit = $derived(positionen.length > 0 && kaeufer.trim().length > 0);
  const rabattZahl = $derived(Number(zusaetzlicherRabatt.replace(',', '.')));
  const heute = new Date().toISOString().slice(0, 10);
  const passendeRegeln = $derived(rabattregeln.filter((regel) => {
    if (!regel.aktiv || (regel.gueltigAb && regel.gueltigAb > heute) ||
        (regel.gueltigBis && regel.gueltigBis < heute)) return false;
    if (regel.riegen.length && !regel.riegen.some((r) => riegen.includes(r))) return false;
    if (regel.rabattart === 'fixpreis' && regel.geltungsbereich === 'warenkorb') return false;
    return positionen.some((p) => regel.geltungsbereich === 'warenkorb' ||
      (regel.geltungsbereich === 'artikel' && regel.artikelIds.includes(p.artikelId)) ||
      (regel.geltungsbereich === 'kategorie' && regel.kategorieIds.includes(
        artikel.find((a) => a._id === p.artikelId)?.kategorieId ?? ''
      )));
  }));
  const ausgewaehlterRabatt = $derived(passendeRegeln.find((r) => r._id === rabattId));
  function rappen(wert: number): number { return Math.round((wert + Number.EPSILON) * 100); }
  function rabattBerechnen(regel: Rabattregel | undefined): number {
    if (!regel) return 0;
    const passend = positionen.filter((p) => regel.geltungsbereich === 'warenkorb' ||
      (regel.geltungsbereich === 'artikel' && regel.artikelIds.includes(p.artikelId)) ||
      (regel.geltungsbereich === 'kategorie' && regel.kategorieIds.includes(
        artikel.find((a) => a._id === p.artikelId)?.kategorieId ?? ''
      )));
    let restmenge = regel.maximaleMenge ?? Number.MAX_SAFE_INTEGER;
    let basis = 0;
    let fixpreisRabatt = 0;
    for (const p of passend) {
      const anzahl = Math.min(restmenge, p.menge);
      basis += anzahl * rappen(p.einzelpreis);
      if (regel.rabattart === 'fixpreis') {
        fixpreisRabatt += anzahl * Math.max(0, rappen(p.einzelpreis) - rappen(regel.wert));
      }
      restmenge -= anzahl;
      if (restmenge === 0) break;
    }
    const wert = regel.rabattart === 'prozent'
      ? Math.round(basis * regel.wert / 100)
      : regel.rabattart === 'betrag'
        ? Math.min(basis, rappen(regel.wert))
        : fixpreisRabatt;
    return Math.min(wert, rappen(gesamtpreis)) / 100;
  }
  const regelRabatt = $derived(rabattBerechnen(ausgewaehlterRabatt));
  const rabattAuswahlGueltig = $derived(rabattId === '' || ausgewaehlterRabatt !== undefined);
  const restNachSonderrabatt = $derived(Math.max(0, Math.round((gesamtpreis - regelRabatt) * 100) / 100));
  const rabattGueltig = $derived(Number.isFinite(rabattZahl) && rabattZahl >= 0 && rabattZahl <= restNachSonderrabatt && Math.abs(rabattZahl * 100 - Math.round(rabattZahl * 100)) < 0.000001);
  const endbetrag = $derived(Math.max(0, Math.round((restNachSonderrabatt - (rabattGueltig ? rabattZahl : 0)) * 100) / 100));

  function riegeUmschalten(riege: string, aktiv: boolean) {
    riegen = aktiv ? [...riegen, riege] : riegen.filter((r) => r !== riege);
    speichernErfolg = '';
    speichernFehler = '';
  }

  const ausgewaehlterArtikel = $derived(artikel.find((a) => a._id === artikelId));
  const aktiveVarianten = $derived(
    (ausgewaehlterArtikel?.varianten ?? [])
      .filter((v) => v.aktiv !== false)
      .sort((a, b) =>
        (groessen.find((g) => g._id === a.groesseId)?.sortierung ?? 9999) -
        (groessen.find((g) => g._id === b.groesseId)?.sortierung ?? 9999)
      )
  );
  const ausgewaehlteVariante = $derived(aktiveVarianten.find((v) => v.groesseId === groesseId));
  const bestand = $derived(
    ausgewaehlterArtikel
      ? ausgewaehlterArtikel.hatGroessen
        ? (ausgewaehlteVariante?.menge ?? 0)
        : ausgewaehlterArtikel.menge
      : 0
  );
  const preis = $derived(
    preise.find((p) =>
      p.artikelId === artikelId &&
      p.groesseId === (ausgewaehlterArtikel?.hatGroessen ? groesseId : null)
    )
  );
  const stueckpreis = $derived(
    preis?.preistyp === 'fix'
      ? preis.verkaufspreis
      : manuellerPreis.trim() !== ''
        ? Number(manuellerPreis.replace(',', '.'))
        : preis?.verkaufspreis ?? null
  );
  const gueltigerPreis = $derived(
    stueckpreis !== null && Number.isFinite(stueckpreis) && stueckpreis >= 0 &&
    Math.abs(stueckpreis * 100 - Math.round(stueckpreis * 100)) < 0.000001
  );
  const bereitsImWarenkorb = $derived(
    positionen
      .filter((p) => p.artikelId === artikelId && p.groesseId === (ausgewaehlterArtikel?.hatGroessen ? groesseId : null))
      .reduce((summe, p) => summe + p.menge, 0)
  );
  const verkaufbar = $derived(Math.max(0, bestand - 1 - bereitsImWarenkorb));
  const direktNeueMenge = $derived(verkaufsart === 'bestellung' ? 0 : Math.min(menge, verkaufbar));
  const bestellNeueMenge = $derived(verkaufsart === 'direkt' ? 0 : Math.max(0, menge - direktNeueMenge));

  function artikelWechseln() {
    groesseId = '';
    menge = 1;
    manuellerPreis = '';
    positionsFehler = '';
  }

  function groesseWechseln() {
    menge = 1;
    manuellerPreis = '';
    positionsFehler = '';
  }

  function formatCHF(wert: number): string {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(wert);
  }

  function artikelName(id: string): string {
    return artikel.find((a) => a._id === id)?.name ?? 'Unbekannter Artikel';
  }

  function groesseName(id: string | null): string {
    return id === null ? 'Ohne Grösse' : groessen.find((g) => g._id === id)?.bezeichnung ?? 'Unbekannt';
  }

  function positionHinzufuegen() {
    positionsFehler = '';
    speichernErfolg = '';
    if (!ausgewaehlterArtikel || (ausgewaehlterArtikel.hatGroessen && !ausgewaehlteVariante)) {
      positionsFehler = 'Bitte Artikel und gegebenenfalls Grösse auswählen.';
      return;
    }
    if (!Number.isInteger(menge) || menge <= 0) {
      positionsFehler = 'Bitte eine gültige Stückzahl eingeben.';
      return;
    }
    if (!gueltigerPreis || stueckpreis === null) {
      positionsFehler = 'Bitte einen gültigen Verkaufspreis mit höchstens zwei Dezimalstellen angeben.';
      return;
    }
    if (verkaufsart === 'direkt' && menge > verkaufbar) {
      positionsFehler = 'Die Menge übersteigt den verfügbaren Bestand nach Abzug der Anprobierreserve und bestehender Warenkorbpositionen.';
      return;
    }

    const neuePosition: Position = {
      artikelId,
      groesseId: ausgewaehlterArtikel.hatGroessen ? groesseId : null,
      menge,
      einzelpreis: stueckpreis
    };
    const index = positionen.findIndex((p) =>
      p.artikelId === neuePosition.artikelId &&
      p.groesseId === neuePosition.groesseId &&
      p.einzelpreis === neuePosition.einzelpreis
    );
    if (index >= 0) {
      positionen = positionen.map((p, i) => i === index ? { ...p, menge: p.menge + menge } : p);
    } else {
      positionen = [...positionen, neuePosition];
    }
    menge = 1;
    manuellerPreis = '';
  }

  function positionEntfernen(index: number) {
    positionen = positionen.filter((_, i) => i !== index);
    positionsFehler = '';
    speichernErfolg = '';
  }

  function bestandFuerPosition(p: Position): number {
    const a = artikel.find((eintrag) => eintrag._id === p.artikelId);
    if (!a) return 0;
    return a.hatGroessen
      ? (a.varianten?.find((v) => v.groesseId === p.groesseId && v.aktiv !== false)?.menge ?? 0)
      : a.menge;
  }

  const warenkorbGueltig = $derived(
    verkaufsart !== 'direkt' || positionen.every((p) =>
      positionen
        .filter((andere) => andere.artikelId === p.artikelId && andere.groesseId === p.groesseId)
        .reduce((summe, andere) => summe + andere.menge, 0) <= Math.max(0, bestandFuerPosition(p) - 1)
    )
  );

  // Verfügbarkeit pro Variante über den gesamten Warenkorb berechnen.
  // So wird die Anprobierreserve auch bei mehreren Preisen nicht mehrfach vergeben.
  const warenkorbAufteilung = $derived.by(() => {
    const verbleibend = new Map<string, number>();
    return positionen.map((p) => {
      const schluessel = `${p.artikelId}:${p.groesseId ?? ''}`;
      if (!verbleibend.has(schluessel)) {
        verbleibend.set(schluessel, Math.max(0, bestandFuerPosition(p) - 1));
      }
      const direkt = verkaufsart === 'bestellung' ? 0
        : verkaufsart === 'direkt' ? p.menge
        : Math.min(p.menge, verbleibend.get(schluessel) ?? 0);
      verbleibend.set(schluessel, Math.max(0, (verbleibend.get(schluessel) ?? 0) - direkt));
      return { direkt, bestellung: p.menge - direkt };
    });
  });
  const direktTotal = $derived(warenkorbAufteilung.reduce((summe, p) => summe + p.direkt, 0));
  const bestellTotal = $derived(warenkorbAufteilung.reduce((summe, p) => summe + p.bestellung, 0));

  async function datenLaden(): Promise<void> {
    const [kategorienAntwort, artikelAntwort, groessenAntwort, preiseAntwort, rabatteAntwort] = await Promise.all([
      fetch('/api/kategorien'),
      fetch('/api/artikel'),
      fetch('/api/groessen'),
      fetch('/api/vereinskleider/preise'),
      fetch('/api/rabatte')
    ]);
    if (![kategorienAntwort, artikelAntwort, groessenAntwort, preiseAntwort, rabatteAntwort].every((r) => r.ok)) {
      throw new Error('Die Vereinskleiderdaten konnten nicht geladen werden.');
    }
    const kategorien: Kategorie[] = await kategorienAntwort.json();
    const alleArtikel: Artikel[] = await artikelAntwort.json();
    groessen = await groessenAntwort.json();
    preise = await preiseAntwort.json();
    rabattregeln = await rabatteAntwort.json();
    const kleider = alleArtikel.filter((a) => a.istVereinskleidung === true);
    kategorieGefunden = kleider.length > 0;
    artikel = await Promise.all(kleider.map(async (a) => {
      if (!a.hatGroessen) return a;
      const antwort = await fetch(`/api/artikel/${a._id}`);
      if (!antwort.ok) throw new Error(`Grössen für ${a.name} konnten nicht geladen werden.`);
      return (await antwort.json()) as Artikel;
    }));
  }

  async function vorgangSpeichern(): Promise<void> {
    if (speichernLaeuft || !bereit || !warenkorbGueltig || !rabattGueltig || !rabattAuswahlGueltig || riegen.length === 0) return;
    speichernLaeuft = true;
    speichernFehler = '';
    speichernErfolg = '';
    try {
      const antwort = await fetch('/api/vereinskleider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kaeufer: kaeufer.trim(),
          verkaufsart,
          zahlungsart,
          zahlungErhalten: zahlungsart !== 'rechnung' && zahlungErhalten,
          bemerkung,
          riegen,
          positionen,
          rabattIds: rabattId ? [rabattId] : [],
          zusaetzlicherRabatt: rabattZahl
        })
      });
      const ergebnis: { erfolg?: boolean; fehler?: string; verkauf?: { _id?: string; direktMenge?: number; bestellMenge?: number } } =
        await antwort.json().catch(() => ({}));
      if (!antwort.ok || !ergebnis.erfolg) {
        throw new Error(ergebnis.fehler ?? 'Der Vorgang konnte nicht gespeichert werden.');
      }
      // Erst nach erfolgreichem Speichern zurücksetzen.
      positionen = [];
      artikelId = '';
      groesseId = '';
      menge = 1;
      manuellerPreis = '';
      kaeufer = '';
      ++mitgliederAnfrage;
      ausgewaehltesMitglied = null;
      mitgliederVorschlaege = [];
      mitgliederListeOffen = false;
      riegen = [];
      bemerkung = '';
      zahlungErhalten = false;
      zusaetzlicherRabatt = '0';
      rabattId = '';
      positionsFehler = '';
      speichernErfolg = `Vorgang erfolgreich gespeichert: ${ergebnis.verkauf?.direktMenge ?? 0} direkt verkauft, ${ergebnis.verkauf?.bestellMenge ?? 0} bestellt${ergebnis.verkauf?._id ? ` (ID: ${ergebnis.verkauf._id})` : ''}.`;
      // Bei einem Direktverkauf Bestände erneut vom Server laden.
      try {
        await datenLaden();
      } catch (ladeFehler) {
        speichernFehler = ladeFehler instanceof Error
          ? `Vorgang gespeichert, aber die Bestände konnten nicht aktualisiert werden: ${ladeFehler.message}`
          : 'Vorgang gespeichert, aber die Bestände konnten nicht aktualisiert werden.';
      }
    } catch (error) {
      speichernFehler = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      speichernLaeuft = false;
    }
  }

  onMount(async () => {
    try {
      await datenLaden();
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      laden = false;
    }
  });

</script>

<svelte:head>
  <title>Vereinskleider verkaufen – ClubMatiq</title>
</svelte:head>

<main>
  <a class="zurueck" href="/vereinskleider">← Zurück zu Vereinskleider</a>
  <header>
    <h1>Vereinskleider verkaufen</h1>
    <p>Mehrere Artikel und Grössen zusammenstellen. Die verfügbaren Mengen werden automatisch verkauft, der Rest bestellt.</p>
  </header>

  {#if laden}
    <section class="karte">Vereinskleider werden geladen ...</section>
  {:else if fehler}
    <section class="karte fehler" role="alert">{fehler}</section>
  {:else if !kategorieGefunden}
    <section class="karte">Noch keine Vereinskleider erfasst. Markiere einen Artikel in der <a href="/inventar">Inventarverwaltung</a> als Vereinskleidung.</section>
  {:else}
    <div class="layout">
      <div class="hauptspalte">
        <section class="karte">
          <h2>Verkaufsdaten</h2>
          <div class="felder">
            <div>
              <label for="kaeufer">Käufer / Mitglied</label>
              <div class="mitgliedersuche">
                <input id="kaeufer" type="text" placeholder="Mitglied suchen oder Namen eingeben"
                  autocomplete="off" bind:value={kaeufer} oninput={() => { void mitgliederSuchen(); }}
                  role="combobox" aria-autocomplete="list" aria-expanded={mitgliederListeOffen} 
                  aria-controls="mitgliedervorschlaege" />
                {#if ausgewaehltesMitglied}
                  <p class="mitglied-gewaehlt">✓ ClubDesk-Mitglied ausgewählt (ID: {ausgewaehltesMitglied.clubdeskId})</p>
                {:else if kaeufer.trim().length > 0}
                  <p class="hinweis">Ohne Auswahl aus der Liste wird der Name manuell übernommen.</p>
                {/if}
                {#if mitgliederListeOffen}
                  <div class="mitgliedervorschlaege" id="mitgliedervorschlaege">
                    {#if mitgliederSucheLaeuft}
                      <p class="vorschlag-info">Mitglieder werden gesucht ...</p>
                    {:else if mitgliederSucheFehler}
                      <p class="vorschlag-info warnung" role="alert">{mitgliederSucheFehler}</p>
                    {:else if mitgliederVorschlaege.length === 0}
                      <p class="vorschlag-info">Keine passenden Mitglieder gefunden. Manuelle Eingabe ist möglich.</p>
                    {:else}
                      {#each mitgliederVorschlaege as mitglied (mitglied._id)}
                        <button class="mitglied-vorschlag" type="button" onclick={() => mitgliedAuswaehlen(mitglied)}>
                          <strong>{mitglied.anzeigename}</strong>
                          <span>ClubDesk-ID: {mitglied.clubdeskId}{mitglied.status ? ` · ${mitglied.status}` : ''}</span>
                        </button>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            <div>
              <label for="verkaufsart">Vorgang</label>
              <select id="verkaufsart" bind:value={verkaufsart}>
                <option value="automatisch">Automatisch nach Lagerbestand (empfohlen)</option>
                <option value="direkt">Nur Direktverkauf / Übergabe</option>
                <option value="bestellung">Nur Bestellung (noch keine Übergabe)</option>
              </select>
            </div>
            <div>
              <label for="zahlung">Zahlungsart</label>
              <select id="zahlung" bind:value={zahlungsart}>
                <option value="rechnung">Rechnung / ClubDesk</option>
                <option value="twint">TWINT</option>
                <option value="bar">Barzahlung</option>
              </select>
            </div>
            {#if zahlungsart === 'twint' || zahlungsart === 'bar'}
              <div class="volle-breite">
                <label class="checkzeile zahlung-bestaetigung">
                  <input type="checkbox" bind:checked={zahlungErhalten} />
                  Zahlung erhalten ({zahlungsart === 'twint' ? 'TWINT' : 'Bar'})
                </label>
                <p class="hinweis">Nur bestätigen, wenn der vollständige Betrag tatsächlich eingegangen ist. Andernfalls bleibt die Zahlung offen.</p>
              </div>
            {/if}
            <div class="volle-breite">
              <span class="feldtitel">Riege(n)</span>
              <div class="riegenliste">
                {#each riegenOptionen as riege}
                  <label class="checkzeile">
                    <input type="checkbox" checked={riegen.includes(riege)} onchange={(event) => riegeUmschalten(riege, event.currentTarget.checked)} />
                    {riege}
                  </label>
                {/each}
              </div>
            </div>
            <div class="volle-breite">
              <label for="bemerkung">Bemerkung (optional)</label>
              <textarea id="bemerkung" rows="2" bind:value={bemerkung}></textarea>
            </div>
          </div>
        </section>

        <section class="karte">
          <h2>Artikel hinzufügen</h2>
          <div class="felder">
            <div>
              <label for="artikel">Vereinskleiderartikel</label>
              <select id="artikel" bind:value={artikelId} onchange={artikelWechseln}>
                <option value="">Artikel auswählen</option>
                {#each artikel as eintrag (eintrag._id)}
                  <option value={eintrag._id}>{eintrag.name}</option>
                {/each}
              </select>
            </div>
            {#if ausgewaehlterArtikel?.hatGroessen}
              <div>
                <label for="groesse">Grösse</label>
                <select id="groesse" bind:value={groesseId} onchange={groesseWechseln}>
                  <option value="">Grösse auswählen</option>
                  {#each aktiveVarianten as variante (variante._id)}
                    <option value={variante.groesseId}>
                      {groesseName(variante.groesseId)}
                    </option>
                  {/each}
                </select>
              </div>
            {/if}
            <div>
              <label for="menge">Menge</label>
              <input id="menge" type="number" min="1" step="1" bind:value={menge} />
            </div>
            {#if preis?.preistyp === 'variabel'}
              <div>
                <label for="preis">Verkaufspreis pro Stück (CHF)</label>
                <input id="preis" type="text" inputmode="decimal" placeholder="Preis eingeben" bind:value={manuellerPreis} />
              </div>
            {/if}
          </div>
          {#if ausgewaehlterArtikel && (!ausgewaehlterArtikel.hatGroessen || ausgewaehlteVariante)}
            <div class="infozeile">
              <span>Lagerbestand: <strong>{bestand}</strong></span>
              <span>Reserve: <strong>{Math.min(1, bestand)}</strong></span>
              <span>Noch direkt verfügbar: <strong>{verkaufbar}</strong></span>
              <span>Stückpreis: <strong>{gueltigerPreis && stueckpreis !== null ? formatCHF(stueckpreis) : 'Offen'}</strong></span>
            </div>
            {#if verkaufsart === 'automatisch' && Number.isInteger(menge) && menge > 0}
              <p class="aufteilung-hinweis">Für diese Auswahl: <strong>{direktNeueMenge} direkt</strong> · <strong>{bestellNeueMenge} Bestellung</strong></p>
            {/if}
          {/if}
          {#if positionsFehler}
            <p class="warnung" role="alert">{positionsFehler}</p>
          {/if}
          <button type="button" class="hinzufuegen" onclick={positionHinzufuegen}>+ Zum Warenkorb hinzufügen</button>
        </section>
      </div>

      <aside class="karte zusammenfassung">
        <h2>Warenkorb</h2>
        {#if positionen.length === 0}
          <p class="hinweis">Noch keine Artikel hinzugefügt. Du kannst beliebig viele verschiedene Artikel und Grössen auswählen.</p>
        {:else}
          <div class="warenkorb">
            {#each positionen as p, index (index)}
              <div class="position">
                <div class="positionskopf">
                  <strong>{artikelName(p.artikelId)}</strong>
                  <button type="button" class="entfernen" onclick={() => positionEntfernen(index)} aria-label={`Position ${artikelName(p.artikelId)} entfernen`}>Entfernen</button>
                </div>
                <div class="positionsdetails">
                  <span>{groesseName(p.groesseId)} · {p.menge} × {formatCHF(p.einzelpreis)}</span>
                  <strong>{formatCHF(p.menge * p.einzelpreis)}</strong>
                </div>
                <div class="positions-aufteilung">
                  {#if warenkorbAufteilung[index]?.direkt}
                    <span class="direkt-tag">✓ {warenkorbAufteilung[index].direkt} direkt</span>
                  {/if}
                  {#if warenkorbAufteilung[index]?.bestellung}
                    <span class="bestellung-tag">◷ {warenkorbAufteilung[index].bestellung} Bestellung</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
          <div class="rabattbereich">
            <h3>Rabatt</h3>
            <label for="rabattregel">Gespeicherte Rabattregel (optional)</label>
            <select id="rabattregel" bind:value={rabattId}>
              <option value="">Keine Rabattregel</option>
              {#each passendeRegeln as regel (regel._id)}
                <option value={regel._id}>{regel.name} ({regel.rabattart === 'prozent' ? `${regel.wert} %` : formatCHF(regel.wert)})</option>
              {/each}
            </select>
            {#if rabattregeln.length === 0}
              <p class="hinweis">Noch keine Rabattregeln hinterlegt. Du kannst sie in den <a href="/stammdaten/rabatte">Rabatt-Stammdaten</a> erstellen.</p>
            {:else if passendeRegeln.length === 0}
              <p class="hinweis">Für die aktuelle Riege und die gewählten Artikel ist keine aktive Rabattregel verfügbar.</p>
            {/if}
            {#if !rabattAuswahlGueltig}
              <p class="warnung" role="alert">Die ausgewählte Rabattregel ist nicht mehr gültig. Bitte neu auswählen.</p>
            {/if}
            <p class="hinweis">Pro Vorgang ist derzeit eine gespeicherte Rabattregel auswählbar. Einmalige Ansprüche (z. B. erstes T-Shirt) müssen vor dem Verkauf geprüft werden.</p>
            <label for="zusatzrabatt">Weiterer Rabatt in CHF (optional)</label>
            <input id="zusatzrabatt" type="text" inputmode="decimal" bind:value={zusaetzlicherRabatt} />
            {#if !rabattGueltig}<p class="warnung" role="alert">Bitte einen gültigen Rabatt zwischen CHF 0 und {formatCHF(restNachSonderrabatt)} eingeben.</p>{/if}
          </div>
          <div class="zeile"><span>Positionen</span><strong>{positionen.length}</strong></div>
          <div class="zeile"><span>Stückzahl</span><strong>{gesamtmenge}</strong></div>
          <div class="zeile"><span>Direktverkauf</span><strong>{direktTotal} Stück</strong></div>
          <div class="zeile"><span>Bestellung</span><strong>{bestellTotal} Stück</strong></div>
          <div class="zeile"><span>Zwischentotal</span><strong>{formatCHF(gesamtpreis)}</strong></div>
          {#if ausgewaehlterRabatt}<div class="zeile"><span>{ausgewaehlterRabatt.name}</span><strong>− {formatCHF(regelRabatt)}</strong></div>{/if}
          {#if rabattGueltig && rabattZahl > 0}<div class="zeile"><span>Weiterer Rabatt</span><strong>− {formatCHF(rabattZahl)}</strong></div>{/if}
          <div class="zeile gesamt"><span>Zu bezahlen</span><strong>{formatCHF(endbetrag)}</strong></div>
        {/if}
        {#if verkaufsart === 'bestellung'}
          <p class="hinweis">Bei Bestellungen wird der Lagerbestand erst bei der späteren Übergabe reduziert.</p>
        {:else if verkaufsart === 'automatisch'}
          <p class="hinweis">Die Aufteilung berücksichtigt pro Grösse eine Anprobierreserve. Der Server prüft den Bestand beim Speichern erneut; die endgültige Aufteilung kann sich deshalb ändern.</p>
        {:else if !warenkorbGueltig}
          <p class="warnung" role="alert">Mindestens eine Warenkorbposition überschreitet den verfügbaren Bestand inklusive Anprobierreserve. Bitte Menge reduzieren oder «Automatisch» wählen.</p>
        {/if}
        {#if speichernErfolg}
          <p class="erfolg" role="status">{speichernErfolg}</p>
        {/if}
        {#if speichernFehler}
          <p class="warnung" role="alert">{speichernFehler}</p>
        {/if}
        <button type="button" class="speichern" onclick={vorgangSpeichern}
          disabled={speichernLaeuft || !bereit || !warenkorbGueltig || !rabattGueltig || !rabattAuswahlGueltig || riegen.length === 0}>
          {speichernLaeuft ? 'Wird gespeichert ...' : 'Gesamten Vorgang speichern'}
        </button>
        <p class="hinweis">Die API speichert den Vorgang. Nur direkt übergebene Stücke reduzieren den Lagerbestand. Bestellte Stücke bleiben offen. Die Zahlungsbestätigung wird nach Anpassung der Verkaufs-API dauerhaft gespeichert.</p>
      </aside>
    </div>
  {/if}
</main>

<style>
  .aufteilung-hinweis { margin: 10px 0 0; color: #334155; font-size: 13px; }
  .positions-aufteilung { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; font-size: 12px; font-weight: 600; }
  .direkt-tag { background: #dcfce7; color: #166534; border-radius: 6px; padding: 4px 8px; }
  .bestellung-tag { background: #fef3c7; color: #92400e; border-radius: 6px; padding: 4px 8px; }
  .mitgliedersuche { position: relative; }
  .mitglied-gewaehlt { color: #166534; font-size: 12px; margin: 6px 0 0; }
  .mitgliedersuche .hinweis { margin: 6px 0 0; }
  .mitgliedervorschlaege { position: absolute; z-index: 20; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px #0000001a; max-height: 250px; overflow-y: auto; }
  .mitglied-vorschlag { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; background: white; border: 0; border-bottom: 1px solid #e2e8f0; padding: 10px 12px; cursor: pointer; text-align: left; font: inherit; }
  .mitglied-vorschlag:hover, .mitglied-vorschlag:focus-visible { background: #eff6ff; }
  .mitglied-vorschlag span { font-size: 12px; color: #64748b; }
  .vorschlag-info { margin: 0; padding: 12px; font-size: 13px; color: #64748b; }
  main { max-width: 1200px; margin: 40px auto; padding: 20px; }
  .zurueck { color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px; }
  header { margin: 28px 0; }
  h1, h2 { color: #172b4d; }
  header p, .hinweis { color: #64748b; }
  .layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 20px; align-items: start; }
  .hauptspalte { display: grid; gap: 20px; }
  .karte { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; min-width: 0; }
  .karte h2 { margin-top: 0; }
  .feldtitel { display: block; font-weight: 600; color: #334155; font-size: 14px; margin-bottom: 8px; }
  .riegenliste { display: flex; flex-wrap: wrap; gap: 8px 16px; }
  .checkzeile { display: flex; align-items: center; gap: 8px; font-weight: 500; margin: 8px 0; }
  .checkzeile input { width: auto; flex: 0 0 auto; }
  .zahlung-bestaetigung { margin-bottom: 4px; }
  .rabattbereich { border-top: 1px solid #e2e8f0; padding: 12px 0; }
  .rabattbereich h3 { font-size: 15px; color: #172b4d; }
  .felder { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .volle-breite { grid-column: 1 / -1; }
  label { display: block; font-weight: 600; color: #334155; font-size: 14px; margin-bottom: 8px; }
  input, select, textarea { box-sizing: border-box; width: 100%; padding: 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; background: white; }
  .infozeile { display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 20px 0 0; color: #475569; font-size: 13px; }
  .hinzufuegen { margin-top: 20px; }
  .warenkorb { margin: 12px 0; }
  .position { padding: 14px 0; border-bottom: 1px solid #e2e8f0; }
  .positionskopf, .positionsdetails, .zeile { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
  .positionskopf strong { color: #172b4d; }
  .positionsdetails { color: #64748b; font-size: 13px; margin-top: 8px; }
  .positionsdetails strong { color: #172b4d; white-space: nowrap; }
  .entfernen { background: none; border: 0; color: #b91c1c; padding: 0; width: auto; font-size: 12px; cursor: pointer; }
  .zeile { padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .zeile span { color: #64748b; }
  .zeile strong { color: #172b4d; }
  .gesamt { font-size: 18px; border-bottom: 0; }
  .warnung { color: #92400e; background: #fffbeb; padding: 12px; border-radius: 8px; font-size: 14px; }
  .fehler { color: #b91c1c; background: #fef2f2; }
  .erfolg { color: #166534; background: #f0fdf4; padding: 12px; border-radius: 8px; font-size: 14px; }
  .hinweis { font-size: 13px; line-height: 1.5; }
  button.hinzufuegen, button.speichern { width: 100%; background: #2563eb; color: white; border: 0; border-radius: 8px; padding: 12px; font: inherit; font-weight: 600; cursor: pointer; }
  button.speichern { margin-top: 18px; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  @media (max-width: 850px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 550px) { main { margin: 20px auto; padding: 16px; } .felder { grid-template-columns: 1fr; } }
</style>
