<script lang="ts">
  import { onMount } from 'svelte';
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
    if (!geladen || speichern) return;
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
      if (geladen) erfolg = 'Vereinseinstellungen gespeichert.';
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
    } finally { speichern = false; }
  }
  onMount(() => { void lade(); });
</script>
<svelte:head><title>Vereinseinstellungen | ClubMatiq</title></svelte:head>
<Aktionsmeldung {fehler} {erfolg} fehlerSchliessen={() => fehler = ''} erfolgSchliessen={() => erfolg = ''} />
<div class="seite">
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
          <label>Vereinsname<input bind:value={name} required maxlength="150" disabled={speichern} /></label>
          <label>Vereinskürzel<input bind:value={kuerzel} maxlength="30" disabled={speichern} /></label>
        </div>
      </section>
      <section class="karte">
        <div class="abschnitt-titel"><h2>Adresse</h2><p class="beschreibung">Alle Adressfelder sind optional.</p></div>
        <div class="formular-raster">
          <label>Strasse und Hausnummer<input bind:value={adresse.strasse} maxlength="150" disabled={speichern} /></label>
          <label>PLZ<input bind:value={adresse.plz} maxlength="20" disabled={speichern} /></label>
          <label>Ort<input bind:value={adresse.ort} maxlength="100" disabled={speichern} /></label>
        </div>
      </section>
      <section class="karte">
        <div class="abschnitt-titel"><h2>Kontaktinformationen</h2><p class="beschreibung">Öffentliche Kontaktdaten des Vereins, unabhängig von der Versandkonfiguration.</p></div>
        <div class="formular-raster">
          <label>E-Mail<input type="email" bind:value={kontakt.email} maxlength="254" disabled={speichern} /></label>
          <label>Telefon<input type="tel" bind:value={kontakt.telefon} maxlength="50" disabled={speichern} /></label>
          <label>Website<input type="url" bind:value={kontakt.website} maxlength="500" placeholder="https://" disabled={speichern} /></label>
        </div>
        <div class="formular-aktionen"><button class="primaer" type="submit" disabled={speichern}>{speichern ? 'Speichert …' : 'Vereinseinstellungen speichern'}</button></div>
      </section>
    </form>
    <section class="karte"><h2>Vereinslogo</h2>{#if logo}<img src={logo} alt="Vereinslogo" style="max-width:180px;max-height:120px;object-fit:contain" />{:else}<p class="beschreibung">Noch kein Vereinslogo hinterlegt.</p>{/if}</section>
  {/if}
  <section class="karte"><h2>E-Mail-Versand</h2><p class="beschreibung">Die Versandkonfiguration wird separat verwaltet.</p><p><a href="/mail-einstellungen">Zu den E-Mail-Einstellungen</a></p></section>
</div>
<style>
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
</style>
