<script lang="ts">
  import { onMount } from 'svelte';
  type Bewegung = { id: string; zeitpunkt: string; artikelId: string; artikel: string; groesse: string; art: string; mengeDelta: number; benutzer: string; referenzTyp: string; referenzId: string };
  type Artikel = { _id: string; name: string };
  let artikel = $state<Artikel[]>([]);
  let bewegungen = $state<Bewegung[]>([]);
  let artikelId = $state('');
  let art = $state('');
  let von = $state('');
  let bis = $state('');
  let suche = $state('');
  let fehler = $state('');
  let hinweis = $state('');
  let laden = $state(false);
  const parameter = $derived(new URLSearchParams({ artikelId, art, von, bis, suche }).toString());
  const exportUrl = $derived('/api/export/lagerbewegungen?' + parameter);
  const arten = [
    { id: 'anlage', name: 'Anlage' }, { id: 'ausleihe', name: 'Ausleihe' },
    { id: 'rueckgabe', name: 'Rückgabe' }, { id: 'inventur', name: 'Inventur' },
    { id: 'verkauf', name: 'Verkauf' }, { id: 'wareneingang', name: 'Wareneingang' },
    { id: 'korrektur', name: 'Korrektur' }, { id: 'storno', name: 'Storno' }
  ];
  const artName = (wert: string) => arten.find((a) => a.id === wert)?.name ?? wert;
  async function ladenJournal() {
    laden = true;
    fehler = '';
    try {
      const antwort = await fetch('/api/lagerbewegungen/gesamt?' + parameter);
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Laden fehlgeschlagen.');
      bewegungen = daten.bewegungen ?? [];
      hinweis = daten.hinweis ?? '';
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.';
    } finally { laden = false; }
  }
  onMount(() => {
    void ladenJournal();
    void (async () => {
      const antwort = await fetch('/api/artikel');
      if (antwort.ok) {
        const daten: unknown = await antwort.json();
        if (Array.isArray(daten)) artikel = daten as Artikel[];
      }
    })();
  });
</script>

<svelte:head><title>Gesamtes Lagerbewegungsjournal – ClubMatiq</title></svelte:head>
<main>
  <a href="/inventar" class="zurueck">← Zurück zum Inventar</a>
  <header><div><span class="uebertitel">BESTANDSHISTORIE</span><h1>Gesamtes Lagerbewegungsjournal</h1><p>Bestandsänderungen über alle Artikel deines Vereins nachvollziehen und exportieren.</p></div><a class="export" href={exportUrl}>Excel exportieren (.xlsx)</a></header>
  <section>
    <div class="filter">
      <label>Suche<input type="search" bind:value={suche} placeholder="Artikel, Benutzer, Referenz …"/></label>
      <label>Artikel<select bind:value={artikelId}><option value="">Alle Artikel</option>{#each artikel as a (a._id)}<option value={a._id}>{a.name}</option>{/each}</select></label>
      <label>Bewegungstyp<select bind:value={art}><option value="">Alle Vorgänge</option>{#each arten as a (a.id)}<option value={a.id}>{a.name}</option>{/each}</select></label>
      <label>Von<input type="date" bind:value={von}/></label>
      <label>Bis<input type="date" bind:value={bis}/></label>
      <button onclick={ladenJournal}>Filter anwenden</button>
      <button class="reset" onclick={() => { artikelId = ''; art = ''; von = ''; bis = ''; suche = ''; void ladenJournal(); }}>Zurücksetzen</button>
    </div>
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <p class="hinweis">{hinweis}</p>
    {#if laden}<p>Bewegungen werden geladen …</p>{:else}
      <div class="tabelle"><table><thead><tr><th>Zeitpunkt</th><th>Artikel</th><th>Grösse</th><th>Vorgang</th><th>Menge</th><th>Durchgeführt von</th><th>Referenz</th></tr></thead>
      <tbody>{#each bewegungen as b (b.id)}<tr><td>{new Date(b.zeitpunkt).toLocaleString('de-CH')}</td><td><a href={`/inventar/${b.artikelId}`}>{b.artikel}</a></td><td>{b.groesse}</td><td>{artName(b.art)}</td><td class:positiv={b.mengeDelta > 0} class:negativ={b.mengeDelta < 0}>{b.mengeDelta > 0 ? '+' : ''}{b.mengeDelta}</td><td>{b.benutzer}</td><td title={b.referenzId}>{b.referenzTyp}: {b.referenzId}</td></tr>{:else}<tr><td colspan="7" class="leer">Keine Bewegungen gefunden.</td></tr>{/each}</tbody></table></div>
    {/if}
  </section>
</main>
<style>
  main{max-width:1320px;margin:36px auto;padding:20px;color:#172b4d}
  .zurueck{color:#2563eb;font-size:13px}
  header{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;margin:20px 0}
  h1{font-size:27px;margin:6px 0}header p,.hinweis{color:#64748b;font-size:13px}
  .uebertitel{font-size:11px;letter-spacing:1px;color:#64748b}
  section{border:1px solid #dce3ee;background:white;border-radius:10px;padding:20px}
  .export{background:#166534;color:white;padding:12px 16px;border-radius:7px;text-decoration:none;font-weight:700}
  .filter{display:flex;align-items:end;flex-wrap:wrap;gap:12px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;margin-bottom:16px}
  label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;flex:1 1 140px}
  input,select{min-height:38px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:white;box-sizing:border-box;width:100%}
  button{background:#172b4d;color:white;border:0;border-radius:6px;padding:12px;cursor:pointer}
  button.reset{background:#e2e8f0;color:#172b4d}
  .tabelle{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:950px}
  th,td{text-align:left;padding:15px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{background:#f1f5f9;color:#475569;font-weight:700}
  .positiv{color:#166534;font-weight:700}.negativ{color:#b91c1c;font-weight:700}
  .leer{text-align:center;padding:35px;color:#64748b}.fehler{color:#b91c1c}
</style>
