
<script lang="ts">
  import { goto } from '$app/navigation';

  // ========================================
  // Formularfelder
  // ========================================

  let vereinsname = $state('');
  let vereinskuerzel = $state('');
  let vorname = $state('');
  let nachname = $state('');
  let email = $state('');
  let passwort = $state('');
  let passwortWiederholen = $state('');

  // ========================================
  // Status und Fehlermeldungen
  // ========================================

  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let wirdGespeichert = $state(false);
  let registrierungErfolgreich = $state(false);

  // ========================================
  // Registrierung durchführen
  // ========================================

  async function registrieren() {
    if (wirdGespeichert) return;

    fehlermeldung = '';
    erfolgsmeldung = '';

    // Pflichtfelder prüfen
    if (
      !vereinsname.trim() ||
      !vorname.trim() ||
      !nachname.trim() ||
      !email.trim() ||
      !passwort
    ) {
      fehlermeldung =
        'Bitte alle Pflichtfelder ausfüllen.';
      return;
    }

    // Passwortlänge prüfen
    if (passwort.length < 12) {
      fehlermeldung =
        'Das Passwort muss mindestens 12 Zeichen haben.';
      return;
    }

    // Passwörter vergleichen
    if (passwort !== passwortWiederholen) {
      fehlermeldung =
        'Die Passwörter stimmen nicht überein.';
      return;
    }

    wirdGespeichert = true;

    try {
      // ========================================
      // Verein und Administrator erstellen
      // ========================================

      const antwort = await fetch('/api/registrieren', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          vereinsname: vereinsname.trim(),
          vereinskuerzel: vereinskuerzel.trim(),
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          email: email.trim().toLowerCase(),
          passwort
        })
      });

      const ergebnis = await antwort.json();

      if (!antwort.ok) {
        fehlermeldung =
          ergebnis.fehler ??
          'Die Registrierung ist fehlgeschlagen.';
        return;
      }

      // ========================================
      // Registrierung erfolgreich
      // ========================================

      registrierungErfolgreich = true;

      erfolgsmeldung =
        'Dein Verein und dein Administratorkonto wurden erfolgreich erstellt.';

      // Passwörter aus dem Formular entfernen
      passwort = '';
      passwortWiederholen = '';

      // ========================================
      // Automatisch zur Startseite wechseln
      // ========================================

      try {
        await goto('/', {
          invalidateAll: true
        });
      } catch (navigationFehler) {
        console.error(
          'Weiterleitung fehlgeschlagen:',
          navigationFehler
        );

        // Falls die Navigation nicht funktioniert,
        // kann der Benutzer manuell weitergehen.
        fehlermeldung =
          'Die automatische Weiterleitung hat nicht funktioniert.';
      }
    } catch (error) {
      console.error('Registrierungsfehler:', error);

      fehlermeldung =
        'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.';
    } finally {
      wirdGespeichert = false;
    }
  }
</script>

<svelte:head>
  <title>Verein registrieren | ClubMatiq</title>
  <meta
    name="description"
    content="Registriere deinen Verein bei ClubMatiq."
  />
</svelte:head>

<div class="registrierung">
  <div class="kopf">
    <div class="symbol">📦</div>

    <h1>Willkommen bei ClubMatiq</h1>

    <p>
      Erstelle deinen Vereinszugang und verwalte Material,
      Vereinskleider und Ausleihen an einem Ort.
    </p>
  </div>

  {#if registrierungErfolgreich}
    <!-- ========================================
         Registrierung erfolgreich
         ======================================== -->

    <div class="erfolgskarte">
      <div class="erfolg-symbol">✓</div>

      <h2>Registrierung erfolgreich!</h2>

      <p>{erfolgsmeldung}</p>

      <p class="hinweis">
        Dein Administratorkonto ist eingerichtet.
        Du kannst ClubMatiq jetzt verwenden.
      </p>

      {#if fehlermeldung}
        <div class="fehlermeldung" role="alert">
          {fehlermeldung}
        </div>
      {/if}

      <a href="/">
        Zur ClubMatiq-Startseite
      </a>
    </div>
  {:else}
    <!-- ========================================
         Registrierungsformular
         ======================================== -->

    <form
      onsubmit={(event) => {
        event.preventDefault();
        void registrieren();
      }}
    >
      <h2>Vereinsangaben</h2>

      <div class="feld">
        <label for="vereinsname">
          Vereinsname *
        </label>

        <input
          id="vereinsname"
          type="text"
          bind:value={vereinsname}
          placeholder="z. B. Turnverein Weiningen"
          autocomplete="organization"
          required
        />
      </div>

      <div class="feld">
        <label for="vereinskuerzel">
          Vereinskürzel
        </label>

        <input
          id="vereinskuerzel"
          type="text"
          bind:value={vereinskuerzel}
          placeholder="z. B. TVW"
        />
      </div>

      <div class="trennlinie"></div>

      <h2>Administratorenkonto</h2>

      <p class="hinweis">
        Diese Person verwaltet den Verein und kann
        später weitere Benutzer einladen.
      </p>

      <div class="zweispaltig">
        <div class="feld">
          <label for="vorname">
            Vorname *
          </label>

          <input
            id="vorname"
            type="text"
            bind:value={vorname}
            autocomplete="given-name"
            required
          />
        </div>

        <div class="feld">
          <label for="nachname">
            Nachname *
          </label>

          <input
            id="nachname"
            type="text"
            bind:value={nachname}
            autocomplete="family-name"
            required
          />
        </div>
      </div>

      <div class="feld">
        <label for="email">
          E-Mail-Adresse *
        </label>

        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="name@verein.ch"
          autocomplete="email"
          required
        />
      </div>

      <div class="feld">
        <label for="passwort">
          Passwort *
        </label>

        <input
          id="passwort"
          type="password"
          bind:value={passwort}
          autocomplete="new-password"
          minlength="12"
          required
        />

        <small>
          Mindestens 12 Zeichen
        </small>
      </div>

      <div class="feld">
        <label for="passwort-wiederholen">
          Passwort wiederholen *
        </label>

        <input
          id="passwort-wiederholen"
          type="password"
          bind:value={passwortWiederholen}
          autocomplete="new-password"
          required
        />
      </div>

      {#if fehlermeldung}
        <div
          class="fehlermeldung"
          role="alert"
        >
          {fehlermeldung}
        </div>
      {/if}

      <button
        type="submit"
        disabled={wirdGespeichert}
      >
        {wirdGespeichert
          ? 'Verein wird erstellt ...'
          : 'Verein registrieren'}
      </button>

      <p class="login-hinweis">
        Bereits registriert?
        <a href="/anmelden">
          Jetzt anmelden
        </a>
      </p>
    </form>
  {/if}
</div>

<style>
  .registrierung {
    max-width: 560px;
    margin: 0 auto;
  }

  .kopf {
    text-align: center;
    margin-bottom: 30px;
  }

  .symbol {
    font-size: 42px;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 27px;
    margin: 0 0 12px;
    color: #172b4d;
  }

  .kopf p {
    color: #64748b;
    line-height: 1.6;
    margin: 0;
  }

  form,
  .erfolgskarte {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 32px;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
  }

  h2 {
    font-size: 18px;
    margin: 0 0 20px;
    color: #172b4d;
  }

  .hinweis {
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
    margin: -10px 0 22px;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-bottom: 18px;
  }

  label {
    font-size: 14px;
    font-weight: 600;
    color: #334155;
  }

  input {
    width: 100%;
    padding: 12px 13px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    color: #1e293b;
    background: white;
  }

  input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px #dbeafe;
  }

  small {
    font-size: 12px;
    color: #64748b;
  }

  .zweispaltig {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .trennlinie {
    height: 1px;
    background: #e2e8f0;
    margin: 12px 0 28px;
  }

  .fehlermeldung {
    padding: 12px;
    background: #fef2f2;
    color: #b91c1c;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 18px;
  }

  button,
  .erfolgskarte a {
    display: block;
    width: 100%;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 14px;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
  }

  button:hover,
  .erfolgskarte a:hover {
    background: #1d4ed8;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login-hinweis {
    text-align: center;
    font-size: 13px;
    color: #64748b;
    margin: 22px 0 0;
  }

  .login-hinweis a {
    color: #2563eb;
    font-weight: 600;
    text-decoration: none;
  }

  .login-hinweis a:hover {
    text-decoration: underline;
  }

  .erfolgskarte {
    text-align: center;
  }

  .erfolg-symbol {
    width: 60px;
    height: 60px;
    background: #dcfce7;
    color: #15803d;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 32px;
    margin: 0 auto 20px;
  }

  .erfolgskarte p {
    color: #475569;
    line-height: 1.6;
  }

  .erfolgskarte a {
    margin-top: 24px;
  }

  @media (max-width: 560px) {
    form,
    .erfolgskarte {
      padding: 22px;
    }

    .zweispaltig {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    h1 {
      font-size: 23px;
    }
  }

  @media (max-width: 400px) {
    .zweispaltig {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }
</style>
