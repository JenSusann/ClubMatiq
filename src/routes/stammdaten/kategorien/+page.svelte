
<script lang="ts">
  type Kategorie = {
    _id: string;
    name: string;
  };

  let kategorien = $state<Kategorie[]>([]);
  let neuerName = $state('');
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let wirdGespeichert = $state(false);

  let bearbeitenId = $state<string | null>(null);
  let bearbeitenName = $state('');

  // Kategorien aus MongoDB laden
  async function kategorienLaden() {
    try {
      const antwort = await fetch('/api/kategorien');

      if (!antwort.ok) {
        throw new Error('Laden fehlgeschlagen');
      }

      kategorien = await antwort.json();
    } catch {
      fehlermeldung = 'Kategorien konnten nicht geladen werden.';
    }
  }

  // Neue Kategorie erstellen
  async function kategorieHinzufuegen() {
    if (!neuerName.trim()) {
      fehlermeldung = 'Bitte einen Kategorienamen eingeben.';
      return;
    }

    wirdGespeichert = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch('/api/kategorien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: neuerName.trim() })
      });

      if (!antwort.ok) {
        throw new Error('Speichern fehlgeschlagen');
      }

      neuerName = '';
      erfolgsmeldung = 'Kategorie erfolgreich erstellt.';
      await kategorienLaden();
    } catch {
      fehlermeldung = 'Kategorie konnte nicht gespeichert werden.';
    } finally {
      wirdGespeichert = false;
    }
  }

  // Bearbeitungsmodus aktivieren
  function bearbeitenStarten(kategorie: Kategorie) {
    bearbeitenId = kategorie._id;
    bearbeitenName = kategorie.name;
    fehlermeldung = '';
    erfolgsmeldung = '';
  }

  // Kategorie bearbeiten
  async function kategorieSpeichern(id: string) {
    if (!bearbeitenName.trim()) {
      fehlermeldung = 'Der Kategoriename darf nicht leer sein.';
      return;
    }

    wirdGespeichert = true;
    fehlermeldung = '';

    try {
      const antwort = await fetch(`/api/kategorien/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bearbeitenName.trim() })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Bearbeiten fehlgeschlagen');
      }

      bearbeitenId = null;
      erfolgsmeldung = 'Kategorie erfolgreich aktualisiert.';
      await kategorienLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error ? error.message : 'Bearbeiten fehlgeschlagen.';
    } finally {
      wirdGespeichert = false;
    }
  }

  // Kategorie löschen
  async function kategorieLoeschen(kategorie: Kategorie) {
    const bestaetigt = confirm(
      `Möchtest du die Kategorie "${kategorie.name}" wirklich löschen?`
    );

    if (!bestaetigt) return;

    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch(
        `/api/kategorien/${kategorie._id}`,
        { method: 'DELETE' }
      );

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Löschen fehlgeschlagen');
      }

      erfolgsmeldung = 'Kategorie erfolgreich gelöscht.';
      await kategorienLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error ? error.message : 'Löschen fehlgeschlagen.';
    }
  }

  $effect(() => {
    kategorienLaden();
  });
</script>

<svelte:head>
  <title>Kategorien – ClubMatiq</title>
</svelte:head>

<main>
  <a href="/stammdaten" class="zurueck">
    ← Zurück zur Stammdatenverwaltung
  </a>

  <h1>Kategorienverwaltung</h1>
  <p>Erstelle, bearbeite und verwalte deine Materialkategorien.</p>

  <section class="bereich">
    <h2>Neue Kategorie erfassen</h2>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        kategorieHinzufuegen();
      }}
    >
      <input
        type="text"
        placeholder="z. B. Turnmaterial"
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
    <h2>Vorhandene Kategorien</h2>

    {#if kategorien.length === 0}
      <p>Noch keine Kategorien vorhanden.</p>
    {:else}
      <div class="liste">
        {#each kategorien as kategorie (kategorie._id)}
          <div class="kategorie">
            {#if bearbeitenId === kategorie._id}
              <input
                type="text"
                bind:value={bearbeitenName}
                aria-label="Kategoriename bearbeiten"
              />

              <button
                onclick={() => kategorieSpeichern(kategorie._id)}
                disabled={wirdGespeichert}
              >
                Speichern
              </button>

              <button
                class="sekundaer"
                onclick={() => (bearbeitenId = null)}
              >
                Abbrechen
              </button>
            {:else}
              <span class="name">{kategorie.name}</span>

              <button
                class="sekundaer"
                onclick={() => bearbeitenStarten(kategorie)}
              >
                Bearbeiten
              </button>

              <button
                class="loeschen"
                onclick={() => kategorieLoeschen(kategorie)}
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
  }

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    margin-top: 25px;
  }

  form, .kategorie {
    display: flex;
    gap: 12px;
    align-items: center;
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

  .kategorie {
    padding: 15px 0;
    border-bottom: 1px solid #e2e8f0;
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
    color: #991b1b;
    background: #fee2e2;
  }

  .erfolg {
    color: #166534;
    background: #dcfce7;
  }

  @media (max-width: 650px) {
    form, .kategorie {
      flex-wrap: wrap;
    }

    .name {
      flex-basis: 100%;
    }
  }
</style>
