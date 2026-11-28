<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { invalidate } from '$app/navigation';
  import Aktionsmeldung from '../../lib/Aktionsmeldung.svelte';
  let name = $state('');
  let kuerzel = $state('');
  let adresse = $state({ strasse: '', plz: '', ort: '' });
  let kontakt = $state({ email: '', telefon: '', website: '' });
  let logo = $state<string | null>(null);
  let laden = $state(true);
  let geladen = $state(false);
  let speichern = $state(false);
  let fehler = $state('');
  let erfolg = $state('');

  let logoDatei = $state<File | null>(null);
  let vorschau = $state<string | null>(null);
  let logoArbeitet = $state(false);
  let entfernenBestaetigen = $state(false);
  let dateiInput: HTMLInputElement | undefined = $state();
  function auswahlLeeren() {
    if (vorschau) URL.revokeObjectURL(vorschau);
    vorschau = null;
    logoDatei = null;
    if (dateiInput) dateiInput.value = '';
  }
  function dateiWaehlen(event: Event) {
    const datei = (event.currentTarget as HTMLInputElement).files?.[0];
    auswahlLeeren();
    fehler = '';
    erfolg = '';
    if (!datei) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(datei.type) || !datei.size || datei.size > 5 * 1024 * 1024) {
      fehler = 'Bitte ein JPG-, PNG- oder WebP-Bild mit maximal 5 MB auswählen.';
      return;
    }
    logoDatei = datei;
    vorschau = URL.createObjectURL(datei);
  }
  async function logoAendern(entfernen = false) {
    if (logoArbeitet || speichern || page.data.demo || (!entfernen && !logoDatei)) return;
    logoArbeitet = true;
    fehler = '';
    erfolg = '';
    try {
      const formular = new FormData();
      if (!entfernen && logoDatei) formular.append('logo', logoDatei);
      const antwort = await fetch('/api/vereine/logo', entfernen ? { method: 'DELETE' } : { method: 'POST', body: formular });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Logoänderung fehlgeschlagen.');
      logo = daten.logo?.url ?? null;
      auswahlLeeren();
      entfernenBestaetigen = false;
      erfolg = entfernen ? 'Vereinslogo entfernt.' : 'Vereinslogo gespeichert.';
      await invalidate('clubmatiq:vereinsprofil');
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Logoänderung fehlgeschlagen.';
    } finally { logoArbeitet = false; }
  }

  async function lade() {
    laden = true;
    geladen = false;
    fehler = '';
    try {
      const antwort = await fetch('/api/vereine');
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Verein konnte nicht geladen werden.');
      const verein = daten[0];
      if (!verein) throw new Error('Verein nicht gefunden.');
      name = verein.name;
      kuerzel = verein.kuerzel;
      adresse = verein.adresse;
      kontakt = verein.kontakt;
      logo = verein.logo?.url ?? null;
      geladen = true;
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Laden fehlgeschlagen.';
    } finally { laden = false; }
  }

  async function speichere(event: SubmitEvent) {
    event.preventDefault();
    if (!geladen || speichern || logoArbeitet) return;
    speichern = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/vereine', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kuerzel, adresse, kontakt })
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Speichern fehlgeschlagen.');
      await lade();
      await invalidate('clubmatiq:vereinsprofil');
      if (geladen) erfolg = 'Vereinseinstellungen gespeichert.';
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
    } finally { speichern = false; }
  }
  onMount(() => { void lade(); return () => { if (vorschau) URL.revokeObjectURL(vorschau); }; });
</script>
<svelte:head><title>Vereinseinstellungen | ClubMatiq</title></svelte:head>
<Aktionsmeldung {fehler} {erfolg} fehlerSchliessen={() => fehler = ''} erfolgSchliessen={() => erfolg = ''} />
<div class="seite">
  <a href="/administration" class="zurueck">← Zurück zur Administration</a>

  <header class="kopf"><div><p class="untertitel">Administration</p><h1>Vereinseinstellungen</h1><p>Stammdaten und Kontaktinformationen deines Vereins verwalten.</p></div></header>
  {#if laden}
    <p>Vereinsdaten werden geladen …</p>
  {:else if !geladen}
    <button class="sekundaer" onclick={lade}>Erneut laden</button>
  {:else}
    <form onsubmit={speichere}>
      <section class="karte">
        <div class="abschnitt-titel"><h2>Vereinsdaten</h2><p class="beschreibung">Die Vereins-ID bleibt bei einer Namensänderung unverändert.</p></div>
        <div class="formular-raster">
          <label>Vereinsname<input bind:value={name} required maxlength="150" disabled={speichern || logoArbeitet} /></label>
          <label>Vereinskürzel<input bind:value={kuerzel} maxlength="30" disabled={speichern || logoArbeitet} /></label>
        </div>
      </section>
      <section class="karte">
        <div class="abschnitt-titel"><h2>Adresse</h2><p class="beschreibung">Alle Adressfelder sind optional.</p></div>
        <div class="formular-raster">
          <label>Strasse und Hausnummer<input bind:value={adresse.strasse} maxlength="150" disabled={speichern || logoArbeitet} /></label>
          <label>PLZ<input bind:value={adresse.plz} maxlength="20" disabled={speichern || logoArbeitet} /></label>
          <label>Ort<input bind:value={adresse.ort} maxlength="100" disabled={speichern || logoArbeitet} /></label>
        </div>
      </section>
      <section class="karte">
        <div class="abschnitt-titel"><h2>Kontaktinformationen</h2><p class="beschreibung">Öffentliche Kontaktdaten des Vereins, unabhängig von der Versandkonfiguration.</p></div>
        <div class="formular-raster">
          <label>E-Mail<input type="email" bind:value={kontakt.email} maxlength="254" disabled={speichern || logoArbeitet} /></label>
          <label>Telefon<input type="tel" bind:value={kontakt.telefon} maxlength="50" disabled={speichern || logoArbeitet} /></label>
          <label>Website<input type="url" bind:value={kontakt.website} maxlength="500" placeholder="https://" disabled={speichern || logoArbeitet} /></label>
        </div>
        <div class="formular-aktionen"><button class="primaer" type="submit" disabled={speichern || logoArbeitet}>{speichern ? 'Speichert …' : 'Vereinseinstellungen speichern'}</button></div>
      </section>
    </form>
    <section class="karte">
      <h2>Vereinslogo</h2>
      <p class="beschreibung">JPG, PNG oder WebP, maximal 5 MB. Änderungen am Logo werden separat gespeichert.</p>
      <div class="logo-raster">
        <div><h3>Aktuelles Logo</h3><div class="logo-flaeche">{#if logo}<img src={logo} alt="Aktuelles Vereinslogo" />{:else}<p>Kein Logo hinterlegt.</p>{/if}</div></div>
        {#if vorschau}<div><h3>Vorschau</h3><div class="logo-flaeche"><img src={vorschau} alt="Vorschau des ausgewählten Logos" /></div></div>{/if}
      </div>
      {#if page.data.demo}
        <p class="beschreibung">Logoänderungen sind in der Demo deaktiviert.</p>
      {:else}
        <label>Neues Logo auswählen<input type="file" accept="image/jpeg,image/png,image/webp" bind:this={dateiInput} onchange={dateiWaehlen} disabled={logoArbeitet || speichern} /></label>
        <div class="logo-aktionen">
          <button class="primaer" onclick={() => logoAendern()} disabled={!logoDatei || logoArbeitet || speichern}>{logoArbeitet ? 'Bitte warten …' : logo ? 'Logo ersetzen' : 'Logo hochladen'}</button>
          {#if logoDatei}<button class="sekundaer" onclick={auswahlLeeren} disabled={logoArbeitet}>Auswahl verwerfen</button>{/if}
          {#if logo && !entfernenBestaetigen}<button class="sekundaer" onclick={() => entfernenBestaetigen = true} disabled={logoArbeitet || speichern}>Logo entfernen</button>{/if}
        </div>
        {#if entfernenBestaetigen}
          <p>Vereinslogo wirklich entfernen? Historische Dokumente behalten ihre Logo-Referenz.</p>
          <div class="logo-aktionen"><button class="sekundaer" onclick={() => entfernenBestaetigen = false} disabled={logoArbeitet}>Abbrechen</button><button class="gefahr" onclick={() => logoAendern(true)} disabled={logoArbeitet || speichern}>Entfernen bestätigen</button></div>
        {/if}
      {/if}
    </section>
  {/if}
  <section class="karte"><h2>E-Mail-Versand</h2><p class="beschreibung">Die Versandkonfiguration wird separat verwaltet.</p>{#if !page.data.demo}<p><a href="/mail-einstellungen">Zu den E-Mail-Einstellungen</a></p>{/if}</section>
</div>
<style>
  .zurueck {
    display: inline-block;
    margin-bottom: 25px;
    color: #64748b;
    text-decoration: none;
  }

  .seite {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 20px 60px;
    color: #1f2937;
  }

  .kopf {
    margin-bottom: 28px;
  }

  .untertitel {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }

  h1 {
    font-size: 32px;
    margin: 6px 0 10px;
  }

  h2 {
    font-size: 21px;
    margin: 0 0 8px;
  }

  .kopf > div > p:last-child,
  .beschreibung {
    color: #64748b;
    line-height: 1.5;
  }

  .beschreibung {
    margin: 0;
    font-size: 14px;
  }

  .karte {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 26px;
    margin-bottom: 24px;
  }

  .abschnitt-titel {
    margin-bottom: 20px;
  }

  .formular-raster {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 12px;
    font: inherit;
    background: white;
    color: #1f2937;
  }

  input:focus {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .formular-aktionen {
    display: flex;
    justify-content: flex-start;
  }

  button {
    border: none;
    border-radius: 8px;
    padding: 12px 18px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  button.primaer {
    background: #1d4ed8;
    color: white;
  }

  button.primaer:hover:not(:disabled) {
    background: #1e40af;
  }

  button.sekundaer {
    background: #f1f5f9;
    color: #334155;
  }

  button.sekundaer:hover:not(:disabled) {
    background: #e2e8f0;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }


  @media (max-width: 650px) {
    .seite {
      padding: 24px 14px 40px;
    }

    .formular-raster {
      grid-template-columns: 1fr;
    }

    .karte {
      padding: 18px;
    }

      h1 {
      font-size: 26px;
    }

    h2 {
      font-size: 19px;
    }
  }
  .logo-raster { display:flex; flex-wrap:wrap; gap:24px; margin:20px 0; }
  .logo-raster h3 { font-size:14px; }
  .logo-flaeche { width:min(240px, 100%); min-height:140px; border:1px solid #e2e8f0; border-radius:8px; display:grid; place-items:center; padding:12px; color:#64748b; }
  .logo-flaeche img { max-width:100%; max-height:140px; object-fit:contain; }
  .logo-aktionen { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
  button.gefahr { background:#b91c1c; color:white; }
</style>
