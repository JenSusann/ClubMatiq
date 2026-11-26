<script lang="ts">
  import Aktionsmeldung from '../../../lib/Aktionsmeldung.svelte';
  let importMeldung = $state('');
  import { onMount } from 'svelte';

  type Mitglied = {
    _id: string;
    clubdeskId: string;
    anrede: string;
    nachname: string;
    vorname: string;
    anzeigename: string;
    adresse: string;
    plz: string;
    ort: string;
    status: string;
    aktiv: boolean;
    riegen?: string[];
    bereiche?: string[];
    clubdeskHauptgruppe?: string;
    clubdeskGruppen?: string[];
    clubdeskGruppendetails?: { gruppe: string; funktion: string | null }[];
  };

  type ImportErgebnis = {
    erfolg: boolean;
    eingelesen: number;
    neu: number;
    aktualisiert: number;
    unveraendert: number;
    hinweis?: string;
  };

  let mitglieder = $state<Mitglied[]>([]);
  let suche = $state('');
  let riege = $state('');
  let bereich = $state('');
  let riegen = $state<{ name: string; aktiv: boolean }[]>([]);
  async function riegenLaden() {
    try {
      const antwort = await fetch('/api/riegen');
      if (!antwort.ok) throw new Error('Riegen konnten nicht geladen werden.');
      riegen = await antwort.json();
    } catch (e) {
      fehlermeldung = e instanceof Error ? e.message : 'Riegen konnten nicht geladen werden.';
    }
  }
  let datei = $state<File | null>(null);
  let laden = $state(false);
  let importieren = $state(false);
  let fehlermeldung = $state('');
  let importFehler = $state('');
  let importErgebnis = $state<ImportErgebnis | null>(null);
  let dateiEingabe: HTMLInputElement;
  let letzteAnfrage = 0;

  function fehlerText(daten: unknown, standard: string): string {
    if (daten && typeof daten === 'object') {
      const eintrag = daten as Record<string, unknown>;
      if (typeof eintrag.fehler === 'string') return eintrag.fehler;
      if (typeof eintrag.message === 'string') return eintrag.message;
    }
    return standard;
  }

  async function mitgliederLaden(): Promise<void> {
    const anfrage = ++letzteAnfrage;
    laden = true;
    fehlermeldung = '';
    try {
      const antwort = await fetch(`/api/mitglieder?details=1&suche=${encodeURIComponent(suche.trim())}&riege=${encodeURIComponent(riege)}&bereich=${encodeURIComponent(bereich)}`);
      const daten: unknown = await antwort.json();
      if (!antwort.ok) throw new Error(fehlerText(daten, 'Mitglieder konnten nicht geladen werden.'));
      if (!Array.isArray(daten)) throw new Error('Unerwartete Antwort vom Server.');
      if (anfrage === letzteAnfrage) mitglieder = daten as Mitglied[];
    } catch (fehler) {
      if (anfrage === letzteAnfrage) {
        fehlermeldung = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.';
        mitglieder = [];
      }
    } finally {
      if (anfrage === letzteAnfrage) laden = false;
    }
  }

  function dateiAuswaehlen(ereignis: Event): void {
    const eingabe = ereignis.currentTarget as HTMLInputElement;
    datei = eingabe.files?.[0] ?? null;
    importErgebnis = null;
    importMeldung = '';
    importFehler = '';
  }

  async function csvImportieren(): Promise<void> {
    if (!datei || importieren) return;
    importieren = true;
    importFehler = '';
    importErgebnis = null;
    importMeldung = '';
    try {
      const formular = new FormData();
      formular.append('datei', datei);
      const antwort = await fetch('/api/mitglieder', { method: 'POST', body: formular });
      const daten: unknown = await antwort.json();
      if (!antwort.ok) throw new Error(fehlerText(daten, 'Der CSV-Import ist fehlgeschlagen.'));
      importErgebnis = daten as ImportErgebnis;
      importMeldung = 'Mitgliederimport erfolgreich abgeschlossen.';
      datei = null;
      if (dateiEingabe) dateiEingabe.value = '';
      await mitgliederLaden();
    } catch (fehler) {
      importFehler = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler beim Import.';
    } finally {
      importieren = false;
    }
  }

  onMount(() => {
    void mitgliederLaden();
    void riegenLaden();
  });
</script>
<Aktionsmeldung fehler={importFehler || fehlermeldung} erfolg={importMeldung} fehlerSchliessen={() => { importFehler = ''; fehlermeldung = ''; }} erfolgSchliessen={() => importMeldung = ''} />

<svelte:head>
  <title>Mitglieder | ClubMatiq</title>
  <meta name="description" content="ClubDesk-Mitglieder importieren und durchsuchen" />
</svelte:head>

<main class="seite">
  <a class="zurueck" href="/stammdaten">← Zurück zu Stammdaten</a>
  <header>
    <h1>Mitglieder</h1>
    <p>Importiere Mitglieder aus ClubDesk und finde sie anschliessend über die Suche.</p>
  </header>

  <section class="karte" aria-labelledby="import-titel">
    <h2 id="import-titel">ClubDesk-CSV importieren</h2>
    <p>Exportiere deine Mitglieder in ClubDesk als CSV-Datei. Importiert werden Anrede, Nachname, Vorname, Adresse, Ort, PLZ, ID und Status. Das Feld «aktiv» wird beim Import auf «Ja» gesetzt.</p>
    <p class="hinweis">Bestehende Mitglieder mit derselben ClubDesk-ID werden aktualisiert. Mitglieder, die in der CSV fehlen, bleiben gespeichert. ClubDesk-Gruppen und Funktionen werden übernommen. Mehrfache Einträge mit derselben ID und demselben Namen werden zusammengeführt.</p>
    <form onsubmit={(ereignis) => { ereignis.preventDefault(); void csvImportieren(); }}>
      <label for="csv-datei">CSV-Datei auswählen (max. 5 MB)</label>
      <input id="csv-datei" type="file" accept=".csv,text/csv" bind:this={dateiEingabe} onchange={dateiAuswaehlen} />
      <button type="submit" disabled={!datei || importieren}>{importieren ? 'Wird importiert …' : 'CSV importieren'}</button>
    </form>
    {#if importFehler}
      <p class="meldung fehler" role="alert">{importFehler}</p>
    {/if}
    {#if importErgebnis}
      <div class="meldung erfolg" role="status">
        <strong>Import abgeschlossen.</strong>
        {importErgebnis.eingelesen} eingelesen · {importErgebnis.neu} neu · {importErgebnis.aktualisiert} aktualisiert · {importErgebnis.unveraendert} unverändert.
      </div>
    {/if}
  </section>

  <section class="karte" aria-labelledby="liste-titel">
    <div class="listen-kopf">
      <div>
        <h2 id="liste-titel">Mitgliederübersicht</h2>
        <p class="hinweis">Die API zeigt maximal 50 aktive Mitglieder pro Suche an. Suche nach Vorname, Nachname oder ClubDesk-ID.</p>
      </div>
      <button type="button" class="sekundaer" onclick={() => void mitgliederLaden()} disabled={laden}>Aktualisieren</button>
    </div>
    <form class="suche" onsubmit={(ereignis) => { ereignis.preventDefault(); void mitgliederLaden(); }}>
      <label for="mitglied-suche">Mitglied suchen</label>
      <div class="filter">
        <label>Riege
          <select bind:value={riege} onchange={() => void mitgliederLaden()}>
            <option value="">Alle Riegen</option>
            <option value="__ohne">Nicht zugeordnet</option>
            {#each riegen.filter(r => r.aktiv) as r}<option value={r.name}>{r.name}</option>{/each}
          </select>
        </label>
        <label>Bereich
          <select bind:value={bereich} onchange={() => void mitgliederLaden()}>
            <option value="">Alle Bereiche</option>
            <option value="juko">JUKO</option>
            <option value="aktive">Aktivriege</option>
          </select>
        </label>
      </div>
      <div class="suchzeile">
        <input id="mitglied-suche" type="search" placeholder="Name oder ClubDesk-ID" bind:value={suche} />
        <button type="submit" disabled={laden}>{laden ? 'Suche …' : 'Suchen'}</button>
      </div>
    </form>

    {#if fehlermeldung}
      <p class="meldung fehler" role="alert">{fehlermeldung}</p>
    {:else if laden}
      <p class="hinweis" role="status">Mitglieder werden geladen …</p>
    {:else if mitglieder.length === 0}
      <p class="hinweis">Keine Mitglieder gefunden. Importiere eine CSV-Datei oder ändere die Suche.</p>
    {:else}
      <div class="tabellenbereich">
        <table>
          <thead>
            <tr><th>Anrede</th><th>Nachname</th><th>Vorname</th><th>Adresse</th><th>PLZ</th><th>Ort</th><th>ClubDesk-ID</th><th>Status</th><th>Aktiv</th><th>Riegen</th><th>Bereich</th><th>ClubDesk-Gruppen</th></tr>
          </thead>
          <tbody>
            {#each mitglieder as mitglied (mitglied._id)}
              <tr>
                <td>{mitglied.anrede || '–'}</td>
                <td>{mitglied.nachname || '–'}</td>
                <td>{mitglied.vorname || '–'}</td>
                <td>{mitglied.adresse || '–'}</td>
                <td>{mitglied.plz || '–'}</td>
                <td>{mitglied.ort || '–'}</td>
                <td>{mitglied.clubdeskId}</td>
                <td>{mitglied.status || '–'}</td>
                <td>{mitglied.aktiv ? 'Ja' : 'Nein'}</td>
                <td>{mitglied.riegen?.join(', ') || 'Nicht zugeordnet'}</td>
                <td>{mitglied.bereiche?.map(b => b === 'juko' ? 'JUKO' : 'Aktivriege').join(', ') || '–'}</td>
                <td><details><summary>Gruppen anzeigen</summary>
                  {#if mitglied.clubdeskHauptgruppe}<p>Hauptgruppe: {mitglied.clubdeskHauptgruppe}</p>{/if}
                  {#if mitglied.clubdeskGruppendetails?.length}
                    {#each mitglied.clubdeskGruppendetails as g}<div>{g.gruppe}{g.funktion ? ' (' + g.funktion + ')' : ''}</div>{/each}
                  {:else}
                    {#each mitglied.clubdeskGruppen ?? [] as g}<div>{g}</div>{/each}
                  {/if}
                </details></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="hinweis">{mitglieder.length} Mitglied(er) angezeigt.</p>
    {/if}
  </section>
</main>

<style>
  .seite { max-width: 1200px; margin: 0 auto; padding: 2rem 1.25rem 4rem; color: var(--text, #1e293b); }
  .zurueck { color: #2563eb; text-decoration: none; font-weight: 600; }
  header { margin: 1.5rem 0; }
  h1 { font-size: 2rem; margin: 0 0 .5rem; }
  h2 { font-size: 1.2rem; margin: 0 0 .7rem; }
  p { line-height: 1.55; }
  .karte { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 12px #0f172a0a; }
  .hinweis { color: #64748b; font-size: .92rem; }
  form { margin-top: 1.2rem; }
  label { display: block; font-weight: 600; margin-bottom: .5rem; }
  input[type="file"], input[type="search"] { border: 1px solid #cbd5e1; border-radius: 8px; padding: .75rem; background: #fff; font: inherit; max-width: 100%; }
  input[type="file"] { display: block; width: 100%; margin-bottom: 1rem; }
  input[type="search"] { flex: 1; min-width: 0; }
  button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: .75rem 1.2rem; font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .sekundaer { background: #eff6ff; color: #1d4ed8; }
  .listen-kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .suche { margin-bottom: 1.2rem; }
  .filter { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: .75rem; }
  .filter select { display: block; padding: .5rem; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
  details summary { cursor: pointer; color: #2563eb; }
  .suchzeile { display: flex; gap: .6rem; }
  .tabellenbereich { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { text-align: left; padding: .8rem .65rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  th { background: #f8fafc; font-weight: 700; }
  .meldung { border-radius: 8px; padding: .9rem 1rem; margin-top: 1rem; }
  .fehler { background: #fef2f2; color: #991b1b; }
  .erfolg { background: #f0fdf4; color: #166534; }
  @media (max-width: 600px) { .seite { padding: 1.25rem .75rem 3rem; } .karte { padding: 1rem; } .listen-kopf { flex-direction: column; } .suchzeile { flex-direction: column; } }
</style>
