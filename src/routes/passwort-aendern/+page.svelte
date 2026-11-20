<script lang="ts">
  import { goto } from '$app/navigation';
  let bisher = $state('');
  let neu = $state('');
  let wiederholen = $state('');
  let speichern = $state(false);
  let fehler = $state('');
  async function aendern(event: SubmitEvent) {
    event.preventDefault();
    fehler = '';
    if (neu !== wiederholen) { fehler = 'Die neuen Passwörter stimmen nicht überein.'; return; }
    speichern = true;
    try {
      const antwort = await fetch('/api/passwort-aendern', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bisher, neu })
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Passwortwechsel fehlgeschlagen.');
      bisher = ''; neu = ''; wiederholen = '';
      await goto('/dashboard', { invalidateAll: true });
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Passwortwechsel fehlgeschlagen.';
    } finally { speichern = false; }
  }
</script>
<svelte:head><title>Passwort ändern | ClubMatiq</title></svelte:head>
<main class="karte">
  <h1>Startpasswort ändern</h1>
  <p>Für deinen ersten Zugriff musst du ein eigenes Passwort festlegen.</p>
  {#if fehler}<p role="alert" class="fehler">{fehler}</p>{/if}
  <form onsubmit={aendern}>
    <label>Bisheriges Passwort<input type="password" bind:value={bisher} autocomplete="current-password" required /></label>
    <label>Neues Passwort (mindestens 12 Zeichen)<input type="password" bind:value={neu} minlength="12" autocomplete="new-password" required /></label>
    <label>Neues Passwort wiederholen<input type="password" bind:value={wiederholen} minlength="12" autocomplete="new-password" required /></label>
    <button disabled={speichern}>{speichern ? 'Wird gespeichert …' : 'Passwort ändern'}</button>
  </form>
</main>
<style>
  .karte{max-width:520px;margin:70px auto;padding:32px;border:1px solid #e2e8f0;border-radius:14px;background:white;color:#1f2937}
  form{display:grid;gap:18px;margin-top:24px}label{display:grid;gap:8px;font-weight:600}
  input{padding:12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
  button{padding:12px 18px;border:0;border-radius:8px;background:#2563eb;color:white;font:inherit;cursor:pointer}
  button:disabled{opacity:.6}.fehler{color:#b91c1c}
</style>
