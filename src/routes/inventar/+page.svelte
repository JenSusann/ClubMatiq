
<script lang="ts">
  
let wirdGeloescht = $state<string | null>(null);

async function artikelLoeschen(a: Artikel) {
  const bestaetigt = confirm(
    `Möchtest du den Artikel "${a.name}" wirklich löschen?\n\n` +
    'Der Artikel und seine Grössenbestände werden dauerhaft gelöscht.'
  );

  if (!bestaetigt) return;

  wirdGeloescht = a._id;
  fehlermeldung = '';

  try {
    const antwort = await fetch(`/api/artikel/${a._id}`, {
      method: 'DELETE'
    });

    const daten = await antwort.json();

    if (!antwort.ok) {
      throw new Error(
        daten.fehler || 'Artikel konnte nicht gelöscht werden.'
      );
    }

    artikel = artikel.filter((eintrag) => eintrag._id !== a._id);
    ausgeklappteArtikel = ausgeklappteArtikel.filter(
      (id) => id !== a._id
    );
  } catch (error) {
    fehlermeldung =
      error instanceof Error
        ? error.message
        : 'Löschen fehlgeschlagen.';
  } finally {
    wirdGeloescht = null;
  }
}

  
  import { onMount } from 'svelte';

  type Variante = {
    groesseId: string;
    groesse: string;
    sortierung: number;
    menge: number;
    einzelwert: number;
  };

  type Artikel = {
    _id: string;
    name: string;
    kategorieId: string;
    kategorie: string;
    lagerortId: string;
    lagerort: string;
    beschreibung: string;
    hatGroessen: boolean;
    gesamtmenge: number;
    inventarwert: number;
    einzelwert: number;
    varianten: Variante[];
  };

  let artikel = $state<Artikel[]>([]);
  let suche = $state('');
  let kategorieFilter = $state('');
  let ausgeklappteArtikel = $state<string[]>([]);
  let wirdGeladen = $state(true);
  let fehlermeldung = $state('');

  // Verfügbare Kategorien
  let kategorien = $derived(
    [...new Set(artikel.map((a) => a.kategorie))].sort()
  );

  // Artikel nach Suche und Kategorie filtern
  let gefilterteArtikel = $derived(
    artikel.filter((a) => {
      const suchtext = suche.toLowerCase().trim();

      const passtZurSuche =
        a.name.toLowerCase().includes(suchtext) ||
        a.kategorie.toLowerCase().includes(suchtext) ||
        a.lagerort.toLowerCase().includes(suchtext);

      const passtZurKategorie =
        !kategorieFilter || a.kategorie === kategorieFilter;

      return passtZurSuche && passtZurKategorie;
    })
  );

  // Kennzahlen
  let gesamtArtikel = $derived(gefilterteArtikel.length);

  let gesamtBestand = $derived(
    gefilterteArtikel.reduce(
      (summe, a) => summe + a.gesamtmenge,
      0
    )
  );

  let gesamtWert = $derived(
    gefilterteArtikel.reduce(
      (summe, a) => summe + a.inventarwert,
      0
    )
  );

  // CHF formatieren
  function formatiereCHF(wert: number) {
    return wert.toLocaleString('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Artikeldetails öffnen/schliessen
  function detailsUmschalten(id: string) {
    if (ausgeklappteArtikel.includes(id)) {
      ausgeklappteArtikel = ausgeklappteArtikel.filter(
        (x) => x !== id
      );
    } else {
      ausgeklappteArtikel = [...ausgeklappteArtikel, id];
    }
  }

  // Inventar laden
  async function artikelLaden() {
    wirdGeladen = true;
    fehlermeldung = '';

    try {
      const antwort = await fetch('/api/inventar-uebersicht');

      if (!antwort.ok) {
        throw new Error('Inventar konnte nicht geladen werden.');
      }

      artikel = await antwort.json();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Laden fehlgeschlagen.';
    } finally {
      wirdGeladen = false;
    }
  }

  onMount(() => {
    artikelLaden();
  });
</script>

<svelte:head>
  <title>Inventarverwaltung – ClubMatiq</title>
</svelte:head>

<main>
  <!-- Kopfbereich -->
  <div class="kopf">
    <div>
      <h1>Inventarverwaltung</h1>
      <p>Verwalte das Material und die Vereinskleider.</p>
    </div>

    <a href="/inventar/neu" class="button">
      + Neuer Artikel
    </a>
  </div>

  {#if fehlermeldung}
    <p class="meldung fehler" role="alert">
      {fehlermeldung}
    </p>
  {/if}

  {#if wirdGeladen}
    <p>Inventar wird geladen ...</p>
  {:else}
    <!-- Kennzahlen -->
    <div class="kennzahlen">
      <div class="kennzahl">
        <span>Artikel</span>
        <strong>{gesamtArtikel}</strong>
      </div>

      <div class="kennzahl">
        <span>Gesamtbestand</span>
        <strong>{gesamtBestand} Stück</strong>
      </div>

      <div class="kennzahl">
        <span>Inventarwert</span>
        <strong>CHF {formatiereCHF(gesamtWert)}</strong>
      </div>
    </div>

    <!-- Inventartabelle -->
    <section class="bereich">
      <div class="filter">
        <div class="feld">
          <label for="suche">Artikel suchen</label>

          <input
            id="suche"
            type="search"
            placeholder="Name, Kategorie oder Lagerort ..."
            bind:value={suche}
          />
        </div>

        <div class="feld">
          <label for="kategorie">Kategorie</label>

          <select
            id="kategorie"
            bind:value={kategorieFilter}
          >
            <option value="">Alle Kategorien</option>

            {#each kategorien as kategorie}
              <option value={kategorie}>
                {kategorie}
              </option>
            {/each}
          </select>
        </div>
      </div>

      <div class="tabellen-container">
        <table>
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Kategorie</th>
              <th>Lagerort</th>
              <th>Bestand</th>
              <th>Inventarwert</th>
              <th>Aktionen</th>
            </tr>
          </thead>

          <tbody>
            {#each gefilterteArtikel as a (a._id)}
              <!-- Hauptzeile -->
              <tr>
                <td>
                  <strong>{a.name}</strong>
                </td>

                <td>{a.kategorie}</td>

                <td>{a.lagerort}</td>

                <td>{a.gesamtmenge} Stück</td>

                <td>
                  CHF {formatiereCHF(a.inventarwert)}
                </td>

                <td>
                  <div class="artikel-aktionen">
                    <!-- Details anzeigen -->
                    <button
                      type="button"
                      class="details-button"
                      onclick={() => detailsUmschalten(a._id)}
                      aria-expanded={ausgeklappteArtikel.includes(a._id)}
                    >
                      {ausgeklappteArtikel.includes(a._id)
                        ? 'Schliessen'
                        : 'Anzeigen'}
                    </button>

                    <!-- Artikel bearbeiten -->
                    <a
                      href={`/inventar/${a._id}/bearbeiten`}
                      class="bearbeiten-button"
                    >
                      Bearbeiten
                    </a>
                      <button
                        type="button"
                        class="loeschen-button"
                        disabled={wirdGeloescht !== null}
                        onclick={() => artikelLoeschen(a)}
                      >
                        {wirdGeloescht === a._id ? 'Löschen ...' : 'Löschen'}
                      </button>
                  </div>
                </td>
              </tr>

              <!-- Ausklappbare Details -->
              {#if ausgeklappteArtikel.includes(a._id)}
                <tr class="detail-zeile">
                  <td colspan="6">
                    <div class="details">
                      {#if a.beschreibung}
                        <p>
                          <strong>Beschreibung:</strong>
                          {a.beschreibung}
                        </p>
                      {/if}

                      {#if a.hatGroessen}
                        <h3>Bestand nach Grösse</h3>

                        <table class="varianten-tabelle">
                          <thead>
                            <tr>
                              <th>Grösse</th>
                              <th>Bestand</th>
                              <th>Einzelwert</th>
                              <th>Gesamtwert</th>
                            </tr>
                          </thead>

                          <tbody>
                            {#each a.varianten.filter((variante) => variante.menge > 0) as variante (variante.groesseId)}
                              <tr>
                                <td>{variante.groesse}</td>

                                <td>
                                  {variante.menge} Stück
                                </td>

                                <td>
                                  CHF {formatiereCHF(variante.einzelwert)}
                                </td>

                                <td>
                                  CHF {formatiereCHF(
                                    variante.menge * variante.einzelwert
                                  )}
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>

                        {#if !a.varianten.some((variante) => variante.menge > 0)}
                          <p class="kein-bestand">
                            Aktuell kein Bestand vorhanden.
                          </p>
                        {/if}
                      {:else}
                        <p>
                          <strong>Einzelwert:</strong>
                          CHF {formatiereCHF(a.einzelwert)}
                        </p>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>

        {#if gefilterteArtikel.length === 0}
          <p class="leer">
            Keine passenden Inventarartikel gefunden.
          </p>
        {/if}
      </div>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
  }

  /* Kopfbereich */

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 30px;
  }

  h1 {
    color: #172b4d;
    margin-bottom: 8px;
  }

  .kopf p {
    color: #64748b;
    margin: 0;
  }

  .button {
    display: inline-block;
    background: #172b4d;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    text-decoration: none;
    white-space: nowrap;
    font-weight: 500;
  }

  .button:hover {
    background: #29456f;
  }

  /* Kennzahlen */

  .kennzahlen {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 30px;
  }

  .kennzahl {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 25px;
  }

  .kennzahl span {
    color: #64748b;
    font-size: 14px;
  }

  .kennzahl strong {
    font-size: 26px;
    color: #172b4d;
  }

  /* Inventarbereich */

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 25px;
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

  .feld label {
    font-size: 14px;
    font-weight: 500;
  }

  input,
  select {
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  /* Tabelle */

  .tabellen-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 14px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
  }

  th {
    background: #f8fafc;
    font-size: 13px;
    color: #475569;
    font-weight: 600;
  }

  /* Aktionen */

  .artikel-aktionen {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .details-button,
  .bearbeiten-button {
    display: inline-block;
    padding: 9px 13px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    font-family: inherit;
    text-align: center;
  }

  .details-button {
    background: #e2e8f0;
    color: #172b4d;
    border: none;
  }

  .details-button:hover {
    background: #cbd5e1;
  }

  .bearbeiten-button {
    background: #172b4d;
    color: white;
    border: none;
    text-decoration: none;
  }

  .bearbeiten-button:hover {
    background: #29456f;
  }


  .loeschen-button {
    padding: 9px 13px;
    background: #fee2e2;
    color: #991b1b;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .loeschen-button:hover {
    background: #fecaca;
  }

  .loeschen-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }


  /* Ausklappbare Details */

  .detail-zeile {
    background: #f8fafc;
  }

  .details {
    padding: 15px;
  }

  .details h3 {
    margin-top: 10px;
    margin-bottom: 15px;
    color: #172b4d;
  }

  .varianten-tabelle {
    max-width: 700px;
    background: white;
  }

  .varianten-tabelle th {
    background: #e2e8f0;
  }

  .kein-bestand {
    color: #64748b;
    font-style: italic;
  }

  .leer {
    text-align: center;
    padding: 30px;
    color: #64748b;
  }

  /* Meldungen */

  .meldung {
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .fehler {
    background: #fee2e2;
    color: #991b1b;
  }

  /* Mobile Ansicht */

  @media (max-width: 750px) {
    .kopf {
      flex-direction: column;
      align-items: flex-start;
    }

    .kennzahlen {
      grid-template-columns: 1fr;
    }

    .filter {
      grid-template-columns: 1fr;
    }

    .bereich {
      padding: 15px;
    }
  }
</style>
