
<script lang="ts">
  import type { PageData } from './$types';

  import {
    verwendeRollenVorschau,
    type Rolle
  } from '../lib/rollenVorschau.svelte';

  let { data }: { data: PageData } = $props();

  // ========================================
  // Gemeinsame Rollenvorschau aus dem Layout
  // ========================================

  const rollenVorschau = verwendeRollenVorschau();

  // Tatsächliche Benutzerrolle aus der Session
  const echteRolle: Rolle = $derived(data.rolle);

  // Nur Administratoren dürfen die Vorschau verwenden.
  const angezeigteRolle = $derived(
    echteRolle === 'admin'
      ? rollenVorschau.rolle
      : echteRolle
  );

  // ========================================
  // Dashboard-Funktionen
  // ========================================

  const funktionen: {
    titel: string;
    beschreibung: string;
    icon: string;
    link: string;
    rollen: Rolle[];
  }[] = [
    {
      titel: 'Inventar-Dashboard',
      beschreibung: 'Bestände, Materialien und Lagerorte verwalten',
      icon: '📦',
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
      beschreibung: 'Material über QR-Code aufrufen',
      icon: '📱',
      link: '/qr-code',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter',
        'mitglied'
      ]
    },
    {
      titel: 'Materialausleihe',
      beschreibung: 'Material ausleihen und zurückgeben',
      icon: '🔄',
      link: '/ausleihen',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter'
      ]
    },
    {
      titel: 'Vereinskleider',
      beschreibung: 'Kleiderverkäufe und Rechnungen verwalten',
      icon: '👕',
      link: '/vereinskleider',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Inventur',
      beschreibung: 'Bestände kontrollieren und korrigieren',
      icon: '📋',
      link: '/inventur',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Inventarbewertung',
      beschreibung: 'Inventarwerte für die Buchhaltung berechnen',
      icon: '💰',
      link: '/inventarbewertung',
      rollen: [
        'admin',
        'materialverantwortlich'
      ]
    },
    {
      titel: 'Schadensmeldungen',
      beschreibung: 'Schäden und Materialbedarf melden',
      icon: '🔧',
      link: '/meldungen',
      rollen: [
        'admin',
        'materialverantwortlich',
        'leiter',
        'mitglied'
      ]
    },
    {
      titel: 'Materialsuche',
      beschreibung: 'Material nach Kategorie und Lagerort suchen',
      icon: '🔍',
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
      beschreibung: 'Benutzer einladen und Vereinsmitglieder verwalten',
      icon: '👥',
      link: '/benutzer',
      rollen: ['admin']
    }
  ];

  // ========================================
  // Sichtbare Dashboard-Kacheln
  // ========================================

  const sichtbareFunktionen = $derived(
    funktionen.filter((funktion) =>
      funktion.rollen.includes(angezeigteRolle)
    )
  );
</script>

<svelte:head>
  <title>Dashboard – ClubMatiq</title>
</svelte:head>

<main>
  <div class="welcome">
    <h1>Willkommen bei ClubMatiq</h1>
    <p>Was möchtest du heute erledigen?</p>
  </div>

  <div class="kachel-grid">
    {#each sichtbareFunktionen as funktion (funktion.link)}
      <a href={funktion.link} class="kachel">
        <div class="icon">{funktion.icon}</div>

        <h2>{funktion.titel}</h2>
        <p>{funktion.beschreibung}</p>

        <span class="pfeil">→</span>
      </a>
    {/each}
  </div>
</main>

<style>
  main {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
  }

  .welcome {
    margin-bottom: 35px;
  }

  h1 {
    font-size: 32px;
    color: #172b4d;
    margin-bottom: 10px;
  }

  .welcome p {
    color: #64748b;
    font-size: 16px;
  }

  .kachel-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  .kachel {
    position: relative;
    display: block;
    min-height: 175px;
    padding: 24px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    text-decoration: none;
    color: #1e293b;
    transition: 0.2s;
  }

  .kachel:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
    border-color: #2563eb;
  }

  .icon {
    display: inline-flex;
    padding: 12px;
    background: #eff6ff;
    border-radius: 10px;
    font-size: 26px;
  }

  h2 {
    font-size: 18px;
    margin: 18px 0 8px;
  }

  .kachel p {
    font-size: 14px;
    color: #64748b;
    line-height: 1.5;
  }

  .pfeil {
    position: absolute;
    right: 20px;
    bottom: 16px;
    font-size: 22px;
    color: #2563eb;
  }

  @media (max-width: 1000px) {
    .kachel-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 600px) {
    .kachel-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
