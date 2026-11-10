
<script lang="ts">
  import { onMount } from 'svelte';

  type Ausleihe = {
    _id: string;
    artikelId: string;
    groesseId: string | null;
    person: string;
    menge: number;
    ausleihdatum: string;
    rueckgabedatum: string;
    bemerkung: string;
    status: string;
    zurueckgegeben: number;
  };

  type Variante = {
    groesseId: string;
    groesse: string;
  };

  type Artikel = {
    _id: string;
    name: string;
    varianten: Variante[];
  };

  // Daten
  let ausleihen = $state<Ausleihe[]>([]);
  let artikel = $state<Artikel[]>([]);

  // Übersicht
  let filter = $state('offen');
  let suche = $state('');
  let wirdGeladen = $state(true);
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let heute = $state('');

  // Materialrückgabe
  let rueckgabeId = $state('');
  let rueckgabeMenge = $state(1);
  let rueckgabeSpeichert = $state(false);

  let aktuelleRueckgabe = $derived(
    ausleihen.find((a) => a._id === rueckgabeId)
  );

  let gefilterteAusleihen = $derived(
    ausleihen.filter((ausleihe) => {
      const suchtext = suche.toLowerCase().trim();

      const passtZumStatus =
        filter === 'alle' ||
        (filter === 'offen' && ausleihe.status !== 'abgeschlossen') ||
        (filter === 'abgeschlossen' &&
          ausleihe.status === 'abgeschlossen');

      const passtZurSuche =
        ausleihe.person.toLowerCase().includes(suchtext) ||
        artikelName(ausleihe.artikelId)
          .toLowerCase()
          .includes(suchtext);

      return passtZumStatus && passtZurSuche;
    })
  );

  let offeneAusleihen = $derived(
    ausleihen.filter((a) => a.status !== 'abgeschlossen').length
  );

  let ueberfaelligeAusleihen = $derived(
    ausleihen.filter(
      (a) =>
        a.status !== 'abgeschlossen' &&
        a.rueckgabedatum < heute
    ).length
  );

  let abgeschlosseneAusleihen = $derived(
    ausleihen.filter((a) => a.status === 'abgeschlossen').length
  );

  function artikelName(id: string) {
    return artikel.find((a) => a._id === id)?.name
      ?? 'Unbekannter Artikel';
  }

  function groessenName(ausleihe: Ausleihe) {
    if (!ausleihe.groesseId) return '';

    const eintrag = artikel.find(
      (a) => a._id === ausleihe.artikelId
    );

    return (
      eintrag?.varianten.find(
        (v) => v.groesseId === ausleihe.groesseId
      )?.groesse ?? 'Unbekannt'
    );
  }

  function datumFormatieren(datum: string) {
    if (!datum) return '–';

    const [jahr, monat, tag] = datum.split('-');
    return `${tag}.${monat}.${jahr}`;
  }

  function istUeberfaellig(ausleihe: Ausleihe) {
    return (
      ausleihe.status !== 'abgeschlossen' &&
      ausleihe.rueckgabedatum < heute
    );
  }

  async function datenLaden() {
    wirdGeladen = true;
    fehlermeldung = '';

    try {
      const [ausleihenAntwort, artikelAntwort] = await Promise.all([
        fetch('/api/ausleihen'),
        fetch('/api/inventar-uebersicht')
      ]);

      if (!ausleihenAntwort.ok || !artikelAntwort.ok) {
        throw new Error('Ausleihen konnten nicht geladen werden.');
      }

      const [neueAusleihen, neueArtikel] = await Promise.all([
        ausleihenAntwort.json(),
        artikelAntwort.json()
      ]);

      ausleihen = neueAusleihen;
      artikel = neueArtikel;
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Daten konnten nicht geladen werden.';
    } finally {
      wirdGeladen = false;
    }
  }

  // ========================================
  // MATERIALRÜCKGABE
  // ========================================

  function rueckgabeOeffnen(ausleihe: Ausleihe) {
    rueckgabeId = ausleihe._id;

    rueckgabeMenge =
      ausleihe.menge - (ausleihe.zurueckgegeben ?? 0);

    fehlermeldung = '';
    erfolgsmeldung = '';
  }

  function rueckgabeSchliessen() {
    rueckgabeId = '';
    rueckgabeMenge = 1;
  }

  async function rueckgabeSpeichern() {
    if (!aktuelleRueckgabe || rueckgabeSpeichert) return;

    const nochOffen =
      aktuelleRueckgabe.menge -
      (aktuelleRueckgabe.zurueckgegeben ?? 0);

    if (
      !Number.isInteger(rueckgabeMenge) ||
      rueckgabeMenge < 1 ||
      rueckgabeMenge > nochOffen
    ) {
      fehlermeldung =
        `Bitte eine Rückgabemenge zwischen 1 und ${nochOffen} eingeben.`;
      return;
    }

    const ausleiheId = aktuelleRueckgabe._id;
    const gespeicherteMenge = rueckgabeMenge;

    rueckgabeSpeichert = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch(
        `/api/ausleihen/${ausleiheId}/rueckgabe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            menge: gespeicherteMenge
          })
        }
      );

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler || 'Rückgabe konnte nicht gespeichert werden.'
        );
      }

      rueckgabeSchliessen();

      await datenLaden();

      erfolgsmeldung =
        `${gespeicherteMenge} Stück erfolgreich zurückgegeben.`;
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Rückgabe konnte nicht gespeichert werden.';
    } finally {
      rueckgabeSpeichert = false;
    }
  }

  onMount(() => {
    const datum = new Date();

    heute = [
      datum.getFullYear(),
      String(datum.getMonth() + 1).padStart(2, '0'),
      String(datum.getDate()).padStart(2, '0')
    ].join('-');

    datenLaden();
  });
</script>

<section class="uebersicht">
  <div class="kopf">
    <div>
      <h2>Materialausleihen – Übersicht</h2>
      <p>Alle offenen und abgeschlossenen Materialausleihen.</p>
    </div>

    <button
      type="button"
      class="aktualisieren"
      onclick={datenLaden}
      disabled={wirdGeladen}
    >
      Aktualisieren
    </button>
  </div>

  {#if fehlermeldung}
    <p class="fehlermeldung" role="alert">
      {fehlermeldung}
    </p>
  {/if}

  {#if erfolgsmeldung}
    <p class="erfolgsmeldung" role="status">
      {erfolgsmeldung}
    </p>
  {/if}

  {#if wirdGeladen}
    <p>Ausleihen werden geladen ...</p>
  {:else}
    <div class="kennzahlen">
      <div class="kennzahl">
        <span>Offene Ausleihen</span>
        <strong>{offeneAusleihen}</strong>
      </div>

      <div class="kennzahl">
        <span>Überfällig</span>
        <strong class="rot">{ueberfaelligeAusleihen}</strong>
      </div>

      <div class="kennzahl">
        <span>Abgeschlossen</span>
        <strong>{abgeschlosseneAusleihen}</strong>
      </div>
    </div>

    <div class="filter">
      <div class="feld">
        <label for="ausleihe-suche">Suchen</label>

        <input
          id="ausleihe-suche"
          type="search"
          placeholder="Artikel oder Person ..."
          bind:value={suche}
        />
      </div>

      <div class="feld">
        <label for="ausleihe-status">Status</label>

        <select id="ausleihe-status" bind:value={filter}>
          <option value="offen">Offene Ausleihen</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="alle">Alle Ausleihen</option>
        </select>
      </div>
    </div>

    <div class="tabellen-container">
      <table>
        <thead>
          <tr>
            <th>Artikel</th>
            <th>Ausgeliehen an</th>
            <th>Ausleihdatum</th>
            <th>Rückgabe geplant</th>
            <th>Menge</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>

        <tbody>
          {#each gefilterteAusleihen as ausleihe (ausleihe._id)}
            <tr class:ueberfaellig={istUeberfaellig(ausleihe)}>
              <td>
                <strong>{artikelName(ausleihe.artikelId)}</strong>

                {#if ausleihe.groesseId}
                  <span class="zusatz">
                    Grösse: {groessenName(ausleihe)}
                  </span>
                {/if}
              </td>

              <td>
                {ausleihe.person}

                {#if ausleihe.bemerkung}
                  <span class="zusatz">
                    {ausleihe.bemerkung}
                  </span>
                {/if}
              </td>

              <td>
                {datumFormatieren(ausleihe.ausleihdatum)}
              </td>

              <td>
                {datumFormatieren(ausleihe.rueckgabedatum)}
              </td>

              <td>
                {ausleihe.menge -
                  (ausleihe.zurueckgegeben ?? 0)}
                / {ausleihe.menge} Stück
              </td>

              <td>
                {#if ausleihe.status === 'abgeschlossen'}
                  <span class="status abgeschlossen">
                    Abgeschlossen
                  </span>
                {:else if istUeberfaellig(ausleihe)}
                  <span class="status spaet">
                    Überfällig
                  </span>
                {:else if ausleihe.zurueckgegeben > 0}
                  <span class="status teilweise">
                    Teilweise zurück
                  </span>
                {:else}
                  <span class="status offen">
                    Offen
                  </span>
                {/if}
              </td>

              <td>
                {#if ausleihe.status !== 'abgeschlossen'}
                  <button
                    type="button"
                    class="rueckgabe-button"
                    onclick={() => rueckgabeOeffnen(ausleihe)}
                  >
                    Rückgabe erfassen
                  </button>
                {:else}
                  <span class="zusatz">Erledigt</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if gefilterteAusleihen.length === 0}
        <p class="leer">
          Keine passenden Ausleihen vorhanden.
        </p>
      {/if}
    </div>
  {/if}
</section>

<!-- ========================================
     RÜCKGABEFENSTER
     ======================================== -->

{#if aktuelleRueckgabe}
  <div class="rueckgabe-hintergrund">
    <div
      class="rueckgabe-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Materialrückgabe"
    >
      <h2>Material zurückgeben</h2>

      <p>
        <strong>
          {artikelName(aktuelleRueckgabe.artikelId)}
        </strong>

        {#if aktuelleRueckgabe.groesseId}
          – Grösse {groessenName(aktuelleRueckgabe)}
        {/if}
      </p>

      <p>
        Ausgeliehen an:
        <strong>{aktuelleRueckgabe.person}</strong>
      </p>

      <div class="rueckgabe-info">
        <span>Noch offen</span>

        <strong>
          {aktuelleRueckgabe.menge -
            (aktuelleRueckgabe.zurueckgegeben ?? 0)}
          Stück
        </strong>
      </div>

      <div class="feld">
        <label for="rueckgabe-menge">
          Rückgabemenge
        </label>

        <input
          id="rueckgabe-menge"
          type="number"
          min="1"
          max={aktuelleRueckgabe.menge -
            (aktuelleRueckgabe.zurueckgegeben ?? 0)}
          step="1"
          bind:value={rueckgabeMenge}
        />
      </div>

      <p class="hinweis">
        Du kannst die gesamte Menge oder nur einen Teil
        des Materials zurückgeben.
      </p>

      <div class="rueckgabe-aktionen">
        <button
          type="button"
          class="abbrechen-button"
          onclick={rueckgabeSchliessen}
          disabled={rueckgabeSpeichert}
        >
          Abbrechen
        </button>

        <button
          type="button"
          class="bestaetigen-button"
          onclick={rueckgabeSpeichern}
          disabled={rueckgabeSpeichert}
        >
          {rueckgabeSpeichert
            ? 'Wird gespeichert ...'
            : 'Rückgabe bestätigen'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .uebersicht {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 25px;
    margin-top: 45px;
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
  }

  h2 {
    color: #172b4d;
    margin: 0 0 8px;
  }

  .kopf p {
    color: #64748b;
    margin: 0;
  }

  .aktualisieren {
    padding: 10px 16px;
    border: 1px solid #cbd5e1;
    background: white;
    color: #172b4d;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
  }

  .aktualisieren:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .kennzahlen {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-bottom: 25px;
  }

  .kennzahl {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    border-radius: 8px;
    background: #f1f5f9;
  }

  .kennzahl span {
    color: #64748b;
    font-size: 14px;
  }

  .kennzahl strong {
    color: #172b4d;
    font-size: 25px;
  }

  .kennzahl .rot {
    color: #dc2626;
  }

  .filter {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-bottom: 25px;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 14px;
    font-weight: 500;
  }

  input,
  select {
    width: 100%;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-sizing: border-box;
    font: inherit;
  }

  .tabellen-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: 13px;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    background: #f8fafc;
    color: #475569;
    font-size: 13px;
  }

  .zusatz {
    display: block;
    margin-top: 5px;
    font-size: 12px;
    color: #64748b;
  }

  .ueberfaellig {
    background: #fff7f7;
  }

  .status {
    display: inline-block;
    padding: 5px 9px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .offen {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .spaet {
    background: #fee2e2;
    color: #991b1b;
  }

  .teilweise {
    background: #fef3c7;
    color: #92400e;
  }

  .abgeschlossen {
    background: #dcfce7;
    color: #166534;
  }

  .rueckgabe-button {
    background: #172b4d;
    color: white;
    border: none;
    border-radius: 7px;
    padding: 9px 12px;
    cursor: pointer;
    white-space: nowrap;
    font: inherit;
    font-size: 13px;
  }

  .leer {
    text-align: center;
    color: #64748b;
    padding: 25px;
  }

  .fehlermeldung {
    padding: 12px;
    margin-bottom: 15px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 8px;
  }

  .erfolgsmeldung {
    padding: 12px;
    margin-bottom: 15px;
    background: #dcfce7;
    color: #166534;
    border-radius: 8px;
  }

  /* Rückgabefenster */

  .rueckgabe-hintergrund {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
  }

  .rueckgabe-dialog {
    background: white;
    width: 100%;
    max-width: 430px;
    padding: 28px;
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
  }

  .rueckgabe-dialog h2 {
    margin-bottom: 20px;
  }

  .rueckgabe-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f1f5f9;
    border-radius: 8px;
    padding: 15px;
    margin: 20px 0;
  }

  .rueckgabe-info strong {
    font-size: 20px;
    color: #172b4d;
  }

  .hinweis {
    color: #64748b;
    font-size: 13px;
  }

  .rueckgabe-aktionen {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  .abbrechen-button,
  .bestaetigen-button {
    border: none;
    border-radius: 7px;
    padding: 11px 15px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }

  .abbrechen-button {
    background: #e2e8f0;
    color: #172b4d;
  }

  .bestaetigen-button {
    background: #172b4d;
    color: white;
  }

  .abbrechen-button:disabled,
  .bestaetigen-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 700px) {
    .kopf {
      flex-direction: column;
      align-items: flex-start;
    }

    .kennzahlen,
    .filter {
      grid-template-columns: 1fr;
    }

    .uebersicht {
      padding: 15px;
    }

    .rueckgabe-aktionen {
      flex-direction: column;
    }
  }
</style>
