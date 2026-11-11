
<script lang="ts">
  import { onMount } from 'svelte';

  type Kategorie = {
    _id: string;
    name: string;
  };

  type Groesse = {
    _id: string;
    bezeichnung: string;
    sortierung: number;
  };

  type Variante = {
    _id: string;
    groesseId: string;
    menge: number;
    einzelwert: number;
    aktiv?: boolean;
  };

  type Artikel = {
    _id: string;
    name: string;
    kategorieId: string;
    menge: number;
    einzelwert: number;
    beschreibung?: string;
    hatGroessen: boolean;
    varianten?: Variante[];
  };

  type Preistyp = 'fix' | 'variabel';

  type Preis = {
    _id?: string;
    artikelId: string;
    groesseId: string | null;
    preistyp: Preistyp;
    druckkosten: number;
    verkaufspreis: number | null;
  };

  type PreisFormular = {
    preistyp: Preistyp;
    druckkosten: string;
    verkaufspreis: string;
  };

  let artikel = $state<Artikel[]>([]);
  let groessen = $state<Groesse[]>([]);
  let preise = $state<Preis[]>([]);

  let laden = $state(true);
  let fehler = $state('');
  let suche = $state('');
  let kategorieGefunden = $state(false);

  let geoeffneteArtikel = $state<string[]>([]);
  let preisBearbeitung = $state<string[]>([]);
  let formulare = $state<Record<string, PreisFormular>>({});
  let speichern = $state<Record<string, boolean>>({});
  let meldungen = $state<Record<string, string>>({});
  let fehlerMeldungen = $state<Record<string, boolean>>({});

  const gefilterteArtikel = $derived(
    artikel.filter((eintrag) =>
      eintrag.name
        .toLowerCase()
        .includes(suche.toLowerCase().trim())
    )
  );

  const gesamtbestand = $derived(
    artikel.reduce(
      (summe, eintrag) => summe + eintrag.menge,
      0
    )
  );

  function preisSchluessel(
    artikelId: string,
    groesseId: string | null
  ): string {
    return `${artikelId}:${groesseId ?? 'ohne-groesse'}`;
  }

  function preisFinden(
    artikelId: string,
    groesseId: string | null
  ): Preis | undefined {
    return preise.find(
      (preis) =>
        preis.artikelId === artikelId &&
        preis.groesseId === groesseId
    );
  }

  function preisFormularErstellen(
    artikelId: string,
    groesseId: string | null
  ) {
    const schluessel = preisSchluessel(
      artikelId,
      groesseId
    );

    const preis = preisFinden(artikelId, groesseId);

    formulare[schluessel] = {
      preistyp: preis?.preistyp ?? 'fix',
      druckkosten: String(preis?.druckkosten ?? 0),
      verkaufspreis:
        preis?.verkaufspreis === null ||
        preis?.verkaufspreis === undefined
          ? ''
          : String(preis.verkaufspreis)
    };
  }

  function preisBearbeiten(
    artikelId: string,
    groesseId: string | null
  ) {
    const schluessel = preisSchluessel(
      artikelId,
      groesseId
    );

    if (preisBearbeitung.includes(schluessel)) {
      preisBearbeitung = preisBearbeitung.filter(
        (eintrag) => eintrag !== schluessel
      );
      return;
    }

    preisFormularErstellen(artikelId, groesseId);

    meldungen[schluessel] = '';
    preisBearbeitung = [
      ...preisBearbeitung,
      schluessel
    ];
  }

  function gueltigerBetrag(wert: number): boolean {
    return (
      Number.isFinite(wert) &&
      wert >= 0 &&
      Math.abs(
        Math.round(wert * 100) - wert * 100
      ) < 0.000001
    );
  }

  function betragLesen(
    wert: string,
    leerErlaubt: boolean
  ): number | null | undefined {
    const bereinigt = wert.trim().replace(',', '.');

    if (bereinigt === '') {
      return leerErlaubt ? null : undefined;
    }

    const betrag = Number(bereinigt);

    return gueltigerBetrag(betrag)
      ? betrag
      : undefined;
  }

  async function preisSpeichern(
    artikelId: string,
    groesseId: string | null
  ) {
    const schluessel = preisSchluessel(
      artikelId,
      groesseId
    );

    const formular = formulare[schluessel];

    if (!formular || speichern[schluessel]) {
      return;
    }

    const druckkosten = betragLesen(
      formular.druckkosten,
      false
    );

    const verkaufspreis = betragLesen(
      formular.verkaufspreis,
      true
    );

    meldungen[schluessel] = '';
    fehlerMeldungen[schluessel] = false;

    if (
      druckkosten === undefined ||
      druckkosten === null
    ) {
      meldungen[schluessel] =
        'Bitte gültige Druckkosten eingeben.';
      fehlerMeldungen[schluessel] = true;
      return;
    }

    if (verkaufspreis === undefined) {
      meldungen[schluessel] =
        'Bitte einen gültigen Verkaufspreis eingeben.';
      fehlerMeldungen[schluessel] = true;
      return;
    }

    if (
      formular.preistyp === 'fix' &&
      verkaufspreis === null
    ) {
      meldungen[schluessel] =
        'Bei einem Fixpreis ist der Verkaufspreis erforderlich.';
      fehlerMeldungen[schluessel] = true;
      return;
    }

    speichern[schluessel] = true;

    try {
      const antwort = await fetch(
        '/api/vereinskleider/preise',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            artikelId,
            groesseId,
            preistyp: formular.preistyp,
            druckkosten,
            verkaufspreis
          })
        }
      );

      const ergebnis = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          ergebnis.fehler ??
            'Der Preis konnte nicht gespeichert werden.'
        );
      }

      const ladenAntwort = await fetch(
        '/api/vereinskleider/preise'
      );

      if (!ladenAntwort.ok) {
        throw new Error(
          'Preis gespeichert, aber aktualisierte Preise konnten nicht geladen werden.'
        );
      }

      preise = await ladenAntwort.json();

      preisBearbeitung = preisBearbeitung.filter(
        (eintrag) => eintrag !== schluessel
      );

      meldungen[schluessel] =
        'Preis erfolgreich gespeichert.';
    } catch (error) {
      meldungen[schluessel] =
        error instanceof Error
          ? error.message
          : 'Ein unbekannter Fehler ist aufgetreten.';

      fehlerMeldungen[schluessel] = true;
    } finally {
      speichern[schluessel] = false;
    }
  }

  onMount(async () => {
    try {
      const [
        kategorienAntwort,
        artikelAntwort,
        groessenAntwort,
        preiseAntwort
      ] = await Promise.all([
        fetch('/api/kategorien'),
        fetch('/api/artikel'),
        fetch('/api/groessen'),
        fetch('/api/vereinskleider/preise')
      ]);

      if (
        !kategorienAntwort.ok ||
        !artikelAntwort.ok ||
        !groessenAntwort.ok ||
        !preiseAntwort.ok
      ) {
        throw new Error(
          'Die Vereinskleiderdaten konnten nicht geladen werden.'
        );
      }

      const kategorien: Kategorie[] =
        await kategorienAntwort.json();

      const alleArtikel: Artikel[] =
        await artikelAntwort.json();

      groessen = await groessenAntwort.json();
      preise = await preiseAntwort.json();

      const kategorie = kategorien.find(
        (eintrag) =>
          eintrag.name.trim().toLowerCase() ===
          'vereinskleider'
      );

      if (!kategorie) {
        return;
      }

      kategorieGefunden = true;

      const kleiderArtikel = alleArtikel.filter(
        (eintrag) =>
          eintrag.kategorieId === kategorie._id
      );

      artikel = await Promise.all(
        kleiderArtikel.map(async (eintrag) => {
          if (!eintrag.hatGroessen) {
            return eintrag;
          }

          const antwort = await fetch(
            `/api/artikel/${eintrag._id}`
          );

          if (!antwort.ok) {
            throw new Error(
              `Grössen für ${eintrag.name} konnten nicht geladen werden.`
            );
          }

          return (await antwort.json()) as Artikel;
        })
      );
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      laden = false;
    }
  });

  function umschalten(id: string) {
    if (geoeffneteArtikel.includes(id)) {
      geoeffneteArtikel = geoeffneteArtikel.filter(
        (eintrag) => eintrag !== id
      );
    } else {
      geoeffneteArtikel = [
        ...geoeffneteArtikel,
        id
      ];
    }
  }

  function groessenName(id: string): string {
    return (
      groessen.find((groesse) => groesse._id === id)
        ?.bezeichnung ?? 'Unbekannt'
    );
  }

  function sortierteVarianten(
    varianten: Variante[]
  ): Variante[] {
    return varianten.filter((variante) => variante.aktiv !== false).sort((a, b) => {
      const sortA =
        groessen.find((g) => g._id === a.groesseId)
          ?.sortierung ?? 9999;

      const sortB =
        groessen.find((g) => g._id === b.groesseId)
          ?.sortierung ?? 9999;

      return sortA - sortB;
    });
  }

  function verkaufbar(bestand: number): number {
    return Math.max(0, bestand - 1);
  }

  // ========================================
  // Kosten- und Margenberechnung
  // ========================================

  function gesamtkosten(
    einkaufspreis: number,
    druckkosten: number
  ): number {
    return einkaufspreis + druckkosten;
  }

  function gewinnVerlust(
    einkaufspreis: number,
    druckkosten: number,
    verkaufspreis: number
  ): number {
    return (
      verkaufspreis -
      gesamtkosten(einkaufspreis, druckkosten)
    );
  }

  function margeProzent(
    einkaufspreis: number,
    druckkosten: number,
    verkaufspreis: number
  ): number | null {
    if (verkaufspreis === 0) {
      return null;
    }

    return (
      gewinnVerlust(
        einkaufspreis,
        druckkosten,
        verkaufspreis
      ) / verkaufspreis
    ) * 100;
  }

  function formatCHF(betrag: number): string {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(betrag);
  }

  function formatProzent(wert: number): string {
    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(wert) + ' %';
  }
</script>

<svelte:head>
  <title>Kleiderbestand – ClubMatiq</title>
</svelte:head>

<main>
  <a class="zurueck" href="/vereinskleider">
    ← Zurück zu Vereinskleider
  </a>

  <header>
    <h1>Kleiderbestand & Preise</h1>
    <p>
      Vereinskleider verwalten, Bestände prüfen
      und Kosten sowie Verkaufspreise vergleichen.
    </p>
  </header>

  {#if laden}
    <section class="meldung">
      Vereinskleider werden geladen ...
    </section>
  {:else if fehler}
    <section class="meldung fehler" role="alert">
      {fehler}
    </section>
  {:else if !kategorieGefunden}
    <section class="meldung">
      Bitte erstelle zuerst die Kategorie
      «Vereinskleider» in der Inventarverwaltung.
    </section>
  {:else}
    <section class="kennzahlen">
      <div class="kennzahl">
        <span>Verschiedene Artikel</span>
        <strong>{artikel.length}</strong>
      </div>

      <div class="kennzahl">
        <span>Gesamter Lagerbestand</span>
        <strong>{gesamtbestand} Stück</strong>
      </div>
    </section>

    <section class="bereich">
      <div class="bereich-kopf">
        <h2>Vereinskleider</h2>
        <a class="aktion" href="/inventar">
          Inventar öffnen
        </a>
      </div>

      <label for="suche">Artikel suchen</label>
      <input
        id="suche"
        type="search"
        placeholder="Artikelbezeichnung ..."
        bind:value={suche}
      />

      {#if gefilterteArtikel.length === 0}
        <p class="leer">
          Keine passenden Vereinskleider gefunden.
        </p>
      {:else}
        <div class="artikelliste">
          {#each gefilterteArtikel as eintrag (eintrag._id)}
            <article class="artikelkarte">
              <div class="artikelkopf">
                <div>
                  <h3>{eintrag.name}</h3>

                  {#if eintrag.beschreibung}
                    <p>{eintrag.beschreibung}</p>
                  {/if}
                </div>

                <div class="artikelaktionen">
                  <span class="bestand">
                    {eintrag.menge} Stück
                  </span>

                  {#if eintrag.hatGroessen}
                    <button
                      type="button"
                      onclick={() =>
                        umschalten(eintrag._id)}
                    >
                      {geoeffneteArtikel.includes(eintrag._id)
                        ? 'Schliessen ▲'
                        : 'Grössen & Preise ▼'}
                    </button>
                  {/if}
                </div>
              </div>

              {#if eintrag.hatGroessen &&
                geoeffneteArtikel.includes(eintrag._id)}
                <div class="tabellenbereich">
                  <table>
                    <thead>
                      <tr>
                        <th>Grösse</th>
                        <th>Bestand</th>
                        <th>Reserve</th>
                        <th>Verkaufbar</th>
                        <th>EP</th>
                        <th>Druck</th>
                        <th>Gesamtkosten</th>
                        <th>VP</th>
                        <th>Gewinn / Verlust</th>
                        <th>Marge</th>
                        <th>Aktion</th>
                      </tr>
                    </thead>

                    <tbody>
                      {#each sortierteVarianten(eintrag.varianten ?? []) as variante (variante._id)}
                        {@const schluessel = preisSchluessel(eintrag._id, variante.groesseId)}
                        {@const preis = preisFinden(eintrag._id, variante.groesseId)}

                        <tr>
                          <td>
                            {groessenName(variante.groesseId)}
                          </td>

                          <td>{variante.menge}</td>

                          <td>
                            {Math.min(1, variante.menge)}
                          </td>

                          <td>
                            <span
                              class:ausverkauft={verkaufbar(variante.menge) === 0}
                              class:verfuegbar={verkaufbar(variante.menge) > 0}
                            >
                              {verkaufbar(variante.menge)}
                            </span>
                          </td>

                          <td>
                            {formatCHF(variante.einzelwert)}
                          </td>

                          <td>
                            {preis
                              ? formatCHF(preis.druckkosten)
                              : '–'}
                          </td>

                          <td>
                            {preis
                              ? formatCHF(
                                  gesamtkosten(
                                    variante.einzelwert,
                                    preis.druckkosten
                                  )
                                )
                              : '–'}
                          </td>

                          <td>
                            {#if preis}
                              {#if preis.verkaufspreis !== null}
                                <strong>
                                  {formatCHF(preis.verkaufspreis)}
                                </strong>
                              {:else}
                                <span class="offen">
                                  Noch offen
                                </span>
                              {/if}

                              <small>
                                {preis.preistyp === 'fix'
                                  ? 'Fixpreis'
                                  : 'Variabel'}
                              </small>
                            {:else}
                              <span class="offen">
                                Nicht erfasst
                              </span>
                            {/if}
                          </td>

                          <td>
                            {#if preis && preis.verkaufspreis !== null}
                              {@const differenz = gewinnVerlust(
                                variante.einzelwert,
                                preis.druckkosten,
                                preis.verkaufspreis
                              )}

                              <strong
                                class:positiv={differenz > 0}
                                class:negativ={differenz < 0}
                              >
                                {formatCHF(differenz)}
                              </strong>
                            {:else}
                              –
                            {/if}
                          </td>

                          <td>
                            {#if preis && preis.verkaufspreis !== null}
                              {@const marge = margeProzent(
                                variante.einzelwert,
                                preis.druckkosten,
                                preis.verkaufspreis
                              )}

                              {#if marge !== null}
                                <strong
                                  class:positiv={marge > 0}
                                  class:negativ={marge < 0}
                                >
                                  {formatProzent(marge)}
                                </strong>
                              {:else}
                                –
                              {/if}
                            {:else}
                              –
                            {/if}
                          </td>

                          <td>
                            <button
                              type="button"
                              onclick={() =>
                                preisBearbeiten(
                                  eintrag._id,
                                  variante.groesseId
                                )}
                            >
                              {preisBearbeitung.includes(schluessel)
                                ? 'Abbrechen'
                                : 'Preis bearbeiten'}
                            </button>
                          </td>
                        </tr>

                        {#if preisBearbeitung.includes(schluessel) && formulare[schluessel]}
                          <tr class="formularzeile">
                            <td colspan="11">
                              <div class="preisformular">
                                <h4>
                                  Preis bearbeiten –
                                  {groessenName(variante.groesseId)}
                                </h4>

                                <p class="hinweis">
                                  Einkaufspreis:
                                  {formatCHF(variante.einzelwert)}
                                </p>

                                <div class="formularfelder">
                                  <div>
                                    <label for={`typ-${schluessel}`}>
                                      Preistyp
                                    </label>
                                    <select
                                      id={`typ-${schluessel}`}
                                      bind:value={formulare[schluessel].preistyp}
                                    >
                                      <option value="fix">
                                        Fixpreis
                                      </option>
                                      <option value="variabel">
                                        Variabler Preis
                                      </option>
                                    </select>
                                  </div>

                                  <div>
                                    <label for={`druck-${schluessel}`}>
                                      Druckkosten (CHF)
                                    </label>
                                    <input
                                      id={`druck-${schluessel}`}
                                      type="text"
                                      inputmode="decimal"
                                      bind:value={formulare[schluessel].druckkosten}
                                    />
                                  </div>

                                  <div>
                                    <label for={`vp-${schluessel}`}>
                                      Verkaufspreis (CHF)
                                    </label>
                                    <input
                                      id={`vp-${schluessel}`}
                                      type="text"
                                      inputmode="decimal"
                                      placeholder="Noch nicht bekannt"
                                      bind:value={formulare[schluessel].verkaufspreis}
                                    />
                                  </div>
                                </div>

                                {#if formulare[schluessel].preistyp === 'variabel'}
                                  <p class="hinweis">
                                    Der Verkaufspreis darf vorerst
                                    leer bleiben und kann später
                                    festgelegt werden.
                                  </p>
                                {/if}

                                <button
                                  type="button"
                                  class="speichern"
                                  disabled={speichern[schluessel]}
                                  onclick={() =>
                                    preisSpeichern(
                                      eintrag._id,
                                      variante.groesseId
                                    )}
                                >
                                  {speichern[schluessel]
                                    ? 'Speichern ...'
                                    : 'Preis speichern'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        {/if}

                        {#if meldungen[schluessel]}
                          <tr>
                            <td colspan="11">
                              <p
                                class:fehlermeldung={fehlerMeldungen[schluessel]}
                                class:erfolgsmeldung={!fehlerMeldungen[schluessel]}
                                role="status"
                              >
                                {meldungen[schluessel]}
                              </p>
                            </td>
                          </tr>
                        {/if}
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else if !eintrag.hatGroessen}
                {@const schluessel = preisSchluessel(eintrag._id, null)}
                {@const preis = preisFinden(eintrag._id, null)}

                <div class="ohne-groessen">
                  <span>
                    Verkaufbar:
                    <strong>
                      {verkaufbar(eintrag.menge)} Stück
                    </strong>
                  </span>

                  <span>
                    EP:
                    <strong>
                      {formatCHF(eintrag.einzelwert)}
                    </strong>
                  </span>

                  <span>
                    VP:
                    <strong>
                      {preis?.verkaufspreis !== null &&
                      preis?.verkaufspreis !== undefined
                        ? formatCHF(preis.verkaufspreis)
                        : 'Noch offen'}
                    </strong>
                  </span>

                  {#if preis}
                    <span>
                      Druckkosten:
                      <strong>
                        {formatCHF(preis.druckkosten)}
                      </strong>
                    </span>

                    <span>
                      Gesamtkosten:
                      <strong>
                        {formatCHF(
                          gesamtkosten(
                            eintrag.einzelwert,
                            preis.druckkosten
                          )
                        )}
                      </strong>
                    </span>

                    {#if preis.verkaufspreis !== null}
                      {@const differenz = gewinnVerlust(
                        eintrag.einzelwert,
                        preis.druckkosten,
                        preis.verkaufspreis
                      )}

                      {@const marge = margeProzent(
                        eintrag.einzelwert,
                        preis.druckkosten,
                        preis.verkaufspreis
                      )}

                      <span>
                        Gewinn / Verlust:
                        <strong
                          class:positiv={differenz > 0}
                          class:negativ={differenz < 0}
                        >
                          {formatCHF(differenz)}
                        </strong>
                      </span>

                      <span>
                        Marge:
                        <strong
                          class:positiv={marge !== null && marge > 0}
                          class:negativ={marge !== null && marge < 0}
                        >
                          {marge !== null
                            ? formatProzent(marge)
                            : '–'}
                        </strong>
                      </span>
                    {/if}
                  {/if}

                  <button
                    type="button"
                    onclick={() =>
                      preisBearbeiten(eintrag._id, null)}
                  >
                    {preisBearbeitung.includes(schluessel)
                      ? 'Abbrechen'
                      : 'Preis bearbeiten'}
                  </button>
                </div>

                {#if preisBearbeitung.includes(schluessel) && formulare[schluessel]}
                  <div class="preisformular">
                    <h4>Preis bearbeiten</h4>

                    <div class="formularfelder">
                      <div>
                        <label for={`typ-${schluessel}`}>
                          Preistyp
                        </label>
                        <select
                          id={`typ-${schluessel}`}
                          bind:value={formulare[schluessel].preistyp}
                        >
                          <option value="fix">
                            Fixpreis
                          </option>
                          <option value="variabel">
                            Variabler Preis
                          </option>
                        </select>
                      </div>

                      <div>
                        <label for={`druck-${schluessel}`}>
                          Druckkosten (CHF)
                        </label>
                        <input
                          id={`druck-${schluessel}`}
                          type="text"
                          inputmode="decimal"
                          bind:value={formulare[schluessel].druckkosten}
                        />
                      </div>

                      <div>
                        <label for={`vp-${schluessel}`}>
                          Verkaufspreis (CHF)
                        </label>
                        <input
                          id={`vp-${schluessel}`}
                          type="text"
                          inputmode="decimal"
                          placeholder="Noch nicht bekannt"
                          bind:value={formulare[schluessel].verkaufspreis}
                        />
                      </div>
                    </div>

                    {#if formulare[schluessel].preistyp === 'variabel'}
                      <p class="hinweis">
                        Der definitive Verkaufspreis kann
                        später festgelegt werden.
                      </p>
                    {/if}

                    <button
                      type="button"
                      class="speichern"
                      disabled={speichern[schluessel]}
                      onclick={() =>
                        preisSpeichern(eintrag._id, null)}
                    >
                      {speichern[schluessel]
                        ? 'Speichern ...'
                        : 'Preis speichern'}
                    </button>
                  </div>
                {/if}

                {#if meldungen[schluessel]}
                  <p
                    class:fehlermeldung={fehlerMeldungen[schluessel]}
                    class:erfolgsmeldung={!fehlerMeldungen[schluessel]}
                    role="status"
                  >
                    {meldungen[schluessel]}
                  </p>
                {/if}
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
  }

  .zurueck {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
  }

  header {
    margin: 28px 0;
  }

  h1, h2, h3, h4 {
    color: #172b4d;
  }

  header p, .artikelkopf p {
    color: #64748b;
  }

  .kennzahlen {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
    margin-bottom: 24px;
  }

  .kennzahl, .bereich, .meldung {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
  }

  .kennzahl {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kennzahl span {
    color: #64748b;
    font-size: 14px;
  }

  .kennzahl strong {
    color: #172b4d;
    font-size: 26px;
  }

  .bereich-kopf, .artikelkopf, .artikelaktionen {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .bereich-kopf {
    margin-bottom: 24px;
  }

  .bereich-kopf h2 {
    margin: 0;
  }

  .aktion {
    background: #2563eb;
    color: white;
    padding: 11px 16px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
  }

  label {
    display: block;
    font-weight: 600;
    color: #334155;
    margin-bottom: 8px;
    font-size: 14px;
  }

  input, select {
    box-sizing: border-box;
    width: 100%;
    padding: 11px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    background: white;
  }

  #suche {
    margin-bottom: 24px;
  }

  .artikelliste {
    display: grid;
    gap: 16px;
  }

  .artikelkarte {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 20px;
  }

  .artikelkopf h3 {
    margin: 0 0 6px;
  }

  .artikelkopf p {
    margin: 0;
    font-size: 14px;
  }

  .bestand {
    color: #475569;
    font-weight: 600;
    white-space: nowrap;
  }

  button {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
    border-radius: 8px;
    padding: 10px 14px;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: #dbeafe;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .tabellenbereich {
    overflow-x: auto;
    margin-top: 20px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  th, td {
    padding: 12px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 14px;
  }

  th {
    background: #f8fafc;
    color: #475569;
  }

  td small {
    display: block;
    color: #64748b;
    margin-top: 4px;
  }

  .verfuegbar {
    color: #15803d;
    font-weight: 700;
  }

  .ausverkauft {
    color: #dc2626;
    font-weight: 700;
  }

  .positiv {
    color: #15803d !important;
  }

  .negativ {
    color: #dc2626 !important;
  }

  .offen {
    color: #b45309;
    font-size: 13px;
  }

  .ohne-groessen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 25px;
    padding-top: 16px;
    color: #64748b;
    font-size: 14px;
  }

  .ohne-groessen strong {
    color: #172b4d;
    margin-left: 5px;
  }

  .preisformular {
    background: #f8fafc;
    border: 1px solid #dbeafe;
    border-radius: 10px;
    padding: 20px;
    margin-top: 16px;
  }

  .preisformular h4 {
    margin: 0 0 16px;
  }

  .formularzeile td {
    padding: 0 12px 18px;
  }

  .formularfelder {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .hinweis {
    color: #64748b;
    font-size: 13px;
    margin: 12px 0;
  }

  .speichern {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  .speichern:hover {
    background: #1d4ed8;
  }

  .fehlermeldung {
    color: #b91c1c;
    font-size: 14px;
  }

  .erfolgsmeldung {
    color: #15803d;
    font-size: 14px;
  }

  .leer {
    color: #64748b;
    text-align: center;
    padding: 30px;
  }

  .fehler {
    background: #fef2f2;
    color: #b91c1c;
  }

  @media (max-width: 700px) {
    main {
      padding: 16px;
      margin: 20px auto;
    }

    .kennzahlen,
    .formularfelder {
      grid-template-columns: 1fr;
    }

    .artikelkopf,
    .bereich-kopf {
      align-items: flex-start;
      flex-direction: column;
    }

    .artikelaktionen {
      flex-wrap: wrap;
    }
  }
</style>
