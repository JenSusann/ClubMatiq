<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const funktionen = [
    { icon:'📦', titel:'Inventarverwaltung', text:'Material, Bestände, Lagerorte und Mindestbestände im Blick.' },
    { icon:'🔄', titel:'Materialausleihe', text:'Ausleihen und Rückgaben übersichtlich organisieren.' },
    { icon:'👕', titel:'Vereinskleider', text:'Grössen, Verkäufe und Bestellungen verwalten.' },
    { icon:'📋', titel:'Inventur & Bewertung', text:'Bestände kontrollieren und Inventarwerte auswerten.' },
    { icon:'🔧', titel:'Schadensmeldungen', text:'Materialschäden einfach erfassen und bearbeiten.' },
    { icon:'👥', titel:'Vereinsorganisation', text:'Rollen, Stammdaten und ClubDesk-Mitgliederimport.' }
  ];
</script>
<svelte:head>
  <title>ClubMatiq – Digitale Materialverwaltung für Vereine</title>
  <meta name="description" content="ClubMatiq unterstützt Vereine bei Inventar, Materialausleihe, Vereinskleidern und Inventur." />
</svelte:head>
<main>
  <section class="hero">
    <div class="hero-inner">
      <span class="eyebrow">DIGITALE VEREINSVERWALTUNG</span>
      <h1>Dein Verein.<br /><span>Dein Material.</span><br />Alles im Blick.</h1>
      <p>Weniger Tabellen, mehr Überblick: Verwalte Inventar, Materialausleihen, Vereinskleider und Bestände an einem zentralen Ort.</p>
      <div class="aktionen">
        <a class="primaer" href={data.angemeldet ? '/dashboard' : '/registrieren'}>{data.angemeldet ? 'Zum Dashboard' : 'Verein registrieren'} →</a>
        <a class="sekundaer" href="/docs">Dokumentation entdecken</a>
      </div>
      <div class="merkmale"><span>✓ Vereinsbezogene Daten</span><span>✓ Rollen & Berechtigungen</span><span>✓ Übersichtliche Abläufe</span></div>
    </div>
    <div class="vorschau" aria-label="Beispielhafte Funktionsübersicht">
      <div class="vorschau-kopf"><strong>📦 ClubMatiq</strong><span>Vereinsübersicht</span></div>
      <div class="mini-grid"><div><span>📦</span><strong>Inventar</strong><small>Bestände verwalten</small></div><div><span>🔄</span><strong>Ausleihen</strong><small>Material verfolgen</small></div><div><span>👕</span><strong>Vereinskleider</strong><small>Grössen & Bestellungen</small></div><div><span>📋</span><strong>Inventur</strong><small>Bestände prüfen</small></div></div>
      <p>Eine Anwendung für die wichtigsten Materialprozesse deines Vereins.</p>
    </div>
  </section>
  <section class="bereich" id="funktionen"><div class="einleitung"><span class="eyebrow dunkel">FUNKTIONEN</span><h2>Alles, was dein Verein für die Materialverwaltung braucht</h2><p>Von der Erfassung bis zur Inventur – ClubMatiq verbindet die wichtigsten Abläufe.</p></div>
    <div class="karten">{#each funktionen as funktion}<article class="karte"><div class="symbol">{funktion.icon}</div><h3>{funktion.titel}</h3><p>{funktion.text}</p></article>{/each}</div>
  </section>
  <section class="cta"><div><h2>Neu bei ClubMatiq?</h2><p>In unserem Hilfe-Center findest du Anleitungen für die ersten Schritte und alle wichtigen Funktionen.</p></div><a href="/docs">Zum Hilfe-Center →</a></section>
</main>
<style>
  main{max-width:1250px;margin:auto;padding:22px 20px 65px;color:#172b4d}.hero{display:grid;grid-template-columns:1.15fr 1fr;align-items:center;gap:55px;padding:75px 10px 95px}.eyebrow{font-size:12px;letter-spacing:.14em;font-weight:800;color:#60a5fa}.eyebrow.dunkel{color:#2563eb}h1{font-size:clamp(42px,5vw,70px);line-height:1.09;letter-spacing:-.045em;margin:18px 0 24px}h1 span{color:#2563eb}.hero-inner>p{font-size:18px;color:#64748b;line-height:1.7;max-width:540px}.aktionen{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.aktionen a,.cta a{padding:15px 20px;border-radius:11px;text-decoration:none;font-weight:700}.primaer,.cta a{background:#2563eb;color:white}.sekundaer{border:1px solid #cbd5e1;color:#172b4d;background:white}.merkmale{display:flex;flex-wrap:wrap;gap:15px;margin-top:28px;font-size:12px;color:#64748b}.vorschau{background:white;border:1px solid #e2e8f0;border-radius:24px;padding:25px;box-shadow:0 22px 65px #172b4d15;transform:rotate(1deg)}.vorschau-kopf{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:20px}.vorschau-kopf span{font-size:13px;color:#64748b}.mini-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px;margin:20px 0}.mini-grid div{display:flex;flex-direction:column;gap:9px;background:#f1f5f9;padding:20px;border-radius:14px}.mini-grid span{font-size:27px}.mini-grid small,.vorschau>p{color:#64748b}.vorschau>p{font-size:13px}.bereich{padding:35px 0}.einleitung{text-align:center;max-width:680px;margin:0 auto 36px}h2{font-size:clamp(28px,3vw,38px);letter-spacing:-.025em}.einleitung p,.karte p,.cta p{color:#64748b;line-height:1.6}.karten{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.karte{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:25px}.symbol{font-size:30px;background:#eff6ff;display:inline-flex;padding:12px;border-radius:12px}.karte h3{margin:18px 0 8px}.karte p{font-size:14px;margin:0}.cta{background:#eaf2ff;border-radius:20px;padding:35px;display:flex;align-items:center;justify-content:space-between;gap:25px;margin-top:55px}.cta h2{margin:0}.cta p{margin-bottom:0}.cta a{white-space:nowrap}@media(max-width:850px){.hero{grid-template-columns:1fr;padding:35px 0 60px;gap:35px}.vorschau{transform:none}.karten{grid-template-columns:repeat(2,1fr)}}@media(max-width:580px){.karten{grid-template-columns:1fr}.cta{flex-direction:column;align-items:flex-start}.mini-grid div{padding:13px}}
</style>
