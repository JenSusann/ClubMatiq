<script lang="ts">
  import { onMount } from 'svelte';
  let token = $state('');
  let vorname = $state('');
  let email = $state('');
  let passwort = $state('');
  let wiederholen = $state('');
  let laden = $state(true);
  let speichern = $state(false);
  let fehler = $state('');
  let erfolg = $state(false);

  onMount(async () => {
    token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (!token) { fehler = 'Einladungslink fehlt.'; laden = false; return; }
    try {
      const antwort = await fetch(`/api/einladung?token=${encodeURIComponent(token)}`);
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Einladung nicht gefunden.');
      vorname = daten.vorname;
      email = daten.email;
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Einladung konnte nicht geladen werden.';
    } finally { laden = false; }
  });

  async function annehmen(event: SubmitEvent) {
    event.preventDefault();
    fehler = '';
    if (passwort.length < 12) { fehler = 'Das Passwort muss mindestens 12 Zeichen haben.'; return; }
    if (passwort !== wiederholen) { fehler = 'Die Passwörter stimmen nicht überein.'; return; }
    speichern = true;
    try {
      const antwort = await fetch('/api/einladung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, passwort })
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Registrierung fehlgeschlagen.');
      erfolg = true;
      passwort = '';
      wiederholen = '';
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Registrierung fehlgeschlagen.';
    } finally { speichern = false; }
  }
</script>

<svelte:head><title>Einladung annehmen | ClubMatiq</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main class="karte">
  <h1>Einladung zu ClubMatiq</h1>
  {#if laden}
    <p>Einladung wird geprüft …</p>
  {:else if erfolg}
    <p>Dein Konto wurde erfolgreich erstellt.</p>
    <a href="/anmelden">Jetzt anmelden</a>
  {:else if fehler && !email}
    <p role="alert" class="fehler">{fehler}</p>
  {:else}
    <p>Hallo {vorname}, du wurdest mit <strong>{email}</strong> eingeladen.</p>
    {#if fehler}<p role="alert" class="fehler">{fehler}</p>{/if}
    <form onsubmit={annehmen}>
      <label>Passwort (mindestens 12 Zeichen)<input type="password" bind:value={passwort} minlength="12" autocomplete="new-password" required /></label>
      <label>Passwort wiederholen<input type="password" bind:value={wiederholen} minlength="12" autocomplete="new-password" required /></label>
      <button disabled={speichern}>{speichern ? 'Konto wird erstellt …' : 'Einladung annehmen'}</button>
    </form>
  {/if}
</main>
<style>
  .karte{max-width:520px;margin:70px auto;padding:32px;border:1px solid #e2e8f0;border-radius:14px;background:white;color:#1f2937}
  h1{font-size:26px;margin-top:0}form{display:grid;gap:18px;margin-top:24px}
  label{display:grid;gap:8px;font-weight:600}input{padding:12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
  button{padding:12px 18px;border:0;border-radius:8px;background:#2563eb;color:white;font:inherit;cursor:pointer}
  button:disabled{opacity:.6;cursor:wait}.fehler{color:#b91c1c}
</style>
