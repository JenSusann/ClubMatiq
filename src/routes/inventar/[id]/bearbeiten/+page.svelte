
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  type Stammdatum = {
    _id: string;
    name: string;
  };

  type Groesse = {
    _id: string;
    bezeichnung: string;
    sortierung: number;
  };

  type Variante = {
    groesseId: string;
    menge: number;
    einzelwert: number;
  };

  type Artikel = {
    _id: string;
    name: string;
    kategorieId: string;
    lagerortId: string;
    menge: number;
    einzelwert: number;
    beschreibung: string;
    hatGroessen: boolean;
    varianten: Variante[];
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

  let groessenBestaende = $state<Record<string, number>>({});
  let groessenEinzelwerte = $state<Record<string, number>>({});
  let standardEinzelwert = $state(0);

  let wirdGeladen = $state(true);
  let wirdGespeichert = $state(false);
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');

  const artikelId = page.params.id;

  let gesamtmenge = $derived(
    hatGroessen
      ? groessen.reduce(
          (summe, groesse) =>
            summe + Number(groessenBestaende[groesse._id] ?? 0),
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
        fetch('/api/groessen'),
        fetch(`/api/artikel/${artikelId}`)
      ]);

      if (antworten.some((antwort) => !antwort.ok)) {
        throw new Error('Artikeldaten konnten nicht geladen werden.');
      }

    const [k, l, g, artikel] = await Promise.all(
        antworten.map((antwort) => antwort.json())
    ) as [Stammdatum[], Stammdatum[], Groesse[], Artikel];

      kategorien = k;
      lagerorte = l;
      groessen = g;

      name = artikel.name;
      kategorieId = artikel.kategorieId;
      lagerortId = artikel.lagerortId;
      menge = artikel.menge;
      einzelwert = artikel.einzelwert;
      beschreibung = artikel.beschreibung ?? '';
      hatGroessen = artikel.hatGroessen;

      groessenBestaende = Object.fromEntries(
        groessen.map((groesse) => [groesse._id, 0])
      );

      groessenEinzelwerte = Object.fromEntries(
        groessen.map((groesse) => [groesse._id, 0])
      );

      for (const variante of artikel.varianten) {
        groessenBestaende[variante.groesseId] = variante.menge;
        groessenEinzelwerte[variante.groesseId] =
          variante.einzelwert;
      }
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
      !Number.isInteger(gesamtmenge) ||
      gesamtmenge < 0 ||
      !Number.isFinite(einzelwert) ||
      einzelwert < 0
    ) {
      fehlermeldung = 'Bitte gültige Mengen und Einzelwerte eingeben.';
      return;
    }

    if (hatGroessen) {
      if (groessen.length === 0) {
        fehlermeldung = 'Keine Grössen vorhanden.';
        return;
      }

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
            menge: Number(groessenBestaende[groesse._id] ?? 0),
            einzelwert: Number(
              groessenEinzelwerte[groesse._id] ?? 0
            )
          }))
        : [];

      const antwort = await fetch(`/api/artikel/${artikelId}`, {
        method: 'PATCH',
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

      erfolgsmeldung = 'Änderungen erfolgreich gespeichert.';
    } catch (error) {
      fehlermeldung =
        error instanceof Error ? error.message : 'Speichern fehlgeschlagen.';
    } finally {
      wirdGespeichert = false;
    }
  }
</script>

<svelte:head>
  <title>Artikel bearbeiten – ClubMatiq</title>
</svelte:head>

<main>
  <a href="/inventar" class="zurueck">
    ← Zurück zum Inventar
  </a>

  <h1>Inventarartikel bearbeiten</h1>

  {#if fehlermeldung}
    <p class="meldung fehler" role="alert">{fehlermeldung}</p>
  {/if}

  {#if erfolgsmeldung}
    <p class="meldung erfolg" role="status">{erfolgsmeldung}</p>
  {/if}

  {#if wirdGeladen}
    <p>Artikel wird geladen ...</p>
  {:else if !fehlermeldung || name}
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
          <input id="name" bind:value={name} required />
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
            bind:value={beschreibung}
          ></textarea>
        </div>
      </section>

      <section class="bereich">
        <h2>Bestand und Inventarwert</h2>

        {#if hatGroessen}
          <p>
            Dieser Artikel hat Grössenvarianten.
            Du kannst die Bestände und Einzelwerte pro Grösse bearbeiten.
          </p>

          <h3>Einzelwert für alle Grössen übernehmen</h3>

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
                    <td><strong>{groesse.bezeichnung}</strong></td>

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
                      CHF {formatiereCHF(
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
        <a href="/inventar" class="abbrechen">Abbrechen</a>

        <button type="submit" disabled={wirdGespeichert}>
          {wirdGespeichert
            ? 'Wird gespeichert ...'
            : 'Änderungen speichern'}
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

  h2, h3 {
    margin-bottom: 20px;
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

  input, select, textarea {
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
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
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
    align-items: center;
    gap: 15px;
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

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sekundaer {
    background: #e2e8f0;
    color: #172b4d;
  }

  .abbrechen {
    color: #64748b;
    text-decoration: none;
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
