
<script lang="ts">
  import favicon from '#lib/assets/favicon.svg';
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import type { Snippet } from 'svelte';

  let {
    children,
    data
  }: {
    children: Snippet;
    data: {
      benutzer: App.Locals['benutzer'];
    };
  } = $props();

  let wirdAbgemeldet = $state(false);
  let logoutFehler = $state('');

  const navigation = [
    { titel: 'Inventar', link: '/inventar' },
    { titel: 'QR-Code', link: '/qr-code' },
    { titel: 'Ausleihen', link: '/ausleihen' },
    { titel: 'Vereinskleider', link: '/vereinskleider' },
    { titel: 'Inventur', link: '/inventur' },
    { titel: 'Inventarbewertung', link: '/inventarbewertung' },
    { titel: 'Schadensmeldungen', link: '/meldungen' },
    { titel: 'Stammdaten', link: '/stammdaten' },
    { titel: 'Materialsuche', link: '/materialsuche' }
  ];

  const istOeffentlicheSeite = $derived(
    ['/registrieren', '/anmelden'].includes(page.url.pathname)
  );

  const navigationAnzeigen = $derived(
    page.url.pathname !== '/' &&
    !istOeffentlicheSeite &&
    !!data.benutzer
  );

  async function abmelden() {
    if (wirdAbgemeldet) return;

    wirdAbgemeldet = true;
    logoutFehler = '';

    try {
      const antwort = await fetch('/api/abmelden', {
        method: 'POST'
      });

      if (!antwort.ok) {
        throw new Error('Abmeldung fehlgeschlagen.');
      }

      await invalidateAll();
      await goto('/anmelden');
    } catch (error) {
      console.error('Logout-Fehler:', error);
      logoutFehler = 'Abmeldung fehlgeschlagen.';
    } finally {
      wirdAbgemeldet = false;
    }
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
  <header>
    <a href="/" class="brand">
      <span class="logo">📦</span>
      <span class="brand-name">ClubMatiq</span>
    </a>

    <div class="header-rechts">
      {#if data.benutzer && !istOeffentlicheSeite}
        <div class="benutzer-info">
          <span class="benutzer-name">
            {data.benutzer.vorname}
            {data.benutzer.nachname}
          </span>

          <span class="benutzer-rolle">
            {data.benutzer.rolle === 'admin'
              ? 'Administrator'
              : 'Mitglied'}
          </span>
        </div>

        <button
          class="logout-button"
          onclick={abmelden}
          disabled={wirdAbgemeldet}
        >
          {wirdAbgemeldet ? 'Abmelden ...' : 'Abmelden'}
        </button>
      {:else}
        <span class="subtitle">
          {istOeffentlicheSeite
            ? 'Dein Verein. Dein Material.'
            : 'Vereinsverwaltung'}
        </span>
      {/if}
    </div>
  </header>

  {#if logoutFehler}
    <div class="logout-fehler" role="alert">
      {logoutFehler}
    </div>
  {/if}

  {#if navigationAnzeigen}
    <nav aria-label="Hauptnavigation">
      <a href="/" class="home-link">
        ← Startseite
      </a>

      {#each navigation as eintrag}
        <a
          href={eintrag.link}
          class:active={page.url.pathname === eintrag.link}
        >
          {eintrag.titel}
        </a>
      {/each}
    </nav>
  {/if}

  <div class="content" class:auth-content={istOeffentlicheSeite}>
    {#if typeof children === 'function'}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: Arial, sans-serif;
    background-color: #f8fafc;
    color: #1e293b;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    min-height: 100vh;
  }

  header {
    background-color: #172b4d;
    color: white;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: white;
  }

  .brand:hover {
    opacity: 0.85;
  }

  .brand-name {
    font-size: 24px;
    font-weight: bold;
  }

  .logo {
    font-size: 28px;
  }

  .header-rechts {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .subtitle {
    font-size: 14px;
    color: #cbd5e1;
  }

  .benutzer-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .benutzer-name {
    font-size: 14px;
    font-weight: 600;
    color: white;
  }

  .benutzer-rolle {
    font-size: 12px;
    color: #cbd5e1;
  }

  .logout-button {
    background-color: transparent;
    color: white;
    border: 1px solid #64748b;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .logout-button:hover {
    background-color: #334155;
  }

  .logout-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .logout-fehler {
    background: #fef2f2;
    color: #b91c1c;
    padding: 12px 40px;
    font-size: 13px;
  }

  nav {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 15px 40px;
    background-color: white;
    border-bottom: 1px solid #e2e8f0;
  }

  nav a {
    text-decoration: none;
    color: #475569;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  nav a:hover {
    background-color: #f1f5f9;
  }

  nav a.active {
    background-color: #dbeafe;
    color: #1d4ed8;
  }

  nav a.home-link {
    border-right: 1px solid #e2e8f0;
    border-radius: 0;
    padding-right: 24px;
    margin-right: 10px;
    color: #2563eb;
  }

  .content {
    padding: 20px;
  }

  .auth-content {
    padding: 48px 20px;
  }

  @media (max-width: 768px) {
    header {
      padding: 16px 20px;
    }

    .brand-name {
      font-size: 20px;
    }

    .header-rechts {
      gap: 10px;
    }

    .benutzer-name {
      font-size: 12px;
    }

    .benutzer-rolle {
      font-size: 11px;
    }

    .logout-button {
      padding: 8px 10px;
      font-size: 12px;
    }

    .subtitle {
      display: none;
    }

    nav {
      padding: 12px 20px;
      gap: 5px;
    }

    nav a {
      padding: 8px 10px;
      font-size: 13px;
    }

    .content {
      padding: 10px;
    }

    .auth-content {
      padding: 24px 12px;
    }
  }
</style>
