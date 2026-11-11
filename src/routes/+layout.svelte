
<script lang="ts">
  import favicon from '#lib/assets/favicon.svg';
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import type { Snippet } from 'svelte';

  import {
    erstelleRollenVorschau,
    type Rolle
  } from '../lib/rollenVorschau.svelte';

  let {
    children,
    data
  }: {
    children: Snippet;
    data: {
      benutzer: App.Locals['benutzer'];
    };
  } = $props();

  // ========================================
  // Eigener Rollenvorschau-Zustand pro Layout
  // ========================================

  const rollenVorschau = erstelleRollenVorschau();

  let wirdAbgemeldet = $state(false);
  let logoutFehler = $state('');

  // ========================================
  // Rollenbezeichnungen
  // ========================================

  const rollenNamen: Record<Rolle, string> = {
    admin: 'Administrator',
    materialverantwortlich: 'Materialverantwortliche',
    leiter: 'Leiter/in',
    mitglied: 'Mitglied'
  };

  // Tatsächliche Rolle aus der Anmeldung
  const echteRolle = $derived(
    data.benutzer?.rolle ?? 'mitglied'
  );

  // Angezeigte Rolle für die Oberfläche
  // Nur Administratoren dürfen die Vorschau nutzen.
  const angezeigteRolle = $derived(
    echteRolle === 'admin'
      ? rollenVorschau.rolle
      : echteRolle
  );

  const vorschauAktiv = $derived(
    echteRolle === 'admin' &&
    angezeigteRolle !== 'admin'
  );

  // ========================================
  // Navigation und Rollenberechtigungen
  // ========================================

  const navigation: {
    titel: string;
    link: string;
    rollen: Rolle[];
  }[] = [
    {
      titel: 'Inventar',
      link: '/inventar',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter',
        'mitglied'
      ]
    },
    {
      titel: 'QR-Code',
      link: '/qr-code',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter',
        'mitglied'
      ]
    },
    {
      titel: 'Ausleihen',
      link: '/ausleihen',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter'
      ]
    },
    {
      titel: 'Vereinskleider',
      link: '/vereinskleider',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Inventur',
      link: '/inventur',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Inventarbewertung',
      link: '/inventarbewertung',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Schadensmeldungen',
      link: '/meldungen',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter',
        'mitglied'
      ]
    },
    {
      titel: 'Stammdaten',
      link: '/stammdaten',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Materialsuche',
      link: '/materialsuche',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter',
        'mitglied'
      ]
    },
    {
      titel: 'Benutzerverwaltung',
      link: '/benutzer',
      rollen: ['admin']
    }
  ];

  // Navigation anhand der angezeigten Rolle filtern
  const sichtbareNavigation = $derived(
    navigation.filter((eintrag) =>
      eintrag.rollen.includes(angezeigteRolle)
    )
  );

  // ========================================
  // Öffentliche Seiten
  // ========================================

  const istOeffentlicheSeite = $derived(
    ['/registrieren', '/anmelden'].includes(
      page.url.pathname
    )
  );

  const navigationAnzeigen = $derived(
    page.url.pathname !== '/' &&
    !istOeffentlicheSeite &&
    !!data.benutzer
  );

  // ========================================
  // Rollenansicht wechseln
  // ========================================

  function rolleWechseln(event: Event) {
    if (echteRolle !== 'admin') return;

    const select =
      event.currentTarget as HTMLSelectElement;

    const neueRolle = select.value as Rolle;

    if (!(neueRolle in rollenNamen)) return;

    rollenVorschau.wechseln(neueRolle);
  }

  function vorschauBeenden() {
    rollenVorschau.zuruecksetzen();
  }

  // ========================================
  // Abmelden
  // ========================================

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

      rollenVorschau.zuruecksetzen();

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

        <!-- Admin: Rollenansicht auswählen -->
        {#if echteRolle === 'admin'}
          <div class="rollenwechsel">
            <label for="rollen-auswahl">
              👁️ Rollenansicht
            </label>

            <select
              id="rollen-auswahl"
              value={angezeigteRolle}
              onchange={rolleWechseln}
            >
              <option value="admin">
                Administrator
              </option>

              <option value="materialverantwortlich">
                Materialverantwortliche
              </option>

              <option value="leiter">
                Leiter/in
              </option>

              <option value="mitglied">
                Mitglied
              </option>
            </select>
          </div>
        {/if}

        <!-- Benutzerinformationen -->
        <div class="benutzer-info">
          <span class="benutzer-name">
            {data.benutzer.vorname}
            {data.benutzer.nachname}
          </span>

          <span class="benutzer-rolle">
            {rollenNamen[echteRolle]}
          </span>
        </div>

        <!-- Abmelden -->
        <button
          class="logout-button"
          onclick={abmelden}
          disabled={wirdAbgemeldet}
        >
          {wirdAbgemeldet
            ? 'Abmelden ...'
            : 'Abmelden'}
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

  <!-- Logout-Fehler -->
  {#if logoutFehler}
    <div class="logout-fehler" role="alert">
      {logoutFehler}
    </div>
  {/if}

  <!-- Hinweis bei aktiver Admin-Vorschau -->
  {#if vorschauAktiv && !istOeffentlicheSeite}
    <div class="vorschau-banner">
      <span>
        👁️ Vorschau als
        <strong>{rollenNamen[angezeigteRolle]}</strong>
        – Du bleibst Administrator.
      </span>

      <button onclick={vorschauBeenden}>
        Vorschau beenden
      </button>
    </div>
  {/if}

  <!-- Rollenabhängige Hauptnavigation -->
  {#if navigationAnzeigen}
    <nav aria-label="Hauptnavigation">
      <a href="/" class="home-link">
        ← Startseite
      </a>

      {#each sichtbareNavigation as eintrag (eintrag.link)}
        <a
          href={eintrag.link}
          class:active={
            page.url.pathname === eintrag.link ||
            page.url.pathname.startsWith(
              eintrag.link + '/'
            )
          }
        >
          {eintrag.titel}
        </a>
      {/each}
    </nav>
  {/if}

  <!-- Seiteninhalt -->
  <div
    class="content"
    class:auth-content={istOeffentlicheSeite}
  >
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

  .rollenwechsel {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .rollenwechsel label {
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
  }

  .rollenwechsel select {
    background: #334155;
    color: white;
    border: 1px solid #64748b;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .rollenwechsel select:focus {
    outline: 2px solid #93c5fd;
    outline-offset: 2px;
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

  .vorschau-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 12px 40px;
    background: #dbeafe;
    color: #1e40af;
    font-size: 13px;
  }

  .vorschau-banner strong {
    margin: 0 4px;
  }

  .vorschau-banner button {
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 9px 13px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }

  .vorschau-banner button:hover {
    background: #1d4ed8;
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

  @media (max-width: 900px) {
    header {
      padding: 16px 20px;
      flex-wrap: wrap;
    }

    .header-rechts {
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 12px;
    }

    .brand-name {
      font-size: 20px;
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

    .vorschau-banner {
      padding: 12px 20px;
      flex-wrap: wrap;
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
