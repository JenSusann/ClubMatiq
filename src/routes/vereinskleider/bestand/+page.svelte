
<script lang="ts">
  import { onMount } from 'svelte';

  type Kategorie = {
    _id: string;
    name: string;
  };

  type Groesse = {
    _id: string;
    bezeichnung: string;
    sortierung: number;
  };

  type Variante = {
    _id: string;
    groesseId: string;
    menge: number;
    einzelwert: number;
  };

  type Artikel = {
    _id: string;
    name: string;
    kategorieId: string;
    menge: number;
    einzelwert: number;
    beschreibung?: string;
    hatGroessen: boolean;
    varianten?: Variante[];
  };

  let artikel = $state<Artikel[]>([]);
  let groessen = $state<Groesse[]>([]);

  let laden = $state(true);
  let fehler = $state('');
  let suche = $state('');
  let kategorieGefunden = $state(false);

  let geoeffneteArtikel = $state<string[]>([]);

  const gefilterteArtikel = $derived(
    artikel.filter((eintrag) =>
      eintrag.name
        .toLowerCase()
        .includes(suche.toLowerCase().trim())
    )
  );

  const gesamtbestand = $derived(
    artikel.reduce(
      (summe, eintrag) => summe + eintrag.menge,
      0
    )
  );

  onMount(async () => {
    try {
      const [kategorienAntwort, artikelAntwort, groessenAntwort] =
        await Promise.all([
          fetch('/api/kategorien'),
          fetch('/api/artikel'),
          fetch('/api/groessen')
        ]);

      if (
        !kategorienAntwort.ok ||
        !artikelAntwort.ok ||
        !groessenAntwort.ok
      ) {
        throw new Error(
          'Die Inventardaten konnten nicht geladen werden.'
        );
      }

      const kategorien: Kategorie[] =
        await kategorienAntwort.json();

      const alleArtikel: Artikel[] =
        await artikelAntwort.json();

      groessen = await groessenAntwort.json();

      const kategorie = kategorien.find(
        (eintrag) =>
          eintrag.name.trim().toLowerCase() ===
          'vereinskleider'
      );

      if (!kategorie) {
        return;
      }

      kategorieGefunden = true;

      const kleiderArtikel = alleArtikel.filter(
        (eintrag) => eintrag.kategorieId === kategorie._id
      );

      // Detail-API liefert die vorhandenen Grössenvarianten.
      artikel = await Promise.all(
        kleiderArtikel.map(async (eintrag) => {
          if (!eintrag.hatGroessen) {
            return eintrag;
          }

          const antwort = await fetch(
            `/api/artikel/${eintrag._id}`
          );

          if (!antwort.ok) {
            throw new Error(
              `Grössen für ${eintrag.name} konnten nicht geladen werden.`
            );
          }

          return (await antwort.json()) as Artikel;
        })
      );
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      laden = false;
    }
  });

  function umschalten(id: string) {
    if (geoeffneteArtikel.includes(id)) {
      geoeffneteArtikel = geoeffneteArtikel.filter(
        (eintrag) => eintrag !== id
      );
    } else {
      geoeffneteArtikel = [...geoeffneteArtikel, id];
    }
  }

  function groessenName(id: string): string {
    return (
      groessen.find((groesse) => groesse._id === id)
        ?.bezeichnung ?? 'Unbekannt'
    );
  }

  function sortierteVarianten(varianten: Variante[]): Variante[] {
    return [...varianten].sort((a, b) => {
      const sortA =
        groessen.find((g) => g._id === a.groesseId)
          ?.sortierung ?? 9999;

      const sortB =
        groessen.find((g) => g._id === b.groesseId)
          ?.sortierung ?? 9999;

      return sortA - sortB;
    });
  }

  function verkaufbar(bestand: number): number {
    return Math.max(0, bestand - 1);
  }

  function formatCHF(betrag: number): string {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(betrag);
  }
</script>

<svelte:head>
  <title>Kleiderbestand – ClubMatiq</title>
</svelte:head>

<main>
  <a class="zurueck" href="/vereinskleider">
    ← Zurück zu Vereinskleider
  </a>

  <header>
    <h1>Kleiderbestand</h1>
    <p>
      Vereinskleider mit Grössen, Lagerbestand und
      verfügbarem Verkaufsbestand.
    </p>
  </header>

  {#if laden}
    <section class="meldung">
      Vereinskleider werden geladen ...
    </section>
  {:else if fehler}
    <section class="meldung fehler" role="alert">
      {fehler}
    </section>
  {:else if !kategorieGefunden}
    <section class="meldung">
      Bitte erstelle die Kategorie «Vereinskleider»
      in der Inventarverwaltung.
    </section>
  {:else}
    <section class="kennzahlen">
      <div class="kennzahl">
        <span>Verschiedene Artikel</span>
        <strong>{artikel.length}</strong>
      </div>

      <div class="kennzahl">
        <span>Gesamter Lagerbestand</span>
        <strong>{gesamtbestand} Stück</strong>
      </div>
    </section>

    <section class="bereich">
      <div class="bereich-kopf">
        <h2>Vereinskleider</h2>
        <a class="aktion" href="/inventar">
          Inventar öffnen
        </a>
      </div>

      <label for="suche">Artikel suchen</label>
      <input
        id="suche"
        type="search"
        placeholder="Artikelbezeichnung ..."
        bind:value={suche}
      />

      {#if gefilterteArtikel.length === 0}
        <p class="leer">
          Keine passenden Vereinskleider gefunden.
        </p>
      {:else}
        <div class="artikelliste">
          {#each gefilterteArtikel as eintrag (eintrag._id)}
            <article class="artikelkarte">
              <div class="artikelkopf">
                <div>
                  <h3>{eintrag.name}</h3>
                  {#if eintrag.beschreibung}
                    <p>{eintrag.beschreibung}</p>
                  {/if}
                </div>

                <div class="artikelaktionen">
                  <span class="bestand">
                    {eintrag.menge} Stück
                  </span>

                  {#if eintrag.hatGroessen}
                    <button
                      type="button"
                      onclick={() => umschalten(eintrag._id)}
                    >
                      {geoeffneteArtikel.includes(eintrag._id)
                        ? 'Schliessen ▲'
                        : 'Grössen anzeigen ▼'}
                    </button>
                  {/if}
                </div>
              </div>

              {#if eintrag.hatGroessen &&
                geoeffneteArtikel.includes(eintrag._id)}
                <div class="tabellenbereich">
                  <table>
                    <thead>
                      <tr>
                        <th>Grösse</th>
                        <th>Bestand</th>
                        <th>Anprobierreserve</th>
                        <th>Verkaufbar</th>
                        <th>Einzelwert (EP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each sortierteVarianten(eintrag.varianten ?? []) as variante (variante._id)}
                        <tr>
                          <td>{groessenName(variante.groesseId)}</td>
                          <td>{variante.menge}</td>
                          <td>{Math.min(1, variante.menge)}</td>
                          <td>
                            <span
                              class:ausverkauft={verkaufbar(variante.menge) === 0}
                              class:verfuegbar={verkaufbar(variante.menge) > 0}
                            >
                              {verkaufbar(variante.menge)}
                            </span>
                          </td>
                          <td>{formatCHF(variante.einzelwert)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else if !eintrag.hatGroessen}
                <div class="ohne-groessen">
                  <span>
                    Verkaufbar:
                    <strong>{verkaufbar(eintrag.menge)} Stück</strong>
                  </span>
                  <span>
                    Einzelwert (EP):
                    <strong>{formatCHF(eintrag.einzelwert)}</strong>
                  </span>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 1100px;
    margin: 40px auto;
    padding: 20px;
  }

  .zurueck {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
  }

  header {
    margin: 28px 0;
  }

  h1,
  h2,
  h3 {
    color: #172b4d;
  }

  header p {
    color: #64748b;
  }

  .kennzahlen {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
    margin-bottom: 24px;
  }

  .kennzahl,
  .bereich,
  .meldung {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
  }

  .kennzahl {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kennzahl span {
    color: #64748b;
    font-size: 14px;
  }

  .kennzahl strong {
    color: #172b4d;
    font-size: 26px;
  }

  .bereich-kopf,
  .artikelkopf,
  .artikelaktionen {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .bereich-kopf {
    margin-bottom: 24px;
  }

  .bereich-kopf h2 {
    margin: 0;
  }

  .aktion {
    background: #2563eb;
    color: white;
    padding: 11px 16px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
  }

  label {
    display: block;
    font-weight: 600;
    color: #334155;
    margin-bottom: 8px;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    margin-bottom: 24px;
    font: inherit;
  }

  .artikelliste {
    display: grid;
    gap: 16px;
  }

  .artikelkarte {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
  }

  .artikelkopf h3 {
    margin: 0 0 6px;
  }

  .artikelkopf p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .bestand {
    color: #475569;
    font-weight: 600;
    white-space: nowrap;
  }

  button {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
    border-radius: 8px;
    padding: 10px 14px;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: #dbeafe;
  }

  .tabellenbereich {
    overflow-x: auto;
    margin-top: 20px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  th,
  td {
    padding: 12px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 14px;
  }

  th {
    background: #f8fafc;
    color: #475569;
  }

  .verfuegbar {
    color: #15803d;
    font-weight: 700;
  }

  .ausverkauft {
    color: #dc2626;
    font-weight: 700;
  }

  .ohne-groessen {
    display: flex;
    flex-wrap: wrap;
    gap: 25px;
    padding-top: 16px;
    color: #64748b;
    font-size: 14px;
  }

  .ohne-groessen strong {
    color: #172b4d;
  }

  .leer {
    color: #64748b;
    text-align: center;
    padding: 30px;
  }

  .fehler {
    background: #fef2f2;
    color: #b91c1c;
  }

  @media (max-width: 650px) {
    main {
      padding: 16px;
      margin: 20px auto;
    }

    .kennzahlen {
      grid-template-columns: 1fr;
    }

    .artikelkopf,
    .bereich-kopf {
      align-items: flex-start;
      flex-direction: column;
    }

    .artikelaktionen {
      flex-wrap: wrap;
    }
  }
</style>
