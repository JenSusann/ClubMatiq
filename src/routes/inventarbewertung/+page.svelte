<script lang="ts">
  import { onMount } from 'svelte';

  type Variante = {
    groesseId: string;
    groesse: string;
    sortierung: number;
    menge: number;
    einzelwert: number;
    preisFehlt: boolean;
  };

  type Artikel = {
    _id: string;
    name: string;
    kategorie: string;
    lagerort: string;
    beschreibung: string;
    hatGroessen: boolean;
    gesamtmenge: number;
    einzelwert: number;
    inventarwert: number;
    preisFehlt: boolean;
    varianten: Variante[];
  };

  type Bewertungszeile = {
    id: string;
    artikelId: string;
    artikel: string;
    groesse: string;
    kategorie: string;
    lagerort: string;
    menge: number;
    einzelwert: number;
    gesamtwert: number;
    preisFehlt: boolean;
  };

  type Gruppierung = { name: string; artikel: number; bestand: number; wert: number; fehlend: number };

  let artikel = $state<Artikel[]>([]);
  let wirdGeladen = $state(true);
  let fehler = $state('');
  let suche = $state('');
  let kategorieFilter = $state('');
  let lagerortFilter = $state('');
  let nurFehlende = $state(false);
  let auswertung = $state<'kategorie' | 'lagerort'>('kategorie');
  let standVom = $state<Date | null>(null);

  const chf = (wert: number) => wert.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const datum = (wert: Date) => wert.toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let kategorien = $derived([...new Set(artikel.map((a) => a.kategorie))].sort());
  let lagerorte = $derived([...new Set(artikel.map((a) => a.lagerort))].sort());

  // Ein Artikel mit Grössen wird in einzelne Bewertungspositionen aufgeteilt.
  // Dadurch werden Grössenbestände und Einzelwerte separat sichtbar.
  let alleZeilen = $derived(
    artikel.flatMap((a): Bewertungszeile[] => {
      if (!a.hatGroessen) {
        return [{
          id: a._id,
          artikelId: a._id,
          artikel: a.name,
          groesse: '–',
          kategorie: a.kategorie,
          lagerort: a.lagerort,
          menge: a.gesamtmenge,
          einzelwert: a.einzelwert,
          gesamtwert: a.inventarwert,
          preisFehlt: a.preisFehlt
        }];
      }

      return a.varianten
        .filter((v) => v.menge > 0)
        .map((v) => ({
          id: `${a._id}-${v.groesseId}`,
          artikelId: a._id,
          artikel: a.name,
          groesse: v.groesse,
          kategorie: a.kategorie,
          lagerort: a.lagerort,
          menge: v.menge,
          einzelwert: v.einzelwert,
          gesamtwert: v.menge * v.einzelwert,
          preisFehlt: v.preisFehlt
        }));
    })
  );

  let gefilterteZeilen = $derived(
    alleZeilen.filter((z) => {
      const suchtext = suche.trim().toLocaleLowerCase('de-CH');
      const passtZurSuche = !suchtext || [z.artikel, z.groesse, z.kategorie, z.lagerort]
        .some((wert) => wert.toLocaleLowerCase('de-CH').includes(suchtext));

      return passtZurSuche
        && (!kategorieFilter || z.kategorie === kategorieFilter)
        && (!lagerortFilter || z.lagerort === lagerortFilter)
        && (!nurFehlende || z.preisFehlt);
    })
  );

  let artikelAnzahl = $derived(new Set(gefilterteZeilen.map((z) => z.artikelId)).size);
  let gesamtBestand = $derived(gefilterteZeilen.reduce((summe, z) => summe + z.menge, 0));
  let gesamtWert = $derived(gefilterteZeilen.reduce((summe, z) => summe + z.gesamtwert, 0));
  let fehlendePositionen = $derived(gefilterteZeilen.filter((z) => z.preisFehlt).length);
  let fehlendeArtikel = $derived(
    new Set(gefilterteZeilen.filter((z) => z.preisFehlt).map((z) => z.artikelId)).size
  );

  // Die Gruppierungen verwenden dieselben bereits gefilterten Bewertungspositionen.
  let gruppen = $derived.by((): Gruppierung[] => {
    const ergebnis = new Map<string, {
      artikelIds: Set<string>;
      bestand: number;
      wert: number;
      fehlend: number;
    }>();

    for (const z of gefilterteZeilen) {
      const name = auswertung === 'kategorie' ? z.kategorie : z.lagerort;
      let gruppe = ergebnis.get(name);
      if (!gruppe) {
        gruppe = { artikelIds: new Set<string>(), bestand: 0, wert: 0, fehlend: 0 };
        ergebnis.set(name, gruppe);
      }
      gruppe.artikelIds.add(z.artikelId);
      gruppe.bestand += z.menge;
      gruppe.wert += z.gesamtwert;
      if (z.preisFehlt) gruppe.fehlend += 1;
    }

    return [...ergebnis.entries()]
      .map(([name, gruppe]) => ({
        name,
        artikel: gruppe.artikelIds.size,
        bestand: gruppe.bestand,
        wert: gruppe.wert,
        fehlend: gruppe.fehlend
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
  });

  async function laden() {
    wirdGeladen = true;
    fehler = '';
    try {
      const antwort = await fetch('/api/inventar-uebersicht');
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({}));
        throw new Error(daten.fehler || 'Inventarbewertung konnte nicht geladen werden.');
      }
      const daten: Artikel[] = await antwort.json();
      artikel = daten;
      standVom = new Date();
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Laden fehlgeschlagen.';
    } finally {
      wirdGeladen = false;
    }
  }

  onMount(() => { laden(); });
</script>

<svelte:head>
  <title>Inventarbewertung – ClubMatiq</title>
</svelte:head>

<main>
  <div class="kopf">
    <div>
      <h1>Inventarbewertung</h1>
      <p>Finanzielle Auswertung des aktuellen Vereinsinventars für die Buchhaltung.</p>
    </div>
    <button class="aktualisieren" onclick={laden} disabled={wirdGeladen}>
      {wirdGeladen ? 'Lädt ...' : 'Aktualisieren'}
    </button>
  </div>

  <p class="hinweis">
    <strong>Bewertungsstand:</strong>
    {standVom ? datum(standVom) : 'Noch nicht geladen'}
    – Die Bewertung basiert auf aktuellen Beständen und Preisen.
    Eine historische Stichtagsbewertung ist noch nicht verfügbar.
  </p>

  {#if fehler}
    <p class="fehler" role="alert">{fehler}</p>
  {/if}

  {#if wirdGeladen}
    <p>Inventarbewertung wird geladen ...</p>
  {:else}
    <div class="kennzahlen">
      <div class="kennzahl">
        <span>Bewertete Artikel</span>
        <strong>{artikelAnzahl}</strong>
      </div>
      <div class="kennzahl">
        <span>Bestand</span>
        <strong>{gesamtBestand} Stück</strong>
      </div>
      <div class="kennzahl">
        <span>Berechneter Inventarwert</span>
        <strong>CHF {chf(gesamtWert)}</strong>
      </div>
      <div class="kennzahl" class:warnung={fehlendePositionen > 0}>
        <span>Positionen ohne Preis</span>
        <strong>{fehlendePositionen}</strong>
      </div>
    </div>

    {#if fehlendePositionen > 0}
      <p class="warntext" role="status">
        <strong>Achtung:</strong> Bei {fehlendePositionen} Bewertungspositionen
        ({fehlendeArtikel} Artikel) fehlt ein Preis.
        Der angezeigte Gesamtwert ist deshalb möglicherweise unvollständig.
        Fehlende Preise werden nicht als tatsächlicher Wert von CHF 0 interpretiert.
      </p>
    {/if}

    <section class="bereich">
      <h2>Bewertungspositionen</h2>
      <div class="filter">
        <div class="feld">
          <label for="suche">Suchen</label>
          <input id="suche" type="search"
            placeholder="Artikel, Grösse, Kategorie oder Lagerort"
            bind:value={suche} />
        </div>
        <div class="feld">
          <label for="kategorie">Kategorie</label>
          <select id="kategorie" bind:value={kategorieFilter}>
            <option value="">Alle Kategorien</option>
            {#each kategorien as kategorie}
              <option value={kategorie}>{kategorie}</option>
            {/each}
          </select>
        </div>
        <div class="feld">
          <label for="lagerort">Lagerort</label>
          <select id="lagerort" bind:value={lagerortFilter}>
            <option value="">Alle Lagerorte</option>
            {#each lagerorte as lagerort}
              <option value={lagerort}>{lagerort}</option>
            {/each}
          </select>
        </div>
      </div>
      <label class="checkbox">
        <input type="checkbox" bind:checked={nurFehlende} />
        Nur Positionen mit fehlendem Preis anzeigen
      </label>

      <div class="tabelle-scroll">
        <table>
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Grösse</th>
              <th>Kategorie</th>
              <th>Lagerort</th>
              <th class="rechts">Bestand</th>
              <th class="rechts">Einzelwert</th>
              <th class="rechts">Gesamtwert</th>
              <th>Bewertung</th>
            </tr>
          </thead>
          <tbody>
            {#each gefilterteZeilen as zeile (zeile.id)}
              <tr>
                <td><strong>{zeile.artikel}</strong></td>
                <td>{zeile.groesse}</td>
                <td>{zeile.kategorie}</td>
                <td>{zeile.lagerort}</td>
                <td class="rechts">{zeile.menge}</td>
                <td class="rechts">
                  {zeile.preisFehlt ? '–' : `CHF ${chf(zeile.einzelwert)}`}
                </td>
                <td class="rechts">
                  {zeile.preisFehlt ? 'Unvollständig' : `CHF ${chf(zeile.gesamtwert)}`}
                </td>
                <td>
                  {#if zeile.preisFehlt}
                    <span class="status fehlt">Preis fehlt</span>
                  {:else}
                    <span class="status vorhanden">Erfasst</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if gefilterteZeilen.length === 0}
          <p class="leer">Keine passenden Bewertungspositionen gefunden.</p>
        {/if}
      </div>
      <p class="tabellenhinweis">
        Bei Artikeln mit Grössen wird jede vorhandene Grössenposition separat ausgewiesen.
        Artikel ohne Bestand und ohne Grössenposition erscheinen nicht in der Bewertungstabelle.
        Ein ausdrücklich erfasster Einzelwert von CHF 0.00 gilt als vorhanden.
      </p>
    </section>

    <section class="bereich">
      <div class="gruppen-kopf">
        <h2>Auswertung nach {auswertung === 'kategorie' ? 'Kategorie' : 'Lagerort'}</h2>
        <div class="feld">
          <label for="gruppierung">Gruppieren nach</label>
          <select id="gruppierung" bind:value={auswertung}>
            <option value="kategorie">Kategorie</option>
            <option value="lagerort">Lagerort</option>
          </select>
        </div>
      </div>
      <div class="tabelle-scroll">
        <table>
          <thead>
            <tr>
              <th>{auswertung === 'kategorie' ? 'Kategorie' : 'Lagerort'}</th>
              <th class="rechts">Artikel</th>
              <th class="rechts">Bestand</th>
              <th class="rechts">Inventarwert</th>
              <th class="rechts">Positionen ohne Preis</th>
            </tr>
          </thead>
          <tbody>
            {#each gruppen as gruppe (gruppe.name)}
              <tr>
                <td><strong>{gruppe.name}</strong></td>
                <td class="rechts">{gruppe.artikel}</td>
                <td class="rechts">{gruppe.bestand}</td>
                <td class="rechts">CHF {chf(gruppe.wert)}</td>
                <td class="rechts">{gruppe.fehlend}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <th class="rechts">{artikelAnzahl}</th>
              <th class="rechts">{gesamtBestand}</th>
              <th class="rechts">CHF {chf(gesamtWert)}</th>
              <th class="rechts">{fehlendePositionen}</th>
            </tr>
          </tfoot>
        </table>
        {#if gruppen.length === 0}
          <p class="leer">Keine Auswertungsdaten vorhanden.</p>
        {/if}
      </div>
    </section>

    <p class="hinweis">
      <strong>Export:</strong> Der CSV-Export für die Buchhaltung wird separat in
      Issue #52 umgesetzt. Diese Seite exportiert noch keine Daten.
    </p>
  {/if}
</main>

<style>
  main { max-width:1250px; margin:40px auto; padding:20px; }
  h1 { color:#172b4d; margin:0 0 8px; }
  h2 { color:#172b4d; margin:0 0 22px; font-size:20px; }
  .kopf { display:flex; justify-content:space-between; align-items:center; gap:20px; margin-bottom:24px; }
  .kopf p { margin:0; color:#64748b; }
  .aktualisieren { background:#172b4d; color:white; border:0; border-radius:8px;
    padding:12px 18px; font:inherit; cursor:pointer; white-space:nowrap; }
  .aktualisieren:disabled { opacity:.55; cursor:wait; }
  .hinweis { background:#f1f5f9; border:1px solid #e2e8f0; padding:14px 18px;
    border-radius:8px; color:#475569; line-height:1.6; }
  .fehler { background:#fee2e2; color:#991b1b; padding:14px; border-radius:8px; }
  .warntext { background:#fff7ed; border:1px solid #fed7aa; color:#9a3412;
    padding:14px 18px; border-radius:8px; line-height:1.6; }
  .kennzahlen { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin:24px 0; }
  .kennzahl { background:white; border:1px solid #e2e8f0; border-radius:12px;
    padding:20px; display:flex; flex-direction:column; gap:12px; }
  .kennzahl span { font-size:14px; color:#64748b; }
  .kennzahl strong { font-size:24px; color:#172b4d; }
  .kennzahl.warnung { border-color:#fdba74; }
  .bereich { background:white; border:1px solid #e2e8f0; border-radius:12px;
    padding:24px; margin-top:24px; }
  .filter { display:grid; grid-template-columns:2fr 1fr 1fr; gap:16px; }
  .feld { display:flex; flex-direction:column; gap:8px; }
  .feld label { font-size:14px; font-weight:600; color:#334155; }
  .feld input,.feld select { width:100%; padding:11px 12px; font:inherit;
    border:1px solid #cbd5e1; border-radius:8px; background:white; }
  .checkbox { display:flex; align-items:center; gap:9px; margin:20px 0;
    font-size:14px; color:#334155; }
  .checkbox input { width:17px; height:17px; }
  .tabelle-scroll { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; }
  th,td { padding:13px 12px; text-align:left; border-bottom:1px solid #e2e8f0; }
  th { background:#f8fafc; font-size:13px; color:#475569; white-space:nowrap; }
  td { font-size:14px; }
  .rechts { text-align:right; white-space:nowrap; }
  tfoot th { background:#eff6ff; color:#172b4d; }
  .status { display:inline-block; border-radius:6px; padding:5px 8px; font-size:12px; white-space:nowrap; }
  .status.fehlt { background:#ffedd5; color:#9a3412; }
  .status.vorhanden { background:#dcfce7; color:#166534; }
  .leer { padding:24px; text-align:center; color:#64748b; }
  .tabellenhinweis { font-size:13px; color:#64748b; line-height:1.5; margin-top:18px; }
  .gruppen-kopf { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:20px; }
  .gruppen-kopf h2 { margin:0; }
  @media (max-width:950px) {
    .kennzahlen { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .filter { grid-template-columns:1fr 1fr; }
    .filter .feld:first-child { grid-column:1/-1; }
  }
  @media (max-width:650px) {
    main { margin:16px auto; padding:12px; }
    .kopf,.gruppen-kopf { flex-direction:column; align-items:stretch; }
    .kennzahlen,.filter { grid-template-columns:1fr; }
    .filter .feld:first-child { grid-column:auto; }
    .bereich { padding:14px; }
  }
</style>
