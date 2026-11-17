<script lang="ts">
  import { onMount } from 'svelte';

  type Position = {
    artikelId?: string;
    artikelname?: string;
    groesseId?: string | null;
    menge?: number;
    storniertMenge?: number;
    einzelpreis?: number;
    positionsbetrag?: number;
    verkaufsart?: string;
  };
  type Rabatt = { name?: string; betrag?: number };
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
    stornierungen?: Array<{ menge?: number; grund?: string; datum?: string; erstelltAm?: string }>;
  };
  type Antwort = {
    verkaeufe?: Verkauf[];
    seite?: number;
    seiten?: number;
    gesamt?: number;
    fehler?: string;
  };

  let verkaeufe = $state<Verkauf[]>([]);
  let laden = $state(true);
  let fehler = $state('');
  let seite = $state(1);
  let seiten = $state(0);
  let gesamt = $state(0);
  let suche = $state('');
  let art = $state('alle');
  let zahlung = $state('alle');
  let offen = $state<string[]>([]);

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

  let sichtbar = $derived(verkaeufe.filter((v) => {
    const s = suche.trim().toLocaleLowerCase('de-CH');
    const passtSuche = !s || [v.kaeufer, v._id, v.rechnung?.rechnungsnummer,
      ...(v.positionen ?? []).map((p) => p.artikelname)]
      .some((x) => String(x ?? '').toLocaleLowerCase('de-CH').includes(s));
    const passtArt = art === 'alle' || v.verkaufsart === art;
    const passtZahlung = zahlung === 'alle'
      || (zahlung === 'bezahlt' && offenBetrag(v) <= 0.005)
      || (zahlung === 'offen' && offenBetrag(v) > 0.005)
      || (zahlung === 'gutschrift' && Number(v.rechnung?.gutgeschriebenBetrag ?? 0) > 0);
    return passtSuche && passtArt && passtZahlung;
  }));

  async function lade(gewSeite: number) {
    laden = true;
    fehler = '';
    try {
      const antwort = await fetch(`/api/vereinskleider?seite=${gewSeite}`);
      const daten: Antwort = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler || 'Verkäufe konnten nicht geladen werden.');
      verkaeufe = daten.verkaeufe ?? [];
      seite = daten.seite ?? gewSeite;
      seiten = daten.seiten ?? 0;
      gesamt = daten.gesamt ?? 0;
      offen = [];
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler';
    } finally {
      laden = false;
    }
  }

  function details(id: string) {
    offen = offen.includes(id) ? offen.filter((x) => x !== id) : [...offen, id];
  }

  onMount(() => { void lade(1); });
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
    <button class="sekundaer" onclick={() => lade(seite)} disabled={laden}>Aktualisieren</button>
  </header>

  <section class="werkzeuge" aria-label="Verkäufe filtern">
    <label>Suche
      <input type="search" bind:value={suche} placeholder="Mitglied, Artikel, Rechnungsnummer …" />
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
  </section>

  {#if fehler}
    <div class="meldung fehler" role="alert">{fehler}</div>
  {/if}
  {#if laden}
    <p class="meldung">Verkäufe werden geladen …</p>
  {:else if sichtbar.length === 0}
    <p class="meldung">Keine passenden Verkäufe auf dieser Seite gefunden.</p>
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
                        <thead><tr><th>Artikel</th><th>Grösse-ID</th><th>Art</th><th class="rechts">Menge</th><th class="rechts">Einzelpreis</th><th class="rechts">Total</th></tr></thead>
                        <tbody>
                          {#each v.positionen ?? [] as p, i (i)}
                            <tr>
                              <td>{p.artikelname || p.artikelId || '–'}{#if Number(p.storniertMenge ?? 0) > 0}<small>Storniert: {p.storniertMenge}</small>{/if}</td>
                              <td>{p.groesseId || '–'}</td>
                              <td>{artName(p.verkaufsart)}</td>
                              <td class="rechts">{p.menge ?? 0}</td>
                              <td class="rechts">{chf(p.einzelpreis)}</td>
                              <td class="rechts">{chf(p.positionsbetrag)}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
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
                        <p>{s.menge ?? 0} Stück · {s.grund || 'Keine Begründung'} · {datum(s.datum ?? s.erstelltAm)}</p>
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
    <span>{gesamt} Verkäufe insgesamt · Seite {seite} von {Math.max(1, seiten)}</span>
    <div>
      <button class="sekundaer" disabled={laden || seite <= 1} onclick={() => lade(seite - 1)}>Zurück</button>
      <button class="sekundaer" disabled={laden || seite >= seiten} onclick={() => lade(seite + 1)}>Weiter</button>
    </div>
  </footer>
  <p class="hinweis">Suche und Filter gelten für die aktuell geladene Seite (maximal 100 Verkäufe).</p>
</main>

<style>
  .seite{max-width:1450px;margin:0 auto;padding:1.5rem;color:var(--text-color,inherit)}
  .zurueck{display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none;font-weight:600}.zurueck:hover{text-decoration:underline}
  .kopf,.detailkopf,.seitenwahl{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
  h1{font-size:1.8rem;margin:0 0 .35rem}h2{font-size:1.15rem;margin:0}h3{font-size:1rem;margin:.8rem 0}
  .kopf p,.hinweis{color:#697586;font-size:.9rem;margin:.25rem 0}
  .werkzeuge{display:grid;grid-template-columns:minmax(230px,2fr) repeat(2,minmax(160px,1fr));gap:1rem;margin:1.5rem 0}
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
