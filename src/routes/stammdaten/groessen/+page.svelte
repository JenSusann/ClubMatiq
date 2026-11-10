
<script lang="ts">
  type Groesse = {
    _id: string;
    bezeichnung: string;
    sortierung: number;
  };

  let groessen = $state<Groesse[]>([]);
  let bezeichnung = $state('');
  let sortierung = $state(10);
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let wirdGespeichert = $state(false);

  let bearbeitenId = $state<string | null>(null);
  let bearbeitenBezeichnung = $state('');
  let bearbeitenSortierung = $state(10);

  // Grössen aus MongoDB laden
  async function groessenLaden() {
    try {
      const antwort = await fetch('/api/groessen');

      if (!antwort.ok) {
        throw new Error('Laden fehlgeschlagen.');
      }

      groessen = await antwort.json();
    } catch {
      fehlermeldung = 'Grössen konnten nicht geladen werden.';
    }
  }

  // Neue Grösse erstellen
  async function groesseHinzufuegen() {
    if (!bezeichnung.trim()) {
      fehlermeldung = 'Bitte eine Grössenbezeichnung eingeben.';
      return;
    }

    wirdGespeichert = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch('/api/groessen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bezeichnung: bezeichnung.trim(),
          sortierung: Number(sortierung)
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Speichern fehlgeschlagen.');
      }

      bezeichnung = '';
      sortierung = Number(sortierung) + 10;
      erfolgsmeldung = 'Grösse erfolgreich erstellt.';

      await groessenLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Grösse konnte nicht gespeichert werden.';
    } finally {
      wirdGespeichert = false;
    }
  }

  // Bearbeitungsmodus aktivieren
  function bearbeitenStarten(groesse: Groesse) {
    bearbeitenId = groesse._id;
    bearbeitenBezeichnung = groesse.bezeichnung;
    bearbeitenSortierung = groesse.sortierung;

    fehlermeldung = '';
    erfolgsmeldung = '';
  }

  // Änderungen speichern
  async function groesseSpeichern(id: string) {
    if (!bearbeitenBezeichnung.trim()) {
      fehlermeldung = 'Die Grössenbezeichnung darf nicht leer sein.';
      return;
    }

    wirdGespeichert = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch(`/api/groessen/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bezeichnung: bearbeitenBezeichnung.trim(),
          sortierung: Number(bearbeitenSortierung)
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Bearbeiten fehlgeschlagen.');
      }

      bearbeitenId = null;
      erfolgsmeldung = 'Grösse erfolgreich aktualisiert.';

      await groessenLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Bearbeiten fehlgeschlagen.';
    } finally {
      wirdGespeichert = false;
    }
  }

  // Grösse löschen
  async function groesseLoeschen(groesse: Groesse) {
    const bestaetigt = confirm(
      `Möchtest du die Grösse "${groesse.bezeichnung}" wirklich löschen?`
    );

    if (!bestaetigt) return;

    fehlermeldung = '';
    erfolgsmeldung = '';
    wirdGespeichert = true;

    try {
      const antwort = await fetch(
        `/api/groessen/${groesse._id}`,
        { method: 'DELETE' }
      );

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Löschen fehlgeschlagen.');
      }

      erfolgsmeldung = 'Grösse erfolgreich gelöscht.';
      await groessenLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Löschen fehlgeschlagen.';
    } finally {
      wirdGespeichert = false;
    }
  }

  $effect(() => {
    groessenLaden();
  });
</script>

<svelte:head>
  <title>Kleidergrössen – ClubMatiq</title>
</svelte:head>

<main>
  <a href="/stammdaten" class="zurueck">
    ← Zurück zur Stammdatenverwaltung
  </a>

  <h1>Kleidergrössenverwaltung</h1>
  <p>Erstelle, bearbeite und verwalte die Grössen deiner Vereinskleider.</p>

  <section class="bereich">
    <h2>Neue Grösse erfassen</h2>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        groesseHinzufuegen();
      }}
    >
      <div class="feld">
        <label for="bezeichnung">Grösse</label>
        <input
          id="bezeichnung"
          type="text"
          placeholder="z. B. M oder 152"
          bind:value={bezeichnung}
        />
      </div>

      <div class="feld sortierung">
        <label for="sortierung">Sortierung</label>
        <input
          id="sortierung"
          type="number"
          min="0"
          step="1"
          bind:value={sortierung}
        />
      </div>

      <button type="submit" disabled={wirdGespeichert}>
        Hinzufügen
      </button>
    </form>
  </section>

  {#if fehlermeldung}
    <p class="meldung fehler" role="alert">{fehlermeldung}</p>
  {/if}

  {#if erfolgsmeldung}
    <p class="meldung erfolg" role="status">{erfolgsmeldung}</p>
  {/if}

  <section class="bereich">
    <h2>Vorhandene Grössen</h2>

    {#if groessen.length === 0}
      <p>Noch keine Grössen vorhanden.</p>
    {:else}
      <div class="liste">
        {#each groessen as groesse (groesse._id)}
          <div class="groesse">
            {#if bearbeitenId === groesse._id}
              <div class="bearbeiten-feld">
                <label for="name-{groesse._id}">Grösse</label>
                <input
                  id="name-{groesse._id}"
                  type="text"
                  bind:value={bearbeitenBezeichnung}
                />
              </div>

              <div class="bearbeiten-feld sortierung">
                <label for="sort-{groesse._id}">Sortierung</label>
                <input
                  id="sort-{groesse._id}"
                  type="number"
                  min="0"
                  step="1"
                  bind:value={bearbeitenSortierung}
                />
              </div>

              <button
                onclick={() => groesseSpeichern(groesse._id)}
                disabled={wirdGespeichert}
              >
                Speichern
              </button>

              <button
                class="sekundaer"
                onclick={() => (bearbeitenId = null)}
                disabled={wirdGespeichert}
              >
                Abbrechen
              </button>
            {:else}
              <span class="name">{groesse.bezeichnung}</span>

              <span class="nummer">
                Sortierung: {groesse.sortierung}
              </span>

              <button
                class="sekundaer"
                onclick={() => bearbeitenStarten(groesse)}
                disabled={wirdGespeichert}
              >
                Bearbeiten
              </button>

              <button
                class="loeschen"
                onclick={() => groesseLoeschen(groesse)}
                disabled={wirdGespeichert}
              >
                Löschen
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 1100px;
    margin: 40px auto;
    padding: 20px;
  }

  .zurueck {
    display: inline-block;
    margin-bottom: 25px;
    color: #64748b;
    text-decoration: none;
  }

  h1 {
    color: #172b4d;
    margin-bottom: 10px;
  }

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    margin-top: 25px;
  }

  form, .groesse {
    display: flex;
    align-items: end;
    gap: 12px;
  }

  form {
    margin-top: 20px;
  }

  .feld, .bearbeiten-feld {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
  }

  .sortierung {
    flex: 0 0 140px;
  }

  label {
    font-size: 14px;
    font-weight: 500;
  }

  input {
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    min-width: 0;
  }

  button {
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    background: #172b4d;
    color: white;
    cursor: pointer;
    white-space: nowrap;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sekundaer {
    background: #e2e8f0;
    color: #172b4d;
  }

  .loeschen {
    background: #dc2626;
  }

  .liste {
    margin-top: 20px;
  }

  .groesse {
    padding: 15px 0;
    border-bottom: 1px solid #e2e8f0;
    align-items: center;
  }

  .name {
    flex: 1;
    font-weight: 600;
  }

  .nummer {
    min-width: 140px;
    color: #64748b;
    font-size: 14px;
  }

  .meldung {
    padding: 12px;
    border-radius: 8px;
    margin-top: 15px;
  }

  .fehler {
    background: #fee2e2;
    color: #991b1b;
  }

  .erfolg {
    background: #dcfce7;
    color: #166534;
  }

  @media (max-width: 750px) {
    form, .groesse {
      flex-wrap: wrap;
    }

    .feld, .bearbeiten-feld {
      flex-basis: 100%;
    }

    .name {
      flex-basis: 100%;
    }
  }
</style>
