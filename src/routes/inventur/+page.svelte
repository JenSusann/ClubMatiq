
<script lang="ts">
  import { onMount } from 'svelte';

  type Inventur = {
    _id: string;
    name: string;
    typ: 'gesamt' | 'lagerort';
    lagerortName: string | null;
    status: string;
    anzahlArtikel: number;
    anzahlPositionen: number;
    erstelltAm: string;
  };

  type Lagerort = {
    _id: string;
    name: string;
  };

  let inventuren = $state<Inventur[]>([]);
  let lagerorte = $state<Lagerort[]>([]);

  let laden = $state(true);
  let speichern = $state(false);
  let fehler = $state('');
  let erfolg = $state('');

  let formularAnzeigen = $state(false);
  let name = $state('');
  let typ = $state<'gesamt' | 'lagerort'>('gesamt');
  let lagerortId = $state('');

  async function datenLaden() {
    laden = true;
    fehler = '';

    try {
      const [inventurenAntwort, lagerorteAntwort] =
        await Promise.all([
          fetch('/api/inventuren'),
          fetch('/api/lagerorte')
        ]);

      if (!inventurenAntwort.ok) {
        const daten = await inventurenAntwort.json();
        throw new Error(
          daten.fehler ?? 'Inventuren konnten nicht geladen werden.'
        );
      }

      if (!lagerorteAntwort.ok) {
        throw new Error(
          'Lagerorte konnten nicht geladen werden.'
        );
      }

      inventuren = await inventurenAntwort.json();
      lagerorte = await lagerorteAntwort.json();
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      laden = false;
    }
  }

  async function inventurErstellen() {
    fehler = '';
    erfolg = '';

    if (!name.trim()) {
      fehler = 'Bitte einen Inventurnamen eingeben.';
      return;
    }

    if (typ === 'lagerort' && !lagerortId) {
      fehler = 'Bitte einen Lagerort auswählen.';
      return;
    }

    speichern = true;

    try {
      const antwort = await fetch('/api/inventuren', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          typ,
          lagerortId: typ === 'lagerort' ? lagerortId : null
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ?? 'Inventur konnte nicht erstellt werden.'
        );
      }

      erfolg = `Inventur erfolgreich erstellt (${daten.anzahlPositionen} Positionen).`;

      name = '';
      typ = 'gesamt';
      lagerortId = '';
      formularAnzeigen = false;

      await datenLaden();
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Inventur konnte nicht erstellt werden.';
    } finally {
      speichern = false;
    }
  }

  function datumFormatieren(datum: string): string {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(datum));
  }

  onMount(() => {
    void datenLaden();
  });
</script>

<svelte:head>
  <title>Inventur | ClubMatiq</title>
</svelte:head>

<div class="seite">
  <div class="kopf">
    <div>
      <h1>Inventur</h1>
      <p>
        Kontrolliere und dokumentiere die Bestände
        deines Vereins.
      </p>
    </div>

    <button
      class="primaer"
      onclick={() => {
        formularAnzeigen = !formularAnzeigen;
        fehler = '';
        erfolg = '';
      }}
    >
      {formularAnzeigen ? 'Abbrechen' : '+ Neue Inventur'}
    </button>
  </div>

  {#if fehler}
    <div class="meldung fehler">{fehler}</div>
  {/if}

  {#if erfolg}
    <div class="meldung erfolg">{erfolg}</div>
  {/if}

  {#if formularAnzeigen}
    <section class="karte">
      <h2>Neue Inventur erstellen</h2>

      <form onsubmit={(event) => {
        event.preventDefault();
        void inventurErstellen();
      }}>
        <div class="feld">
          <label for="inventurname">Inventurname</label>
          <input
            id="inventurname"
            type="text"
            bind:value={name}
            maxlength="150"
            placeholder="z. B. Jahresinventur 2027"
            required
          />
        </div>

        <div class="feld">
          <label for="inventurtyp">Inventurart</label>
          <select id="inventurtyp" bind:value={typ}>
            <option value="gesamt">
              Gesamtinventur – alle Lagerorte
            </option>
            <option value="lagerort">
              Lagerortinventur – ein Lagerort
            </option>
          </select>
        </div>

        {#if typ === 'lagerort'}
          <div class="feld">
            <label for="lagerort">Lagerort</label>
            <select
              id="lagerort"
              bind:value={lagerortId}
              required
            >
              <option value="">Bitte auswählen</option>
              {#each lagerorte as lagerort}
                <option value={lagerort._id}>
                  {lagerort.name}
                </option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="hinweis">
          Beim Erstellen werden die aktuellen Soll-Bestände
          gespeichert. Der tatsächliche Bestand wird erst
          später bei der Zählung erfasst.
        </div>

        <button
          type="submit"
          class="primaer"
          disabled={speichern}
        >
          {speichern ? 'Wird erstellt ...' : 'Inventur erstellen'}
        </button>
      </form>
    </section>
  {/if}

  <section class="karte">
    <h2>Bestehende Inventuren</h2>

    {#if laden}
      <p>Inventuren werden geladen ...</p>
    {:else if inventuren.length === 0}
      <div class="leer">
        <h3>Noch keine Inventuren vorhanden</h3>
        <p>
          Erstelle deine erste Inventur, um die
          Materialbestände zu kontrollieren.
        </p>
      </div>
    {:else}
      <div class="tabelle-container">
        <table>
          <thead>
            <tr>
              <th>Inventur</th>
              <th>Art</th>
              <th>Erstellt</th>
              <th>Positionen</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>

          <tbody>
            {#each inventuren as inventur (inventur._id)}
              <tr>
                <td>
                  <strong>{inventur.name}</strong>
                </td>

                <td>
                  {inventur.typ === 'gesamt'
                    ? 'Gesamtinventur'
                    : inventur.lagerortName ?? 'Lagerort'}
                </td>

                <td>
                  {datumFormatieren(inventur.erstelltAm)}
                </td>

                <td>{inventur.anzahlPositionen}</td>

                <td>
                  <span class="status">
                    {inventur.status === 'offen'
                      ? 'Offen'
                      : inventur.status === 'abgeschlossen'
                        ? 'Abgeschlossen'
                        : inventur.status}
                  </span>
                </td>
                <td>
                  <a
                    class="inventur-link"
                    href={`/inventur/${inventur._id}`}
                  >
                    {inventur.status === 'offen'
                      ? 'Inventur öffnen'
                      : 'Details ansehen'}
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>

<style>
  .seite {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 28px;
  }

  h1 {
    font-size: 30px;
    margin: 0 0 8px;
    color: #172b4d;
  }

  .inventur-link {
    display: inline-block;
    padding: 9px 14px;
    background: #172b4d;
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .inventur-link:hover {
    background: #25436e;
  }

  h2 {
    font-size: 20px;
    margin: 0 0 24px;
    color: #172b4d;
  }

  h3 {
    margin-bottom: 8px;
  }

  p {
    color: #64748b;
    margin: 0;
  }

  .karte {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 24px;
  }

  .primaer {
    background: #172b4d;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    cursor: pointer;
    font-weight: 600;
  }

  .primaer:hover:not(:disabled) {
    background: #25436e;
  }

  .primaer:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  form {
    max-width: 550px;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  label {
    font-weight: 600;
    color: #334155;
  }

  input,
  select {
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .hinweis {
    background: #f1f5f9;
    padding: 14px;
    border-radius: 8px;
    color: #475569;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .meldung {
    padding: 14px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .fehler {
    background: #fee2e2;
    color: #991b1b;
  }

  .erfolg {
    background: #dcfce7;
    color: #166534;
  }

  .tabelle-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 14px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
  }

  .status {
    display: inline-block;
    background: #fef3c7;
    color: #92400e;
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .leer {
    text-align: center;
    padding: 50px 20px;
  }

  .leer p {
    margin-top: 8px;
  }

  @media (max-width: 700px) {
    .seite {
      padding: 20px 14px;
    }

    .kopf {
      flex-direction: column;
      align-items: stretch;
    }

    .primaer {
      width: 100%;
    }

    .karte {
      padding: 18px;
    }
  }
</style>
