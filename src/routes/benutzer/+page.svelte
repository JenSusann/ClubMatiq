
<script lang="ts">
  import { onMount } from 'svelte';

  type Benutzerrolle =
    | 'admin'
    | 'materialverantwortlich'
    | 'leiter'
    | 'mitglied';

  type Benutzer = {
    id: string;
    vorname: string;
    nachname: string;
    email: string;
    rolle: Benutzerrolle;
    aktiv: boolean;
  };

  type Einladungsstatus =
    | 'offen'
    | 'abgelaufen'
    | 'angenommen'
    | 'widerrufen';

  type Einladung = {
    id: string;
    vorname: string;
    nachname: string;
    email: string;
    rolle: Benutzerrolle;
    status: Einladungsstatus;
    erstelltAm: string;
    ablaufdatum: string;
    versendet: boolean;
  };

  // Benutzer
  let benutzer = $state<Benutzer[]>([]);
  let benutzerLaden = $state(true);

  // Einladungen
  let einladungen = $state<Einladung[]>([]);
  let einladungenLaden = $state(true);

  // Formular
  let vorname = $state('');
  let nachname = $state('');
  let email = $state('');
  let rolle = $state<Benutzerrolle>('mitglied');
  let speichern = $state(false);

  // Meldungen
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let benutzerFehler = $state('');
  let einladungenFehler = $state('');

  const rollen: {
    wert: Benutzerrolle;
    bezeichnung: string;
  }[] = [
    {
      wert: 'admin',
      bezeichnung: 'Administrator'
    },
    {
      wert: 'materialverantwortlich',
      bezeichnung: 'Materialverantwortliche'
    },
    {
      wert: 'leiter',
      bezeichnung: 'Leiter/in'
    },
    {
      wert: 'mitglied',
      bezeichnung: 'Mitglied'
    }
  ];

  function rollenname(wert: Benutzerrolle): string {
    return (
      rollen.find((eintrag) => eintrag.wert === wert)
        ?.bezeichnung ?? wert
    );
  }

  function formatiereDatum(datum: string): string {
    const wert = new Date(datum);

    if (Number.isNaN(wert.getTime())) {
      return '–';
    }

    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(wert);
  }

  function statusname(status: Einladungsstatus): string {
    switch (status) {
      case 'offen':
        return 'Vorbereitet';

      case 'abgelaufen':
        return 'Abgelaufen';

      case 'angenommen':
        return 'Angenommen';

      case 'widerrufen':
        return 'Widerrufen';

      default:
        return status;
    }
  }

  // Benutzer des eigenen Vereins laden
  async function ladeBenutzer() {
    benutzerLaden = true;
    benutzerFehler = '';

    try {
      const antwort = await fetch('/api/benutzer');
      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ??
            'Benutzer konnten nicht geladen werden.'
        );
      }

      if (!Array.isArray(daten)) {
        throw new Error('Ungültige Antwort der Benutzer-API.');
      }

      benutzer = daten;
    } catch (fehler) {
      benutzerFehler =
        fehler instanceof Error
          ? fehler.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      benutzerLaden = false;
    }
  }

  // Einladungen des eigenen Vereins laden
  async function ladeEinladungen() {
    einladungenLaden = true;
    einladungenFehler = '';

    try {
      const antwort = await fetch('/api/benutzer/einladen');
      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ??
            'Einladungen konnten nicht geladen werden.'
        );
      }

      if (!Array.isArray(daten)) {
        throw new Error('Ungültige Antwort der Einladungs-API.');
      }

      einladungen = daten;
    } catch (fehler) {
      einladungenFehler =
        fehler instanceof Error
          ? fehler.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      einladungenLaden = false;
    }
  }

  // Neue Einladung vorbereiten
  async function einladungErstellen(event: SubmitEvent) {
    event.preventDefault();

    if (speichern) {
      return;
    }

    speichern = true;
    fehlermeldung = '';
    erfolgsmeldung = '';

    try {
      const antwort = await fetch('/api/benutzer/einladen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          email: email.trim().toLowerCase(),
          rolle
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ??
            'Die Einladung konnte nicht erstellt werden.'
        );
      }

      erfolgsmeldung =
        'Die Einladung wurde erfolgreich vorbereitet. ' +
        'Der E-Mail-Versand ist noch nicht eingerichtet.';

      // Formular zurücksetzen
      vorname = '';
      nachname = '';
      email = '';
      rolle = 'mitglied';

      // Einladungsübersicht aktualisieren
      await ladeEinladungen();
    } catch (fehler) {
      fehlermeldung =
        fehler instanceof Error
          ? fehler.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      speichern = false;
    }
  }

  // Daten beim Öffnen der Seite laden
  onMount(() => {
    void ladeBenutzer();
    void ladeEinladungen();
  });
</script>

<svelte:head>
  <title>Benutzerverwaltung | ClubMatiq</title>
  <meta
    name="description"
    content="Benutzer und Einladungen deines Vereins verwalten."
  />
</svelte:head>

<div class="seite">
  <!-- Seitenkopf -->
  <header class="kopf">
    <div>
      <p class="untertitel">Vereinsverwaltung</p>
      <h1>Benutzerverwaltung</h1>
      <p>
        Verwalte die Benutzer deines Vereins und
        bereite Einladungen für neue Personen vor.
      </p>
    </div>
  </header>

  <!-- Formularmeldungen -->
  {#if fehlermeldung}
    <div class="meldung fehler" role="alert">
      {fehlermeldung}
    </div>
  {/if}

  {#if erfolgsmeldung}
    <div class="meldung erfolg" role="status">
      {erfolgsmeldung}
    </div>
  {/if}

  <!-- Neue Einladung -->
  <section class="karte">
    <div class="abschnitt-titel">
      <h2>Neue Person einladen</h2>
      <p class="beschreibung">
        Erfasse die Kontaktdaten und wähle die
        gewünschte Benutzerrolle.
      </p>
    </div>

    <div class="hinweis">
      <span class="hinweis-symbol">ⓘ</span>
      <span>
        Einladungen werden aktuell nur gespeichert.
        Der automatische E-Mail-Versand wird
        in einem späteren Schritt eingerichtet.
      </span>
    </div>

    <form onsubmit={einladungErstellen}>
      <div class="formular-raster">
        <label>
          Vorname
          <input
            type="text"
            bind:value={vorname}
            maxlength="100"
            autocomplete="given-name"
            placeholder="Vorname eingeben"
            required
          />
        </label>

        <label>
          Nachname
          <input
            type="text"
            bind:value={nachname}
            maxlength="100"
            autocomplete="family-name"
            placeholder="Nachname eingeben"
            required
          />
        </label>

        <label>
          E-Mail-Adresse
          <input
            type="email"
            bind:value={email}
            maxlength="254"
            autocomplete="email"
            placeholder="name@beispiel.ch"
            required
          />
        </label>

        <label>
          Benutzerrolle
          <select bind:value={rolle}>
            {#each rollen as eintrag}
              <option value={eintrag.wert}>
                {eintrag.bezeichnung}
              </option>
            {/each}
          </select>
        </label>
      </div>

      <div class="formular-aktionen">
        <button
          type="submit"
          class="primaer"
          disabled={speichern}
        >
          {speichern
            ? 'Wird gespeichert ...'
            : 'Einladung vorbereiten'}
        </button>
      </div>
    </form>
  </section>

  <!-- Bestehende Benutzer -->
  <section class="karte">
    <div class="abschnitt-kopf">
      <div>
        <h2>Benutzer deines Vereins</h2>
        <p class="beschreibung">
          Alle bereits registrierten Benutzer.
        </p>
      </div>

      <button
        type="button"
        class="sekundaer"
        onclick={ladeBenutzer}
        disabled={benutzerLaden}
      >
        Aktualisieren
      </button>
    </div>

    {#if benutzerFehler}
      <div class="meldung fehler" role="alert">
        {benutzerFehler}
      </div>
    {/if}

    {#if benutzerLaden}
      <p class="platzhalter">
        Benutzer werden geladen ...
      </p>
    {:else if benutzer.length === 0}
      <p class="platzhalter">
        Noch keine Benutzer vorhanden.
      </p>
    {:else}
      <div class="tabellen-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail-Adresse</th>
              <th>Rolle</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {#each benutzer as person (person.id)}
              <tr>
                <td>
                  <strong>
                    {person.vorname} {person.nachname}
                  </strong>
                </td>

                <td>{person.email}</td>

                <td>
                  {rollenname(person.rolle)}
                </td>

                <td>
                  <span
                    class="status"
                    class:status-inaktiv={!person.aktiv}
                  >
                    {person.aktiv ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="tabellen-info">
        {benutzer.length}
        {benutzer.length === 1
          ? ' Benutzer'
          : ' Benutzer'} vorhanden
      </p>
    {/if}
  </section>

  <!-- Einladungsübersicht -->
  <section class="karte">
    <div class="abschnitt-kopf">
      <div>
        <h2>Einladungen</h2>
        <p class="beschreibung">
          Übersicht aller vorbereiteten und
          bisherigen Einladungen.
        </p>
      </div>

      <button
        type="button"
        class="sekundaer"
        onclick={ladeEinladungen}
        disabled={einladungenLaden}
      >
        Aktualisieren
      </button>
    </div>

    {#if einladungenFehler}
      <div class="meldung fehler" role="alert">
        {einladungenFehler}
      </div>
    {/if}

    {#if einladungenLaden}
      <p class="platzhalter">
        Einladungen werden geladen ...
      </p>
    {:else if einladungen.length === 0}
      <p class="platzhalter">
        Noch keine Einladungen vorhanden.
      </p>
    {:else}
      <div class="tabellen-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail-Adresse</th>
              <th>Rolle</th>
              <th>Erstellt</th>
              <th>Gültig bis</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {#each einladungen as einladung (einladung.id)}
              <tr>
                <td>
                  <strong>
                    {einladung.vorname}
                    {einladung.nachname}
                  </strong>
                </td>

                <td>{einladung.email}</td>

                <td>
                  {rollenname(einladung.rolle)}
                </td>

                <td>
                  {formatiereDatum(einladung.erstelltAm)}
                </td>

                <td>
                  {formatiereDatum(einladung.ablaufdatum)}
                </td>

                <td>
                  <span
                    class="status"
                    class:status-offen={einladung.status === 'offen'}
                    class:status-abgelaufen={einladung.status === 'abgelaufen'}
                    class:status-inaktiv={einladung.status === 'widerrufen'}
                  >
                    {statusname(einladung.status)}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="tabellen-info">
        {einladungen.length}
        {einladungen.length === 1
          ? ' Einladung'
          : ' Einladungen'} vorhanden
      </p>
    {/if}
  </section>
</div>

<style>
  .seite {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 20px 60px;
    color: #1f2937;
  }

  .kopf {
    margin-bottom: 28px;
  }

  .untertitel {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }

  h1 {
    font-size: 32px;
    margin: 6px 0 10px;
  }

  h2 {
    font-size: 21px;
    margin: 0 0 8px;
  }

  .kopf > div > p:last-child,
  .beschreibung {
    color: #64748b;
    line-height: 1.5;
  }

  .beschreibung {
    margin: 0;
    font-size: 14px;
  }

  .karte {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 26px;
    margin-bottom: 24px;
  }

  .abschnitt-titel {
    margin-bottom: 20px;
  }

  .abschnitt-kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }

  .hinweis {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    margin-bottom: 24px;
    background: #eff6ff;
    color: #1e40af;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.5;
  }

  .hinweis-symbol {
    font-size: 19px;
    font-weight: 700;
    line-height: 1;
  }

  .formular-raster {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }

  input,
  select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 12px;
    font: inherit;
    background: white;
    color: #1f2937;
  }

  input:focus,
  select:focus {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .formular-aktionen {
    display: flex;
    justify-content: flex-start;
  }

  button {
    border: none;
    border-radius: 8px;
    padding: 12px 18px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  button.primaer {
    background: #1d4ed8;
    color: white;
  }

  button.primaer:hover:not(:disabled) {
    background: #1e40af;
  }

  button.sekundaer {
    background: #f1f5f9;
    color: #334155;
  }

  button.sekundaer:hover:not(:disabled) {
    background: #e2e8f0;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .tabellen-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  th,
  td {
    padding: 14px 12px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 14px;
  }

  th {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  td {
    vertical-align: middle;
  }

  td strong {
    font-weight: 600;
  }

  .status {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 20px;
    background: #dcfce7;
    color: #166534;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .status-offen {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status-abgelaufen {
    background: #fef3c7;
    color: #92400e;
  }

  .status-inaktiv {
    background: #f1f5f9;
    color: #64748b;
  }

  .meldung {
    padding: 14px 18px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 14px;
  }

  .meldung.fehler {
    background: #fee2e2;
    color: #991b1b;
  }

  .meldung.erfolg {
    background: #dcfce7;
    color: #166534;
  }

  .platzhalter {
    color: #64748b;
    padding: 16px 0;
  }

  .tabellen-info {
    margin: 16px 0 0;
    font-size: 13px;
    color: #64748b;
  }

  @media (max-width: 650px) {
    .seite {
      padding: 24px 14px 40px;
    }

    .formular-raster {
      grid-template-columns: 1fr;
    }

    .karte {
      padding: 18px;
    }

    .abschnitt-kopf {
      align-items: flex-start;
      flex-direction: column;
    }

    h1 {
      font-size: 26px;
    }

    h2 {
      font-size: 19px;
    }
  }
</style>
