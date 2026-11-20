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

  type Groesse = { _id: string; bezeichnung: string };
  let groessen = $state<Groesse[]>([]);
  const groessenName = (id: string | null) => id === null ? '–' : (groessen.find((g) => g._id === id)?.bezeichnung ?? 'Unbekannte Grösse');

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
  let bewegungGroesse = $state('');
  let bewegungSuche = $state('');
  let artikelIdKopiert = $state(false);
  const bewegungenGefiltert = $derived(bewegungen.filter((eintrag) => {
    if (bewegungGroesse && eintrag.groesseId !== bewegungGroesse) return false;
    const suche = bewegungSuche.trim().toLocaleLowerCase('de-CH');
    return !suche || [eintrag.art, eintrag.benutzerId, eintrag.referenzId, eintrag.referenzTyp, groessenName(eintrag.groesseId), bewegungsName(eintrag.art)].some((wert) => wert.toLocaleLowerCase('de-CH').includes(suche));
  }));
  const bewegungsName = (art: string) => ({ anlage: 'Anlage', ausleihe: 'Ausleihe', rueckgabe: 'Rückgabe', inventur: 'Inventurkorrektur', verkauf: 'Verkauf', wareneingang: 'Wareneingang', korrektur: 'Korrektur', storno: 'Storno' })[art as 'anlage'] ?? art;
  async function kopiereArtikelId() {
    try { await navigator.clipboard.writeText(artikelId); artikelIdKopiert = true; } catch { artikelIdKopiert = false; }
  }

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
      const [artikelAntwort, lieferantenAntwort, groessenAntwort] = await Promise.all([
        fetch(`/api/artikel/${encodeURIComponent(artikelId)}`),
        fetch('/api/lieferanten'),
        fetch('/api/groessen')
      ]);

      const artikelDaten = await artikelAntwort.json();
      if (!artikelAntwort.ok) {
        throw new Error(artikelDaten.fehler ?? 'Artikel konnte nicht geladen werden.');
      }
      artikel = artikelDaten as Artikel;
      if (groessenAntwort.ok) {
        const groessenDaten: unknown = await groessenAntwort.json();
        groessen = Array.isArray(groessenDaten) ? groessenDaten as Groesse[] : [];
      }

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
      if (bewegungGroesse) parameter.set('groesseId', bewegungGroesse);
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
          <span class="feldname">Interne Artikel-ID</span>
          <div class="id-zeile"><code class="artikel-id" title={artikel._id}>{artikel._id}</code><button type="button" class="kopieren" onclick={kopiereArtikelId}>{artikelIdKopiert ? 'Kopiert' : 'Kopieren'}</button></div>
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
                <tr><th>Grösse</th><th>Menge</th><th>Einzelwert</th></tr>
              </thead>
              <tbody>
                {#each artikel.varianten as variante (variante._id)}
                  <tr>
                    <td>{groessenName(variante.groesseId)}</td>
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
    <section class="bereich journal">
      <div class="journal-kopf">
        <div><span class="kennzeichnung">BESTANDSHISTORIE</span><h2>Lagerbewegungsjournal</h2><p class="journal-hinweis">{bewegungHinweis || 'Alle erfassten Bestandsänderungen dieses Artikels.'}</p></div>
        <span class="anzahl">{bewegungenGefiltert.length} Bewegungen</span>
      </div>
      <div class="filterbereich">
        <label class="suche-feld">Suche
          <input type="search" bind:value={bewegungSuche} placeholder="Vorgang, Benutzer-ID oder Referenz suchen …" aria-label="Lagerbewegungen durchsuchen"/>
        </label>
        <label>Grösse
          <select bind:value={bewegungGroesse} onchange={ladeBewegungen}><option value="">Alle Grössen</option>{#each groessen.filter((g) => artikel?.varianten.some((v) => v.groesseId === g._id)) as groesse (groesse._id)}<option value={groesse._id}>{groesse.bezeichnung}</option>{/each}</select>
        </label>
        <label>Bewegungstyp
          <select bind:value={bewegungsart}><option value="">Alle Vorgänge</option><option value="anlage">Anlage</option><option value="ausleihe">Ausleihe</option><option value="rueckgabe">Rückgabe</option><option value="inventur">Inventur</option><option value="verkauf">Verkauf</option><option value="wareneingang">Wareneingang</option><option value="korrektur">Korrektur</option><option value="storno">Storno</option></select>
        </label>
        <label>Von <input type="date" bind:value={bewegungVon}/></label>
        <label>Bis <input type="date" bind:value={bewegungBis}/></label>
        <button type="button" class="filtern" onclick={ladeBewegungen}>Zeitraum / Typ anwenden</button>
        <button type="button" class="zuruecksetzen" onclick={() => { bewegungSuche = ''; bewegungGroesse = ''; bewegungsart = ''; bewegungVon = ''; bewegungBis = ''; void ladeBewegungen(); }}>Zurücksetzen</button>
      </div>
      {#if bewegungFehler}<p class="fehlermeldung" role="alert">{bewegungFehler}</p>{/if}
      <div class="tabelle-wrapper"><table class="journal-tabelle"><thead><tr><th>Zeitpunkt</th><th>Vorgang</th><th>Menge</th><th>Grösse</th><th>Durchgeführt von</th><th>Referenz</th></tr></thead>
      <tbody>{#each bewegungenGefiltert as bewegung (bewegung.id)}
        <tr><td>{new Date(bewegung.zeitpunkt).toLocaleString('de-CH')}</td><td><span class="vorgang">{bewegungsName(bewegung.art)}</span></td><td><span class:zugang={bewegung.mengeDelta > 0} class:abgang={bewegung.mengeDelta < 0} class="menge">{bewegung.mengeDelta > 0 ? '+' : ''}{bewegung.mengeDelta}</span></td><td>{groessenName(bewegung.groesseId)}</td><td><span class="referenz" title={bewegung.benutzerId}>{bewegung.benutzerId}</span></td><td><span class="referenz" title={bewegung.referenzId}>{bewegung.referenzTyp}: {bewegung.referenzId}</span></td></tr>
      {:else}<tr><td colspan="6"><div class="leerzustand"><strong>Keine Lagerbewegungen gefunden</strong><p>{bewegungen.length === 0 ? 'Für diesen Artikel wurden seit Einführung des Journals noch keine Bestandsänderungen protokolliert.' : 'Passe die Suche oder die Filter an.'}</p></div></td></tr>{/each}</tbody></table></div>
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
  .id-zeile { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:7px; }
  .artikel-id { font-size:12px; color:#64748b; overflow-wrap:anywhere; }
  .kopieren { padding:5px 9px; font-size:12px; background:#e9eef6; color:#172b4d; }
  .journal { margin-top:24px; }
  .journal-kopf { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; }
  .journal-kopf h2 { margin:7px 0; }
  .journal-hinweis { color:#64748b; font-size:13px; max-width:680px; }
  .anzahl { background:#edf2f9; color:#172b4d; border-radius:20px; padding:7px 12px; font-size:12px; font-weight:600; }
  .filterbereich { display:flex; flex-wrap:wrap; align-items:end; gap:12px; margin:24px 0 18px; padding:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; }
  .filterbereich label { display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:600; color:#475569; }
  .filterbereich input, .filterbereich select { border:1px solid #cbd5e1; border-radius:7px; padding:9px 10px; background:white; color:#172b4d; font:inherit; min-height:38px; }
  .filterbereich .suche-feld { flex:2 1 240px; }
  .suche-feld input { width:100%; box-sizing:border-box; }
  .filterbereich button { min-height:38px; padding:9px 12px; font-size:12px; }
  .filterbereich .zuruecksetzen { background:white; color:#172b4d; border:1px solid #cbd5e1; }
  .journal-tabelle th { font-size:12px; color:#64748b; white-space:nowrap; }
  .journal-tabelle td { font-size:13px; }
  .vorgang { background:#eef2f7; color:#334155; padding:5px 9px; border-radius:6px; font-weight:600; white-space:nowrap; }
  .menge { font-weight:700; padding:5px 8px; border-radius:6px; }
  .zugang { color:#166534; background:#dcfce7; }
  .abgang { color:#b91c1c; background:#fee2e2; }
  .referenz { display:inline-block; max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; color:#64748b; font-size:12px; }
  .leerzustand { text-align:center; padding:32px 12px; color:#475569; }
  .leerzustand p { font-size:13px; color:#64748b; margin-bottom:0; }
  .fehlermeldung button { margin-top: 12px; }
  @media (max-width: 600px) {
    main { margin: 16px auto; padding: 12px; }
    .bereich { padding: 18px; }
  }
</style>
