<script lang="ts">
  import { onMount } from 'svelte';

  type Status = 'offen' | 'teilweise' | 'abgeschlossen' | 'storniert';
  type Filter = 'alle' | Status;
  type Bestellung = {
    vorgangId: string;
    positionsIndex: number;
    erstelltAm: string;
    kaeufer: string;
    riegen: string[];
    zahlungsart: string;
    zahlungsstatus: string;
    artikelId: string;
    artikelname: string;
    groesseId: string | null;
    bestellt: number;
    urspruenglichBestellt?: number;
    storniertMenge?: number;
    uebergeben: number;
    reserviert?: number;
    offen: number;
    einzelpreis: number;
    status: Status;
  };
  type Groesse = { _id: string; bezeichnung: string };
  type Variante = { groesseId: string; menge: number; aktiv?: boolean };
  type Artikel = { _id: string; menge: number; hatGroessen: boolean; varianten?: Variante[] };

  let bestellungen = $state<Bestellung[]>([]);
  let groessen = $state<Groesse[]>([]);
  let artikel = $state<Artikel[]>([]);
  let suche = $state('');
  let filter = $state<Filter>('offen');
  let laden = $state(true);
  let aktualisieren = $state(false);
  let fehler = $state('');
  let bestandFehler = $state('');
  let begrenzt = $state(false);
  let letzteAktualisierung = $state<Date | null>(null);
  let ausgewaehlt = $state<Bestellung | null>(null);
  let uebergabeMenge = $state(1);
  let uebergabeLaeuft = $state(false);
  let uebergabeFehler = $state('');
  let erfolgsmeldung = $state('');
  let stornierungAuswahl = $state<Bestellung | null>(null);
  let stornierungMenge = $state(1);
  let stornierungGrund = $state('');
  let stornierungFehler = $state('');
  let stornierungLaeuft = $state(false);
  type UebergabeEintrag = {
    id: string; vorgangId: string; positionsIndex: number; kaeufer: string;
    riegen: string[]; artikelId: string; artikelname: string;
    groesseId: string | null; menge: number; uebergebenAm: string;
  };
  type StornierungEintrag = {
    id: string; vorgangId: string; positionsIndex: number; kaeufer: string;
    riegen: string[]; artikelId: string; artikelname: string;
    groesseId: string | null; menge: number; grund: string;
    storniertAm: string; storniertVon: string | null;
  };
  let stornierungenHistorie = $state<StornierungEintrag[]>([]);
  let stornierungenSuche = $state('');
  let stornierungenFehler = $state('');
  let stornierungenLaden = $state(false);
  const gefilterteStornierungen = $derived(stornierungenHistorie.filter((eintrag) => {
    const text = stornierungenSuche.trim().toLocaleLowerCase('de-CH');
    return !text || [eintrag.kaeufer, eintrag.artikelname, groesseName(eintrag.groesseId),
      ...eintrag.riegen, eintrag.vorgangId, eintrag.grund]
      .some((wert) => wert.toLocaleLowerCase('de-CH').includes(text));
  }));
  let historie = $state<UebergabeEintrag[]>([]);
  let historieSuche = $state('');
  let historieFehler = $state('');
  let historieLaden = $state(false);
  const gefilterteHistorie = $derived(historie.filter((eintrag) => {
    const text = historieSuche.trim().toLocaleLowerCase('de-CH');
    return !text || [eintrag.kaeufer, eintrag.artikelname, groesseName(eintrag.groesseId),
      ...eintrag.riegen, eintrag.vorgangId].some((wert) => wert.toLocaleLowerCase('de-CH').includes(text));
  }));

  const gefiltert = $derived(bestellungen.filter((b) => {
    const text = suche.trim().toLocaleLowerCase('de-CH');
    const passtText = !text || [b.kaeufer, b.artikelname, ...b.riegen, groesseName(b.groesseId)]
      .some((wert) => wert.toLocaleLowerCase('de-CH').includes(text));
    const passtStatus = filter === 'alle' || b.status === filter || (filter === 'offen' && b.status === 'teilweise');
    return passtText && passtStatus;
  }));
  const offenGesamt = $derived(gefiltert.reduce((summe, b) => summe + b.offen, 0));
  const bestelltGesamt = $derived(gefiltert.reduce((summe, b) => summe + b.bestellt, 0));
  const uebergebenGesamt = $derived(gefiltert.reduce((summe, b) => summe + b.uebergeben, 0));
  const reserviertGesamt = $derived(gefiltert.reduce((summe, b) => summe + (b.reserviert ?? 0), 0));

  function groesseName(id: string | null): string {
    if (id === null) return 'Ohne Grösse';
    return groessen.find((g) => g._id === id)?.bezeichnung ?? 'Grösse unbekannt';
  }
  function formatCHF(betrag: number): string {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(betrag);
  }
  function formatDatum(datum: string): string {
    const wert = new Date(datum);
    return Number.isNaN(wert.getTime()) ? '–' : new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(wert);
  }
  function bestandFuer(b: Bestellung): number | null {
    if (bestandFehler) return null;
    const a = artikel.find((eintrag) => eintrag._id === b.artikelId);
    if (!a) return null;
    if (b.groesseId !== null) {
      const variante = a.varianten?.find((v) => v.groesseId === b.groesseId && v.aktiv !== false);
      return variante ? variante.menge : null;
    }
    return a.menge;
  }
  function verfuegbarFuer(b: Bestellung): number | null {
    const bestand = bestandFuer(b);
    if (bestand === null) return null;
    // Die API prüft beim Speichern zusätzlich alle Reservierungen in der Datenbank.
    // Die hier geladenen Bestellungen können auf 1000 Vorgänge begrenzt sein.
    const fremdeReservierungen = bestellungen.reduce((summe, eintrag) => {
      if (eintrag.artikelId !== b.artikelId || eintrag.groesseId !== b.groesseId ||
          (eintrag.vorgangId === b.vorgangId && eintrag.positionsIndex === b.positionsIndex)) return summe;
      return summe + (eintrag.reserviert ?? 0);
    }, 0);
    return Math.min(b.offen, Math.max(0, bestand - 1 - fremdeReservierungen));
  }

  function nochFehlend(b: Bestellung): number {
    return Math.max(0, b.offen - (b.reserviert ?? 0));
  }
  async function historieAbrufen(): Promise<void> {
    historieLaden = true;
    historieFehler = '';
    try {
      const antwort = await fetch('/api/vereinskleider/bestellungen/historie');
      if (!antwort.ok) {
        const meldung = await antwort.json().catch(() => ({})) as { fehler?: string };
        throw new Error(meldung.fehler ?? 'Übergabehistorie konnte nicht geladen werden.');
      }
      const daten = await antwort.json() as { historie?: UebergabeEintrag[] };
      historie = Array.isArray(daten.historie) ? daten.historie : [];
    } catch (e) {
      historieFehler = e instanceof Error ? e.message : 'Übergabehistorie konnte nicht geladen werden.';
    } finally {
      historieLaden = false;
    }
  }

  async function stornierungenHistorieAbrufen(): Promise<void> {
    stornierungenLaden = true;
    stornierungenFehler = '';
    try {
      const antwort = await fetch('/api/vereinskleider/bestellungen/stornierungen/historie');
      if (!antwort.ok) {
        const meldung = await antwort.json().catch(() => ({})) as { fehler?: string };
        throw new Error(meldung.fehler ?? 'Stornierungshistorie konnte nicht geladen werden.');
      }
      const daten = await antwort.json() as { historie?: StornierungEintrag[] };
      stornierungenHistorie = Array.isArray(daten.historie) ? daten.historie : [];
    } catch (e) {
      stornierungenFehler = e instanceof Error ? e.message : 'Stornierungshistorie konnte nicht geladen werden.';
    } finally {
      stornierungenLaden = false;
    }
  }

  async function datenLaden(): Promise<void> {
    aktualisieren = true;
    fehler = '';
    bestandFehler = '';
    try {
      const [bestellAntwort, groessenAntwort, artikelAntwort] = await Promise.all([
        fetch('/api/vereinskleider/bestellungen?status=alle'),
        fetch('/api/groessen'),
        fetch('/api/artikel')
      ]);
      if (!bestellAntwort.ok) {
        const meldung = await bestellAntwort.json().catch(() => ({})) as { fehler?: string };
        throw new Error(meldung.fehler ?? 'Bestellungen konnten nicht geladen werden.');
      }
      const daten = await bestellAntwort.json() as { bestellungen?: Bestellung[]; begrenzt?: boolean };
      bestellungen = Array.isArray(daten.bestellungen) ? daten.bestellungen : [];
      begrenzt = daten.begrenzt === true;
      if (!groessenAntwort.ok || !artikelAntwort.ok) {
        bestandFehler = 'Lagerbestand oder Grössen konnten nicht vollständig geladen werden.';
      } else {
        groessen = await groessenAntwort.json() as Groesse[];
        const alleArtikel = await artikelAntwort.json() as Artikel[];
        const relevanteIds = new Set(bestellungen.filter((b) => b.offen > 0 && b.groesseId !== null).map((b) => b.artikelId));
        const mitDetails = await Promise.all(alleArtikel.map(async (a) => {
          if (!a.hatGroessen || !relevanteIds.has(a._id)) return a;
          const antwort = await fetch(`/api/artikel/${encodeURIComponent(a._id)}`);
          if (!antwort.ok) throw new Error('Grössenbestände konnten nicht geladen werden.');
          return await antwort.json() as Artikel;
        }));
        artikel = mitDetails;
      }
      await Promise.all([historieAbrufen(), stornierungenHistorieAbrufen()]);
      letzteAktualisierung = new Date();
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Laden.';
    } finally {
      laden = false;
      aktualisieren = false;
    }
  }
  function uebergabeOeffnen(b: Bestellung): void {
    ausgewaehlt = b;
    uebergabeMenge = Math.min(b.offen, verfuegbarFuer(b) ?? 0);
    uebergabeFehler = '';
    erfolgsmeldung = '';
  }

  function uebergabeSchliessen(): void {
    if (uebergabeLaeuft) return;
    ausgewaehlt = null;
    uebergabeFehler = '';
  }

  async function uebergabeSpeichern(): Promise<void> {
    const b = ausgewaehlt;
    if (!b || uebergabeLaeuft) return;
    const maximal = Math.min(b.offen, verfuegbarFuer(b) ?? 0);
    if (!Number.isSafeInteger(uebergabeMenge) || uebergabeMenge < 1 || uebergabeMenge > maximal) {
      uebergabeFehler = `Bitte eine Menge zwischen 1 und ${maximal} eingeben.`;
      return;
    }
    uebergabeLaeuft = true;
    uebergabeFehler = '';
    try {
      const antwort = await fetch('/api/vereinskleider/bestellungen/uebergabe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vorgangId: b.vorgangId, positionsIndex: b.positionsIndex, menge: uebergabeMenge })
      });
      const daten = await antwort.json().catch(() => ({})) as { fehler?: string; erfolg?: boolean };
      if (!antwort.ok || daten.erfolg !== true) throw new Error(daten.fehler ?? 'Übergabe konnte nicht gespeichert werden.');
      erfolgsmeldung = `${uebergabeMenge} Stück «${b.artikelname}» wurden an ${b.kaeufer} übergeben.`;
      ausgewaehlt = null;
      await datenLaden();
    } catch (e) {
      uebergabeFehler = e instanceof Error ? e.message : 'Unbekannter Fehler.';
    } finally {
      uebergabeLaeuft = false;
    }
  }

  function stornierungOeffnen(b: Bestellung): void {
    stornierungAuswahl = b;
    stornierungMenge = b.offen;
    stornierungGrund = '';
    stornierungFehler = '';
    erfolgsmeldung = '';
  }

  function stornierungSchliessen(): void {
    if (stornierungLaeuft) return;
    stornierungAuswahl = null;
    stornierungFehler = '';
  }

  async function stornierungSpeichern(): Promise<void> {
    const b = stornierungAuswahl;
    if (!b || stornierungLaeuft) return;
    if (!Number.isSafeInteger(stornierungMenge) || stornierungMenge < 1 || stornierungMenge > b.offen) {
      stornierungFehler = `Bitte eine Menge zwischen 1 und ${b.offen} eingeben.`;
      return;
    }
    if (!stornierungGrund.trim() || stornierungGrund.length > 1000) {
      stornierungFehler = 'Bitte einen Stornierungsgrund mit maximal 1000 Zeichen eingeben.';
      return;
    }
    stornierungLaeuft = true;
    stornierungFehler = '';
    try {
      const antwort = await fetch('/api/vereinskleider/stornierungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verkaufId: b.vorgangId,
          positionsIndex: b.positionsIndex,
          menge: stornierungMenge,
          grund: stornierungGrund.trim()
        })
      });
      const daten = await antwort.json().catch(() => ({})) as { fehler?: string; erfolg?: boolean };
      if (!antwort.ok || daten.erfolg !== true) {
        throw new Error(daten.fehler ?? 'Stornierung konnte nicht gespeichert werden.');
      }
      const menge = stornierungMenge;
      stornierungAuswahl = null;
      await datenLaden();
      erfolgsmeldung = `${menge} Stück «${b.artikelname}» für ${b.kaeufer} wurden storniert.`;
    } catch (e) {
      stornierungFehler = e instanceof Error ? e.message : 'Unbekannter Fehler.';
    } finally {
      stornierungLaeuft = false;
    }
  }

  onMount(() => { void datenLaden(); });
</script>

<svelte:head>
  <title>Bestellungen – ClubMatiq</title>
</svelte:head>

<main>
  <a class="zurueck" href="/vereinskleider">← Zurück zu Vereinskleider</a>
  <header>
    <div>
      <h1>Bestellungen</h1>
      <p>Offene, abgeschlossene und stornierte Vereinskleiderbestellungen im Überblick.</p>
    </div>
    <button class="aktualisieren" type="button" onclick={() => void datenLaden()} disabled={aktualisieren}>
      {aktualisieren ? 'Wird aktualisiert ...' : '↻ Aktualisieren'}
    </button>
  </header>

  {#if erfolgsmeldung}<p class="erfolg" role="status">{erfolgsmeldung}</p>{/if}
  {#if fehler}
    <p class="warnung" role="alert">{fehler}</p>
  {/if}
  {#if begrenzt}
    <p class="warnung" role="status">Es wurden maximal 1000 Verkaufsvorgänge geladen. Ältere Bestellungen sind möglicherweise nicht enthalten.</p>
  {/if}
  {#if bestandFehler}
    <p class="warnung" role="status">{bestandFehler}</p>
  {/if}

  <section class="karte filterbereich" aria-label="Bestellungen filtern">
    <div>
      <label for="suche">Mitglied, Artikel, Grösse oder Riege suchen</label>
      <input id="suche" type="search" placeholder="Suchbegriff eingeben ..." bind:value={suche} />
    </div>
    <div>
      <label for="status">Bestellstatus</label>
      <select id="status" bind:value={filter}>
        <option value="offen">Offen (inkl. teilweise übergeben)</option>
        <option value="teilweise">Teilweise übergeben</option>
        <option value="abgeschlossen">Abgeschlossen</option>
        <option value="storniert">Storniert</option>
        <option value="alle">Alle Bestellungen</option>
      </select>
    </div>
  </section>

  <div class="kennzahlen" aria-label="Zusammenfassung der gefilterten Bestellungen">
    <div class="kennzahl"><span>Bestellpositionen</span><strong>{gefiltert.length}</strong></div>
    <div class="kennzahl"><span>Bestellte Stück</span><strong>{bestelltGesamt}</strong></div>
    <div class="kennzahl"><span>Bereits übergeben</span><strong>{uebergebenGesamt}</strong></div>
    <div class="kennzahl"><span>Reserviert</span><strong>{reserviertGesamt}</strong></div>
    <div class="kennzahl"><span>Noch fehlend</span><strong>{gefiltert.reduce((summe, b) => summe + nochFehlend(b), 0)}</strong></div>
    <div class="kennzahl"><span>Noch nicht übergeben</span><strong>{offenGesamt}</strong></div>
  </div>

  {#if laden}
    <section class="karte">Bestellungen werden geladen ...</section>
  {:else if gefiltert.length === 0}
    <section class="karte leer">Keine passenden Bestellungen gefunden.</section>
  {:else}
    <section class="karte tabellenkarte" aria-label="Bestellübersicht">
      <div class="tabellen-scroll">
        <table>
          <thead>
            <tr>
              <th>Datum / Vorgang</th>
              <th>Mitglied / Riege</th>
              <th>Artikel / Grösse</th>
              <th class="zahl">Bestellt</th>
              <th class="zahl">Storniert</th>
              <th class="zahl">Übergeben</th>
              <th class="zahl">Reserviert</th>
              <th class="zahl">Noch fehlend</th>
              <th class="zahl">Offen</th>
              <th>Bestand / verfügbar</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {#each gefiltert as b (`${b.vorgangId}:${b.positionsIndex}`)}
              <tr>
                <td><strong>{formatDatum(b.erstelltAm)}</strong><small title={b.vorgangId}>#{b.vorgangId.slice(-8)}</small></td>
                <td><strong>{b.kaeufer}</strong><small>{b.riegen.join(', ') || '–'}</small></td>
                <td><strong>{b.artikelname}</strong><small>{groesseName(b.groesseId)} · {formatCHF(b.einzelpreis)} / Stk.</small></td>
                <td class="zahl">{b.bestellt}<small>Ursprünglich: {b.urspruenglichBestellt ?? b.bestellt}</small></td>
                <td class="zahl">{b.storniertMenge ?? 0}</td>
                <td class="zahl">{b.uebergeben}</td>
                <td class="zahl"><strong>{b.reserviert ?? '–'}</strong></td>
                <td class="zahl">{b.reserviert === undefined ? '–' : nochFehlend(b)}</td>
                <td class="zahl"><strong>{b.offen}</strong></td>
                <td>
                  {#if b.offen === 0}
                    <span class="dezent">–</span>
                  {:else if bestandFuer(b) === null}
                    <span class="dezent">Nicht verfügbar</span>
                  {:else}
                    <strong>{bestandFuer(b)} / {verfuegbarFuer(b)}</strong>
                    {#if (verfuegbarFuer(b) ?? 0) >= b.offen}
                      <small class="lager-gut">Menge voraussichtlich verfügbar</small>
                    {:else if (verfuegbarFuer(b) ?? 0) > 0}
                      <small class="lager-teil">Teilmenge verfügbar</small>
                    {:else}
                      <small class="dezent">Derzeit nicht verfügbar</small>
                    {/if}
                  {/if}
                </td>
                <td>
                  <span class:status-offen={b.status === 'offen'} class:status-teilweise={b.status === 'teilweise'} class:status-abgeschlossen={b.status === 'abgeschlossen'} class:status-storniert={b.status === 'storniert'} class="status">
                    {b.status === 'offen' ? 'Offen' : b.status === 'teilweise' ? 'Teilweise übergeben' : b.status === 'storniert' ? 'Storniert' : 'Abgeschlossen'}
                  </span>
                </td>
                <td>
                  {#if b.offen > 0}
                    <div class="aktionsgruppe">
                      <button class="uebergabe-knopf" type="button" onclick={() => uebergabeOeffnen(b)}
                        disabled={aktualisieren || uebergabeLaeuft || stornierungLaeuft || (verfuegbarFuer(b) ?? 0) < 1}>
                        Übergeben
                      </button>
                      <button class="stornierung-knopf" type="button" onclick={() => stornierungOeffnen(b)}
                        disabled={aktualisieren || uebergabeLaeuft || stornierungLaeuft}>
                        Stornieren
                      </button>
                    </div>
                  {:else}
                    <span class="dezent">{b.status === 'storniert' ? 'Storniert' : 'Erledigt'}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  {#if ausgewaehlt}
    <div class="dialog-hintergrund" role="presentation">
      <div class="dialog karte" role="dialog" aria-modal="true" aria-labelledby="uebergabe-titel">
        <h2 id="uebergabe-titel">Kleiderübergabe erfassen</h2>
        <p><strong>{ausgewaehlt.kaeufer}</strong> · {ausgewaehlt.artikelname} · {groesseName(ausgewaehlt.groesseId)}</p>
        <p>Noch offen: <strong>{ausgewaehlt.offen}</strong> · Verfügbar (mit Reserve): <strong>{verfuegbarFuer(ausgewaehlt) ?? 'unbekannt'}</strong></p>
        <label for="uebergabe-menge">Jetzt übergebene Stückzahl</label>
        <input id="uebergabe-menge" type="number" min="1"
          max={Math.min(ausgewaehlt.offen, verfuegbarFuer(ausgewaehlt) ?? 0)} step="1" bind:value={uebergabeMenge}
          disabled={uebergabeLaeuft} />
        {#if uebergabeFehler}<p class="warnung" role="alert">{uebergabeFehler}</p>{/if}
        <p class="dezent">Beim Bestätigen wird der Lagerbestand verbindlich reduziert. Die Übergabe wird gespeichert.</p>
        <div class="dialog-aktionen">
          <button type="button" class="abbrechen" onclick={uebergabeSchliessen} disabled={uebergabeLaeuft}>Abbrechen</button>
          <button type="button" class="aktualisieren" onclick={() => void uebergabeSpeichern()}
            disabled={uebergabeLaeuft || !Number.isSafeInteger(uebergabeMenge) || uebergabeMenge < 1 || uebergabeMenge > Math.min(ausgewaehlt.offen, verfuegbarFuer(ausgewaehlt) ?? 0)}>
            {uebergabeLaeuft ? 'Wird gespeichert ...' : 'Übergabe bestätigen'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if stornierungAuswahl}
    <div class="dialog-hintergrund" role="presentation">
      <div class="dialog karte" role="dialog" aria-modal="true" aria-labelledby="stornierung-titel">
        <h2 id="stornierung-titel">Bestellartikel stornieren</h2>
        <p><strong>{stornierungAuswahl.kaeufer}</strong> · {stornierungAuswahl.artikelname} · {groesseName(stornierungAuswahl.groesseId)}</p>
        <p>Bestellt: <strong>{stornierungAuswahl.bestellt}</strong> · Bereits übergeben: <strong>{stornierungAuswahl.uebergeben}</strong> · Noch stornierbar: <strong>{stornierungAuswahl.offen}</strong></p>
        <label for="stornierung-menge">Zu stornierende Stückzahl</label>
        <input id="stornierung-menge" type="number" min="1" max={stornierungAuswahl.offen}
          step="1" bind:value={stornierungMenge} disabled={stornierungLaeuft} />
        <label for="stornierung-grund" class="grund-label">Stornierungsgrund (Pflichtfeld)</label>
        <textarea id="stornierung-grund" rows="3" maxlength="1000" bind:value={stornierungGrund}
          disabled={stornierungLaeuft} placeholder="z. B. falsche Grösse bestellt"></textarea>
        <p class="dezent">Nur noch nicht übergebene Mengen können storniert werden. Reservierungen werden freigegeben. Verkäufe mit Rechnung, Quittung, Zahlung oder Rabatt werden bis zur Umsetzung der Belegkorrektur von der API abgelehnt.</p>
        {#if stornierungFehler}<p class="warnung" role="alert">{stornierungFehler}</p>{/if}
        <div class="dialog-aktionen">
          <button type="button" class="abbrechen" onclick={stornierungSchliessen} disabled={stornierungLaeuft}>Abbrechen</button>
          <button type="button" class="stornierung-knopf" onclick={() => void stornierungSpeichern()}
            disabled={stornierungLaeuft || !Number.isSafeInteger(stornierungMenge) || stornierungMenge < 1 || stornierungMenge > stornierungAuswahl.offen || !stornierungGrund.trim()}>
            {stornierungLaeuft ? 'Wird storniert ...' : 'Stornierung bestätigen'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <section class="karte" aria-label="Gespeicherte Stornierungshistorie">
    <div class="historie-kopf">
      <div>
        <h2>Stornierungshistorie</h2>
        <p class="dezent">Alle gespeicherten Stornierungen, auch Teilstornierungen und ältere Vorgänge.</p>
      </div>
      <span class="dezent">{gefilterteStornierungen.length} Stornierungen</span>
    </div>
    <label for="stornierungen-historie-suche">Stornierungen durchsuchen</label>
    <input id="stornierungen-historie-suche" type="search"
      placeholder="Mitglied, Artikel, Grösse, Riege, Grund oder Vorgang ..."
      bind:value={stornierungenSuche} />
    {#if stornierungenFehler}<p class="warnung" role="alert">{stornierungenFehler}</p>{/if}
    {#if stornierungenLaden}
      <p class="dezent">Stornierungshistorie wird geladen ...</p>
    {:else if gefilterteStornierungen.length === 0}
      <p class="dezent">Keine passenden Stornierungen gefunden.</p>
    {:else}
      <div class="tabellen-scroll historie-tabelle">
        <table>
          <thead>
            <tr><th>Storniert am</th><th>Mitglied / Riege</th><th>Artikel / Grösse</th><th class="zahl">Menge</th><th>Grund</th><th>Durchgeführt von</th><th>Bestellung</th></tr>
          </thead>
          <tbody>
            {#each gefilterteStornierungen as eintrag (eintrag.id)}
              <tr>
                <td>{new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(eintrag.storniertAm))}</td>
                <td><strong>{eintrag.kaeufer}</strong><small>{eintrag.riegen.join(', ') || '–'}</small></td>
                <td><strong>{eintrag.artikelname}</strong><small>{groesseName(eintrag.groesseId)}</small></td>
                <td class="zahl">{eintrag.menge}</td>
                <td>{eintrag.grund || '–'}</td>
                <td><small title={eintrag.storniertVon ?? ''}>{eintrag.storniertVon ? `Benutzer-ID: ${eintrag.storniertVon.slice(-8)}` : 'Nicht erfasst'}</small></td>
                <td><small title={eintrag.vorgangId}>#{eintrag.vorgangId.slice(-8)}</small></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="karte" aria-label="Gespeicherte Übergabehistorie">
    <div class="historie-kopf">
      <div>
        <h2>Übergabehistorie</h2>
        <p class="dezent">Alle in MongoDB gespeicherten Kleiderübergaben, auch aus früheren Sitzungen.</p>
      </div>
      <span class="dezent">{gefilterteHistorie.length} Übergaben</span>
    </div>
    <label for="historie-suche">Übergaben durchsuchen</label>
    <input id="historie-suche" type="search" placeholder="Mitglied, Artikel, Grösse, Riege oder Vorgang ..." bind:value={historieSuche} />
    {#if historieFehler}<p class="warnung" role="alert">{historieFehler}</p>{/if}
    {#if historieLaden}
      <p class="dezent">Übergabehistorie wird geladen ...</p>
    {:else if gefilterteHistorie.length === 0}
      <p class="dezent">Keine passenden Übergaben gefunden.</p>
    {:else}
      <div class="tabellen-scroll historie-tabelle">
        <table>
          <thead><tr><th>Übergabedatum</th><th>Mitglied / Riege</th><th>Artikel / Grösse</th><th class="zahl">Menge</th><th>Bestellung</th></tr></thead>
          <tbody>
            {#each gefilterteHistorie as eintrag (eintrag.id)}
              <tr>
                <td>{new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(eintrag.uebergebenAm))}</td>
                <td><strong>{eintrag.kaeufer}</strong><small>{eintrag.riegen.join(', ') || '–'}</small></td>
                <td><strong>{eintrag.artikelname}</strong><small>{groesseName(eintrag.groesseId)}</small></td>
                <td class="zahl"><strong>{eintrag.menge}</strong></td>
                <td><small title={eintrag.vorgangId}>#{eintrag.vorgangId.slice(-8)}</small></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="karte info">
    <h2>Hinweise zur Bestellübersicht</h2>
    <p>Die verfügbaren Mengen sind eine Momentaufnahme des Lagerbestands abzüglich eines Stücks Anprobierreserve pro Grösse. Wenn mehrere Bestellungen denselben Artikel betreffen, ist der angezeigte Bestand nicht für jede Bestellung separat reserviert.</p>
    <p>Über «Stornieren» können noch nicht übergebene Mengen einzeln oder vollständig storniert werden. Bereits übergebene Artikel benötigen einen separaten Rückgabeprozess.</p>
    <p>Über den Knopf «Übergeben» kannst du eine vollständige oder teilweise Übergabe erfassen. Die API prüft den Lagerbestand beim Speichern nochmals. Bereits gespeicherte Übergaben sind in den offenen Stückzahlen berücksichtigt.</p>
    {#if letzteAktualisierung}<small>Zuletzt aktualisiert: {new Intl.DateTimeFormat('de-CH', { dateStyle: 'short', timeStyle: 'short' }).format(letzteAktualisierung)}</small>{/if}
  </section>
</main>

<style>
  main { max-width: 1300px; margin: 40px auto; padding: 20px; }
  .zurueck { color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin: 28px 0; }
  h1, h2 { color: #172b4d; }
  h1 { margin: 0 0 8px; }
  header p { color: #64748b; margin: 0; }
  .karte { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin-bottom: 20px; }
  .filterbereich { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; }
  label { display: block; color: #334155; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  input, select, textarea { box-sizing: border-box; width: 100%; padding: 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; background: white; }
  .aktualisieren { background: #2563eb; color: white; border: 0; border-radius: 8px; padding: 11px 16px; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
  button:disabled { opacity: .6; cursor: not-allowed; }
  .kennzahlen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
  .kennzahl { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 7px; }
  .kennzahl span { font-size: 13px; color: #64748b; }
  .kennzahl strong { font-size: 25px; color: #172b4d; }
  .tabellenkarte { padding: 0; overflow: hidden; }
  .tabellen-scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: 950px; font-size: 14px; }
  th { text-align: left; background: #f8fafc; color: #475569; font-size: 12px; padding: 14px 12px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 15px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
  tbody tr:last-child td { border-bottom: 0; }
  td strong { color: #172b4d; }
  td small { display: block; margin-top: 6px; font-size: 12px; color: #64748b; }
  .zahl { text-align: right; white-space: nowrap; }
  .status { display: inline-block; border-radius: 100px; padding: 5px 9px; font-size: 12px; white-space: nowrap; font-weight: 600; }
  .status-offen { color: #92400e; background: #fef3c7; }
  .status-teilweise { color: #1d4ed8; background: #dbeafe; }
  .status-storniert { color: #475569; background: #e2e8f0; }
  .status-abgeschlossen { color: #166534; background: #dcfce7; }
  td small.lager-gut { color: #166534; }
  td small.lager-teil { color: #92400e; }
  .dezent { color: #64748b; }
  .warnung { color: #92400e; background: #fffbeb; padding: 12px; border-radius: 8px; font-size: 14px; }
  .leer { text-align: center; color: #64748b; padding: 50px 20px; }
  .info h2 { font-size: 17px; margin-top: 0; }
  .info p, .info small { color: #64748b; font-size: 13px; line-height: 1.6; }
  .aktionsgruppe { display: flex; flex-wrap: wrap; gap: 8px; }
  .stornierung-knopf { border: 0; border-radius: 8px; padding: 9px 12px; background: #b91c1c; color: white; font: inherit; font-weight: 600; cursor: pointer; }
  .grund-label { margin-top: 14px; }
  textarea { resize: vertical; }
  .uebergabe-knopf { border: 0; border-radius: 8px; padding: 9px 12px; background: #0f766e; color: white; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .uebergabe-knopf:disabled { opacity: .45; cursor: not-allowed; }
  .erfolg { background: #ecfdf5; color: #166534; padding: 12px; border-radius: 8px; }
  .dialog-hintergrund { position: fixed; inset: 0; z-index: 100; background: #0f172a99; display: flex; justify-content: center; align-items: center; padding: 16px; }
  .dialog { width: min(100%, 480px); max-height: 90vh; overflow-y: auto; margin: 0; box-sizing: border-box; }
  .dialog h2 { margin-top: 0; }
  .dialog p { line-height: 1.5; }
  .dialog-aktionen { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .abbrechen { border: 1px solid #cbd5e1; background: white; border-radius: 8px; padding: 11px 16px; font: inherit; cursor: pointer; }
  .historie-kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .historie-kopf h2 { margin: 0 0 6px; }
  .historie-kopf p { margin: 0; }
  .historie-tabelle { margin-top: 16px; }
  .historie-tabelle table { min-width: 750px; }
  @media (max-width: 850px) { .kennzahlen { grid-template-columns: repeat(2, minmax(0, 1fr)); } .filterbereich { grid-template-columns: 1fr; } }
  @media (max-width: 550px) { main { margin: 20px auto; padding: 16px; } header { flex-direction: column; align-items: stretch; } }
</style>
