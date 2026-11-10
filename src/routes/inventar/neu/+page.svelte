
<script lang="ts">
  import { onMount } from 'svelte';

  type Stammdatum = {
    _id: string;
    name: string;
  };

  type Groesse = {
    _id: string;
    bezeichnung: string;
    sortierung: number;
  };

  let kategorien = $state<Stammdatum[]>([]);
  let lagerorte = $state<Stammdatum[]>([]);
  let groessen = $state<Groesse[]>([]);

  let name = $state('');
  let kategorieId = $state('');
  let lagerortId = $state('');
  let menge = $state(0);
  let einzelwert = $state(0);
  let beschreibung = $state('');
  let hatGroessen = $state(false);

  // Bestände und Einzelwerte pro Grösse
  let groessenBestaende = $state<Record<string, number>>({});
  let groessenEinzelwerte = $state<Record<string, number>>({});

  // Wert, der auf alle Grössen übertragen werden kann
  let standardEinzelwert = $state(0);

  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let wirdGespeichert = $state(false);
  let wirdGeladen = $state(true);

  let gesamtmenge = $derived(
    hatGroessen
      ? Object.values(groessenBestaende).reduce(
          (summe, bestand) => summe + (Number(bestand) || 0),
          0
        )
      : Number(menge) || 0
  );

  let inventarwert = $derived(
    hatGroessen
      ? groessen.reduce(
          (summe, groesse) =>
            summe +
            Number(groessenBestaende[groesse._id] ?? 0) *
              Number(groessenEinzelwerte[groesse._id] ?? 0),
          0
        )
      : Number(menge || 0) * Number(einzelwert || 0)
  );

  function formatiereCHF(wert: number) {
    return wert.toLocaleString('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Einzelwert für alle Grössen übernehmen
  function einzelwertUebernehmen() {
    if (
      !Number.isFinite(standardEinzelwert) ||
      standardEinzelwert < 0
    ) {
      fehlermeldung = 'Bitte einen gültigen Einzelwert eingeben.';
      return;
    }

    fehlermeldung = '';

    groessenEinzelwerte = Object.fromEntries(
      groessen.map((groesse) => [
        groesse._id,
        Number(standardEinzelwert)
      ])
    );
  }

  onMount(async () => {
    try {
      const antworten = await Promise.all([
        fetch('/api/kategorien'),
        fetch('/api/lagerorte'),
        fetch('/api/groessen')
      ]);

      if (antworten.some((antwort) => !antwort.ok)) {
        throw new Error('Stammdaten konnten nicht geladen werden.');
      }

      const [k, l, g] = await Promise.all(
        antworten.map((antwort) => antwort.json())
      );

      kategorien = k;
      lagerorte = l;
      groessen = g;

      groessenBestaende = Object.fromEntries(
        groessen.map((groesse) => [groesse._id, 0])
      );

      groessenEinzelwerte = Object.fromEntries(
        groessen.map((groesse) => [groesse._id, 0])
      );
    } catch (error) {
      fehlermeldung =
        error instanceof Error ? error.message : 'Laden fehlgeschlagen.';
    } finally {
      wirdGeladen = false;
    }
  });

  async function artikelSpeichern() {
    fehlermeldung = '';
    erfolgsmeldung = '';

    if (!name.trim() || !kategorieId || !lagerortId) {
      fehlermeldung =
        'Bitte Artikelbezeichnung, Kategorie und Lagerort ausfüllen.';
      return;
    }

    if (
      !Number.isFinite(einzelwert) ||
      einzelwert < 0 ||
      !Number.isInteger(gesamtmenge) ||
      gesamtmenge < 0
    ) {
      fehlermeldung = 'Bitte gültige Mengen und Einzelwerte eingeben.';
      return;
    }

    if (hatGroessen && groessen.length === 0) {
      fehlermeldung = 'Es sind noch keine Grössen erfasst.';
      return;
    }

    if (hatGroessen) {
      for (const groesse of groessen) {
        const bestand = Number(
          groessenBestaende[groesse._id] ?? 0
        );

        const wert = Number(
          groessenEinzelwerte[groesse._id] ?? 0
        );

        if (
          !Number.isInteger(bestand) ||
          bestand < 0 ||
          !Number.isFinite(wert) ||
          wert < 0
        ) {
          fehlermeldung =
            'Bitte alle Grössenbestände und Einzelwerte überprüfen.';
          return;
        }
      }
    }

    wirdGespeichert = true;

    try {
      const varianten = hatGroessen
        ? groessen.map((groesse) => ({
            groesseId: groesse._id,
            menge: Number(
              groessenBestaende[groesse._id] ?? 0
            ),
            einzelwert: Number(
              groessenEinzelwerte[groesse._id] ?? 0
            )
          }))
        : [];

      const antwort = await fetch('/api/artikel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          kategorieId,
          lagerortId,
          menge: gesamtmenge,
          einzelwert: hatGroessen ? 0 : Number(einzelwert),
          beschreibung,
          hatGroessen,
          varianten
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler || 'Artikel konnte nicht gespeichert werden.'
        );
      }

      erfolgsmeldung =
        `Artikel erfolgreich gespeichert (${daten.gesamtmenge} Stück).`;

      // Formular zurücksetzen
      name = '';
      kategorieId = '';
      lagerortId = '';
      menge = 0;
      einzelwert = 0;
      standardEinzelwert = 0;
      beschreibung = '';
      hatGroessen = false;

      groessenBestaende = Object.fromEntries(
        groessen.map((groesse) => [groesse._id, 0])
      );

      groessenEinzelwerte = Object.fromEntries(
        groessen.map((groesse) => [groesse._id, 0])
      );
    } catch (error) {
      fehlermeldung =
        error instanceof Error ? error.message : 'Speichern fehlgeschlagen.';
    } finally {
      wirdGespeichert = false;
    }
  }
</script>

<svelte:head>
  <title>Artikel erfassen – ClubMatiq</title>
</svelte:head>

<main>
  <a href="/inventar" class="zurueck">
    ← Zurück zum Inventar
  </a>

  <h1>Neuen Inventarartikel erfassen</h1>
  <p>Erfasse Vereinsmaterial und Vereinskleider zentral im Inventar.</p>

  {#if fehlermeldung}
    <p class="meldung fehler" role="alert">{fehlermeldung}</p>
  {/if}

  {#if erfolgsmeldung}
    <p class="meldung erfolg" role="status">{erfolgsmeldung}</p>
  {/if}

  {#if wirdGeladen}
    <p>Stammdaten werden geladen ...</p>
  {:else}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        artikelSpeichern();
      }}
    >
      <section class="bereich">
        <h2>Allgemeine Angaben</h2>

        <div class="feld">
          <label for="name">Artikelbezeichnung *</label>
          <input
            id="name"
            type="text"
            placeholder="z. B. Trainerjacke TV Weiningen"
            bind:value={name}
            required
          />
        </div>

        <div class="zweispaltig">
          <div class="feld">
            <label for="kategorie">Kategorie *</label>
            <select id="kategorie" bind:value={kategorieId} required>
              <option value="">Bitte auswählen</option>
              {#each kategorien as kategorie}
                <option value={kategorie._id}>
                  {kategorie.name}
                </option>
              {/each}
            </select>
          </div>

          <div class="feld">
            <label for="lagerort">Lagerort *</label>
            <select id="lagerort" bind:value={lagerortId} required>
              <option value="">Bitte auswählen</option>
              {#each lagerorte as lagerort}
                <option value={lagerort._id}>
                  {lagerort.name}
                </option>
              {/each}
            </select>
          </div>
        </div>

        <div class="feld">
          <label for="beschreibung">Beschreibung</label>
          <textarea
            id="beschreibung"
            rows="3"
            placeholder="Zusätzliche Informationen ..."
            bind:value={beschreibung}
          ></textarea>
        </div>
      </section>

      <section class="bereich">
        <h2>Bestand und Inventarwert</h2>

        <label class="checkbox-zeile">
          <input type="checkbox" bind:checked={hatGroessen} />
          Artikel hat Grössenvarianten
        </label>

        {#if hatGroessen}
          <h3>Einzelwert für alle Grössen übernehmen</h3>
          <p>
            Lege einen gemeinsamen Einzelwert fest und passe
            anschliessend einzelne Grössen bei Bedarf an.
          </p>

          <div class="wert-uebernehmen">
            <div class="feld">
              <label for="standardwert">Einzelwert (CHF)</label>
              <input
                id="standardwert"
                type="number"
                min="0"
                step="0.01"
                bind:value={standardEinzelwert}
              />
            </div>

            <button
              type="button"
              class="sekundaer"
              onclick={einzelwertUebernehmen}
            >
              Für alle übernehmen
            </button>
          </div>

          <h3>Bestand pro Grösse</h3>

          <div class="tabelle-container">
            <table>
              <thead>
                <tr>
                  <th>Grösse</th>
                  <th>Bestand</th>
                  <th>Einzelwert (CHF)</th>
                  <th>Gesamtwert (CHF)</th>
                </tr>
              </thead>

              <tbody>
                {#each groessen as groesse (groesse._id)}
                  <tr>
                    <td>
                      <strong>{groesse.bezeichnung}</strong>
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Bestand {groesse.bezeichnung}"
                        bind:value={groessenBestaende[groesse._id]}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Einzelwert {groesse.bezeichnung}"
                        bind:value={groessenEinzelwerte[groesse._id]}
                      />
                    </td>

                    <td>
                      {formatiereCHF(
                        Number(groessenBestaende[groesse._id] ?? 0) *
                        Number(groessenEinzelwerte[groesse._id] ?? 0)
                      )}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="zweispaltig">
            <div class="feld">
              <label for="menge">Gesamtmenge *</label>
              <input
                id="menge"
                type="number"
                min="0"
                step="1"
                bind:value={menge}
              />
            </div>

            <div class="feld">
              <label for="einzelwert">Einzelwert (CHF)</label>
              <input
                id="einzelwert"
                type="number"
                min="0"
                step="0.01"
                bind:value={einzelwert}
              />
            </div>
          </div>
        {/if}

        <div class="zusammenfassung">
          <div>
            <span>Gesamtbestand</span>
            <strong>{gesamtmenge} Stück</strong>
          </div>

          <div>
            <span>Gesamter Inventarwert</span>
            <strong>CHF {formatiereCHF(inventarwert)}</strong>
          </div>
        </div>
      </section>

      <div class="aktionen">
        <button type="submit" disabled={wirdGespeichert}>
          {wirdGespeichert
            ? 'Wird gespeichert ...'
            : 'Artikel speichern'}
        </button>
      </div>
    </form>
  {/if}
</main>

<style>
  main {
    max-width: 1100px;
    margin: 40px auto;
    padding: 20px;
  }

  .zurueck {
    color: #64748b;
    text-decoration: none;
  }

  h1 {
    color: #172b4d;
    margin-top: 25px;
  }

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 25px;
    margin-top: 25px;
  }

  h2 {
    margin-bottom: 20px;
  }

  h3 {
    margin-top: 25px;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 18px;
  }

  label {
    font-size: 14px;
    font-weight: 500;
  }

  input,
  select,
  textarea {
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .zweispaltig {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .checkbox-zeile {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }

  .checkbox-zeile input {
    width: auto;
  }

  .wert-uebernehmen {
    display: flex;
    align-items: flex-end;
    gap: 15px;
    margin: 20px 0 30px;
  }

  .wert-uebernehmen .feld {
    flex: 1;
    margin-bottom: 0;
  }

  .tabelle-container {
    overflow-x: auto;
    margin-top: 20px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 12px;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
  }

  th {
    background: #f1f5f9;
  }

  td input {
    min-width: 100px;
  }

  .zusammenfassung {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 20px;
    background: #f1f5f9;
    border-radius: 8px;
    margin-top: 25px;
  }

  .zusammenfassung div {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .zusammenfassung strong {
    font-size: 20px;
  }

  .aktionen {
    display: flex;
    justify-content: flex-end;
    margin-top: 25px;
  }

  button {
    background: #172b4d;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 14px 25px;
    cursor: pointer;
    font: inherit;
  }

  button:hover {
    background: #29456d;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sekundaer {
    background: #e2e8f0;
    color: #172b4d;
  }

  .sekundaer:hover {
    background: #cbd5e1;
  }

  .meldung {
    padding: 12px;
    border-radius: 8px;
    margin-top: 20px;
  }

  .fehler {
    background: #fee2e2;
    color: #991b1b;
  }

  .erfolg {
    background: #dcfce7;
    color: #166534;
  }

  @media (max-width: 700px) {
    .zweispaltig {
      grid-template-columns: 1fr;
    }

    .wert-uebernehmen,
    .zusammenfassung {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
