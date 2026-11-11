
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  type Inventur = {
    _id: string;
    name: string;
    typ: 'gesamt' | 'lagerort';
    lagerortName: string | null;
    status: string;
    erstelltAm: string;
    abgeschlossenAm?: string;
    storniertAm?: string;
    stornierungsgrund?: string;
    anzahlKorrekturen?: number;
    version: number;
  };

  type Position = {
    _id: string;
    artikelId: string;
    artikelName: string;
    groesseId: string | null;
    sollBestand: number;
    istBestand: number | null;
    differenz: number | null;
    bemerkung: string;
  };

  type KorrekturEintrag = {
    id: string;
    positionId: string;
    artikelName: string;
    groesseId: string | null;
    alterIstBestand: number;
    neuerIstBestand: number;
    differenz: number;
    begruendung: string;
    ausgefuehrtAm: string;
    ausgefuehrtVon: string;
    bearbeitetVon?: string;
  };

  type VerlaufPosition = {
    artikelName?: string;
    groesseId?: string | null;
    sollBestand?: number;
    istBestand?: number;
    differenz?: number;
  };

  type VerlaufEintrag = {
    id: string;
    aktion: string;
    ausgefuehrtAm: string;
    bearbeitetVon: string;
    begruendung: string | null;
    artikelName: string | null;
    alterIstBestand: number | null;
    neuerIstBestand: number | null;
    differenz: number | null;
    statusVorher: string | null;
    anzahlRueckbuchungen: number | null;
    anzahlKorrekturen: number | null;
    positionen: VerlaufPosition[] | null;
  };

  type Groesse = {
    _id: string;
    bezeichnung: string;
    sortierung: number;
  };

  let inventur = $state<Inventur | null>(null);
  let positionen = $state<Position[]>([]);
  let groessen = $state<Groesse[]>([]);
  let gespeichertePositionen = $state<Position[]>([]);
  let geladeneVersion = $state(0);

  let laden = $state(true);
  let fehler = $state('');
  let erfolg = $state('');
  let speichernId = $state<string | null>(null);
  let abschliessenLaeuft = $state(false);
  let abschlussBestaetigt = $state(false);
  let zuruecksetzenLaeuft = $state(false);
  let zuruecksetzenBestaetigt = $state(false);
  let stornierenLaeuft = $state(false);
  let stornierenBestaetigt = $state(false);
  let stornierungsgrund = $state('');
  let korrekturPositionId = $state<string | null>(null);
  let korrekturMenge = $state('');
  let korrekturGrund = $state('');
  let korrekturBestaetigt = $state(false);
  let korrekturLaeuft = $state(false);
  let korrekturHistorie = $state<KorrekturEintrag[]>([]);
  let inventurVerlauf = $state<VerlaufEintrag[]>([]);
  let korrekturHistorieFehler = $state('');
  let korrekturHistorieLaedt = $state(false);

  let suche = $state('');
  let filter = $state('alle');

  const inventurId = $derived(page.params.id ?? '');
  const abgeschlossen = $derived(
    inventur?.status === 'abgeschlossen'
  );
  const storniert = $derived(inventur?.status === 'storniert');
  const bearbeitbar = $derived(
    inventur?.status === 'offen'
  );

  const gezaehlt = $derived(
    gespeichertePositionen.filter(
      (position) => position.istBestand !== null
    ).length
  );

  const offenePositionen = $derived(
    gespeichertePositionen.length - gezaehlt
  );

  const abweichungen = $derived(
    gespeichertePositionen.filter(
      (position) =>
        position.istBestand !== null &&
        position.istBestand !== position.sollBestand
    ).length
  );

  const fortschritt = $derived(
    gespeichertePositionen.length
      ? Math.round((gezaehlt / gespeichertePositionen.length) * 100)
      : 0
  );

  function istUngespeichert(position: Position): boolean {
    const gespeichert = gespeichertePositionen.find(
      (eintrag) => eintrag._id === position._id
    );

    return !gespeichert ||
      gespeichert.istBestand !== position.istBestand ||
      gespeichert.bemerkung !== position.bemerkung;
  }

  const ungespeicherteAnzahl = $derived(
    positionen.filter((position) => istUngespeichert(position)).length
  );

  const bereitZumAbschluss = $derived(
    bearbeitbar &&
    positionen.length > 0 &&
    offenePositionen === 0 &&
    ungespeicherteAnzahl === 0 &&
    speichernId === null &&
    !abschliessenLaeuft &&
    !zuruecksetzenLaeuft &&
    !stornierenLaeuft
  );

  const gefiltertePositionen = $derived(
    positionen.filter((position) => {
      const suchtext = suche.toLowerCase().trim();

      const passtSuche =
        position.artikelName.toLowerCase().includes(suchtext) ||
        groesseAnzeigen(position.groesseId)
          .toLowerCase()
          .includes(suchtext);

      const passtFilter =
        filter === 'alle' ||
        (filter === 'offen' &&
          position.istBestand === null) ||
        (filter === 'gezaehlt' &&
          position.istBestand !== null) ||
        (filter === 'abweichungen' &&
          position.istBestand !== null &&
          position.istBestand !== position.sollBestand);

      return passtSuche && passtFilter;
    })
  );

  function groesseAnzeigen(id: string | null): string {
    if (!id) return '–';

    return groessen.find(
      (groesse) => groesse._id === id
    )?.bezeichnung ?? id;
  }

  function datumFormatieren(datum: string): string {
    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(datum));
  }

  async function korrekturHistorieLaden() {
    korrekturHistorieLaedt = true;
    korrekturHistorieFehler = '';
    try {
      const antwort = await fetch(`/api/inventuren/${inventurId}/korrekturhistorie`, {
        cache: 'no-store'
      });
      const daten = await antwort.json();
      if (!antwort.ok) {
        throw new Error(daten.fehler ?? 'Korrekturhistorie konnte nicht geladen werden.');
      }
      if (!Array.isArray(daten.korrekturen)) {
        throw new Error('Ungültige Antwort der Korrekturhistorie.');
      }
      if (!Array.isArray(daten.verlauf)) {
        throw new Error('Ungültige Antwort des Inventurverlaufs.');
      }
      korrekturHistorie = daten.korrekturen as KorrekturEintrag[];
      inventurVerlauf = daten.verlauf as VerlaufEintrag[];
    } catch (error) {
      korrekturHistorie = [];
      inventurVerlauf = [];
      korrekturHistorieFehler = error instanceof Error
        ? error.message
        : 'Korrekturhistorie konnte nicht geladen werden.';
    } finally {
      korrekturHistorieLaedt = false;
    }
  }

  async function datenLaden() {
    laden = true;
    fehler = '';

    try {
      const [inventurAntwort, groessenAntwort] =
        await Promise.all([
          fetch(`/api/inventuren/${inventurId}`),
          fetch('/api/groessen')
        ]);

      const inventurDaten = await inventurAntwort.json();

      if (!inventurAntwort.ok) {
        throw new Error(
          inventurDaten.fehler ??
            'Inventur konnte nicht geladen werden.'
        );
      }

      inventur = inventurDaten.inventur;
      geladeneVersion = inventurDaten.inventur.version ?? 0;
      const geladenePositionen: Position[] = inventurDaten.positionen.map(
        (position: Position) => ({
          ...position,
          bemerkung: position.bemerkung ?? ''
        })
      );
      positionen = geladenePositionen.map((position) => ({ ...position }));
      gespeichertePositionen = geladenePositionen.map((position) => ({ ...position }));
      abschlussBestaetigt = false;
      zuruecksetzenBestaetigt = false;

      if (inventur) {
        await korrekturHistorieLaden();
      } else {
        korrekturHistorie = [];
        inventurVerlauf = [];
        korrekturHistorieFehler = '';
      }

      if (groessenAntwort.ok) {
        const groessenDaten = await groessenAntwort.json();

        if (Array.isArray(groessenDaten)) {
          groessen = groessenDaten;
        }
      }
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      laden = false;
    }
  }

  async function positionSpeichern(position: Position) {
    fehler = '';
    erfolg = '';

    if (
      position.istBestand !== null &&
      (
        !Number.isSafeInteger(position.istBestand) ||
        position.istBestand < 0
      )
    ) {
      fehler = 'Bitte eine gültige ganze Menge ab 0 eingeben.';
      return;
    }

    speichernId = position._id;
    const gesendeterIstBestand = position.istBestand;
    const gesendeteBemerkung = position.bemerkung;

    try {
      const antwort = await fetch(
        `/api/inventuren/${inventurId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            positionId: position._id,
            istBestand: gesendeterIstBestand,
            bemerkung: gesendeteBemerkung
          })
        }
      );

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ??
            'Position konnte nicht gespeichert werden.'
        );
      }

      const gespeicherterEintrag: Position = {
        ...position,
        istBestand: daten.istBestand,
        differenz: daten.differenz,
        bemerkung: daten.bemerkung
      };

      gespeichertePositionen = gespeichertePositionen.map((eintrag) =>
        eintrag._id === position._id
          ? { ...gespeicherterEintrag }
          : eintrag
      );

      positionen = positionen.map((eintrag) =>
        eintrag._id === position._id
          ? {
              ...eintrag,
              // Änderungen während des Speicherns nicht überschreiben.
              istBestand:
                eintrag.istBestand === gesendeterIstBestand
                  ? daten.istBestand
                  : eintrag.istBestand,
              bemerkung:
                eintrag.bemerkung === gesendeteBemerkung
                  ? daten.bemerkung
                  : eintrag.bemerkung,
              differenz: daten.differenz
            }
          : eintrag
      );
      geladeneVersion = daten.version;
      abschlussBestaetigt = false;

      erfolg = `${position.artikelName} wurde gespeichert.`;
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Position konnte nicht gespeichert werden.';
    } finally {
      speichernId = null;
    }
  }

  async function inventurAbschliessen() {
    if (!bereitZumAbschluss || !abschlussBestaetigt) return;

    fehler = '';
    erfolg = '';
    abschliessenLaeuft = true;

    try {
      // Vor dem Abschluss erneut die serverseitigen Daten prüfen.
      const pruefung = await fetch(`/api/inventuren/${inventurId}`, {
        cache: 'no-store'
      });
      const aktuelleDaten = await pruefung.json();

      if (!pruefung.ok) {
        throw new Error(
          aktuelleDaten.fehler ?? 'Inventur konnte nicht geprüft werden.'
        );
      }

      if (aktuelleDaten.inventur.status !== 'offen') {
        throw new Error('Die Inventur ist nicht mehr offen. Bitte Seite neu laden.');
      }

      if (aktuelleDaten.inventur.version !== geladeneVersion) {
        throw new Error(
          'Die Inventur wurde inzwischen von jemand anderem bearbeitet. ' +
          'Bitte die Seite neu laden und die Zählungen kontrollieren.'
        );
      }

      const aktuellePositionen: Position[] = aktuelleDaten.positionen;
      if (
        aktuellePositionen.length !== gespeichertePositionen.length ||
        aktuellePositionen.some((aktuell) => {
          const lokal = gespeichertePositionen.find(
            (position) => position._id === aktuell._id
          );
          return !lokal ||
            aktuell.istBestand !== lokal.istBestand ||
            (aktuell.bemerkung ?? '') !== lokal.bemerkung;
        })
      ) {
        throw new Error(
          'Die gespeicherten Zählungen haben sich verändert. ' +
          'Bitte die Seite neu laden und kontrollieren.'
        );
      }

      if (aktuellePositionen.some((position) => position.istBestand === null)) {
        throw new Error('Es sind noch nicht alle Positionen gezählt.');
      }

      const antwort = await fetch(
        `/api/inventuren/${inventurId}/abschliessen`,
        { method: 'POST' }
      );
      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ?? 'Inventur konnte nicht abgeschlossen werden.'
        );
      }

      await datenLaden();
      erfolg =
        `Inventur erfolgreich abgeschlossen. ` +
        `${daten.anzahlKorrekturen} Bestandskorrekturen übernommen.`;
    } catch (error) {
      fehler = error instanceof Error
        ? error.message
        : 'Inventur konnte nicht abgeschlossen werden.';
      abschlussBestaetigt = false;
    } finally {
      abschliessenLaeuft = false;
    }
  }

  async function inventurZuruecksetzen() {
    if (
      !bearbeitbar ||
      !zuruecksetzenBestaetigt ||
      speichernId !== null ||
      abschliessenLaeuft ||
      zuruecksetzenLaeuft
    ) return;

    fehler = '';
    erfolg = '';
    zuruecksetzenLaeuft = true;

    try {
      // Vor dem Zurücksetzen fremde Änderungen erkennen.
      const pruefung = await fetch(`/api/inventuren/${inventurId}`, {
        cache: 'no-store'
      });
      const aktuelleDaten = await pruefung.json();

      if (!pruefung.ok) {
        throw new Error(aktuelleDaten.fehler ?? 'Inventur konnte nicht geprüft werden.');
      }

      if (aktuelleDaten.inventur.status !== 'offen') {
        throw new Error('Die Inventur ist nicht mehr offen. Bitte Seite neu laden.');
      }

      if (aktuelleDaten.inventur.version !== geladeneVersion) {
        throw new Error(
          'Die Inventur wurde zwischenzeitlich verändert. ' +
          'Bitte die Seite neu laden, bevor du die Zählung zurücksetzt.'
        );
      }

      const antwort = await fetch(
        `/api/inventuren/${inventurId}/zuruecksetzen`,
        { method: 'POST' }
      );
      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(daten.fehler ?? 'Zählung konnte nicht zurückgesetzt werden.');
      }

      await datenLaden();
      erfolg = `${daten.anzahlZurueckgesetzt} Inventurpositionen wurden zurückgesetzt.`;
    } catch (error) {
      fehler = error instanceof Error
        ? error.message
        : 'Zählung konnte nicht zurückgesetzt werden.';
    } finally {
      zuruecksetzenLaeuft = false;
      zuruecksetzenBestaetigt = false;
    }
  }

  async function inventurStornieren() {
    const grund = stornierungsgrund.trim();
    if (
      !inventur ||
      (inventur.status !== 'offen' && inventur.status !== 'abgeschlossen') ||
      !stornierenBestaetigt ||
      grund.length < 5 || grund.length > 1000 ||
      speichernId !== null ||
      abschliessenLaeuft ||
      zuruecksetzenLaeuft ||
      stornierenLaeuft ||
      korrekturLaeuft ||
      ungespeicherteAnzahl > 0
    ) return;

    fehler = '';
    erfolg = '';
    stornierenLaeuft = true;

    try {
      const pruefung = await fetch(`/api/inventuren/${inventurId}`, {
        cache: 'no-store'
      });
      const aktuelleDaten = await pruefung.json();
      if (!pruefung.ok) {
        throw new Error(aktuelleDaten.fehler ?? 'Inventur konnte nicht geprüft werden.');
      }
      if (aktuelleDaten.inventur.status !== inventur.status ||
          aktuelleDaten.inventur.version !== geladeneVersion) {
        throw new Error(
          'Die Inventur wurde zwischenzeitlich verändert. Bitte Seite neu laden und erneut prüfen.'
        );
      }

      const antwort = await fetch(`/api/inventuren/${inventurId}/stornieren`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ begruendung: grund })
      });
      const daten = await antwort.json();
      if (!antwort.ok) {
        throw new Error(daten.fehler ?? 'Inventur konnte nicht storniert werden.');
      }

      await datenLaden();
      stornierungsgrund = '';
      erfolg = daten.meldung ?? 'Inventur wurde storniert.';
    } catch (error) {
      fehler = error instanceof Error
        ? error.message
        : 'Inventur konnte nicht storniert werden.';
    } finally {
      stornierenLaeuft = false;
      stornierenBestaetigt = false;
    }
  }

  function korrekturStarten(position: Position) {
    if (!abgeschlossen || korrekturLaeuft || stornierenLaeuft) return;
    korrekturPositionId = position._id;
    korrekturMenge = String(position.istBestand ?? '');
    korrekturGrund = '';
    korrekturBestaetigt = false;
    fehler = '';
    erfolg = '';
  }

  function korrekturAbbrechen() {
    korrekturPositionId = null;
    korrekturMenge = '';
    korrekturGrund = '';
    korrekturBestaetigt = false;
  }

  async function korrekturSpeichern() {
    const position = gespeichertePositionen.find((p) => p._id === korrekturPositionId);
    const neuerWert = Number(korrekturMenge);
    const grund = korrekturGrund.trim();
    if (!abgeschlossen || !position || !korrekturBestaetigt || korrekturLaeuft || stornierenLaeuft ||
        String(korrekturMenge ?? '').trim() === '' || !Number.isSafeInteger(neuerWert) || neuerWert < 0 ||
        neuerWert === position.istBestand || grund.length < 5 || grund.length > 1000) return;

    korrekturLaeuft = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch(`/api/inventuren/${inventurId}/korrigieren`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: position._id,
          neuerIstBestand: neuerWert,
          begruendung: grund,
          version: geladeneVersion
        })
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Inventurkorrektur fehlgeschlagen.');
      korrekturAbbrechen();
      await datenLaden();
      erfolg = `${position.artikelName}: Bestand um ${daten.differenz > 0 ? '+' : ''}${daten.differenz} korrigiert.`;
    } catch (error) {
      fehler = error instanceof Error ? error.message : 'Inventurkorrektur fehlgeschlagen.';
    } finally {
      korrekturLaeuft = false;
    }
  }

  onMount(() => {
    void datenLaden();
  });
</script>

<svelte:head>
  <title>{inventur?.name ?? 'Inventur'} | ClubMatiq</title>
</svelte:head>

<div class="seite">
  <a class="zurueck" href="/inventur">
    ← Zurück zur Inventurübersicht
  </a>

  {#if laden}
    <p>Inventur wird geladen ...</p>
  {:else if inventur}
  <div class="pdf-aktionen">
    <a
      class="pdf-button"
      href={`/api/inventuren/${inventurId}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
    >
      📄 Inventurbericht als PDF herunterladen
    </a>
  </div>
    <div class="kopf">
      <div>
        <h1>{inventur.name}</h1>
        <p>
          {inventur.typ === 'gesamt'
            ? 'Gesamtinventur'
            : `Lagerort: ${inventur.lagerortName ?? 'Unbekannt'}`}
          · Erstellt am {datumFormatieren(inventur.erstelltAm)}
        </p>
      </div>

      <span class:fertig={abgeschlossen} class:storniert={storniert} class="status">
        {storniert ? 'Storniert' : abgeschlossen ? 'Abgeschlossen' : 'Offen'}
      </span>
    </div>

    {#if fehler}
      <div class="meldung fehler">{fehler}</div>
    {/if}

    {#if erfolg}
      <div class="meldung erfolg">{erfolg}</div>
    {/if}

    {#if ungespeicherteAnzahl > 0 && bearbeitbar}
      <div class="meldung hinweis">
        {ungespeicherteAnzahl} Position(en) enthalten ungespeicherte Änderungen.
        Bitte die betroffenen Zeilen speichern.
      </div>
    {/if}

    <div class="kennzahlen">
      <div class="kennzahl">
        <span>Positionen</span>
        <strong>{positionen.length}</strong>
      </div>
      <div class="kennzahl">
        <span>Gezählt</span>
        <strong>{gezaehlt}</strong>
      </div>
      <div class="kennzahl">
        <span>Noch offen</span>
        <strong>{offenePositionen}</strong>
      </div>
      <div class="kennzahl">
        <span>Abweichungen</span>
        <strong>{abweichungen}</strong>
      </div>
    </div>

    <section class="karte">
      <div class="fortschritt-kopf">
        <h2>Zählfortschritt</h2>
        <strong>{fortschritt}%</strong>
      </div>

      <div class="fortschritt-hintergrund">
        <div
          class="fortschritt-balken"
          style:width={`${fortschritt}%`}
        ></div>
      </div>

      <p>
        {gezaehlt} von {positionen.length} Positionen gezählt
      </p>
    </section>

    <section class="karte">
      <div class="werkzeuge">
        <input
          type="search"
          placeholder="Artikel oder Grösse suchen ..."
          bind:value={suche}
          aria-label="Artikel oder Grösse suchen"
        />

        <select
          bind:value={filter}
          aria-label="Positionen filtern"
        >
          <option value="alle">Alle Positionen</option>
          <option value="offen">Noch nicht gezählt</option>
          <option value="gezaehlt">Bereits gezählt</option>
          <option value="abweichungen">Mit Abweichung</option>
        </select>
      </div>

      <div class="tabelle-container">
        <table>
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Grösse</th>
              <th>Soll</th>
              <th>Ist</th>
              <th>Differenz</th>
              <th>Bemerkung</th>
              <th>Aktion</th>
            </tr>
          </thead>

          <tbody>
            {#each gefiltertePositionen as position (position._id)}
              <tr>
                <td>
                  <strong>{position.artikelName}</strong>
                  {#if istUngespeichert(position)}
                    <span class="ungespeichert">Nicht gespeichert</span>
                  {/if}
                </td>
                <td>
                  {groesseAnzeigen(position.groesseId)}
                </td>
                <td>{position.sollBestand}</td>
                <td>
                  <input
                    class="menge"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!bearbeitbar || abschliessenLaeuft || zuruecksetzenLaeuft || stornierenLaeuft || speichernId === position._id}
                    value={position.istBestand ?? ''}
                    oninput={(event) => {
                      const wert = event.currentTarget.value;
                      position.istBestand =
                        wert === '' ? null : Number(wert);
                    }}
                    aria-label={`Ist-Bestand für ${position.artikelName}`}
                  />
                </td>
                <td>
                  {#if position.istBestand === null}
                    <span class="neutral">–</span>
                  {:else}
                    {@const differenz =
                      position.istBestand - position.sollBestand}
                    <span
                      class:abweichung={differenz !== 0}
                      class="differenz"
                    >
                      {differenz > 0 ? '+' : ''}{differenz}
                    </span>
                  {/if}
                </td>
                <td>
                  <input
                    class="bemerkung"
                    type="text"
                    maxlength="1000"
                    placeholder="Optional"
                    disabled={!bearbeitbar || abschliessenLaeuft || zuruecksetzenLaeuft || stornierenLaeuft || speichernId === position._id}
                    bind:value={position.bemerkung}
                    aria-label={`Bemerkung für ${position.artikelName}`}
                  />
                </td>
                <td>
                  <button
                    class="speichern"
                    disabled={!bearbeitbar ||
                      speichernId !== null ||
                      abschliessenLaeuft ||
                      zuruecksetzenLaeuft ||
                      !istUngespeichert(position)}
                    onclick={() => positionSpeichern(position)}
                  >
                    {speichernId === position._id
                      ? 'Speichert ...'
                      : 'Speichern'}
                  </button>
                  {#if abgeschlossen}
                    <button class="korrektur-button" disabled={korrekturLaeuft || stornierenLaeuft}
                      onclick={() => korrekturStarten(position)}>Korrigieren</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if gefiltertePositionen.length === 0}
        <p class="leer">
          Keine passenden Positionen gefunden.
        </p>
      {/if}
    </section>

    {#if abgeschlossen && korrekturPositionId}
      {@const aktuellePosition = gespeichertePositionen.find((p) => p._id === korrekturPositionId)}
      {#if aktuellePosition}
        <section class="karte korrektur-bereich">
          <h2>Inventurposition nachträglich korrigieren</h2>
          <p><strong>{aktuellePosition.artikelName}</strong> · Grösse: {groesseAnzeigen(aktuellePosition.groesseId)}</p>
          <p>Bisher gezählt: <strong>{aktuellePosition.istBestand}</strong> · Ursprünglicher Soll-Bestand: {aktuellePosition.sollBestand}</p>
          <label class="feld-label" for="korrektur-menge">Neuer gezählter Bestand</label>
          <input id="korrektur-menge" type="number" min="0" step="1" bind:value={korrekturMenge} disabled={korrekturLaeuft}/>
          {#if String(korrekturMenge ?? '').trim() !== '' && Number.isSafeInteger(Number(korrekturMenge)) && Number(korrekturMenge) >= 0 && aktuellePosition.istBestand !== null}
            <p>Zusätzliche Buchung: <strong>{Number(korrekturMenge) - aktuellePosition.istBestand > 0 ? '+' : ''}{Number(korrekturMenge) - aktuellePosition.istBestand}</strong> Stück</p>
          {/if}
          <label class="feld-label" for="korrektur-grund">Begründung (mindestens 5 Zeichen)</label>
          <textarea id="korrektur-grund" rows="3" maxlength="1000" bind:value={korrekturGrund} disabled={korrekturLaeuft} placeholder="Warum muss die Zählung korrigiert werden?"></textarea>
          <label class="bestaetigung"><input type="checkbox" bind:checked={korrekturBestaetigt} disabled={korrekturLaeuft}/>
            Ich bestätige die verbindliche Bestandskorrektur.</label>
          <div class="korrektur-aktionen">
            <button
              class="korrektur-button"
              disabled={
                !korrekturBestaetigt ||
                korrekturLaeuft ||
                stornierenLaeuft ||
                korrekturMenge === null ||
                korrekturMenge === undefined ||
                korrekturMenge === '' ||
                !Number.isSafeInteger(Number(korrekturMenge)) ||
                Number(korrekturMenge) < 0 ||
                Number(korrekturMenge) === aktuellePosition.istBestand ||
                korrekturGrund.trim().length < 5 ||
                korrekturGrund.trim().length > 1000
              }
              onclick={korrekturSpeichern}
            >
              {korrekturLaeuft ? 'Wird korrigiert ...' : 'Korrektur verbindlich buchen'}
            </button>
            <button class="abbrechen-button" disabled={korrekturLaeuft} onclick={korrekturAbbrechen}>Abbrechen</button>
          </div>
          <p class="warnung">Es wird nur die zusätzliche Differenz gebucht. Die Korrektur wird protokolliert.</p>
        </section>
      {/if}
    {/if}

    {#if bearbeitbar}
      <section class="karte zuruecksetzen-bereich">
        <h2>Zählung zurücksetzen</h2>
        <p>
          Damit werden alle gespeicherten Ist-Mengen und Bemerkungen dieser
          Inventur gelöscht. Die Soll-Bestände und das tatsächliche Inventar
          bleiben unverändert.
        </p>
        {#if ungespeicherteAnzahl > 0}
          <p class="abschluss-hinweis">
            Achtung: Auch {ungespeicherteAnzahl} ungespeicherte Änderung(en)
            auf dieser Seite gehen verloren.
          </p>
        {/if}
        <label class="bestaetigung">
          <input
            type="checkbox"
            bind:checked={zuruecksetzenBestaetigt}
            disabled={speichernId !== null || abschliessenLaeuft || zuruecksetzenLaeuft || stornierenLaeuft}
          />
          Ich möchte alle Zählungen dieser offenen Inventur löschen und neu beginnen.
        </label>
        <button
          class="zuruecksetzen-button"
          disabled={!zuruecksetzenBestaetigt || speichernId !== null ||
            abschliessenLaeuft || zuruecksetzenLaeuft || stornierenLaeuft}
          onclick={inventurZuruecksetzen}
        >
          {zuruecksetzenLaeuft ? 'Wird zurückgesetzt ...' : 'Zählung zurücksetzen'}
        </button>
      </section>
    {/if}

    <section class="karte abschluss">
      <h2>Inventurabschluss</h2>

      {#if abgeschlossen}
        <p>
          Diese Inventur wurde am
          {inventur.abgeschlossenAm
            ? datumFormatieren(inventur.abgeschlossenAm)
            : 'einem unbekannten Datum'}
          abgeschlossen.
        </p>
        <p>
          Bestandskorrekturen:
          <strong>{inventur.anzahlKorrekturen ?? 0}</strong>
        </p>
      {:else if bearbeitbar}
        <p>
          Vor dem Abschluss müssen alle Positionen gezählt
          und gespeichert sein.
        </p>

        {#if offenePositionen > 0}
          <p class="abschluss-hinweis">
            Es fehlen noch {offenePositionen} Positionen.
          </p>
        {:else}
          <p class="abschluss-bereit">
            Alle Positionen wurden gespeichert und gezählt.
          </p>
        {/if}

        {#if ungespeicherteAnzahl > 0}
          <p class="abschluss-hinweis">
            Abschluss gesperrt: {ungespeicherteAnzahl} Position(en) sind noch nicht gespeichert.
          </p>
        {/if}

        <label class="bestaetigung">
          <input
            type="checkbox"
            bind:checked={abschlussBestaetigt}
            disabled={!bereitZumAbschluss || abschliessenLaeuft}
          />
          Ich habe die gezählten Bestände kontrolliert
          und bestätige die Übernahme der Differenzen.
        </label>

        <button
          class="abschluss-button"
          disabled={!bereitZumAbschluss ||
            !abschlussBestaetigt ||
            abschliessenLaeuft}
          onclick={inventurAbschliessen}
        >
          {abschliessenLaeuft
            ? 'Inventur wird abgeschlossen ...'
            : 'Inventur verbindlich abschliessen'}
        </button>

        <p class="warnung">
          Achtung: Beim Abschluss werden Bestandsdifferenzen
          direkt in das Inventar übernommen. Dieser Vorgang
          kann nicht über diese Seite rückgängig gemacht werden.
        </p>
      {:else}
        <p>Diese Inventur wurde storniert und kann nicht mehr abgeschlossen werden.</p>
      {/if}
    </section>

    {#if abgeschlossen || storniert}
      <section class="karte historie-bereich">
        <div class="historie-kopf">
          <h2>Nachträgliche Korrekturen ({korrekturHistorie.length})</h2>
          <button class="historie-aktualisieren" disabled={korrekturHistorieLaedt}
            onclick={korrekturHistorieLaden}>
            {korrekturHistorieLaedt ? 'Lädt ...' : 'Aktualisieren'}
          </button>
        </div>
        {#if korrekturHistorieFehler}
          <p class="historie-fehler">{korrekturHistorieFehler}</p>
        {:else if korrekturHistorieLaedt && korrekturHistorie.length === 0}
          <p>Korrekturhistorie wird geladen ...</p>
        {:else if korrekturHistorie.length === 0}
          <p>Es wurden noch keine nachträglichen Korrekturen vorgenommen.</p>
        {:else}
          <div class="tabelle-container">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Artikel / Grösse</th>
                  <th>Vorher</th>
                  <th>Nachher</th>
                  <th>Buchung</th>
                  <th>Begründung</th>
                  <th>Bearbeitet von</th>
                </tr>
              </thead>
              <tbody>
                {#each korrekturHistorie as eintrag (eintrag.id)}
                  <tr>
                    <td>{datumFormatieren(eintrag.ausgefuehrtAm)}</td>
                    <td><strong>{eintrag.artikelName}</strong><span class="historie-groesse">{groesseAnzeigen(eintrag.groesseId)}</span></td>
                    <td>{eintrag.alterIstBestand}</td>
                    <td>{eintrag.neuerIstBestand}</td>
                    <td><strong class:historie-negativ={eintrag.differenz < 0} class="historie-differenz">{eintrag.differenz > 0 ? '+' : ''}{eintrag.differenz}</strong></td>
                    <td class="historie-begruendung">{eintrag.begruendung}</td>
                    <td class="historie-benutzer">{eintrag.bearbeitetVon ?? 'Unbekannter Benutzer'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="historie-hinweis">Die Einträge zeigen nachträgliche Korrekturen. Bestandsänderungen beim ursprünglichen Inventurabschluss sind nicht enthalten.</p>
        {/if}
      </section>
    {/if}

    <section class="karte historie-bereich">
      <div class="historie-kopf">
        <h2>Inventurverlauf ({inventurVerlauf.length})</h2>
        <button class="historie-aktualisieren" disabled={korrekturHistorieLaedt}
          onclick={korrekturHistorieLaden}>
          {korrekturHistorieLaedt ? 'Lädt ...' : 'Aktualisieren'}
        </button>
      </div>
      {#if korrekturHistorieFehler}
        <p class="historie-fehler">{korrekturHistorieFehler}</p>
      {:else if korrekturHistorieLaedt && inventurVerlauf.length === 0}
        <p>Inventurverlauf wird geladen ...</p>
      {:else if inventurVerlauf.length === 0}
        <p>Es sind noch keine protokollierten Ereignisse vorhanden.</p>
      {:else}
        <div class="tabelle-container">
          <table>
            <thead>
              <tr><th>Datum</th><th>Ereignis</th><th>Details</th><th>Bearbeitet von</th></tr>
            </thead>
            <tbody>
              {#each inventurVerlauf as eintrag (eintrag.id)}
                <tr>
                  <td>{datumFormatieren(eintrag.ausgefuehrtAm)}</td>
                  <td>
                    <strong>
                      {eintrag.aktion === 'erstellt' ? 'Inventur erstellt'
                        : eintrag.aktion === 'abgeschlossen' ? 'Inventur abgeschlossen'
                        : eintrag.aktion === 'nachtraeglich_korrigiert' ? 'Bestand korrigiert'
                        : eintrag.aktion === 'storniert' ? 'Inventur storniert'
                        : eintrag.aktion.replaceAll('_', ' ')}
                    </strong>
                  </td>
                  <td class="verlauf-details">
                    {#if eintrag.aktion === 'nachtraeglich_korrigiert'}
                      <strong>{eintrag.artikelName ?? 'Unbekannter Artikel'}</strong>
                      {#if eintrag.alterIstBestand !== null && eintrag.neuerIstBestand !== null}
                        · {eintrag.alterIstBestand} → {eintrag.neuerIstBestand}
                      {/if}
                      {#if eintrag.differenz !== null}
                        · Buchung {eintrag.differenz > 0 ? '+' : ''}{eintrag.differenz}
                      {/if}
                    {:else if eintrag.aktion === 'abgeschlossen'}
                      {#if eintrag.anzahlKorrekturen !== null}
                        {eintrag.anzahlKorrekturen} Bestandskorrektur(en)
                      {/if}
                      {#if eintrag.positionen && eintrag.positionen.length > 0}
                        <details>
                          <summary>Ursprüngliche Zählung anzeigen ({eintrag.positionen.length} Positionen)</summary>
                          <div class="tabelle-container">
                            <table>
                              <thead><tr><th>Artikel</th><th>Grösse</th><th>Soll</th><th>Ist</th><th>Differenz</th></tr></thead>
                              <tbody>
                                {#each eintrag.positionen as position, index (index)}
                                  <tr>
                                    <td>{position.artikelName ?? 'Unbekannter Artikel'}</td>
                                    <td>{groesseAnzeigen(position.groesseId ?? null)}</td>
                                    <td>{position.sollBestand ?? '–'}</td>
                                    <td>{position.istBestand ?? '–'}</td>
                                    <td>{position.differenz ?? '–'}</td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      {/if}
                    {:else if eintrag.aktion === 'storniert'}
                      {#if eintrag.statusVorher}
                        Vorheriger Status: {eintrag.statusVorher}
                      {/if}
                      {#if eintrag.anzahlRueckbuchungen !== null}
                        · {eintrag.anzahlRueckbuchungen} Rückbuchung(en)
                      {/if}
                    {/if}
                    {#if eintrag.begruendung}
                      <p>Begründung: {eintrag.begruendung}</p>
                    {/if}
                  </td>
                  <td class="historie-benutzer">{eintrag.bearbeitetVon}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    {#if inventur.status === 'offen' || inventur.status === 'abgeschlossen'}
      <section class="karte stornieren-bereich">
        <h2>Inventur stornieren</h2>
        <p>
          {abgeschlossen
            ? 'Bei einer abgeschlossenen Inventur werden die gebuchten Bestandsdifferenzen rückgebucht. Spätere Ausleihen und Rückgaben bleiben bestehen.'
            : 'Die offene Inventur wird beendet. Lagerbestände bleiben unverändert.'}
        </p>
        <label class="feld-label" for="stornierungsgrund">Begründung (mindestens 5 Zeichen)</label>
        <textarea
          id="stornierungsgrund"
          rows="3"
          maxlength="1000"
          placeholder="Warum wird diese Inventur storniert?"
          bind:value={stornierungsgrund}
          disabled={stornierenLaeuft || abschliessenLaeuft || zuruecksetzenLaeuft}
        ></textarea>
        {#if ungespeicherteAnzahl > 0}
          <p class="abschluss-hinweis">Bitte zuerst ungespeicherte Änderungen speichern oder die Seite neu laden.</p>
        {/if}
        <label class="bestaetigung">
          <input
            type="checkbox"
            bind:checked={stornierenBestaetigt}
            disabled={stornierenLaeuft || abschliessenLaeuft || zuruecksetzenLaeuft}
          />
          Ich bestätige, dass ich diese Inventur endgültig stornieren möchte.
        </label>
        <button
          class="stornieren-button"
          disabled={!stornierenBestaetigt || stornierungsgrund.trim().length < 5 ||
            stornierungsgrund.trim().length > 1000 || ungespeicherteAnzahl > 0 ||
            speichernId !== null || abschliessenLaeuft || zuruecksetzenLaeuft || stornierenLaeuft || korrekturLaeuft}
          onclick={inventurStornieren}
        >
          {stornierenLaeuft ? 'Wird storniert ...' : 'Inventur verbindlich stornieren'}
        </button>
        <p class="warnung">Nur Administratoren und Materialverantwortliche dürfen stornieren. Bei abgeschlossenen Inventuren kann eine Rückbuchung abgelehnt werden, wenn der Bestand nicht ausreicht.</p>
      </section>
    {:else if storniert}
      <section class="karte stornieren-bereich">
        <h2>Stornierte Inventur</h2>
        <p>Storniert am: {inventur.storniertAm ? datumFormatieren(inventur.storniertAm) : 'Unbekannt'}</p>
        {#if inventur.stornierungsgrund}
          <p>Begründung: {inventur.stornierungsgrund}</p>
        {/if}
      </section>
    {/if}
  {:else if fehler}
    <div class="meldung fehler">{fehler}</div>
  {/if}
</div>

<style>
  .seite {
    max-width: 1400px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .zurueck {
    display: inline-block;
    margin-bottom: 24px;
    color: #172b4d;
    text-decoration: none;
    font-weight: 600;
  }

  .kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 28px;
  }

  h1 {
    font-size: 30px;
    color: #172b4d;
    margin: 0 0 8px;
  }

  h2 {
    font-size: 19px;
    color: #172b4d;
    margin: 0;
  }

  p {
    color: #64748b;
    margin: 8px 0 0;
  }

  .status {
    padding: 8px 14px;
    border-radius: 20px;
    background: #fef3c7;
    color: #92400e;
    font-weight: 600;
  }

  .status.storniert {
    background: #fee2e2;
    color: #991b1b;
  }

  .status.fertig {
    background: #dcfce7;
    color: #166534;
  }

  .kennzahlen {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .kennzahl,
  .karte {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
  }

  .kennzahl {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .kennzahl span {
    color: #64748b;
    font-size: 14px;
  }

  .kennzahl strong {
    font-size: 28px;
    color: #172b4d;
  }

  .karte {
    margin-bottom: 24px;
  }

  .fortschritt-kopf {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .fortschritt-hintergrund {
    height: 12px;
    background: #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .fortschritt-balken {
    height: 100%;
    background: #172b4d;
    border-radius: 10px;
    transition: width 0.2s;
  }

  .werkzeuge {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  input,
  select,
  textarea {
    padding: 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    box-sizing: border-box;
  }

  .werkzeuge input {
    flex: 1;
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
    text-align: left;
    padding: 14px 10px;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    color: #64748b;
    font-size: 13px;
  }

  td {
    color: #334155;
  }

  .menge {
    width: 85px;
  }

  .bemerkung {
    min-width: 170px;
    width: 100%;
  }

  .speichern,
  .abschluss-button {
    background: #172b4d;
    color: white;
    border: 0;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
  }

  .historie-bereich { border-top: 3px solid #2563eb; }
  .historie-kopf { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
  .historie-aktualisieren { background: #e2e8f0; color: #172b4d; border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  .historie-groesse { display: block; font-size: 12px; color: #64748b; margin-top: 4px; }
  .historie-differenz { color: #166534; }
  .historie-differenz.historie-negativ { color: #b45309; }
  .historie-begruendung { min-width: 180px; overflow-wrap: anywhere; }
  .historie-benutzer { font-size: 12px; overflow-wrap: anywhere; max-width: 160px; }
  .historie-fehler { color: #991b1b; }
  .historie-hinweis { font-size: 12px; margin-top: 16px; }
  .verlauf-details { min-width: 260px; overflow-wrap: anywhere; }
  .verlauf-details details { margin-top: 10px; }
  .verlauf-details summary { cursor: pointer; color: #1d4ed8; font-weight: 600; }
  .verlauf-details details .tabelle-container { margin-top: 10px; }
  .verlauf-details details th, .verlauf-details details td { padding: 8px; }


  .korrektur-bereich { border-top: 3px solid #2563eb; }
  .korrektur-bereich textarea { width: 100%; display: block; resize: vertical; }
  .korrektur-button { background: #1d4ed8; color: white; border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; margin-top: 8px; }
  .korrektur-aktionen { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .abbrechen-button { background: #e2e8f0; color: #334155; border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; }

  .stornieren-bereich {
    border-top: 3px solid #991b1b;
  }

  .feld-label {
    display: block;
    margin-top: 20px;
    margin-bottom: 8px;
    font-weight: 600;
    color: #334155;
  }

  .stornieren-bereich textarea {
    display: block;
    width: 100%;
    resize: vertical;
  }

  .stornieren-button {
    background: #991b1b;
    color: white;
    border: 0;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
  }

  .zuruecksetzen-bereich {
    border-top: 3px solid #b45309;
  }

  .zuruecksetzen-button {
    background: #9a3412;
    color: white;
    border: 0;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .differenz {
    font-weight: 600;
    color: #166534;
  }

  .differenz.abweichung {
    color: #b45309;
  }

  .neutral {
    color: #94a3b8;
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

  .hinweis {
    background: #fef3c7;
    color: #92400e;
  }

  .ungespeichert {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #b45309;
  }

  .erfolg {
    background: #dcfce7;
    color: #166534;
  }

  .leer {
    text-align: center;
    padding: 30px;
  }

  .abschluss {
    border-top: 3px solid #172b4d;
  }

  .abschluss-hinweis {
    color: #92400e;
    font-weight: 600;
  }

  .abschluss-bereit {
    color: #166534;
    font-weight: 600;
  }

  .bestaetigung {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 22px 0;
    color: #334155;
  }

  .bestaetigung input {
    margin-top: 4px;
  }

  .warnung {
    font-size: 13px;
    margin-top: 14px;
    color: #92400e;
  }

  @media (max-width: 900px) {
    .kennzahlen {
      grid-template-columns: repeat(2, 1fr);
    }

    .werkzeuge {
      flex-direction: column;
    }
  }

  @media (max-width: 600px) {
    .seite {
      padding: 20px 12px;
    }

    .kopf {
      align-items: flex-start;
      flex-direction: column;
    }

    .kennzahl,
    .karte {
      padding: 16px;
    }
  }

  .pdf-aktionen {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }

  .pdf-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 8px;
    background: #172b4d;
    color: white;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.2s;
  }

  .pdf-button:hover {
    background: #2563eb;
  }
</style>
