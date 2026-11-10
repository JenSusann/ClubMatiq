
<script lang="ts">
  import { onMount } from 'svelte';
  import AusleihenUebersicht from '../../lib/AusleihenUebersicht.svelte';

  type Variante = {
    groesseId: string;
    groesse: string;
    menge: number;
    einzelwert: number;
  };

  type Artikel = {
    _id: string;
    name: string;
    kategorie: string;
    lagerort: string;
    hatGroessen: boolean;
    gesamtmenge: number;
    varianten: Variante[];
  };

  let artikel = $state<Artikel[]>([]);
  let artikelId = $state('');
  let groesseId = $state('');
  let person = $state('');
  let menge = $state(1);
  let ausleihdatum = $state('');
  let rueckgabedatum = $state('');
  let bemerkung = $state('');

  let wirdGeladen = $state(true);
  let wirdGespeichert = $state(false);
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');

  let ausgewaehlterArtikel = $derived(
    artikel.find((a) => a._id === artikelId)
  );

  let ausgewaehlteVariante = $derived(
    ausgewaehlterArtikel?.varianten.find(
      (v) => v.groesseId === groesseId
    )
  );

  let verfuegbarerBestand = $derived(
    ausgewaehlterArtikel
      ? ausgewaehlterArtikel.hatGroessen
        ? ausgewaehlteVariante?.menge ?? 0
        : ausgewaehlterArtikel.gesamtmenge
      : 0
  );

  let bestandNachAusleihe = $derived(
    verfuegbarerBestand - (Number(menge) || 0)
  );

  function datumAlsText(datum: Date) {
    const jahr = datum.getFullYear();
    const monat = String(datum.getMonth() + 1).padStart(2, '0');
    const tag = String(datum.getDate()).padStart(2, '0');

    return `${jahr}-${monat}-${tag}`;
  }

  function artikelWechseln() {
    groesseId = '';
    menge = 1;
    erfolgsmeldung = '';
    fehlermeldung = '';
  }

  function groesseWechseln() {
    menge = 1;
    erfolgsmeldung = '';
    fehlermeldung = '';
  }

  async function artikelLaden() {
    try {
      const antwort = await fetch('/api/inventar-uebersicht');

      if (!antwort.ok) {
        throw new Error('Inventar konnte nicht geladen werden.');
      }

      artikel = await antwort.json();
    } catch (error) {
      fehlermeldung =
        error instanceof Error ? error.message : 'Laden fehlgeschlagen.';
    } finally {
      wirdGeladen = false;
    }
  }

  onMount(() => {
    const heute = new Date();
    const rueckgabe = new Date(heute);
    rueckgabe.setDate(rueckgabe.getDate() + 7);

    ausleihdatum = datumAlsText(heute);
    rueckgabedatum = datumAlsText(rueckgabe);

    artikelLaden();
  });

  async function ausleiheSpeichern() {
    fehlermeldung = '';
    erfolgsmeldung = '';

    if (!ausgewaehlterArtikel) {
      fehlermeldung = 'Bitte einen Artikel auswählen.';
      return;
    }

    if (ausgewaehlterArtikel.hatGroessen && !groesseId) {
      fehlermeldung = 'Bitte eine Grösse auswählen.';
      return;
    }

    if (!person.trim()) {
      fehlermeldung = 'Bitte die ausleihende Person eingeben.';
      return;
    }

    if (
      !Number.isInteger(menge) ||
      menge <= 0 ||
      menge > verfuegbarerBestand
    ) {
      fehlermeldung =
        'Die Ausleihmenge muss zwischen 1 und dem verfügbaren Bestand liegen.';
      return;
    }

    if (
      !ausleihdatum ||
      !rueckgabedatum ||
      rueckgabedatum < ausleihdatum
    ) {
      fehlermeldung = 'Bitte gültige Ausleih- und Rückgabedaten wählen.';
      return;
    }

    wirdGespeichert = true;

    try {
      const antwort = await fetch('/api/ausleihen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artikelId,
          groesseId: ausgewaehlterArtikel.hatGroessen
            ? groesseId
            : null,
          person: person.trim(),
          menge: Number(menge),
          ausleihdatum,
          rueckgabedatum,
          bemerkung
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler || 'Ausleihe konnte nicht gespeichert werden.'
        );
      }

      // Formular zurücksetzen
      artikelId = '';
      groesseId = '';
      person = '';
      menge = 1;
      bemerkung = '';

      erfolgsmeldung = 'Materialausleihe erfolgreich erfasst.';

      // Aktualisierte Bestände laden
      await artikelLaden();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Ausleihe konnte nicht gespeichert werden.';
    } finally {
      wirdGespeichert = false;
    }
  }
</script>

<svelte:head>
  <title>Materialausleihe – ClubMatiq</title>
</svelte:head>

<main>
  <div class="kopf">
    <div>
      <h1>Materialausleihe</h1>
      <p>Erfasse, wer welches Vereinsmaterial ausgeliehen hat.</p>
    </div>

    <a href="/" class="zurueck">← Zur Startseite</a>
  </div>

  {#if fehlermeldung}
    <p class="meldung fehler" role="alert">{fehlermeldung}</p>
  {/if}

  {#if erfolgsmeldung}
    <p class="meldung erfolg" role="status">{erfolgsmeldung}</p>
  {/if}

  {#if wirdGeladen}
    <p>Inventar wird geladen ...</p>
  {:else}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        ausleiheSpeichern();
      }}
    >
      <section class="bereich">
        <h2>Material auswählen</h2>

        <div class="feld">
          <label for="artikel">Artikel *</label>

          <select
            id="artikel"
            bind:value={artikelId}
            onchange={artikelWechseln}
            required
          >
            <option value="">Bitte Artikel auswählen</option>

            {#each artikel.filter((a) => a.gesamtmenge > 0) as a (a._id)}
              <option value={a._id}>
                {a.name} – {a.kategorie}
              </option>
            {/each}
          </select>
        </div>

        {#if ausgewaehlterArtikel}
          <p class="lagerort">
            Lagerort: <strong>{ausgewaehlterArtikel.lagerort}</strong>
          </p>

          {#if ausgewaehlterArtikel.hatGroessen}
            <div class="feld">
              <label for="groesse">Grösse *</label>

              <select
                id="groesse"
                bind:value={groesseId}
                onchange={groesseWechseln}
                required
              >
                <option value="">Bitte Grösse auswählen</option>

                {#each ausgewaehlterArtikel.varianten.filter((v) => v.menge > 0) as variante (variante.groesseId)}
                  <option value={variante.groesseId}>
                    {variante.groesse} – {variante.menge} verfügbar
                  </option>
                {/each}
              </select>
            </div>
          {/if}

          {#if !ausgewaehlterArtikel.hatGroessen || groesseId}
            <div class="bestand">
              <div>
                <span>Verfügbarer Bestand</span>
                <strong>{verfuegbarerBestand} Stück</strong>
              </div>

              <div>
                <span>Nach der Ausleihe</span>
                <strong class:negativ={bestandNachAusleihe < 0}>
                  {bestandNachAusleihe} Stück
                </strong>
              </div>
            </div>

            <div class="feld">
              <label for="menge">Ausleihmenge *</label>

              <input
                id="menge"
                type="number"
                min="1"
                max={verfuegbarerBestand}
                step="1"
                bind:value={menge}
                required
              />
            </div>
          {/if}
        {/if}
      </section>

      <section class="bereich">
        <h2>Angaben zur Ausleihe</h2>

        <div class="feld">
          <label for="person">Ausgeliehen an *</label>

          <input
            id="person"
            type="text"
            placeholder="Vorname und Nachname"
            bind:value={person}
            required
          />
        </div>

        <div class="zweispaltig">
          <div class="feld">
            <label for="ausleihdatum">Ausleihdatum *</label>

            <input
              id="ausleihdatum"
              type="date"
              bind:value={ausleihdatum}
              required
            />
          </div>

          <div class="feld">
            <label for="rueckgabedatum">
              Geplantes Rückgabedatum *
            </label>

            <input
              id="rueckgabedatum"
              type="date"
              min={ausleihdatum}
              bind:value={rueckgabedatum}
              required
            />
          </div>
        </div>

        <div class="feld">
          <label for="bemerkung">Bemerkung (optional)</label>

          <textarea
            id="bemerkung"
            rows="3"
            placeholder="z. B. Material für Wettkampf ausgeliehen"
            bind:value={bemerkung}
          ></textarea>
        </div>
      </section>

      <div class="aktionen">
        <a href="/" class="abbrechen">Abbrechen</a>

        <button
          type="submit"
          disabled={wirdGespeichert || !ausgewaehlterArtikel}
        >
          {wirdGespeichert
            ? 'Wird gespeichert ...'
            : 'Ausleihe erfassen'}
        </button>
      </div>
    </form>
  {/if}

    <AusleihenUebersicht />

</main>

<style>
  main {
    max-width: 950px;
    margin: 40px auto;
    padding: 20px;
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 30px;
  }

  h1 {
    color: #172b4d;
    margin-bottom: 8px;
  }

  .kopf p {
    color: #64748b;
    margin: 0;
  }

  .zurueck,
  .abbrechen {
    color: #64748b;
    text-decoration: none;
  }

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 25px;
    margin-bottom: 25px;
  }

  h2 {
    color: #172b4d;
    margin-top: 0;
    margin-bottom: 25px;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  label {
    font-size: 14px;
    font-weight: 500;
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    box-sizing: border-box;
  }

  .zweispaltig {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .lagerort {
    color: #64748b;
    margin-bottom: 20px;
  }

  .bestand {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 25px;
  }

  .bestand div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #f1f5f9;
    border-radius: 8px;
    padding: 20px;
  }

  .bestand span {
    color: #64748b;
    font-size: 14px;
  }

  .bestand strong {
    color: #172b4d;
    font-size: 22px;
  }

  .bestand strong.negativ {
    color: #dc2626;
  }

  .aktionen {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 20px;
  }

  button {
    background: #172b4d;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 14px 24px;
    cursor: pointer;
    font: inherit;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  @media (max-width: 700px) {
    .kopf {
      flex-direction: column;
      align-items: flex-start;
    }

    .zweispaltig,
    .bestand {
      grid-template-columns: 1fr;
    }

    .bereich {
      padding: 18px;
    }
  }
</style>
