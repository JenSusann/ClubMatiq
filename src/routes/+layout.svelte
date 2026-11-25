<script lang="ts">
  import favicon from '#lib/assets/favicon.svg';
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount, type Snippet } from 'svelte';
  import { erstelleRollenVorschau, type Rolle } from '../lib/rollenVorschau.svelte';

  let { children, data }: { children: Snippet; data: { benutzer: App.Locals['benutzer']; sessionFristen?: { absolut: number; inaktiv: number } } } = $props();
  const rollenVorschau = erstelleRollenVorschau();
  let wirdAbgemeldet = $state(false);
  let logoutFehler = $state('');
  const rollenNamen: Record<Rolle, string> = {
    admin:'Administrator', materialverantwortlich:'Materialverantwortliche', leiter:'Leiter/in', mitglied:'Mitglied'
  };
  const echteRolle = $derived(data.benutzer?.rolle ?? 'mitglied');
  const angezeigteRolle = $derived(echteRolle === 'admin' ? rollenVorschau.rolle : echteRolle);
  const vorschauAktiv = $derived(echteRolle === 'admin' && angezeigteRolle !== 'admin');
  const navigation: { titel:string; link:string; rollen:Rolle[] }[] = [
    { titel:'Dashboard', link:'/dashboard', rollen:['admin','materialverantwortlich','leiter','mitglied'] },
    { titel:'Inventar', link:'/inventar', rollen:['admin','materialverantwortlich','leiter','mitglied'] },
    { titel:'QR-Code', link:'/qr-code', rollen:['admin','materialverantwortlich','leiter','mitglied'] },
    { titel:'Ausleihen', link:'/ausleihen', rollen:['admin','materialverantwortlich','leiter'] },
    { titel:'Vereinskleider', link:'/vereinskleider', rollen:['admin','materialverantwortlich'] },
    { titel:'Inventur', link:'/inventur', rollen:['admin','materialverantwortlich'] },
    { titel:'Inventarbewertung', link:'/inventarbewertung', rollen:['admin','materialverantwortlich'] },
    { titel:'Schadensmeldungen', link:'/meldungen', rollen:['admin','materialverantwortlich','leiter','mitglied'] },
    { titel:'Stammdaten', link:'/stammdaten', rollen:['admin','materialverantwortlich'] },
    { titel:'Benutzerverwaltung', link:'/benutzer', rollen:['admin'] },
    { titel:'E-Mail-Einstellungen', link:'/mail-einstellungen', rollen:['admin'] }
  ];
  const sichtbareNavigation = $derived(navigation.filter((n)=>n.rollen.includes(angezeigteRolle)));
  const istOeffentlicheSeite = $derived(page.url.pathname==='/' || page.url.pathname==='/anmelden' || page.url.pathname==='/registrieren' || page.url.pathname==='/funktionen' || page.url.pathname==='/docs' || page.url.pathname.startsWith('/docs/'));
  const navigationAnzeigen = $derived(!istOeffentlicheSeite && !!data.benutzer);
  let fristen = $state<{ absolut: number; inaktiv: number } | undefined>(undefined);
  let rest = $state(0);
  let sessionFehler = $state('');
  let prueft = false;
  let letzteMeldung = 0;
  let abgelaufen = false;
  const warnung = $derived(!!data.benutzer && !!fristen && rest <= 300000);
  const absolutEndet = $derived(!!fristen && fristen.absolut <= fristen.inaktiv);
  $effect(() => { fristen = data.sessionFristen; if (fristen) rest = Math.max(0, Math.min(fristen.absolut, fristen.inaktiv) - Date.now()); });
  function zurAnmeldung() {
    if (abgelaufen) return;
    abgelaufen = true;
    rollenVorschau.zuruecksetzen();
    window.location.replace('/anmelden');
  }
  async function sessionPruefen(aktiv = false) {
    if (!data.benutzer || prueft || abgelaufen) return;
    prueft = true;
    try {
      const r = await fetch(aktiv ? '/api/session/aktivitaet' : '/api/session', { method: aktiv ? 'POST' : 'GET', cache: 'no-store' });
      if (r.status === 401) { zurAnmeldung(); return; }
      if (!r.ok) throw new Error('Sessionstatus nicht verfügbar');
      fristen = await r.json();
      sessionFehler = '';
      if (fristen) rest = Math.max(0, Math.min(fristen.absolut, fristen.inaktiv) - Date.now());
    } catch { sessionFehler = 'Sitzung konnte nicht überprüft werden. Bitte versuche es erneut.'; }
    finally { prueft = false; }
  }
  onMount(() => {
    const aktivitaet = () => {
      if (!data.benutzer || warnung || Date.now() - letzteMeldung < 60000) return;
      letzteMeldung = Date.now();
      void sessionPruefen(true);
    };
    const tick = () => {
      if (!data.benutzer || !fristen) return;
      rest = Math.max(0, Math.min(fristen.absolut, fristen.inaktiv) - Date.now());
      if (Date.now() >= fristen.absolut) zurAnmeldung();
      else if (rest === 0) void sessionPruefen();
    };
    const sichtbar = () => { if (!document.hidden) void sessionPruefen(); };
    const timer = window.setInterval(tick, 1000);
    const sync = window.setInterval(() => void sessionPruefen(), 15000);
    window.addEventListener('pointerdown', aktivitaet);
    window.addEventListener('keydown', aktivitaet);
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      clearInterval(timer); clearInterval(sync);
      window.removeEventListener('pointerdown', aktivitaet);
      window.removeEventListener('keydown', aktivitaet);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  });
  function rolleWechseln(event:Event) {
    if(echteRolle!=='admin') return;
    const neueRolle=(event.currentTarget as HTMLSelectElement).value as Rolle;
    if(neueRolle in rollenNamen) rollenVorschau.wechseln(neueRolle);
  }
  async function abmelden() {
    if(wirdAbgemeldet) return;
    wirdAbgemeldet=true;logoutFehler='';
    try {
      const antwort=await fetch('/api/abmelden',{method:'POST'});
      if(!antwort.ok) throw new Error('Abmeldung fehlgeschlagen.');
      rollenVorschau.zuruecksetzen();await invalidateAll();await goto('/');
    } catch(e) { console.error(e);logoutFehler='Abmeldung fehlgeschlagen.'; }
    finally { wirdAbgemeldet=false; }
  }
</script>
<svelte:head><link rel="icon" href={favicon}/></svelte:head>
<div class="app">
  <header>
    <a href="/" class="brand"><span class="logo">📦</span><span class="brand-name">ClubMatiq</span></a>
    <div class="header-rechts">
      {#if istOeffentlicheSeite}
        <div class="public-links"><a href="/#funktionen">Funktionen</a><a href="/docs">Dokumentation</a>{#if data.benutzer}<a class="login" href="/dashboard">Dashboard →</a>{:else}<a href="/anmelden">Anmelden</a><a class="login" href="/registrieren">Registrieren →</a>{/if}</div>
      {:else if data.benutzer}
        <a class="hilfe-link" href="/docs">❔ Hilfe</a>
        {#if echteRolle === 'admin'}<div class="rollenwechsel"><label for="rollen-auswahl">👁️ Rollenansicht</label><select id="rollen-auswahl" value={angezeigteRolle} onchange={rolleWechseln}><option value="admin">Administrator</option><option value="materialverantwortlich">Materialverantwortliche</option><option value="leiter">Leiter/in</option><option value="mitglied">Mitglied</option></select></div>{/if}
        <div class="benutzer-info"><span class="benutzer-name">{data.benutzer.vorname} {data.benutzer.nachname}</span><span class="benutzer-rolle">{rollenNamen[echteRolle]}</span></div>
        <button class="logout-button" onclick={abmelden} disabled={wirdAbgemeldet}>{wirdAbgemeldet?'Abmelden ...':'Abmelden'}</button>
      {/if}
    </div>
  </header>
  {#if logoutFehler}<div class="logout-fehler" role="alert">{logoutFehler}</div>{/if}
  {#if vorschauAktiv && !istOeffentlicheSeite}<div class="vorschau-banner"><span>👁️ Vorschau als <strong>{rollenNamen[angezeigteRolle]}</strong> – Du bleibst Administrator.</span><button onclick={()=>rollenVorschau.zuruecksetzen()}>Vorschau beenden</button></div>{/if}
  {#if navigationAnzeigen}<nav aria-label="Hauptnavigation">{#each sichtbareNavigation as eintrag (eintrag.link)}<a href={eintrag.link} class:active={page.url.pathname===eintrag.link || page.url.pathname.startsWith(eintrag.link+'/')}>{eintrag.titel}</a>{/each}</nav>{/if}
  <div class="content" class:auth-content={page.url.pathname==='/anmelden' || page.url.pathname==='/registrieren'}>{@render children()}</div>
  <footer><span>© {new Date().getFullYear()} ClubMatiq</span><div><a href="/">Startseite</a><a href="/docs">Dokumentation</a></div></footer>
</div>
{#if warnung}
  <div class="session-overlay">
    <section class="session-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-titel">
      <h2 id="session-titel">Deine Sitzung läuft bald ab</h2>
      <p>{absolutEndet ? 'Die maximale Sitzungsdauer von zwei Stunden ist bald erreicht. Bitte speichere deine Änderungen.' : 'Du warst längere Zeit inaktiv. Aus Sicherheitsgründen wirst du automatisch abgemeldet.'}</p>
      <div class="session-countdown">{Math.floor(Math.ceil(rest / 1000) / 60)}:{String(Math.ceil(rest / 1000) % 60).padStart(2, '0')}</div>
      {#if sessionFehler}<p role="alert">{sessionFehler}</p>{/if}
      <div class="session-aktionen"><button onclick={abmelden}>Abmelden</button>{#if !absolutEndet}<button class="session-weiter" onclick={() => sessionPruefen(true)}>Angemeldet bleiben</button>{/if}</div>
    </section>
  </div>
{/if}
<style>
.session-overlay{position:fixed;inset:0;background:#172b4d88;display:grid;place-items:center;z-index:1000;padding:16px}.session-dialog{background:white;border-radius:14px;padding:24px;width:min(440px,100%);box-shadow:0 12px 40px #0003}.session-countdown{text-align:center;font-size:36px;font-weight:700;font-variant-numeric:tabular-nums;margin:20px}.session-aktionen{display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap}.session-aktionen button{padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;background:white;cursor:pointer}.session-aktionen .session-weiter{background:#2563eb;color:white;border-color:#2563eb}

 :global(body){margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#1e293b}:global(*){box-sizing:border-box}.app{min-height:100vh;display:flex;flex-direction:column}header{background:#172b4d;color:white;padding:17px 40px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:white}.brand-name{font-size:23px;font-weight:800}.logo{font-size:28px}.header-rechts,.public-links{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.public-links a,.hilfe-link{color:#cbd5e1;text-decoration:none;font-size:14px}.public-links a:hover,.hilfe-link:hover{color:white}.public-links .login{background:#2563eb;color:white;border-radius:9px;padding:11px 15px;font-weight:700}.rollenwechsel{display:flex;flex-direction:column;gap:5px}.rollenwechsel label{color:#cbd5e1;font-size:11px}.rollenwechsel select{background:#334155;color:white;border:1px solid #64748b;border-radius:8px;padding:8px}.benutzer-info{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.benutzer-name{font-size:14px;font-weight:600}.benutzer-rolle{font-size:12px;color:#cbd5e1}.logout-button{background:transparent;color:white;border:1px solid #64748b;border-radius:8px;padding:10px 14px;cursor:pointer}.logout-fehler{background:#fef2f2;color:#b91c1c;padding:12px 40px}.vorschau-banner{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:12px 40px;background:#dbeafe;color:#1e40af;font-size:13px}.vorschau-banner button{background:#2563eb;color:white;border:0;border-radius:8px;padding:9px 13px;cursor:pointer}nav{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:13px 40px;background:white;border-bottom:1px solid #e2e8f0}nav a{text-decoration:none;color:#475569;padding:10px 12px;border-radius:8px;font-size:14px}nav a:hover{background:#f1f5f9}nav a.active{background:#dbeafe;color:#1d4ed8}.content{flex:1;padding:20px}.auth-content{padding:48px 20px}footer{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:24px 40px;border-top:1px solid #e2e8f0;background:white;color:#64748b;font-size:13px}footer div{display:flex;gap:20px}footer a{color:#475569;text-decoration:none}@media(max-width:900px){header{padding:16px 20px;flex-wrap:wrap}.header-rechts{gap:12px}.public-links{gap:12px}nav{padding:12px 20px}.content{padding:10px}.auth-content{padding:24px 12px}footer{padding:20px}.vorschau-banner{padding:12px 20px}}
</style>
