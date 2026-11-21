<script lang="ts">
  import { onMount } from 'svelte';

  type Position = {
    artikelId?: string;
    artikelname?: string;
    groesseId?: string | null;
    menge?: number;
    storniertMenge?: number;
    uebergebenMenge?: number;
    einzelpreis?: number;
    positionsbetrag?: number;
    verkaufsart?: string;
  };
  type Groesse = { _id: string; bezeichnung: string };
  type Rabatt = { name?: string; betrag?: number };
  type Gutschrift = {
    _id: string;
    rechnungId: string;
    gutschriftnummer: string;
    artikelname: string;
    menge: number;
    betrag: number;
    grund: string;
    erstelltAm: string;
  };
  type GutschriftenAntwort = {
    gutschriften?: Gutschrift[];
    begrenzt?: boolean;
    fehler?: string;
  };
  type Rechnung = {
    _id: string;
    rechnungsnummer?: string;
    status?: string;
    gesamtbetrag?: number;
    bezahltBetrag?: number;
    gutgeschriebenBetrag?: number;
    rueckerstattungOffen?: number;
  };
  type Verkauf = {
    _id: string;
    kaeufer?: string;
    erstelltAm?: string;
    verkaufsart?: string;
    status?: string;
    zahlungsart?: string;
    zahlungsstatus?: string;
    bezahltBetrag?: number;
    endbetrag?: number;
    zwischentotal?: number;
    rabattTotal?: number;
    zusaetzlicherRabatt?: number;
    bemerkung?: string;
    riegen?: string[];
    positionen?: Position[];
    rabatte?: Rabatt[];
    rechnung?: Rechnung | null;
    uebergaben?: Array<{ positionsIndex: number; menge: number }>;
    retouren?: Array<{ positionsIndex: number; menge: number; grund: string; wiederverkaufbar: boolean; datum: string; betrag: number }>;
    stornierungen?: Array<{ menge?: number; grund?: string; datum?: string; erstelltAm?: string; storniertAm?: string }>;
  };
  type Antwort = {
    verkaeufe?: Verkauf[];
    seite?: number;
    seiten?: number;
    gesamt?: number;
    fehler?: string;
  };

  let verkaeufe = $state<Verkauf[]>([]);
  let groessen = $state<Groesse[]>([]);
  let gutschriften = $state<Gutschrift[]>([]);
  let gutschriftenBegrenzt = $state(false);
  let gutschriftenFehler = $state('');
  let laden = $state(true);
  let fehler = $state('');
  let seite = $state(1);
  let seiten = $state(0);
  let gesamt = $state(0);
  let suche = $state('');
  let art = $state('alle');
  let zahlung = $state('alle');
  let offen = $state<string[]>([]);
  let riege = $state('');
  let von = $state('');
  let bis = $state('');
  let filterAktiv = $state(false);
  let exportLaden = $state(false);
  let aktiveFilter = $state('');

  const groessenName = (id: string | null | undefined) =>
    !id ? "–" : groessen.find((g) => g._id === id)?.bezeichnung ?? "Unbekannte Grösse";
  const gutschriftenZu = (rechnungId: string | undefined) =>
    rechnungId ? gutschriften.filter((g) => g.rechnungId === rechnungId) : [];
  const rechnungsstatus = (wert: string | undefined) =>
    wert === 'teilweise_bezahlt' ? 'Teilweise bezahlt'
    : wert === 'bezahlt' ? 'Bezahlt'
    : wert === 'storniert' ? 'Storniert'
    : wert === 'offen' ? 'Offen' : (wert || '–');
  const chf = (wert: number | undefined) =>
    new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number(wert ?? 0));
  const datum = (wert: string | undefined) =>
    wert ? new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(wert)) : '–';
  const artName = (wert: string | undefined) =>
    wert === 'direkt' ? 'Direktverkauf' : wert === 'bestellung' ? 'Bestellung' : wert === 'gemischt' ? 'Gemischt' : (wert || '–');
  const netto = (v: Verkauf) => Math.max(0, Number(v.rechnung?.gesamtbetrag ?? v.endbetrag ?? 0) - Number(v.rechnung?.gutgeschriebenBetrag ?? 0));
  const bezahlt = (v: Verkauf) => Number(v.rechnung?.bezahltBetrag ?? v.bezahltBetrag ?? 0);
  const offenBetrag = (v: Verkauf) => Math.max(0, netto(v) - bezahlt(v));
  const status = (v: Verkauf) =>
    Number(v.rechnung?.rueckerstattungOffen ?? 0) > 0 ? 'Rückerstattung offen'
    : Number(v.rechnung?.gutgeschriebenBetrag ?? 0) > 0 ? 'Gutschrift vorhanden'
    : offenBetrag(v) <= 0.005 ? 'Bezahlt' : bezahlt(v) > 0 ? 'Teilweise bezahlt' : 'Offen';

  // Die Daten sind bereits vollständig auf dem Server gefiltert.
  let sichtbar = $derived(verkaeufe);

  function parameter(gewSeite: number) {
    const params = new URLSearchParams({ seite: String(gewSeite) });
    if (suche.trim()) params.set('suche', suche.trim());
    if (art !== 'alle') params.set('art', art);
    if (zahlung !== 'alle') params.set('zahlung', zahlung);
    if (riege.trim()) params.set('riege', riege.trim());
    if (von) params.set('von', von);
    if (bis) params.set('bis', bis);
    return params;
  }

  function filterAnwenden() {
    if (von && bis && von > bis) {
      fehler = 'Das Startdatum darf nicht nach dem Enddatum liegen.';
      return;
    }
    filterAktiv = true;
    void lade(1);
  }

  function filterZuruecksetzen() {
    suche = '';
    art = 'alle';
    zahlung = 'alle';
    riege = '';
    von = '';
    bis = '';
    filterAktiv = false;
    void lade(1);
  }

  async function lade(gewSeite: number) {
    laden = true;
    fehler = '';
    try {
      const filterParameter = parameter(gewSeite);
      const antwort = await fetch(`/api/vereinskleider?${filterParameter.toString()}`);
      const daten: Antwort = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler || 'Verkäufe konnten nicht geladen werden.');
      verkaeufe = daten.verkaeufe ?? [];
      seite = daten.seite ?? gewSeite;
      seiten = daten.seiten ?? 0;
      gesamt = daten.gesamt ?? 0;
      filterParameter.delete('seite');
      aktiveFilter = filterParameter.toString();
      offen = [];
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler';
    } finally {
      laden = false;
    }
  }

  async function excelExportieren() {
    if (exportLaden || laden || gesamt === 0) return;
    exportLaden = true;
    fehler = '';
    try {
      // Nur die zuletzt erfolgreich angewendeten Filter exportieren.
      const url = `/api/vereinskleider/export${aktiveFilter ? `?${aktiveFilter}` : ''}`;
      const antwort = await fetch(url);
      if (!antwort.ok) {
        const daten: { fehler?: string } = await antwort.json().catch(() => ({}));
        throw new Error(daten.fehler || 'Excel-Export konnte nicht erstellt werden.');
      }
      const datei = await antwort.blob();
      const downloadUrl = URL.createObjectURL(datei);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `ClubMatiq_Verkaufshistorie_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Excel-Export konnte nicht erstellt werden.';
    } finally {
      exportLaden = false;
    }
  }

  async function ladeGutschriften() {
    gutschriftenFehler = '';
    try {
      const antwort = await fetch('/api/vereinskleider/stornierungen');
      const daten: GutschriftenAntwort = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler || 'Gutschriften konnten nicht geladen werden.');
      gutschriften = daten.gutschriften ?? [];
      gutschriftenBegrenzt = daten.begrenzt ?? false;
    } catch (e) {
      gutschriftenFehler = e instanceof Error ? e.message : 'Gutschriften konnten nicht geladen werden.';
    }
  }

  function aktualisieren() {
    void lade(seite);
    void ladeGutschriften();
  }

  function details(id: string) {
    offen = offen.includes(id) ? offen.filter((x) => x !== id) : [...offen, id];
  }

  onMount(() => {
    void lade(1);
    void ladeGutschriften();
    void (async () => {
      try {
        const antwort = await fetch("/api/groessen");
        if (!antwort.ok) return;
        const daten: unknown = await antwort.json();
        if (Array.isArray(daten)) {
          groessen = daten.filter((g): g is Groesse =>
            typeof g === "object" && g !== null &&
            typeof g._id === "string" && typeof g.bezeichnung === "string"
          );
        }
      } catch {
        // Die Verkaufshistorie bleibt auch bei einem Fehler der Grössenabfrage nutzbar.
      }
    })();
  });
</script>

<svelte:head>
  <title>Verkaufshistorie | ClubMatiq</title>
  <meta name="description" content="Alle Vereinskleiderverkäufe, Bestellungen und Verrechnungen im Überblick" />
</svelte:head>

<main class="seite">
  <a class="zurueck" href="/vereinskleider">← Zurück zu Vereinskleider</a>
  <header class="kopf">
    <div>
      <h1>Verkaufshistorie</h1>
      <p>Alle erfassten Vereinskleiderverkäufe und Bestellungen nachvollziehen.</p>
    </div>
    <div class="kopfaktionen">
      <button class="sekundaer" onclick={aktualisieren} disabled={laden || exportLaden}>Aktualisieren</button>
      <button class="sekundaer" onclick={excelExportieren} disabled={laden || exportLaden || gesamt === 0}>
        {exportLaden ? 'Excel wird erstellt …' : 'Excel exportieren'}
      </button>
    </div>
  </header>

  <form class="werkzeuge" aria-label="Verkäufe filtern" onsubmit={(event) => { event.preventDefault(); filterAnwenden(); }}>
    <label>Suche
      <input type="search" bind:value={suche} maxlength="120" placeholder="Mitglied, Artikel, Rechnungsnummer …" />
    </label>
    <label>Verkaufsart
      <select bind:value={art}>
        <option value="alle">Alle</option>
        <option value="direkt">Direktverkauf</option>
        <option value="bestellung">Bestellung</option>
        <option value="gemischt">Gemischt</option>
      </select>
    </label>
    <label>Zahlungsstand
      <select bind:value={zahlung}>
        <option value="alle">Alle</option>
        <option value="bezahlt">Bezahlt</option>
        <option value="offen">Offener Betrag</option>
        <option value="gutschrift">Mit Gutschrift</option>
      </select>
    </label>
    <label>Riege (genaue Bezeichnung)
      <input type="text" bind:value={riege} maxlength="100" placeholder="z. B. Aktivriege" />
    </label>
    <label>Von
      <input type="date" bind:value={von} max={bis || undefined} />
    </label>
    <label>Bis
      <input type="date" bind:value={bis} min={von || undefined} />
    </label>
    <div class="filteraktionen">
      <button class="sekundaer" type="submit" disabled={laden}>Filter anwenden</button>
      <button class="sekundaer" type="button" onclick={filterZuruecksetzen} disabled={laden}>Zurücksetzen</button>
    </div>
  </form>

  {#if fehler}
    <div class="meldung fehler" role="alert">{fehler}</div>
  {/if}
  {#if gutschriftenFehler}
    <div class="meldung fehler" role="alert">Gutschriften: {gutschriftenFehler}</div>
  {/if}
  {#if gutschriftenBegrenzt}
    <p class="hinweis">Es werden maximal 1000 Gutschriften geladen. Ältere Einträge sind möglicherweise nicht in dieser Ansicht enthalten.</p>
  {/if}
  {#if laden}
    <p class="meldung">Verkäufe werden geladen …</p>
  {:else if sichtbar.length === 0}
    <p class="meldung">Keine passenden Verkäufe gefunden.</p>
  {:else}
    <div class="tabellenrahmen">
      <table>
        <thead>
          <tr>
            <th>Datum / Verkauf</th>
            <th>Käufer / Riege</th>
            <th>Art</th>
            <th class="rechts">Betrag</th>
            <th class="rechts">Bezahlt</th>
            <th class="rechts">Offen</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {#each sichtbar as v (v._id)}
            <tr>
              <td><strong>{datum(v.erstelltAm)}</strong><small>{v.rechnung?.rechnungsnummer || v._id.slice(-8)}</small></td>
              <td><strong>{v.kaeufer || '–'}</strong><small>{(v.riegen ?? []).join(', ') || '–'}</small></td>
              <td>{artName(v.verkaufsart)}</td>
              <td class="rechts">{chf(netto(v))}</td>
              <td class="rechts">{chf(bezahlt(v))}</td>
              <td class="rechts">{chf(offenBetrag(v))}</td>
              <td><span class="status">{status(v)}</span></td>
              <td><button class="linkbutton" onclick={() => details(v._id)} aria-expanded={offen.includes(v._id)}>{offen.includes(v._id) ? 'Schliessen' : 'Anzeigen'}</button></td>
            </tr>
            {#if offen.includes(v._id)}
              <tr class="detailzeile">
                <td colspan="8">
                  <div class="details">
                    <div class="detailkopf">
                      <h2>Verkaufsdetails</h2>
                      {#if v.rechnung?._id}
                        <a href={`/api/vereinskleider/verrechnung/${v.rechnung._id}/pdf`} target="_blank" rel="noopener noreferrer">Rechnung / Quittung als PDF</a>
                      {/if}
                    </div>
                    <p><strong>Verkaufs-ID:</strong> {v._id} · <strong>Bestellstatus:</strong> {v.status || '–'} · <strong>Zahlungsart:</strong> {v.zahlungsart || '–'}</p>
                    <div class="positionen">
                      <table>
                        <thead><tr><th>Artikel</th><th>Grösse</th><th>Art</th><th class="rechts">Menge</th><th class="rechts">Einzelpreis</th><th class="rechts">Total</th></tr></thead>
                        <tbody>
                          {#each v.positionen ?? [] as p, i (i)}
                            <tr>
                              <td>{p.artikelname || p.artikelId || '–'}{#if Number(p.storniertMenge ?? 0) > 0}<small>Storniert: {p.storniertMenge}</small>{/if}</td>
                              <td>{groessenName(p.groesseId)}</td>
                              <td>{artName(p.verkaufsart)}</td>
                              <td class="rechts">{p.menge ?? 0}</td>
                              <td class="rechts">{chf(p.einzelpreis)}</td>
                              <td class="rechts">{chf(p.positionsbetrag)}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                    {#if (v.retouren ?? []).length > 0}
                      <h3>Retourenhistorie</h3>
                      {#each v.retouren ?? [] as r}
                        <p>{r.menge} Stück · {r.grund} · {r.wiederverkaufbar ? 'Wiederverkaufbar' : 'Nicht wiederverkaufbar'} · {chf(r.betrag)} · {datum(r.datum)}</p>
                      {/each}
                    {/if}
                    <div class="zusammenfassung">
                      <span>Zwischentotal</span><strong>{chf(v.zwischentotal)}</strong>
                      <span>Rabatte</span><strong>− {chf(v.rabattTotal)}</strong>
                      <span>Ursprünglicher Endbetrag</span><strong>{chf(v.endbetrag)}</strong>
                      {#if v.rechnung}
                        <span>Gutschriften</span><strong>− {chf(v.rechnung.gutgeschriebenBetrag)}</strong>
                        <span>Aktueller Rechnungsbetrag</span><strong>{chf(netto(v))}</strong>
                        <span>Bezahlt</span><strong>{chf(bezahlt(v))}</strong>
                        <span>Offene Forderung</span><strong>{chf(offenBetrag(v))}</strong>
                        {#if Number(v.rechnung.rueckerstattungOffen ?? 0) > 0}
                          <span>Rückerstattung offen</span><strong>{chf(v.rechnung.rueckerstattungOffen)}</strong>
                        {/if}
                      {/if}
                    </div>
                    {#if (v.rabatte ?? []).length > 0}
                      <p><strong>Angewendete Rabatte:</strong> {v.rabatte?.map((r) => `${r.name || 'Rabatt'} (${chf(r.betrag)})`).join(', ')}</p>
                    {/if}
                    {#if (v.stornierungen ?? []).length > 0}
                      <h3>Stornierungen</h3>
                      {#each v.stornierungen ?? [] as s, i (i)}
                        <p>{s.menge ?? 0} Stück · {s.grund || 'Keine Begründung'} · {datum(s.storniertAm ?? s.datum ?? s.erstelltAm)}</p>
                      {/each}
                    {/if}
                    {#if v.bemerkung}<p><strong>Bemerkung:</strong> {v.bemerkung}</p>{/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <footer class="seitenwahl">
    <span>{gesamt} {filterAktiv ? 'Treffer' : 'Verkäufe insgesamt'} · Seite {seite} von {Math.max(1, seiten)}</span>
    <div>
      <button class="sekundaer" disabled={laden || seite <= 1} onclick={() => lade(seite - 1)}>Zurück</button>
      <button class="sekundaer" disabled={laden || seite >= seiten} onclick={() => lade(seite + 1)}>Weiter</button>
    </div>
  </footer>
  <p class="hinweis">Suche und Filter werden über alle Verkäufe ausgeführt. Pro Seite werden maximal 100 Treffer angezeigt. Änderungen an den Filtern mit «Filter anwenden» bestätigen.</p>
</main>

<style>

  .seite{max-width:1450px;margin:0 auto;padding:1.5rem;color:var(--text-color,inherit)}
  .zurueck{display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none;font-weight:600}.zurueck:hover{text-decoration:underline}
  .kopfaktionen{display:flex;gap:.6rem;flex-wrap:wrap}
  .kopf,.detailkopf,.seitenwahl{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
  h1{font-size:1.8rem;margin:0 0 .35rem}h2{font-size:1.15rem;margin:0}h3{font-size:1rem;margin:.8rem 0}
  .kopf p,.hinweis{color:#697586;font-size:.9rem;margin:.25rem 0}
  .werkzeuge{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:1rem;margin:1.5rem 0}.filteraktionen{display:flex;align-items:end;gap:.6rem;flex-wrap:wrap}
  label{display:flex;flex-direction:column;gap:.35rem;font-size:.88rem;font-weight:600}
  input,select{width:100%;padding:.7rem;border:1px solid #cbd5e1;border-radius:8px;background:var(--background,#fff);color:inherit;font:inherit}
  button{cursor:pointer;font:inherit}.sekundaer{border:1px solid #cbd5e1;background:transparent;color:inherit;border-radius:8px;padding:.6rem .9rem}
  button:disabled{opacity:.45;cursor:not-allowed}.linkbutton{border:0;background:transparent;color:#2563eb;text-decoration:underline;padding:.4rem}
  .tabellenrahmen,.positionen{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px}
  table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:.85rem .7rem;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{background:#f1f5f9;color:#334155;white-space:nowrap}td strong{font-weight:600}small{display:block;color:#64748b;font-size:.78rem;margin-top:.25rem}
  .rechts{text-align:right;white-space:nowrap}.status{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:.2rem .5rem;white-space:nowrap;font-size:.8rem}
  .detailzeile td{background:#f8fafc}.details{padding:.5rem;display:grid;gap:.8rem}.details p{margin:.2rem 0;font-size:.88rem}
  .detailkopf a{color:#2563eb}.positionen th{background:#e8eef5}.zusammenfassung{display:grid;grid-template-columns:minmax(150px,1fr) auto;gap:.4rem 1rem;max-width:450px;margin-left:auto;font-size:.9rem}.zusammenfassung strong{text-align:right}
  .seitenwahl{margin:1.25rem 0}.seitenwahl>div{display:flex;gap:.5rem}.meldung{padding:1rem;border:1px solid #cbd5e1;border-radius:8px}.fehler{border-color:#ef4444;color:#b91c1c}
  @media(max-width:800px){.werkzeuge{grid-template-columns:1fr}.seite{padding:1rem}.kopf{align-items:flex-start}}
</style>
