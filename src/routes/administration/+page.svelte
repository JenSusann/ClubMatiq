<script lang="ts">
  import { page } from '$app/state';
  import { verwendeRollenVorschau } from '../../lib/rollenVorschau.svelte';
  const rollenVorschau = verwendeRollenVorschau();
  const eintraege = [
    { titel: 'Benutzerverwaltung', beschreibung: 'Benutzer, Einladungen und Zugriffsrechte verwalten.', symbol: '👥', link: '/benutzer' },
    { titel: 'Vereinseinstellungen', beschreibung: 'Vereinsdaten, Kontaktinformationen und Vereinslogo verwalten.', symbol: '⚙️', link: '/vereinseinstellungen' },
    { titel: 'E-Mail-Einstellungen', beschreibung: 'Versandmethode des Vereins konfigurieren und testen.', symbol: '✉️', link: '/mail-einstellungen' }
  ];
  const sichtbar = $derived(eintraege.filter(e => !page.data.demo || e.link !== '/mail-einstellungen'));
</script>
<svelte:head><title>Administration – ClubMatiq</title></svelte:head>
<main>
  <div class="kopf"><h1>Administration</h1><p>Verwalte die Benutzer und Einstellungen deines Vereins.</p></div>
  {#if rollenVorschau.rolle === 'admin'}
    <div class="karten">
      {#each sichtbar as eintrag (eintrag.link)}
        <a href={eintrag.link} class="karte">
          <span class="symbol">{eintrag.symbol}</span><h2>{eintrag.titel}</h2><p>{eintrag.beschreibung}</p><span class="weiter">Verwalten →</span>
        </a>
      {/each}
    </div>
  {:else}
    <p>Die Administration ist in dieser Rollenansicht nicht verfügbar.</p>
  {/if}
</main>
<style>
  main { max-width:1100px; margin:40px auto; padding:20px; }
  .kopf { margin-bottom:30px; }
  h1 { color:#172b4d; margin-bottom:10px; }
  .karten { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  .karte { display:flex; flex-direction:column; padding:25px; background:white; border:1px solid #e2e8f0; border-radius:12px; text-decoration:none; color:#172b4d; transition:.2s; }
  .karte:hover { transform:translateY(-3px); border-color:#172b4d; box-shadow:0 4px 12px #00000012; }
  .symbol { font-size:32px; margin-bottom:15px; }
  h2 { font-size:20px; margin-bottom:10px; }
  .karte p { color:#64748b; font-size:14px; line-height:1.5; }
  .weiter { margin-top:auto; padding-top:25px; font-weight:600; font-size:14px; }
  @media(max-width:700px) { .karten { grid-template-columns:1fr; } }
</style>
