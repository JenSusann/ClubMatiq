<script lang="ts">
  import { onMount } from 'svelte';
  type Position = { verkaufsart?: string; menge?: number; artikelname?: string; groesseId?: string | null; einzelpreis?: number };
  type Retoure = { positionsIndex: number; menge: number; grund: string; datum: string; betrag: number; wiederverkaufbar: boolean };
  type Uebergabe = { positionsIndex: number; menge: number };
  type Verkauf = {
    _id: string; kaeufer?: string; erstelltAm?: string; positionen?: Position[];
    uebergaben?: Uebergabe[]; retouren?: Retoure[];
  };
  let verkaeufe = $state<Verkauf[]>([]);
  let groessen = $state<{ _id: string; bezeichnung: string }[]>([]);
  const groessenName = (id: string | null | undefined) => !id ? '–' : groessen.find((g) => g._id === id)?.bezeichnung ?? 'Unbekannt';
  let laden = $state(true);
  let speichern = $state(false);
  let fehler = $state('');
  let erfolg = $state('');
  let suche = $state('');
  let ausgewaehlt = $state('');
  let positionsIndex = $state(0);
  let menge = $state(1);
  let grund = $state('falsche_groesse');
  let wiederverkaufbar = $state(true);
  let bemerkung = $state('');
  let datum = $state('');
  let seite = $state(1);
  let seiten = $state(1);
  const formatGeld = (wert: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(wert);
  const grundText = (wert: string) => ({
    falsche_groesse: 'Falsche Grösse', gefaellt_nicht: 'Gefällt nicht',
    defekt: 'Defekt', sonstiges: 'Sonstiges'
  })[wert as 'falsche_groesse' | 'gefaellt_nicht' | 'defekt' | 'sonstiges'] ?? wert;
  const datumText = (wert: string) => new Date(wert).toLocaleDateString('de-CH');
  function maximal(v: Verkauf, i: number): number {
    const protokolliert = (v.uebergaben ?? []).filter((u) => u.positionsIndex === i)
      .reduce((sum, u) => sum + u.menge, 0);
    const p = v.positionen?.[i];
    const uebergeben = p?.verkaufsart === 'direkt' && protokolliert === 0
      ? p.menge ?? 0 : protokolliert;
    const retourniert = (v.retouren ?? []).filter((r) => r.positionsIndex === i)
      .reduce((sum, r) => sum + r.menge, 0);
    return Math.max(0, uebergeben - retourniert);
  }
  let gefiltert = $derived(verkaeufe.filter((v) =>
    !suche.trim() || [v.kaeufer, v._id, ...(v.positionen ?? []).map((p) => p.artikelname)]
      .some((wert) => (wert ?? '').toLowerCase().includes(suche.trim().toLowerCase()))
  ));
  let aktiveVerkaeufe = $derived(gefiltert.filter((v) => (v.positionen ?? [])
    .some((_, i) => maximal(v, i) > 0)));
  let ausgewaehlterVerkauf = $derived(verkaeufe.find((v) => v._id === ausgewaehlt));
  let historien = $derived(verkaeufe.flatMap((v) => (v.retouren ?? []).map((r) => ({
    ...r, verkaufId: v._id, kaeufer: v.kaeufer ?? 'Unbekannt',
    artikel: v.positionen?.[r.positionsIndex]?.artikelname ?? 'Artikel'
  }))).sort((a, b) => b.datum.localeCompare(a.datum)));
  async function lade(zielSeite = seite): Promise<void> {
    laden = true;
    fehler = '';
    try {
      const antwort = await fetch(`/api/vereinskleider?seite=${zielSeite}`);
      const daten: { verkaeufe?: Verkauf[]; seiten?: number; fehler?: string } = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Verkäufe konnten nicht geladen werden.');
      verkaeufe = daten.verkaeufe ?? [];
      seite = zielSeite;
      seiten = Math.max(1, daten.seiten ?? 1);
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler.';
    } finally {
      laden = false;
    }
  }
  function auswaehlen(v: Verkauf, i: number): void {
    ausgewaehlt = v._id;
    positionsIndex = i;
    menge = 1;
    grund = 'falsche_groesse';
    wiederverkaufbar = true;
    bemerkung = '';
    datum = new Date().toLocaleDateString('sv-SE');
    fehler = '';
    erfolg = '';
  }
  async function erfassen(): Promise<void> {
    if (!ausgewaehlterVerkauf || speichern) return;
    speichern = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/vereinskleider/retouren', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verkaufId: ausgewaehlt, positionsIndex,
          menge: Number(menge), grund, wiederverkaufbar, bemerkung, datum })
      });
      const daten: { erfolg?: boolean; fehler?: string } = await antwort.json().catch(() => ({}));
      if (!antwort.ok || !daten.erfolg) throw new Error(daten.fehler ?? 'Retoure konnte nicht gespeichert werden.');
      ausgewaehlt = '';
      erfolg = 'Retoure gespeichert. Die Gutschrift ist erstellt; eine Auszahlung wurde nicht ausgelöst.';
      await lade(seite);
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Retoure konnte nicht gespeichert werden.';
    } finally {
      speichern = false;
    }
  }
  onMount(() => {
    void lade(1);
    void fetch('/api/groessen').then(async (r) => {
      if (!r.ok) return;
      const daten: unknown = await r.json();
      groessen = Array.isArray(daten) ? daten :
        (daten && typeof daten === 'object' && 'groessen' in daten && Array.isArray(daten.groessen)) ? daten.groessen : [];
    }).catch(() => { /* Grössen bleiben bei Ladefehler unbekannt. */ });
  });
</script>

<svelte:head><title>Retouren | ClubMatiq</title></svelte:head>
<main>
  <a href="/vereinskleider" class="zurueck">← Zurück zu Vereinskleider</a>
  <h1>Retouren</h1>
  <p class="untertitel">Übergebene Vereinskleider zurücknehmen, Gutschriften erstellen und Retouren nachvollziehen.</p>
  {#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
  {#if erfolg}<p class="meldung" role="status">{erfolg}</p>{/if}
  <section class="karte">
    <h2>Neue Retoure erfassen</h2>
    <label>Mitglied oder Artikel suchen
      <input type="search" bind:value={suche} placeholder="Name, Artikel oder Verkaufs-ID" />
    </label>
    {#if laden}
      <p>Verkäufe werden geladen …</p>
    {:else if aktiveVerkaeufe.length === 0}
      <p>Keine übergebenen, noch retournierbaren Artikel auf dieser Seite gefunden.</p>
    {:else}
      <div class="tabelle">
        <table>
          <thead><tr><th>Mitglied</th><th>Artikel</th><th>Grösse</th><th>Noch retournierbar</th><th>Aktion</th></tr></thead>
          <tbody>
            {#each aktiveVerkaeufe as v (v._id)}
              {#each v.positionen ?? [] as p, i}
                {#if maximal(v, i) > 0}
                  <tr>
                    <td>{v.kaeufer ?? 'Unbekannt'}</td>
                    <td>{p.artikelname ?? 'Artikel'}</td>
                    <td>{groessenName(p.groesseId)}</td>
                    <td>{maximal(v, i)} Stück</td>
                    <td><button class="sekundaer" type="button" onclick={() => auswaehlen(v, i)}>Retoure erfassen</button></td>
                  </tr>
                {/if}
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    <div class="seitenwahl">
      <button class="sekundaer" disabled={laden || seite <= 1} onclick={() => lade(seite - 1)}>Zurück</button>
      <span>Seite {seite} von {seiten}</span>
      <button class="sekundaer" disabled={laden || seite >= seiten} onclick={() => lade(seite + 1)}>Weiter</button>
    </div>
    <p class="hinweis">Die Suche bezieht sich aktuell auf die angezeigte Seite mit maximal 100 Verkäufen.</p>
  </section>

  {#if ausgewaehlterVerkauf}
    <section class="karte formular">
      <h2>Retoure: {ausgewaehlterVerkauf.positionen?.[positionsIndex]?.artikelname ?? 'Artikel'}</h2>
      <p>{ausgewaehlterVerkauf.kaeufer} · Maximal {maximal(ausgewaehlterVerkauf, positionsIndex)} Stück</p>
      <form onsubmit={(e) => { e.preventDefault(); void erfassen(); }}>
        <div class="felder">
          <label>Menge<input type="number" min="1" max={maximal(ausgewaehlterVerkauf, positionsIndex)} step="1" required bind:value={menge} /></label>
          <label>Datum<input type="date" required bind:value={datum} /></label>
          <label>Retourengrund
            <select bind:value={grund}>
              <option value="falsche_groesse">Falsche Grösse</option>
              <option value="gefaellt_nicht">Gefällt nicht</option>
              <option value="defekt">Defekt</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </label>
          <label>Artikelzustand
            <select bind:value={wiederverkaufbar}>
              <option value={true}>Wiederverkaufbar – ins Lager</option>
              <option value={false}>Nicht wiederverkaufbar – kein Lagerzugang</option>
            </select>
          </label>
        </div>
        <label>Bemerkung<input type="text" maxlength="1000" bind:value={bemerkung} /></label>
        <p class="hinweis">Die Retoure erzeugt eine Gutschrift, aber keine automatische Rückzahlung. Nicht eindeutig abrechenbare Fälle werden gesperrt.</p>
        <div class="aktionen">
          <button type="submit" disabled={speichern}>{speichern ? 'Speichern …' : 'Retoure bestätigen'}</button>
          <button type="button" class="sekundaer" disabled={speichern} onclick={() => ausgewaehlt = ''}>Abbrechen</button>
        </div>
      </form>
    </section>
  {/if}

  <section class="karte">
    <h2>Retourenhistorie</h2>
    {#if historien.length === 0}
      <p>Keine Retouren auf der aktuellen Seite vorhanden.</p>
    {:else}
      <div class="tabelle">
        <table>
          <thead><tr><th>Datum</th><th>Mitglied</th><th>Artikel</th><th>Menge</th><th>Grund / Zustand</th><th>Betrag</th></tr></thead>
          <tbody>
            {#each historien as r}
              <tr>
                <td>{datumText(r.datum)}</td><td>{r.kaeufer}</td><td>{r.artikel}</td>
                <td>{r.menge}</td><td>{grundText(r.grund)} · {r.wiederverkaufbar ? 'Wiederverkaufbar' : 'Nicht wiederverkaufbar'}</td>
                <td>{formatGeld(r.betrag)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    <p class="hinweis">Diese Ansicht zeigt Retouren der aktuellen Verkaufsseite. Alle Gutschriften und Rückerstattungen findest du unter Verrechnung.</p>
  </section>
</main>
<style>
  main{max-width:1200px;margin:2rem auto;padding:1rem;color:var(--text-color,inherit)}
  .zurueck{display:inline-block;margin-bottom:1rem;color:#2563eb;text-decoration:none}
  h1{font-size:1.9rem;margin:0 0 .4rem}h2{font-size:1.2rem;margin:0 0 1rem}
  .untertitel,.hinweis{color:#64748b;font-size:.9rem}
  .karte{border:1px solid #e2e8f0;border-radius:14px;padding:1.5rem;margin:1.5rem 0;background:var(--card-bg,#fff)}
  label{display:flex;flex-direction:column;gap:.45rem;margin:.7rem 0;font-weight:600}
  input,select{padding:.7rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;box-sizing:border-box}
  .felder{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem}
  .tabelle{overflow-x:auto}table{border-collapse:collapse;width:100%;text-align:left}
  th,td{padding:.8rem;border-bottom:1px solid #e2e8f0}
  button{padding:.65rem 1rem;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer}
  button.sekundaer{background:#e2e8f0;color:#172b4d}
  button:disabled{opacity:.55;cursor:not-allowed}
  .aktionen,.seitenwahl{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin-top:1rem}
  .meldung{padding:1rem;background:#eff6ff;border-radius:8px}
  .meldung.fehler{background:#fef2f2;color:#991b1b}
</style>
