<script lang="ts">
  import Aktionsmeldung from '../../../lib/Aktionsmeldung.svelte';
  import { onMount } from 'svelte';

  type Lieferant = {
    _id: string;
    name: string;
    kontaktperson?: string;
    email?: string;
    telefon?: string;
    bemerkungen?: string;
    bemerkung?: string;
  };
  type Formular = { name: string; kontaktperson: string; email: string; telefon: string; bemerkungen: string };
  const leer = (): Formular => ({ name: '', kontaktperson: '', email: '', telefon: '', bemerkungen: '' });

  let lieferanten = $state<Lieferant[]>([]);
  let suche = $state('');
  let laden = $state(true);
  let speichern = $state(false);
  let fehler = $state('');
  let erfolg = $state('');
  let formularOffen = $state(false);
  let bearbeitenId = $state<string | null>(null);
  let formular = $state<Formular>(leer());
  let loeschenId = $state<string | null>(null);

  const gefiltert = $derived(lieferanten.filter((l) =>
    [l.name, l.kontaktperson ?? '', l.email ?? '', l.telefon ?? '']
      .some((wert) => wert.toLocaleLowerCase('de-CH').includes(suche.trim().toLocaleLowerCase('de-CH')))
  ));

  async function antwortLesen(antwort: Response): Promise<Record<string, unknown>> {
    const daten: unknown = await antwort.json().catch(() => ({}));
    return daten && typeof daten === 'object' && !Array.isArray(daten) ? daten as Record<string, unknown> : {};
  }

  function fehlermeldung(daten: Record<string, unknown>, standard: string): string {
    return typeof daten.fehler === 'string' ? daten.fehler :
      typeof daten.error === 'string' ? daten.error : standard;
  }

  async function ladenAusApi(): Promise<void> {
    laden = true;
    fehler = '';
    try {
      const antwort = await fetch('/api/lieferanten');
      if (!antwort.ok) {
        const daten = await antwortLesen(antwort);
        throw new Error(fehlermeldung(daten, 'Lieferanten konnten nicht geladen werden.'));
      }
      const daten: unknown = await antwort.json();
      const liste = Array.isArray(daten) ? daten :
        daten && typeof daten === 'object' && 'lieferanten' in daten && Array.isArray(daten.lieferanten)
          ? daten.lieferanten : [];
      lieferanten = (liste as Lieferant[]).sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Laden.';
    } finally {
      laden = false;
    }
  }

  function neu(): void {
    bearbeitenId = null;
    formular = leer();
    fehler = '';
    erfolg = '';
    formularOffen = true;
  }

  function bearbeiten(l: Lieferant): void {
    bearbeitenId = l._id;
    formular = {
      name: l.name,
      kontaktperson: l.kontaktperson ?? '',
      email: l.email ?? '',
      telefon: l.telefon ?? '',
      bemerkungen: l.bemerkungen ?? l.bemerkung ?? ''
    };
    fehler = '';
    erfolg = '';
    formularOffen = true;
  }

  async function speichernAusFormular(): Promise<void> {
    if (speichern) return;
    if (!formular.name.trim()) { fehler = 'Bitte einen Lieferantennamen eingeben.'; return; }
    speichern = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/lieferanten', {
        method: bearbeitenId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(bearbeitenId ? { id: bearbeitenId, _id: bearbeitenId } : {}),
          name: formular.name.trim(), kontaktperson: formular.kontaktperson.trim(),
          email: formular.email.trim(), telefon: formular.telefon.trim(),
          bemerkungen: formular.bemerkungen.trim(), bemerkung: formular.bemerkungen.trim() })
      });
      const daten = await antwortLesen(antwort);
      if (!antwort.ok) throw new Error(fehlermeldung(daten, 'Lieferant konnte nicht gespeichert werden.'));
      formularOffen = false;
      erfolg = bearbeitenId ? 'Lieferant wurde aktualisiert.' : 'Lieferant wurde erstellt.';
      await ladenAusApi();
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Speichern.';
    } finally {
      speichern = false;
    }
  }

  async function loeschen(): Promise<void> {
    if (!loeschenId || speichern) return;
    speichern = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/lieferanten', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: loeschenId, _id: loeschenId })
      });
      const daten = await antwortLesen(antwort);
      if (!antwort.ok) throw new Error(fehlermeldung(daten, 'Lieferant konnte nicht gelöscht werden.'));
      loeschenId = null;
      erfolg = 'Lieferant wurde gelöscht.';
      await ladenAusApi();
    } catch (e) {
      loeschenId = null;
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Löschen.';
    } finally {
      speichern = false;
    }
  }

  onMount(() => { void ladenAusApi(); });
</script>
<Aktionsmeldung fehler={fehler} erfolg={erfolg} fehlerSchliessen={() => fehler = ''} erfolgSchliessen={() => erfolg = ''} />

<svelte:head><title>Lieferanten – ClubMatiq</title></svelte:head>

<main>
  <a class="zurueck" href="/stammdaten">← Zurück zu Stammdaten</a>
  <header>
    <div><h1>Lieferanten</h1><p>Lieferanten für Vereinskleider erfassen und verwalten.</p></div>
    <button class="primaer" type="button" onclick={neu}>+ Lieferant erfassen</button>
  </header>

  
  

  <section class="karte">
    <label for="suche">Lieferanten suchen</label>
    <input id="suche" type="search" bind:value={suche} placeholder="Name, Kontaktperson, E-Mail oder Telefon" />
  </section>

  {#if laden}
    <section class="karte">Lieferanten werden geladen ...</section>
  {:else if gefiltert.length === 0}
    <section class="karte leer">{lieferanten.length === 0 ? 'Noch keine Lieferanten erfasst.' : 'Keine passenden Lieferanten gefunden.'}</section>
  {:else}
    <section class="karte tabelle">
      <div class="scroll">
        <table>
          <thead><tr><th>Lieferant</th><th>Kontaktperson</th><th>Kontakt</th><th>Bemerkungen</th><th>Aktionen</th></tr></thead>
          <tbody>
            {#each gefiltert as l (l._id)}
              <tr>
                <td><strong>{l.name}</strong></td>
                <td>{l.kontaktperson || '–'}</td>
                <td>
                  {#if l.email}<a href={`mailto:${l.email}`}>{l.email}</a>{/if}
                  {#if l.telefon}<small>{l.telefon}</small>{/if}
                  {#if !l.email && !l.telefon}–{/if}
                </td>
                <td class="bemerkung">{l.bemerkungen || l.bemerkung || '–'}</td>
                <td><div class="aktionen"><button type="button" class="sekundaer" onclick={() => bearbeiten(l)}>Bearbeiten</button><button type="button" class="gefahr" onclick={() => { loeschenId = l._id; fehler = ''; }}>Löschen</button></div></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <section class="karte hinweis"><h2>Standardlieferant pro Artikel</h2><p>Im nächsten Schritt ergänzen wir die Lieferantenauswahl bei den Kleidungsartikeln. Bereits zugeordnete Lieferanten sollen nicht gelöscht werden können.</p></section>

  {#if formularOffen}
    <div class="overlay" role="presentation">
      <div class="dialog karte" role="dialog" aria-modal="true" aria-labelledby="formular-titel">
        <h2 id="formular-titel">{bearbeitenId ? 'Lieferant bearbeiten' : 'Lieferant erfassen'}</h2>
        <form onsubmit={(ereignis) => { ereignis.preventDefault(); void speichernAusFormular(); }}>
          <label for="name">Name *</label><input id="name" bind:value={formular.name} required maxlength="150" />
          <label for="kontaktperson">Kontaktperson</label><input id="kontaktperson" bind:value={formular.kontaktperson} maxlength="150" />
          <label for="email">E-Mail</label><input id="email" type="email" bind:value={formular.email} maxlength="254" />
          <label for="telefon">Telefon</label><input id="telefon" type="tel" bind:value={formular.telefon} maxlength="80" />
          <label for="bemerkungen">Bemerkungen</label><textarea id="bemerkungen" rows="3" bind:value={formular.bemerkungen} maxlength="2000"></textarea>
          <div class="dialog-aktionen"><button type="button" class="sekundaer" onclick={() => { formularOffen = false; fehler = ''; }} disabled={speichern}>Abbrechen</button><button type="submit" class="primaer" disabled={speichern}>{speichern ? 'Wird gespeichert ...' : 'Speichern'}</button></div>
        </form>
      </div>
    </div>
  {/if}

  {#if loeschenId}
    <div class="overlay" role="presentation">
      <div class="dialog karte" role="dialog" aria-modal="true" aria-labelledby="loeschen-titel">
        <h2 id="loeschen-titel">Lieferant löschen?</h2>
        <p>Der Lieferant wird dauerhaft gelöscht. Bereits verwendete Lieferanten dürfen nicht gelöscht werden.</p>
        <div class="dialog-aktionen"><button type="button" class="sekundaer" onclick={() => loeschenId = null} disabled={speichern}>Abbrechen</button><button type="button" class="gefahr gefahr-voll" onclick={() => void loeschen()} disabled={speichern}>{speichern ? 'Wird gelöscht ...' : 'Löschen bestätigen'}</button></div>
      </div>
    </div>
  {/if}
</main>

<style>
  main { max-width: 1200px; margin: 40px auto; padding: 20px; }
  .zurueck { color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin: 28px 0; }
  h1, h2 { color: #172b4d; }
  h1 { margin: 0 0 8px; }
  header p { margin: 0; color: #64748b; }
  .karte { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin-bottom: 20px; }
  label { display: block; margin: 12px 0 7px; color: #334155; font-size: 14px; font-weight: 600; }
  input, textarea { box-sizing: border-box; width: 100%; padding: 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; background: white; }
  button { font: inherit; cursor: pointer; border-radius: 8px; padding: 10px 14px; font-weight: 600; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primaer { border: 0; color: white; background: #2563eb; }
  .sekundaer { border: 1px solid #cbd5e1; color: #334155; background: white; }
  .gefahr { border: 1px solid #fecaca; color: #b91c1c; background: #fff; }
  .gefahr-voll { background: #b91c1c; color: white; border-color: #b91c1c; }
  .warnung, .erfolg { padding: 12px 16px; border-radius: 8px; }
  .warnung { background: #fffbeb; color: #92400e; }
  .erfolg { background: #ecfdf5; color: #166534; }
  .leer { text-align: center; color: #64748b; padding: 40px; }
  .tabelle { padding: 0; overflow: hidden; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 800px; font-size: 14px; }
  th { text-align: left; background: #f8fafc; color: #475569; font-size: 12px; padding: 14px; }
  td { padding: 14px; border-top: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
  td strong { color: #172b4d; }
  td small { display: block; margin-top: 6px; color: #64748b; }
  td a { color: #2563eb; }
  .aktionen { display: flex; gap: 8px; }
  .bemerkung { max-width: 260px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .hinweis h2 { font-size: 17px; margin-top: 0; }
  .hinweis p { color: #64748b; font-size: 14px; margin-bottom: 0; }
  .overlay { position: fixed; inset: 0; z-index: 100; background: #0f172a99; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .dialog { width: min(100%, 520px); max-height: 90vh; overflow-y: auto; margin: 0; box-sizing: border-box; }
  .dialog h2 { margin-top: 0; }
  .dialog-aktionen { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  @media (max-width: 650px) { main { margin: 20px auto; padding: 16px; } header { flex-direction: column; align-items: stretch; } }
</style>
