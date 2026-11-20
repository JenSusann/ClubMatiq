<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  type Variante = {
    _id: string;
    groesseId: string;
    menge: number;
    einzelwert: number;
  };

  type Artikel = {
    _id: string;
    name: string;
    beschreibung?: string;
    kategorieId: string;
    lagerortId: string;
    lieferantId?: string | null;
    menge: number;
    einzelwert: number;
    hatGroessen: boolean;
    varianten: Variante[];
  };

  type Lieferant = {
    _id: string;
    name: string;
  };

  let artikel = $state<Artikel | null>(null);
  let lieferanten = $state<Lieferant[]>([]);
  let laden = $state(true);
  let fehler = $state('');
  let lieferantenFehler = $state('');
  type Bewegung = { id: string; art: string; mengeDelta: number; zeitpunkt: string; benutzerId: string; groesseId: string | null; referenzTyp: string; referenzId: string };
  let bewegungen = $state<Bewegung[]>([]);
  let bewegungFehler = $state('');
  let bewegungHinweis = $state('');
  let bewegungsart = $state('');
  let bewegungVon = $state('');
  let bewegungBis = $state('');

  const artikelId = $derived(page.params.id ?? '');
  const standardlieferant = $derived(
    lieferanten.find((eintrag) => eintrag._id === artikel?.lieferantId)
  );

  onMount(() => {
    void ladeArtikel();
    void ladeBewegungen();
  });

  async function ladeArtikel() {
    laden = true;
    fehler = '';
    lieferantenFehler = '';

    try {
      const [artikelAntwort, lieferantenAntwort] = await Promise.all([
        fetch(`/api/artikel/${encodeURIComponent(artikelId)}`),
        fetch('/api/lieferanten')
      ]);

      const artikelDaten = await artikelAntwort.json();
      if (!artikelAntwort.ok) {
        throw new Error(artikelDaten.fehler ?? 'Artikel konnte nicht geladen werden.');
      }
      artikel = artikelDaten as Artikel;

      if (lieferantenAntwort.ok) {
        const lieferantenDaten: unknown = await lieferantenAntwort.json();
        // Unterstützt sowohl ein direktes Array als auch { lieferanten: [...] }.
        if (Array.isArray(lieferantenDaten)) {
          lieferanten = lieferantenDaten as Lieferant[];
        } else if (
          lieferantenDaten &&
          typeof lieferantenDaten === 'object' &&
          'lieferanten' in lieferantenDaten &&
          Array.isArray(lieferantenDaten.lieferanten)
        ) {
          lieferanten = lieferantenDaten.lieferanten as Lieferant[];
        } else {
          lieferantenFehler = 'Lieferanten konnten nicht zugeordnet werden.';
        }
      } else {
        lieferantenFehler = 'Lieferanten konnten nicht geladen werden.';
      }
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Verbindung zum Server fehlgeschlagen.';
    } finally {
      laden = false;
    }
  }

  async function ladeBewegungen() {
    bewegungFehler = '';
    try {
      const parameter = new URLSearchParams();
      if (bewegungsart) parameter.set('art', bewegungsart);
      if (bewegungVon) parameter.set('von', bewegungVon);
      if (bewegungBis) parameter.set('bis', bewegungBis);
      const antwort = await fetch(`/api/artikel/${encodeURIComponent(artikelId)}/lagerbewegungen?${parameter}`);
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Lagerbewegungen konnten nicht geladen werden.');
      bewegungen = daten.bewegungen ?? [];
      bewegungHinweis = daten.hinweis ?? '';
    } catch (error) {
      bewegungFehler = error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.';
    }
  }

  function geldbetrag(wert: number) {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(wert);
  }
</script>

<svelte:head>
  <title>{artikel ? `${artikel.name} – ClubMatiq` : 'Artikeldetails – ClubMatiq'}</title>
</svelte:head>

<main>
  <a href="/inventar" class="zurueck">← Zurück zum Inventar</a>
  <h1>Artikeldetails</h1>

  {#if laden}
    <div class="bereich"><p>Artikel wird geladen ...</p></div>
  {:else if fehler}
    <div class="bereich fehlermeldung" role="alert">
      <p>{fehler}</p>
      <button onclick={ladeArtikel}>Erneut versuchen</button>
    </div>
  {:else if artikel}
    <section class="bereich">
      <div class="kopf">
        <div>
          <span class="kennzeichnung">Inventarartikel</span>
          <h2>{artikel.name}</h2>
        </div>
        <span class="bestand">Bestand: {artikel.menge}</span>
      </div>

      <div class="informationen">
        <div>
          <span class="feldname">Artikel-ID</span>
          <p>{artikel._id}</p>
        </div>
        <div>
          <span class="feldname">Gesamtbestand</span>
          <p>{artikel.menge} Stück</p>
        </div>
        <div>
          <span class="feldname">Standardlieferant</span>
          {#if lieferantenFehler}
            <p class="hinweis">{lieferantenFehler}</p>
          {:else if !artikel.lieferantId}
            <p class="hinweis">Kein Lieferant hinterlegt</p>
          {:else if standardlieferant}
            <p>{standardlieferant.name}</p>
          {:else}
            <p class="hinweis">Zugeordneter Lieferant nicht mehr vorhanden</p>
          {/if}
        </div>
        {#if !artikel.hatGroessen}
          <div>
            <span class="feldname">Einzelwert</span>
            <p>{geldbetrag(artikel.einzelwert ?? 0)}</p>
          </div>
        {/if}
      </div>

      <div class="beschreibung">
        <h3>Beschreibung</h3>
        <p>{artikel.beschreibung?.trim() || 'Für diesen Artikel ist keine Beschreibung hinterlegt.'}</p>
      </div>

      {#if artikel.hatGroessen}
        <div class="varianten">
          <h3>Grössenvarianten</h3>
          <div class="tabelle-wrapper">
            <table>
              <thead>
                <tr><th>Grössen-ID</th><th>Menge</th><th>Einzelwert</th></tr>
              </thead>
              <tbody>
                {#each artikel.varianten as variante (variante._id)}
                  <tr>
                    <td>{variante.groesseId}</td>
                    <td>{variante.menge}</td>
                    <td>{geldbetrag(variante.einzelwert)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <div class="aktionen">
        <a href="/ausleihen" class="aktion">Zur Ausleihe</a>
        <a href="/meldungen" class="aktion">Schaden melden</a>
      </div>
    </section>
    <section class="bereich" style="margin-top:24px">
      <h2>Lagerbewegungsjournal</h2>
      <p class="hinweis">{bewegungHinweis || 'Bestandsänderungen seit Einführung des Journals werden hier angezeigt.'}</p>
      <div class="aktionen">
        <label>Bewegungstyp <select bind:value={bewegungsart}><option value="">Alle</option><option value="anlage">Anlage</option><option value="ausleihe">Ausleihe</option><option value="rueckgabe">Rückgabe</option><option value="inventur">Inventur</option><option value="verkauf">Verkauf</option><option value="wareneingang">Wareneingang</option><option value="korrektur">Korrektur</option><option value="storno">Storno</option></select></label>
        <label>Von <input type="date" bind:value={bewegungVon}/></label>
        <label>Bis <input type="date" bind:value={bewegungBis}/></label>
        <button type="button" onclick={ladeBewegungen}>Filtern</button>
      </div>
      {#if bewegungFehler}<p class="fehlermeldung" role="alert">{bewegungFehler}</p>{/if}
      <div class="tabelle-wrapper"><table><thead><tr><th>Zeitpunkt</th><th>Vorgang</th><th>Menge</th><th>Grösse</th><th>Durchgeführt von (Benutzer-ID)</th><th>Referenz</th></tr></thead>
      <tbody>{#each bewegungen as bewegung (bewegung.id)}
        <tr><td>{new Date(bewegung.zeitpunkt).toLocaleString('de-CH')}</td><td>{bewegung.art}</td><td>{bewegung.mengeDelta > 0 ? '+' : ''}{bewegung.mengeDelta}</td><td>{bewegung.groesseId ?? '–'}</td><td>{bewegung.benutzerId}</td><td>{bewegung.referenzTyp}: {bewegung.referenzId}</td></tr>
      {:else}<tr><td colspan="6">Keine erfassten Bewegungen für diesen Zeitraum.</td></tr>{/each}</tbody></table></div>
    </section>
  {/if}
</main>

<style>
  main { max-width: 1100px; margin: 40px auto; padding: 20px; }
  h1 { color: #172b4d; margin: 18px 0 24px; }
  .zurueck { color: #2563eb; text-decoration: none; font-weight: 500; }
  .bereich { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
  .kopf h2 { margin: 8px 0; color: #172b4d; }
  .kennzeichnung, .feldname { font-size: 13px; color: #64748b; }
  .bestand { padding: 9px 14px; border-radius: 8px; background: #e0f2fe; color: #075985; font-weight: 600; }
  .informationen { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 28px; }
  .informationen p { margin: 6px 0 0; overflow-wrap: anywhere; font-weight: 500; }
  .informationen .hinweis { color: #64748b; font-weight: 400; }
  .beschreibung, .varianten { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  h3 { color: #172b4d; }
  .tabelle-wrapper { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { background: #f8fafc; }
  .aktionen { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
  .aktion, button { display: inline-block; padding: 11px 18px; border: 0; border-radius: 8px; background: #172b4d; color: white; font: inherit; text-decoration: none; cursor: pointer; }
  .fehlermeldung { color: #b91c1c; }
  .fehlermeldung button { margin-top: 12px; }
  @media (max-width: 600px) {
    main { margin: 16px auto; padding: 12px; }
    .bereich { padding: 18px; }
  }
</style>
