<script lang="ts">
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';
  import { verwendeRollenVorschau, type Rolle } from '../lib/rollenVorschau.svelte';

  let { data }: { data: PageData } = $props();
  const rollenVorschau = verwendeRollenVorschau();
  const echteRolle: Rolle = $derived(data.rolle);
  const angezeigteRolle = $derived(echteRolle === 'admin' ? rollenVorschau.rolle : echteRolle);
  let wirdAktualisiert = $state(false);

  const funktionen: { titel: string; beschreibung: string; icon: string; link: string; rollen: Rolle[] }[] = [
    { titel: 'Inventar-Dashboard', beschreibung: 'Bestände, Materialien und Lagerorte suchen und verwalten', icon: '📦', link: '/inventar', rollen: ['admin', 'materialverantwortlich', 'leiter', 'mitglied'] },
    { titel: 'QR-Code', beschreibung: 'Material über QR-Code aufrufen', icon: '📱', link: '/qr-code', rollen: ['admin', 'materialverantwortlich', 'leiter', 'mitglied'] },
    { titel: 'Materialausleihe', beschreibung: 'Material ausleihen und zurückgeben', icon: '🔄', link: '/ausleihen', rollen: ['admin', 'materialverantwortlich', 'leiter'] },
    { titel: 'Vereinskleider', beschreibung: 'Kleiderverkäufe und Rechnungen verwalten', icon: '👕', link: '/vereinskleider', rollen: ['admin', 'materialverantwortlich'] },
    { titel: 'Inventur', beschreibung: 'Bestände kontrollieren und korrigieren', icon: '📋', link: '/inventur', rollen: ['admin', 'materialverantwortlich'] },
    { titel: 'Inventarbewertung', beschreibung: 'Inventarwerte für die Buchhaltung berechnen', icon: '💰', link: '/inventarbewertung', rollen: ['admin', 'materialverantwortlich'] },
    { titel: 'Schadensmeldungen', beschreibung: 'Schäden und Materialbedarf melden', icon: '🔧', link: '/meldungen', rollen: ['admin', 'materialverantwortlich', 'leiter', 'mitglied'] },
    { titel: 'Benutzerverwaltung', beschreibung: 'Benutzer einladen und Vereinsmitglieder verwalten', icon: '👥', link: '/benutzer', rollen: ['admin'] }
  ];

  const sichtbareFunktionen = $derived(funktionen.filter((f) => f.rollen.includes(angezeigteRolle)));
  const darfAusleihenSehen = $derived(angezeigteRolle !== 'mitglied');
  const darfBestellungenSehen = $derived(angezeigteRolle === 'admin' || angezeigteRolle === 'materialverantwortlich');

  const kennzahlKarten = $derived([
    { titel: 'Artikel', wert: data.kennzahlen?.artikel, zusatz: 'Erfasste Inventarartikel', link: '/inventar', sichtbar: true },
    { titel: 'Verfügbarer Bestand', wert: data.kennzahlen?.bestand, zusatz: 'Stück im Inventar', link: '/inventar', sichtbar: true },
    { titel: 'Offene Ausleihen', wert: data.kennzahlen?.ausleihen, zusatz: 'Noch nicht abgeschlossene Ausleihen', link: '/ausleihen', sichtbar: darfAusleihenSehen },
    { titel: 'Offene Schadensmeldungen', wert: data.kennzahlen?.meldungen, zusatz: darfBestellungenSehen ? 'Offen oder in Bearbeitung' : 'Eigene offene Meldungen', link: '/meldungen', sichtbar: true },
    { titel: 'Unter Mindestbestand', wert: data.kennzahlen?.unterMindestbestand, zusatz: 'Artikel mit definiertem Mindestbestand', link: '/inventar', sichtbar: true },
    { titel: 'Offene Kleiderbestellungen', wert: data.kennzahlen?.bestellungen, zusatz: 'Noch nicht vollständig übergebene Bestellpositionen', link: '/vereinskleider/bestellungen', sichtbar: darfBestellungenSehen }
  ].filter((k) => k.sichtbar));

  async function aktualisieren() {
    wirdAktualisiert = true;
    try { await invalidate('clubmatiq:dashboard'); }
    finally { wirdAktualisiert = false; }
  }
</script>

<svelte:head><title>Dashboard – ClubMatiq</title></svelte:head>

<main>
  <div class="welcome">
    <h1>Willkommen bei ClubMatiq</h1>
  </div>

  {#if data.kennzahlen || data.kennzahlenFehler}
    <section class="uebersicht" aria-label="Vereinskennzahlen">
      <div class="bereich-kopf">
        <div><h2>Vereinsübersicht</h2><p>Aktuelle Zahlen deines Vereins</p></div>
        <button onclick={aktualisieren} disabled={wirdAktualisiert}>
          {wirdAktualisiert ? 'Aktualisiere ...' : '↻ Aktualisieren'}
        </button>
      </div>
      {#if data.kennzahlenFehler}
        <p class="fehler" role="alert">{data.kennzahlenFehler}</p>
      {:else}
        <div class="kennzahlen-grid">
          {#each kennzahlKarten as k (k.titel)}
            <a class="kennzahl" href={k.link}>
              <span>{k.titel}</span>
              <strong>{k.wert ?? '–'}</strong>
              <small>{k.zusatz}</small>
              <span class="mehr">Zur Übersicht →</span>
            </a>
          {/each}
        </div>
        {#if data.kennzahlen?.artikel === 0}
          <p class="leer">Noch keine Inventarartikel vorhanden. Erfasse deinen ersten Artikel in der Inventarverwaltung.</p>
        {/if}
        <p class="hinweis">Die Kacheln führen zu den bestehenden Übersichten. Dort kannst du die entsprechenden Einträge prüfen.</p>
      {/if}
    </section>
  {/if}

  <section aria-label="Funktionen">
    <h2 class="funktionen-titel">Schnellzugriffe</h2>
    <div class="kachel-grid">
      {#each sichtbareFunktionen as funktion (funktion.link)}
        <a href={funktion.link} class="kachel">
          <div class="icon">{funktion.icon}</div>
          <h3>{funktion.titel}</h3>
          <p>{funktion.beschreibung}</p>
          <span class="pfeil">→</span>
        </a>
      {/each}
    </div>
  </section>
</main>

<style>
  main { max-width:1200px; margin:40px auto; padding:20px; }
  .welcome { margin-bottom:30px; }
  h1 { font-size:32px; color:#172b4d; margin-bottom:10px; }
  .welcome p { color:#64748b; font-size:16px; }
  .uebersicht { margin-bottom:35px; }
  .bereich-kopf { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
  .bereich-kopf h2,.funktionen-titel { color:#172b4d; font-size:21px; margin:0 0 7px; }
  .bereich-kopf p { margin:0; color:#64748b; font-size:14px; }
  .bereich-kopf button { padding:10px 15px; border-radius:8px; border:1px solid #cbd5e1; background:white; color:#172b4d; font:inherit; cursor:pointer; }
  .bereich-kopf button:disabled { opacity:.6; cursor:wait; }
  .kennzahlen-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
  .kennzahl { display:flex; flex-direction:column; gap:8px; background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; text-decoration:none; color:#172b4d; }
  .kennzahl:hover,.kachel:hover { border-color:#2563eb; box-shadow:0 8px 25px rgba(0,0,0,.08); }
  .kennzahl>span:first-child { font-size:14px; color:#64748b; }
  .kennzahl strong { font-size:30px; }
  .kennzahl small { color:#64748b; font-size:12px; }
  .kennzahl .mehr { color:#2563eb; font-size:12px; font-weight:600; margin-top:auto; }
  .hinweis,.leer { font-size:13px; color:#64748b; margin:14px 0 0; }
  .fehler { padding:16px; border-radius:8px; background:#fee2e2; color:#991b1b; }
  .funktionen-titel { margin-bottom:18px; }
  .kachel-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px; }
  .kachel { position:relative; display:block; min-height:175px; padding:24px; background:white; border:1px solid #e2e8f0; border-radius:14px; text-decoration:none; color:#1e293b; transition:.2s; }
  .kachel:hover { transform:translateY(-4px); }
  .icon { display:inline-flex; padding:12px; background:#eff6ff; border-radius:10px; font-size:26px; }
  h3 { font-size:18px; margin:18px 0 8px; }
  .kachel p { font-size:14px; color:#64748b; line-height:1.5; }
  .pfeil { position:absolute; right:20px; bottom:16px; font-size:22px; color:#2563eb; }
  @media (max-width:1000px) { .kachel-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .kennzahlen-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width:600px) { main { margin:20px auto; padding:12px; } .kachel-grid,.kennzahlen-grid { grid-template-columns:1fr; } .bereich-kopf { align-items:flex-start; flex-direction:column; } }
</style>
