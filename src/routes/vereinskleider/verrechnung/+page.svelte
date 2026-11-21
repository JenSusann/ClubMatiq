<script lang="ts">
  import { onMount, tick } from 'svelte';

  type Verkauf = {
    _id: string;
    kaeufer: string;
    riegen?: string[];
    endbetrag: number;
    erstelltAm: string;
    zahlungsart: string;
    zahlungsstatus?: string;
    bezahltBetrag?: number;
    preisOffen?: boolean;
    offenePreispositionen?: number;
    trancheRechnungIds?: string[];
  };

  type Rechnung = {
    _id: string;
    rechnungsnummer: string;
    empfaenger: string;
    gesamtbetrag: number;
    bezahltBetrag: number;
    gutgeschriebenBetrag?: number;
    rueckerstattungOffen?: number;
    status: 'offen' | 'teilweise_bezahlt' | 'bezahlt' | 'storniert';
    erstelltAm: string;
    zahlungsart: string;
    riegen?: string[];
  };

  type Gutschrift = {
    _id: string;
    rechnungId: string;
    gutschriftnummer: string;
    artikelname: string;
    menge: number;
    betrag: number;
    grund: string;
    erstelltAm: string;
    bearbeitungsstatus?: 'erledigt' | 'rueckerstattet' | 'teilweise_rueckerstattet';
    rueckerstattetBetrag?: number;
    rueckerstattungen?: { betrag: number; datum: string; zahlungsart: string; bemerkung?: string }[];
  };

  type GutschriftenAntwort = {
    gutschriften?: Gutschrift[];
    begrenzt?: boolean;
    fehler?: string;
  };

  type Antwort = {
    rechnungen?: Rechnung[];
    unverrechneteVerkaeufe?: Verkauf[];
    begrenzt?: boolean;
    fehler?: string;
  };

  let rechnungen = $state<Rechnung[]>([]);
  let gutschriften = $state<Gutschrift[]>([]);
  let gutschriftenBegrenzt = $state(false);
  let gutschriftSpeichern = $state<string | null>(null);

  let aktiveGutschrift = $state<Gutschrift | null>(null);
  let aktiveGutschriftRechnung = $state<Rechnung | null>(null);
  let rueckBetrag = $state('');
  let rueckDatum = $state('');
  let rueckArt = $state<'bank' | 'twint' | 'bar'>('bank');
  let rueckBemerkung = $state('');
  let rueckBestaetigt = $state(false);
  let rueckFehler = $state('');

  async function zumRueckFormular(): Promise<void> {
    await tick();
    document.getElementById('gutschrift-formular')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function gutschriftOeffnen(g: Gutschrift, rechnung: Rechnung): void {
    if (gutschriftSpeichern) return;
    aktiveGutschrift = g;
    aktiveGutschriftRechnung = rechnung;
    rueckBetrag = Math.min(rueckerstattung(rechnung),
      Math.max(0, g.betrag - (g.rueckerstattetBetrag ?? 0))).toFixed(2);
    rueckDatum = lokalesDatum();
    rueckArt = 'bank';
    rueckBemerkung = '';
    rueckBestaetigt = false;
    rueckFehler = '';
    fehler = '';
    erfolg = '';
    void zumRueckFormular();
  }

  function gutschriftSchliessen(): void {
    if (gutschriftSpeichern) return;
    aktiveGutschrift = null;
    aktiveGutschriftRechnung = null;
  }

  async function gutschriftAbschliessen(): Promise<void> {
    const g = aktiveGutschrift;
    const rechnung = aktiveGutschriftRechnung;
    if (!g || !rechnung || gutschriftSpeichern) return;
    const offen = rueckerstattung(rechnung);
    const aktion = offen > 0 ? 'rueckerstattet' : 'erledigt';
    const daten: Record<string, unknown> = { gutschriftId: g._id, aktion };
    if (aktion === 'rueckerstattet') {
      const wert = Number(rueckBetrag.replace(',', '.'));
      const rappen = Math.round(wert * 100);
      const maximal = Math.round(Math.min(offen,
        g.betrag - (g.rueckerstattetBetrag ?? 0)) * 100);
      if (!Number.isFinite(wert) || !Number.isSafeInteger(rappen) ||
          rappen <= 0 || rappen > maximal || Math.abs(wert * 100 - rappen) > 0.000001) {
        rueckFehler = `Bitte einen gültigen Betrag bis ${chf(maximal / 100)} eingeben.`;
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rueckDatum)) {
        rueckFehler = 'Bitte ein gültiges Rückerstattungsdatum eingeben.';
        return;
      }
      if (!rueckBestaetigt) {
        rueckFehler = 'Bitte bestätigen, dass die Rückerstattung tatsächlich erfolgt ist.';
        return;
      }
      Object.assign(daten, {
        betrag: rappen / 100, datum: rueckDatum, zahlungsart: rueckArt,
        bemerkung: rueckBemerkung
      });
    }
    rueckFehler = '';
    gutschriftSpeichern = g._id;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/vereinskleider/gutschriften/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten)
      });
      const ergebnis: { erfolg?: boolean; fehler?: string } = await antwort.json().catch(() => ({}));
      if (!antwort.ok || !ergebnis.erfolg) throw new Error(ergebnis.fehler ?? 'Gutschrift konnte nicht abgeschlossen werden.');
      await ladenAktualisieren();
      aktiveGutschrift = null;
      aktiveGutschriftRechnung = null;
      erfolg = `Gutschrift ${g.gutschriftnummer} wurde aktualisiert.`;
    } catch (e) {
      rueckFehler = e instanceof Error ? e.message : 'Gutschrift konnte nicht abgeschlossen werden.';
    } finally {
      gutschriftSpeichern = null;
    }
  }

  let aufgeklappteRechnungen = $state<string[]>([]);
  let verkaeufe = $state<Verkauf[]>([]);
  let laden = $state(true);
  let fehler = $state('');
  let erfolg = $state('');
  let erstellenId = $state<string | null>(null);
  let suche = $state('');
  let statusFilter = $state('alle');
  let begrenzt = $state(false);
  let zahlungRechnung = $state<Rechnung | null>(null);
  let zahlungBetrag = $state('');
  let zahlungDatum = $state('');
  let zahlungArt = $state<'bank' | 'twint' | 'bar'>('bank');
  let zahlungSpeichern = $state(false);
  let zahlungId = $state<string | null>(null);

  function gutschriftenZu(rechnungId: string): Gutschrift[] {
    return gutschriften.filter((g) => g.rechnungId === rechnungId);
  }

  function aufklappen(rechnungId: string): void {
    aufgeklappteRechnungen = aufgeklappteRechnungen.includes(rechnungId)
      ? aufgeklappteRechnungen.filter((id) => id !== rechnungId)
      : [...aufgeklappteRechnungen, rechnungId];
  }

  const nettoBetrag = (rechnung: Rechnung): number =>
    Math.max(0, (Math.round(rechnung.gesamtbetrag * 100) - Math.round((rechnung.gutgeschriebenBetrag ?? 0) * 100)) / 100);

  const offenerBetrag = (rechnung: Rechnung): number =>
    Math.max(0, (Math.round(nettoBetrag(rechnung) * 100) - Math.round((rechnung.bezahltBetrag ?? 0) * 100)) / 100);

  const rueckerstattung = (rechnung: Rechnung): number =>
    Math.max(0, rechnung.rueckerstattungOffen ?? 0);

  function lokalesDatum(): string {
    const heute = new Date();
    const teile = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(heute);
    const wert = (typ: string) => teile.find((teil) => teil.type === typ)?.value ?? '';
    return `${wert('year')}-${wert('month')}-${wert('day')}`;
  }

  function zahlungOeffnen(rechnung: Rechnung): void {
    if (zahlungSpeichern || rechnung.status === 'storniert' || offenerBetrag(rechnung) <= 0) return;
    zahlungRechnung = rechnung;
    zahlungBetrag = offenerBetrag(rechnung).toFixed(2);
    zahlungDatum = lokalesDatum();
    zahlungArt = 'bank';
    zahlungId = null;
    fehler = '';
    erfolg = '';
  }

  function zahlungSchliessen(): void {
    if (zahlungSpeichern) return;
    zahlungRechnung = null;
    zahlungId = null;
  }

  function zahlungGeaendert(): void {
    zahlungId = null;
  }

  async function zahlungErfassen(): Promise<void> {
    if (!zahlungRechnung || zahlungSpeichern) return;
    const betrag = Number(String(zahlungBetrag).replace(',', '.'));
    const rappen = Math.round(betrag * 100);
    const maximal = Math.round(offenerBetrag(zahlungRechnung) * 100);
    if (!Number.isFinite(betrag) || !Number.isSafeInteger(rappen) || rappen <= 0 ||
        Math.abs(betrag * 100 - rappen) > 0.000001 || rappen > maximal) {
      fehler = `Bitte einen gültigen Betrag zwischen CHF 0.01 und ${chf(offenerBetrag(zahlungRechnung))} eingeben.`;
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(zahlungDatum)) {
      fehler = 'Bitte ein gültiges Zahlungsdatum eingeben.';
      return;
    }
    if (!zahlungId) zahlungId = crypto.randomUUID();
    zahlungSpeichern = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch(`/api/vereinskleider/verrechnung/${zahlungRechnung._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betrag: rappen / 100, datum: zahlungDatum, zahlungsart: zahlungArt, zahlungId })
      });
      const daten: { erfolg?: boolean; fehler?: string; bereitsErfasst?: boolean } =
        await antwort.json().catch(() => ({}));
      if (!antwort.ok || !daten.erfolg) throw new Error(daten.fehler ?? 'Zahlung konnte nicht gespeichert werden.');
      const nummer = zahlungRechnung.rechnungsnummer;
      await ladenAktualisieren();
      zahlungRechnung = null;
      zahlungId = null;
      erfolg = daten.bereitsErfasst
        ? `Zahlung für Beleg ${nummer} war bereits erfasst.`
        : `Zahlung für Beleg ${nummer} wurde erfasst.`;
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Zahlung konnte nicht gespeichert werden.';
    } finally {
      zahlungSpeichern = false;
    }
  }

  const gefilterteVerkaeufe = $derived(verkaeufe.filter((v) =>
    `${v.kaeufer} ${(v.riegen ?? []).join(' ')} ${v._id}`.toLocaleLowerCase('de-CH')
      .includes(suche.toLocaleLowerCase('de-CH'))
  ));

  const gefilterteRechnungen = $derived(rechnungen.filter((r) =>
    (statusFilter === 'alle' || r.status === statusFilter) &&
    `${r.empfaenger} ${r.rechnungsnummer} ${(r.riegen ?? []).join(' ')}`
      .toLocaleLowerCase('de-CH').includes(suche.toLocaleLowerCase('de-CH'))
  ));

  const offeneSumme = $derived(rechnungen.reduce((summe, r) => summe + offenerBetrag(r), 0));
  const gutschriftenSumme = $derived(rechnungen.reduce((summe, r) => summe + (r.gutgeschriebenBetrag ?? 0), 0));
  const rueckerstattungenSumme = $derived(rechnungen.reduce((summe, r) => summe + rueckerstattung(r), 0));

  function chf(betrag: number): string {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(betrag);
  }

  function datum(wert: string): string {
    const d = new Date(wert);
    return Number.isNaN(d.getTime()) ? '–' : new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(d);
  }

  function istBezahlt(verkauf: Verkauf): boolean {
    if (verkauf.preisOffen === true) return false;
    return verkauf.zahlungsstatus === 'bezahlt' ||
      (verkauf.endbetrag === 0 && verkauf.zahlungsstatus !== 'offen') ||
      (verkauf.endbetrag > 0 && (verkauf.bezahltBetrag ?? 0) >= verkauf.endbetrag);
  }

  function istQuittung(verkauf: Verkauf): boolean {
    return (verkauf.zahlungsart === 'bar' || verkauf.zahlungsart === 'twint') && istBezahlt(verkauf);
  }

  function istQuittungsDokument(rechnung: Rechnung): boolean {
    return (rechnung.zahlungsart === 'bar' || rechnung.zahlungsart === 'twint') &&
      (rechnung.bezahltBetrag ?? 0) >= rechnung.gesamtbetrag;
  }

  function zahlungsartText(art: string): string {
    return art === 'bar' ? 'Bar' : art === 'twint' ? 'TWINT' : art === 'rechnung' ? 'Rechnung' : art;
  }

  function statusText(status: Rechnung['status']): string {
    if (status === 'teilweise_bezahlt') return 'Teilweise bezahlt';
    if (status === 'bezahlt') return 'Bezahlt';
    if (status === 'storniert') return 'Storniert';
    return 'Offen';
  }

  async function ladenAktualisieren(): Promise<void> {
    const [antwort, gutschriftenAntwort] = await Promise.all([
      fetch('/api/vereinskleider/verrechnung'),
      fetch('/api/vereinskleider/stornierungen')
    ]);
    const daten: Antwort = await antwort.json().catch(() => ({}));
    const gutschriftenDaten: GutschriftenAntwort = await gutschriftenAntwort.json().catch(() => ({}));
    if (!antwort.ok) throw new Error(daten.fehler ?? 'Verrechnungsdaten konnten nicht geladen werden.');
    if (!gutschriftenAntwort.ok) throw new Error(gutschriftenDaten.fehler ?? 'Gutschriften konnten nicht geladen werden.');
    gutschriften = gutschriftenDaten.gutschriften ?? [];
    gutschriftenBegrenzt = gutschriftenDaten.begrenzt ?? false;
    rechnungen = daten.rechnungen ?? [];
    verkaeufe = daten.unverrechneteVerkaeufe ?? [];
    begrenzt = daten.begrenzt ?? false;
  }

  async function neuLaden(): Promise<void> {
    laden = true;
    fehler = '';
    try {
      await ladenAktualisieren();
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Laden.';
    } finally {
      laden = false;
    }
  }

  let bestaetigungVerkauf = $state<Verkauf | null>(null);
  async function rechnungErstellen(verkauf: Verkauf): Promise<void> {
    if (erstellenId !== null) return;
    const istTranche = verkauf.preisOffen === true || (verkauf.trancheRechnungIds?.length ?? 0) > 0;
    const bezeichnung = istQuittung(verkauf) ? 'Quittung' : 'Rechnung';
    erstellenId = verkauf._id;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch(istTranche ? '/api/vereinskleider/verrechnung/tranche' : '/api/vereinskleider/verrechnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verkaufId: verkauf._id })
      });
      const daten: { erfolg?: boolean; fehler?: string; rechnung?: { rechnungsnummer: string } } =
        await antwort.json().catch(() => ({}));
      if (!antwort.ok || !daten.erfolg) throw new Error(daten.fehler ?? 'Rechnung konnte nicht erstellt werden.');
      erfolg = `${istTranche ? 'Teilrechnung' : bezeichnung} ${daten.rechnung?.rechnungsnummer ?? ''} wurde erstellt.`;
      await ladenAktualisieren();
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Rechnung konnte nicht erstellt werden.';
    } finally {
      erstellenId = null;
    }
  }

  function bestaetigungOeffnen(verkauf: Verkauf): void {
    if (erstellenId !== null) return;
    bestaetigungVerkauf = verkauf;
  }

  async function bestaetigtErstellen(): Promise<void> {
    const verkauf = bestaetigungVerkauf;
    if (!verkauf) return;
    bestaetigungVerkauf = null;
    await rechnungErstellen(verkauf);
  }

  onMount(() => { void neuLaden(); });
</script>

<svelte:head>
  <title>Verrechnung – ClubMatiq</title>
</svelte:head>

{#if bestaetigungVerkauf}
  <div class="dialog-hintergrund" role="presentation">
    <div class="dialog-karte" role="dialog" aria-modal="true" aria-labelledby="beleg-bestaetigen" tabindex="-1">
      <h2 id="beleg-bestaetigen">Beleg erstellen</h2>
      <p>{bestaetigungVerkauf.preisOffen || (bestaetigungVerkauf.trancheRechnungIds?.length ?? 0) > 0
        ? `Weitere Teilrechnung für ${bestaetigungVerkauf.kaeufer} erstellen? Es werden nur noch nicht verrechnete Positionen berücksichtigt.`
        : `${istQuittung(bestaetigungVerkauf) ? 'Quittung' : 'Rechnung'} für ${bestaetigungVerkauf.kaeufer} über ${chf(bestaetigungVerkauf.endbetrag)} erstellen?`}</p>
      <div class="formularaktionen">
        <button type="button" onclick={() => void bestaetigtErstellen()}>Beleg erstellen</button>
        <button type="button" class="sekundaer" onclick={() => bestaetigungVerkauf = null}>Abbrechen</button>
      </div>
    </div>
  </div>
{/if}
<main>
  <a class="zurueck" href="/vereinskleider">← Zurück zu Vereinskleider</a>
  <header>
    <h1>Verrechnung</h1>
    <p>Rechnungen und Zahlungsbelege aus erfassten Vereinskleiderverkäufen erstellen und verwalten.</p>
  </header>

  <div class="kennzahlen">
    <div class="karte kennzahl"><span>Unverrechnete Vorgänge</span><strong>{verkaeufe.length}</strong></div>
    <div class="karte kennzahl"><span>Erstellte Belege</span><strong>{rechnungen.length}</strong></div>
    <div class="karte kennzahl"><span>Offener Rechnungsbetrag</span><strong>{chf(offeneSumme)}</strong></div>
    <div class="karte kennzahl"><span>Gutschriften</span><strong>{chf(gutschriftenSumme)}</strong></div>
    <div class="karte kennzahl"><span>Rückerstattungen offen</span><strong>{chf(rueckerstattungenSumme)}</strong></div>
  </div>

  {#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
  {#if erfolg}<p class="meldung erfolg" role="status">{erfolg}</p>{/if}
  {#if begrenzt}<p class="meldung hinweis">Es werden maximal 1000 Vorgänge beziehungsweise Rechnungen geladen.</p>{/if}
  {#if gutschriftenBegrenzt}<p class="meldung hinweis">Es werden maximal 1000 Gutschriften angezeigt.</p>{/if}

  <div class="werkzeuge">
    <label for="suche">Suche
      <input id="suche" type="search" placeholder="Mitglied, Riege oder Rechnungsnummer" bind:value={suche} />
    </label>
    <button type="button" onclick={neuLaden} disabled={laden || erstellenId !== null || zahlungSpeichern}>Aktualisieren</button>
    <a href="/api/vereinskleider/verrechnung/export" download="ClubMatiq_Rechnungsabgleich.csv">Rechnungsabgleich (CSV)</a>
    <a href="/api/vereinskleider/gutschriften/export" download="ClubMatiq_Gutschriftenabgleich.csv">Gutschriftenabgleich (CSV)</a>
  </div>

  <p class="hinweis">Die CSV-Dateien sind Kontrollauszüge für den manuellen Abgleich mit ClubDesk – keine ClubDesk-Importdateien. Rechnungen und Gutschriften müssen in ClubDesk separat verbucht werden. Ein CSV-Download bestätigt keine Verbuchung.</p>

  {#if laden}
    <section class="karte">Verrechnungsdaten werden geladen ...</section>
  {:else}
    <section class="karte">
      <h2>Verkäufe ohne Beleg</h2>
      <p class="hinweis">Bei bestätigter Bar- oder TWINT-Zahlung wird ein bezahlter Beleg erfasst. Bei offenen Zahlungen wird eine Rechnung erstellt. Die Übergabe der Artikel bleibt davon unabhängig.</p>
      {#if gefilterteVerkaeufe.length === 0}
        <p class="leer">Keine unverrechneten Verkäufe gefunden.</p>
      {:else}
        <div class="tabellenbereich">
          <table>
            <thead><tr><th>Datum</th><th>Käufer / Mitglied</th><th>Riege(n)</th><th>Zahlungsart</th><th>Zahlungsstatus</th><th class="rechts">Betrag</th><th>Aktion</th></tr></thead>
            <tbody>
              {#each gefilterteVerkaeufe as verkauf (verkauf._id)}
                <tr>
                  <td>{datum(verkauf.erstelltAm)}</td>
                  <td><strong>{verkauf.kaeufer}</strong></td>
                  <td>{(verkauf.riegen ?? []).join(', ') || '–'}</td>
                  <td>{zahlungsartText(verkauf.zahlungsart)}</td>
                  <td><span class="status" class:bezahlt={istBezahlt(verkauf)}>{verkauf.preisOffen ? 'Preis offen' : istBezahlt(verkauf) ? 'Bezahlt' : 'Offen'}</span></td>
                  <td class="rechts">{chf(verkauf.endbetrag)}</td>
                  <td><button type="button" onclick={() => bestaetigungOeffnen(verkauf)} disabled={erstellenId !== null}>
                    {erstellenId === verkauf._id ? 'Wird erstellt ...' : (verkauf.preisOffen || (verkauf.trancheRechnungIds?.length ?? 0) > 0) ? 'Teilrechnung erstellen' : istQuittung(verkauf) ? 'Quittung erfassen' : 'Rechnung erstellen'}
                  </button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <section class="karte">
      <div class="abschnittskopf">
        <h2>Erstellte Rechnungen und Belege</h2>
        <label for="status">Status
          <select id="status" bind:value={statusFilter}>
            <option value="alle">Alle</option>
            <option value="offen">Offen</option>
            <option value="teilweise_bezahlt">Teilweise bezahlt</option>
            <option value="bezahlt">Bezahlt</option>
            <option value="storniert">Storniert</option>
          </select>
        </label>
      </div>
      {#if gefilterteRechnungen.length === 0}
        <p class="leer">Keine Rechnungen gefunden.</p>
      {:else}
        <div class="tabellenbereich">
          <table>
            <thead><tr><th>Belegnummer</th><th>Typ</th><th>Datum</th><th>Empfänger</th><th class="rechts">Original</th><th class="rechts">Gutschrift</th><th class="rechts">Netto</th><th class="rechts">Bezahlt</th><th class="rechts">Offen</th><th class="rechts">Rückerstattung offen</th><th>Status</th><th>Aktion</th><th>PDF</th></tr></thead>
            <tbody>
              {#each gefilterteRechnungen as rechnung (rechnung._id)}
                <tr>
                  <td><strong>{rechnung.rechnungsnummer}</strong>
                    {#if gutschriftenZu(rechnung._id).length > 0}
                      <button type="button" class="gutschriften-schalter" aria-expanded={aufgeklappteRechnungen.includes(rechnung._id)} onclick={() => aufklappen(rechnung._id)}>
                        {aufgeklappteRechnungen.includes(rechnung._id) ? '−' : '+'} {gutschriftenZu(rechnung._id).length} Gutschrift(en)
                      </button>
                    {/if}
                  </td>
                  <td>{istQuittungsDokument(rechnung) ? 'Quittung' : 'Rechnung'}</td>
                  <td>{datum(rechnung.erstelltAm)}</td>
                  <td>{rechnung.empfaenger}</td>
                  <td class="rechts">{chf(rechnung.gesamtbetrag)}</td>
                  <td class="rechts">{chf(rechnung.gutgeschriebenBetrag ?? 0)}</td>
                  <td class="rechts">{chf(nettoBetrag(rechnung))}</td>
                  <td class="rechts">{chf(rechnung.bezahltBetrag ?? 0)}</td>
                  <td class="rechts">{chf(offenerBetrag(rechnung))}</td>
                  <td class="rechts">{rueckerstattung(rechnung) > 0 ? chf(rueckerstattung(rechnung)) : '–'}</td>
                  <td><span class:bezahlt={rechnung.status === 'bezahlt'} class:storniert={rechnung.status === 'storniert'} class="status">{statusText(rechnung.status)}</span></td>
                  <td>
                    {#if rechnung.status !== 'storniert' && offenerBetrag(rechnung) > 0}
                      <button type="button" onclick={() => zahlungOeffnen(rechnung)} disabled={zahlungSpeichern || erstellenId !== null}>Zahlung erfassen</button>
                    {:else}
                      <span class="hinweis">–</span>
                    {/if}
                  </td>
                  <td><a class="pdf-link" href={`/api/vereinskleider/verrechnung/${rechnung._id}/pdf`} target="_blank" rel="noopener noreferrer">PDF öffnen</a></td>
                </tr>
                {#if aufgeklappteRechnungen.includes(rechnung._id)}
                  <tr class="gutschriften-zeile"><td colspan="13">
                    <strong>Gutschriften zu {rechnung.rechnungsnummer}</strong>
                    <div class="tabellenbereich">
                      <table class="gutschriften-tabelle">
                        <thead><tr><th>Gutschriftnummer</th><th>Datum</th><th>Artikel</th><th>Menge</th><th class="rechts">Betrag</th><th>Grund</th><th>Status / Rückerstattung</th><th>Aktion</th><th>PDF</th></tr></thead>
                        <tbody>
                          {#each gutschriftenZu(rechnung._id) as gutschrift (gutschrift._id)}
                            <tr>
                              <td>{gutschrift.gutschriftnummer}</td>
                              <td>{datum(gutschrift.erstelltAm)}</td>
                              <td>{gutschrift.artikelname}</td>
                              <td>{gutschrift.menge}</td>
                              <td class="rechts">{chf(gutschrift.betrag)}</td>
                              <td>{gutschrift.grund}</td>
                              <td>
                                {gutschrift.bearbeitungsstatus === 'rueckerstattet' ? 'Rückerstattet' :
                                  gutschrift.bearbeitungsstatus === 'erledigt' ? 'Erledigt' :
                                  gutschrift.bearbeitungsstatus === 'teilweise_rueckerstattet' ? 'Teilweise rückerstattet' : 'Offen'}
                                {#if (gutschrift.rueckerstattetBetrag ?? 0) > 0}
                                  <div class="hinweis">{chf(gutschrift.rueckerstattetBetrag ?? 0)} zurückbezahlt</div>
                                {/if}
                                {#each gutschrift.rueckerstattungen ?? [] as rueckzahlung}
                                  <div class="hinweis">{datum(rueckzahlung.datum)} · {zahlungsartText(rueckzahlung.zahlungsart)} · {chf(rueckzahlung.betrag)}{rueckzahlung.bemerkung ? ` · ${rueckzahlung.bemerkung}` : ''}</div>
                                {/each}
                              </td>
                              <td>
                                {#if gutschrift.bearbeitungsstatus !== 'erledigt' && gutschrift.bearbeitungsstatus !== 'rueckerstattet'}
                                  <button type="button" disabled={gutschriftSpeichern !== null}
                                    onclick={() => gutschriftOeffnen(gutschrift, rechnung)}>
                                    {gutschriftSpeichern === gutschrift._id ? 'Speichern ...' :
                                      rueckerstattung(rechnung) > 0 ? 'Rückerstattung erfassen' : 'Als erledigt markieren'}
                                  </button>
                                {:else}
                                  <span class="hinweis">Abgeschlossen</span>
                                {/if}
                              </td>
                              <td><a class="pdf-link" href={`/api/vereinskleider/verrechnung/${rechnung._id}/pdf?gutschriftId=${gutschrift._id}`} target="_blank" rel="noopener noreferrer">Gutschrift-PDF</a></td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </td></tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <p class="hinweis">Gutschriften vermindern den zahlbaren Rechnungsbetrag. Bereits erhaltene Zahlungen bleiben unverändert; allfällige Rückerstattungen werden separat ausgewiesen. Über die aufklappbare Liste können die separaten Gutschrift-PDFs geöffnet werden.</p>
    </section>

    {#if aktiveGutschrift && aktiveGutschriftRechnung}
      <section id="gutschrift-formular" class="karte zahlungsformular" aria-label="Gutschrift bearbeiten">
        <div class="abschnittskopf">
          <h2>Gutschrift bearbeiten – {aktiveGutschrift.gutschriftnummer}</h2>
          <button type="button" class="sekundaer" onclick={gutschriftSchliessen} disabled={gutschriftSpeichern !== null}>Schliessen</button>
        </div>
        <p class="hinweis">Rechnung {aktiveGutschriftRechnung.rechnungsnummer} · Gutschrift: {chf(aktiveGutschrift.betrag)} · Noch offene Rückerstattung der Rechnung: <strong>{chf(rueckerstattung(aktiveGutschriftRechnung))}</strong></p>
        {#if rueckFehler}<p class="meldung fehler" role="alert">{rueckFehler}</p>{/if}
        <form onsubmit={(ereignis) => { ereignis.preventDefault(); void gutschriftAbschliessen(); }}>
          {#if rueckerstattung(aktiveGutschriftRechnung) > 0}
            <div class="formularfelder">
              <label for="rueck-betrag">Bereits rückerstatteter Betrag (CHF)
                <input id="rueck-betrag" type="number" min="0.01" step="0.01"
                  max={Math.min(rueckerstattung(aktiveGutschriftRechnung), aktiveGutschrift.betrag - (aktiveGutschrift.rueckerstattetBetrag ?? 0))}
                  required bind:value={rueckBetrag} disabled={gutschriftSpeichern !== null} />
              </label>
              <label for="rueck-datum">Datum der Rückerstattung
                <input id="rueck-datum" type="date" required bind:value={rueckDatum} disabled={gutschriftSpeichern !== null} />
              </label>
              <label for="rueck-art">Zahlungsweg
                <select id="rueck-art" bind:value={rueckArt} disabled={gutschriftSpeichern !== null}>
                  <option value="bank">Bank</option>
                  <option value="twint">TWINT</option>
                  <option value="bar">Bar</option>
                </select>
              </label>
            </div>
            <label for="rueck-bemerkung">Bemerkung / Zahlungsreferenz (optional)
              <input id="rueck-bemerkung" type="text" maxlength="1000" bind:value={rueckBemerkung} disabled={gutschriftSpeichern !== null} />
            </label>
            <label class="bestaetigung"><input type="checkbox" bind:checked={rueckBestaetigt} disabled={gutschriftSpeichern !== null} />
              Ich bestätige, dass dieser Betrag bereits tatsächlich zurückbezahlt wurde. Es wird keine automatische Auszahlung ausgelöst.
            </label>
          {:else}
            <p class="hinweis">Es ist keine Auszahlung mehr offen. Die Gutschrift kann als erledigt markiert werden.</p>
          {/if}
          <div class="formularaktionen">
            <button type="submit" disabled={gutschriftSpeichern !== null}>
              {gutschriftSpeichern ? 'Wird gespeichert ...' : rueckerstattung(aktiveGutschriftRechnung) > 0 ? 'Rückerstattung bestätigen' : 'Als erledigt markieren'}
            </button>
            <button type="button" class="sekundaer" onclick={gutschriftSchliessen} disabled={gutschriftSpeichern !== null}>Abbrechen</button>
          </div>
        </form>
      </section>
    {/if}

    {#if zahlungRechnung}
      <section class="karte zahlungsformular" aria-label="Zahlung erfassen">
        <div class="abschnittskopf">
          <h2>Zahlung erfassen – {zahlungRechnung.rechnungsnummer}</h2>
          <button type="button" class="sekundaer" onclick={zahlungSchliessen} disabled={zahlungSpeichern}>Schliessen</button>
        </div>
        <p class="hinweis">{zahlungRechnung.empfaenger} · Offener Betrag: <strong>{chf(offenerBetrag(zahlungRechnung))}</strong></p>
        <form onsubmit={(ereignis) => { ereignis.preventDefault(); void zahlungErfassen(); }}>
          <div class="formularfelder">
            <label for="zahlung-betrag">Betrag (CHF)
              <input id="zahlung-betrag" type="number" min="0.01" step="0.01" max={offenerBetrag(zahlungRechnung)} required bind:value={zahlungBetrag} oninput={zahlungGeaendert} disabled={zahlungSpeichern} />
            </label>
            <label for="zahlung-datum">Zahlungsdatum
              <input id="zahlung-datum" type="date" required bind:value={zahlungDatum} onchange={zahlungGeaendert} disabled={zahlungSpeichern} />
            </label>
            <label for="zahlung-art">Zahlungsart
              <select id="zahlung-art" bind:value={zahlungArt} onchange={zahlungGeaendert} disabled={zahlungSpeichern}>
                <option value="bank">Bank</option>
                <option value="twint">TWINT</option>
                <option value="bar">Bar</option>
              </select>
            </label>
          </div>
          <div class="formularaktionen">
            <button type="submit" disabled={zahlungSpeichern}>{zahlungSpeichern ? 'Wird gespeichert ...' : 'Zahlung speichern'}</button>
            <button type="button" class="sekundaer" onclick={zahlungSchliessen} disabled={zahlungSpeichern}>Abbrechen</button>
          </div>
        </form>
      </section>
    {/if}
  {/if}
</main>

<style>
  .dialog-hintergrund{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:1rem}
  .dialog-karte{width:min(100%,440px);background:var(--card-bg,#fff);color:var(--text-color,#172b4d);padding:1.5rem;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
  .dialog-karte h2{margin-top:0}

  main { max-width: 1250px; margin: 35px auto; padding: 20px; color: #172b4d; }
  .zurueck { color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px; }
  header { margin: 28px 0; }
  header p, .hinweis { color: #64748b; font-size: 14px; line-height: 1.5; }
  .kennzahlen { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
  .karte { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin-bottom: 20px; }
  .kennzahl { display: flex; flex-direction: column; gap: 10px; }
  .kennzahl span { color: #64748b; font-size: 14px; }
  .kennzahl strong { font-size: 25px; }
  .werkzeuge { display: flex; align-items: end; gap: 14px; margin: 18px 0; }
  .werkzeuge label { flex: 1; }
  label { display: block; font-size: 13px; font-weight: 600; }
  input, select { box-sizing: border-box; width: 100%; padding: 10px; margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; font: inherit; }
  button { border: 0; border-radius: 8px; padding: 10px 14px; background: #2563eb; color: white; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .meldung { padding: 12px 16px; border-radius: 8px; }
  .fehler { background: #fef2f2; color: #b91c1c; }
  .erfolg { background: #f0fdf4; color: #166534; }
  .leer { padding: 15px 0; color: #64748b; }
  .tabellenbereich { width: 100%; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: middle; }
  th { color: #475569; font-size: 12px; }
  .rechts { text-align: right; white-space: nowrap; }
  .abschnittskopf { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .abschnittskopf label { min-width: 190px; }
  .status { display: inline-block; border-radius: 7px; padding: 5px 8px; background: #fef3c7; color: #92400e; white-space: nowrap; font-size: 12px; font-weight: 600; }
  .status.bezahlt { background: #dcfce7; color: #166534; }
  .zahlungsformular { border-color: #93c5fd; scroll-margin-top: 20px; }
  .formularfelder { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
  .formularaktionen { display: flex; gap: 10px; margin-top: 18px; }
  .bestaetigung { display: flex; align-items: center; gap: 10px; margin-top: 18px; font-weight: 400; }
  .bestaetigung input { width: auto; margin: 0; }
  button.sekundaer { background: #e2e8f0; color: #172b4d; }
  .pdf-link { color: #2563eb; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .gutschriften-schalter { display: block; margin-top: 7px; padding: 4px 7px; background: #eff6ff; color: #1d4ed8; font-size: 12px; }
  .gutschriften-zeile { background: #f8fafc; }
  .gutschriften-tabelle { margin-top: 12px; }
  .status.storniert { background: #f1f5f9; color: #475569; }
  @media (max-width: 800px) { .kennzahlen { grid-template-columns: 1fr; } .werkzeuge, .abschnittskopf { flex-direction: column; align-items: stretch; } .formularfelder { grid-template-columns: 1fr; } }
</style>
