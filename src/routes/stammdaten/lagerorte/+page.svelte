
<script lang="ts">
  type Lagerort = {
    _id: string;
    name: string;
  };

  let lagerorte = $state<Lagerort[]>([]);
  let neuerName = $state('');
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let wirdGespeichert = $state(false);

  let bearbeitenId = $state<string | null>(null);
  let bearbeitenName = $state('');

  // Lagerorte aus MongoDB laden
  async function lagerorteLaden() {
    try {
      const antwort = await fetch('/api/lagerorte');

      if (!antwort.ok) {
        throw new Error('Laden fehlgeschlagen');
      }

      lagerorte = await antwort.json();
    } catch {
      fehlermeldung = 'Lagerorte konnten nicht geladen werden.';
    }
  }

  // Neuen Lagerort erstellen
  async function lagerortHinzufuegen() {
    if (!neuerName.trim()) {
      fehlermeldung = 'Bitte einen Lagerortnamen eingeben.';
      return;
    }

    wirdGespeichert = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch('/api/lagerorte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: neuerName.trim() })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Speichern fehlgeschlagen.');
      }

      neuerName = '';
      erfolgsmeldung = 'Lagerort erfolgreich erstellt.';
      await lagerorteLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Lagerort konnte nicht gespeichert werden.';
    } finally {
      wirdGespeichert = false;
    }
  }

  // Bearbeitungsmodus starten
  function bearbeitenStarten(lagerort: Lagerort) {
    bearbeitenId = lagerort._id;
    bearbeitenName = lagerort.name;
    fehlermeldung = '';
    erfolgsmeldung = '';
  }

  // Änderungen speichern
  async function lagerortSpeichern(id: string) {
    if (!bearbeitenName.trim()) {
      fehlermeldung = 'Der Lagerortname darf nicht leer sein.';
      return;
    }

    wirdGespeichert = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch(`/api/lagerorte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bearbeitenName.trim() })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Bearbeiten fehlgeschlagen.');
      }

      bearbeitenId = null;
      erfolgsmeldung = 'Lagerort erfolgreich aktualisiert.';
      await lagerorteLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Bearbeiten fehlgeschlagen.';
    } finally {
      wirdGespeichert = false;
    }
  }

  // Lagerort löschen
  async function lagerortLoeschen(lagerort: Lagerort) {
    const bestaetigt = confirm(
      `Möchtest du den Lagerort "${lagerort.name}" wirklich löschen?`
    );

    if (!bestaetigt) return;

    fehlermeldung = '';
    erfolgsmeldung = '';
    wirdGespeichert = true;

    try {
      const antwort = await fetch(
        `/api/lagerorte/${lagerort._id}`,
        { method: 'DELETE' }
      );

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Löschen fehlgeschlagen.');
      }

      erfolgsmeldung = 'Lagerort erfolgreich gelöscht.';
      await lagerorteLaden();
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
    lagerorteLaden();
  });
</script>

<svelte:head>
  <title>Lagerorte – ClubMatiq</title>
</svelte:head>

<main>
  <a href="/stammdaten" class="zurueck">
    ← Zurück zur Stammdatenverwaltung
  </a>

  <h1>Lagerortverwaltung</h1>
  <p>Erstelle, bearbeite und verwalte die Lagerorte deines Vereins.</p>

  <section class="bereich">
    <h2>Neuen Lagerort erfassen</h2>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        lagerortHinzufuegen();
      }}
    >
      <input
        type="text"
        placeholder="z. B. Materialraum Schlüechti"
        bind:value={neuerName}
      />

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
    <h2>Vorhandene Lagerorte</h2>

    {#if lagerorte.length === 0}
      <p>Noch keine Lagerorte vorhanden.</p>
    {:else}
      <div class="liste">
        {#each lagerorte as lagerort (lagerort._id)}
          <div class="lagerort">
            {#if bearbeitenId === lagerort._id}
              <input
                type="text"
                bind:value={bearbeitenName}
                aria-label="Lagerortname bearbeiten"
              />

              <button
                onclick={() => lagerortSpeichern(lagerort._id)}
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
              <span class="symbol">📍</span>
              <span class="name">{lagerort.name}</span>

              <button
                class="sekundaer"
                onclick={() => bearbeitenStarten(lagerort)}
                disabled={wirdGespeichert}
              >
                Bearbeiten
              </button>

              <button
                class="loeschen"
                onclick={() => lagerortLoeschen(lagerort)}
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

  form, .lagerort {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  form {
    margin-top: 20px;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
  }

  button {
    background: #172b4d;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
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

  .lagerort {
    padding: 15px 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .symbol {
    font-size: 20px;
  }

  .name {
    flex: 1;
    font-weight: 500;
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

  @media (max-width: 650px) {
    form, .lagerort {
      flex-wrap: wrap;
    }

    .name {
      flex-basis: 100%;
    }
  }
</style>
