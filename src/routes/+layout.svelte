
<script lang="ts">
  import favicon from '#lib/assets/favicon.svg';
  import { page } from '$app/state';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

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
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app">

  <!-- Kopfbereich: auf jeder Seite sichtbar -->
  <header>
    <a href="/" class="brand">
      <span class="logo">📦</span>
      <span class="brand-name">ClubMatiq</span>
    </a>

    <span class="subtitle">Vereinsverwaltung</span>
  </header>

  <!-- Navigation: nur auf Unterseiten sichtbar -->
  {#if page.url.pathname !== '/'}
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

  <!-- Hier wird die aktuelle Seite angezeigt -->
<div class="content">
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

  /* Kopfbereich */

  header {
    background-color: #172b4d;
    color: white;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .subtitle {
    font-size: 14px;
    color: #cbd5e1;
  }

  /* Navigation */

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

  /* Seiteninhalt */

  .content {
    padding: 20px;
  }

  /* Darstellung auf kleineren Bildschirmen */

  @media (max-width: 768px) {
    header {
      padding: 16px 20px;
    }

    .brand-name {
      font-size: 20px;
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
  }
</style>
