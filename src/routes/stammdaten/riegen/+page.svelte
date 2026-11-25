<script lang="ts">
  import { onMount } from 'svelte';
  type Riege = { _id: string; name: string; bereich: 'juko' | 'aktive'; aktiv: boolean };
  type Zuordnung = { _id: string; gruppe: string; funktion: string | null; riegeId: string };
  let riegen = $state<Riege[]>([]);
  let zuordnungen = $state<Zuordnung[]>([]);
  let name = $state('');
  let bereich = $state<'juko' | 'aktive'>('juko');
  let gruppe = $state('');
  let funktion = $state('');
  let riegeId = $state('');
  let fehler = $state('');
  let beschaeftigt = $state(false);

  async function api(url: string, method = 'GET', daten?: unknown) {
    const res = await fetch(url, { method, ...(daten !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(daten) } : {}) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.fehler ?? result.message ?? 'Anfrage fehlgeschlagen.');
    return result;
  }
  async function laden() {
    const [r, z] = await Promise.all([api('/api/riegen'), api('/api/gruppenzuordnungen')]);
    riegen = r;
    zuordnungen = z;
  }
  async function ausfuehren(aktion: () => Promise<void>) {
    if (beschaeftigt) return;
    beschaeftigt = true;
    fehler = '';
    try { await aktion(); await laden(); }
    catch (e) { fehler = e instanceof Error ? e.message : 'Unbekannter Fehler.'; }
    finally { beschaeftigt = false; }
  }
  onMount(() => { void ausfuehren(async () => {}); });
  function neueRiege() {
    return ausfuehren(async () => { await api('/api/riegen', 'POST', { name, bereich }); name = ''; });
  }
  function neueZuordnung() {
    return ausfuehren(async () => { await api('/api/gruppenzuordnungen', 'POST', { gruppe, funktion: funktion.trim() || null, riegeId }); gruppe = ''; funktion = ''; riegeId = ''; });
  }
</script>
<svelte:head><title>Riegen – ClubMatiq</title></svelte:head>
<main>
  <a href="/stammdaten">← Stammdaten</a>
  <h1>Riegen und ClubDesk-Gruppen</h1>
  {#if fehler}<p role="alert" class="fehler">{fehler}</p>{/if}
  <section>
    <h2>Riegenverwaltung</h2>
    <form onsubmit={(e) => { e.preventDefault(); void neueRiege(); }}>
      <label>Riegenname<input bind:value={name} required maxlength="100" /></label>
      <label>Bereich<select bind:value={bereich}><option value="juko">JUKO</option><option value="aktive">Aktivriege</option></select></label>
      <button disabled={beschaeftigt}>Riege erstellen</button>
    </form>
    {#each riegen as r (r._id)}
      <div class="eintrag"><span>{r.name} · {r.bereich === 'juko' ? 'JUKO' : 'Aktivriege'} · {r.aktiv ? 'Aktiv' : 'Inaktiv'}</span>
      <button disabled={beschaeftigt} onclick={() => ausfuehren(async () => { await api('/api/riegen', 'PATCH', { id: r._id, aktiv: !r.aktiv }); })}>{r.aktiv ? 'Deaktivieren' : 'Aktivieren'}</button></div>
    {:else}<p>Keine Riegen vorhanden.</p>{/each}
  </section>
  <section>
    <h2>ClubDesk-Gruppenzuordnung</h2>
    <p>Gruppennamen und Funktionen wie im ClubDesk-Export erfassen. Die automatische Mitgliederzuordnung folgt noch.</p>
    <form onsubmit={(e) => { e.preventDefault(); void neueZuordnung(); }}>
      <label>ClubDesk-Gruppe<input bind:value={gruppe} required maxlength="250" /></label>
      <label>Funktion (optional)<input bind:value={funktion} maxlength="150" placeholder="z. B. TurnerIn" /></label>
      <label>Riege<select bind:value={riegeId} required><option value="">Bitte auswählen</option>{#each riegen.filter(r => r.aktiv) as r (r._id)}<option value={r._id}>{r.name}</option>{/each}</select></label>
      <button disabled={beschaeftigt}>Zuordnung erstellen</button>
    </form>
    {#each zuordnungen as z (z._id)}
      <div class="eintrag"><span>{z.gruppe}{z.funktion ? ' (' + z.funktion + ')' : ''} → {riegen.find(r => r._id === z.riegeId)?.name ?? 'Unbekannte Riege'}</span>
      <button disabled={beschaeftigt} onclick={() => { if (confirm('Zuordnung entfernen?')) void ausfuehren(async () => { await api('/api/gruppenzuordnungen?id=' + encodeURIComponent(z._id), 'DELETE'); }); }}>Entfernen</button></div>
    {:else}<p>Keine Zuordnungen vorhanden.</p>{/each}
  </section>
</main>
<style>
  main { max-width: 1100px; margin: 40px auto; padding: 20px; color: #172b4d; }
  section { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 20px 0; }
  form { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin-bottom: 20px; }
  label { display: flex; flex-direction: column; gap: 6px; flex: 1 1 180px; }
  input, select, button { font: inherit; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
  button { background: #172b4d; color: white; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .eintrag { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid #e2e8f0; }
  .fehler { color: #b91c1c; }
</style>
