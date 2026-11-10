
<script lang="ts">
  import { goto } from '$app/navigation';

  let email = $state('');
  let passwort = $state('');

  let fehlermeldung = $state('');
  let wirdAngemeldet = $state(false);
  let passwortAnzeigen = $state(false);

  async function anmelden() {
    fehlermeldung = '';

    if (!email.trim() || !passwort) {
      fehlermeldung =
        'Bitte E-Mail-Adresse und Passwort eingeben.';
      return;
    }

    wirdAngemeldet = true;

    try {
      const antwort = await fetch('/api/anmelden', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          passwort
        })
      });

      const ergebnis = await antwort.json();

      if (!antwort.ok) {
        fehlermeldung =
          ergebnis.fehler ??
          'Die Anmeldung ist fehlgeschlagen.';
        return;
      }

      // Passwort aus dem Formular entfernen
      passwort = '';

      // Zur Startseite wechseln
      await goto('/', { invalidateAll: true });
    } catch (error) {
      console.error('Anmeldefehler:', error);

      fehlermeldung =
        'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.';
    } finally {
      wirdAngemeldet = false;
    }
  }
</script>

<svelte:head>
  <title>Anmelden | ClubMatiq</title>
  <meta
    name="description"
    content="Melde dich bei ClubMatiq an."
  />
</svelte:head>

<div class="anmeldung">
  <div class="kopf">
    <div class="symbol">📦</div>

    <h1>Willkommen zurück!</h1>

    <p>
      Melde dich bei ClubMatiq an und verwalte
      dein Vereinsmaterial.
    </p>
  </div>

  <form
    onsubmit={(event) => {
      event.preventDefault();
      anmelden();
    }}
  >
    <h2>Bei ClubMatiq anmelden</h2>

    <div class="feld">
      <label for="email">E-Mail-Adresse</label>

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
      <label for="passwort">Passwort</label>

      <div class="passwort-feld">
        <input
          id="passwort"
          type={passwortAnzeigen ? 'text' : 'password'}
          bind:value={passwort}
          placeholder="Dein Passwort"
          autocomplete="current-password"
          required
        />

        <button
          type="button"
          class="passwort-toggle"
          onclick={() => {
            passwortAnzeigen = !passwortAnzeigen;
          }}
          aria-label={passwortAnzeigen
            ? 'Passwort verbergen'
            : 'Passwort anzeigen'}
        >
          {passwortAnzeigen ? 'Verbergen' : 'Anzeigen'}
        </button>
      </div>
    </div>

    {#if fehlermeldung}
      <div class="fehlermeldung" role="alert">
        {fehlermeldung}
      </div>
    {/if}

    <button
      type="submit"
      class="anmelden-button"
      disabled={wirdAngemeldet}
    >
      {wirdAngemeldet
        ? 'Anmeldung läuft ...'
        : 'Anmelden'}
    </button>

    <div class="trennlinie"></div>

    <p class="registrieren-hinweis">
      Dein Verein ist noch nicht registriert?
      <a href="/registrieren">Verein registrieren</a>
    </p>
  </form>

  <p class="fusszeile">
    ClubMatiq – Materialverwaltung für Vereine
  </p>
</div>

<style>
  .anmeldung {
    max-width: 460px;
    margin: 0 auto;
    padding: 20px 0;
  }

  .kopf {
    text-align: center;
    margin-bottom: 30px;
  }

  .symbol {
    font-size: 46px;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 28px;
    margin: 0 0 12px;
    color: #172b4d;
  }

  .kopf p {
    color: #64748b;
    line-height: 1.6;
    margin: 0;
  }

  form {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 32px;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
  }

  h2 {
    font-size: 19px;
    margin: 0 0 26px;
    color: #172b4d;
    text-align: center;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  label {
    font-size: 14px;
    font-weight: 600;
    color: #334155;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    padding: 13px;
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

  .passwort-feld {
    position: relative;
  }

  .passwort-feld input {
    padding-right: 95px;
  }

  .passwort-toggle {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #2563eb;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .fehlermeldung {
    padding: 12px;
    background: #fef2f2;
    color: #b91c1c;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 18px;
  }

  .anmelden-button {
    display: block;
    width: 100%;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .anmelden-button:hover {
    background: #1d4ed8;
  }

  .anmelden-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .trennlinie {
    height: 1px;
    background: #e2e8f0;
    margin: 26px 0 20px;
  }

  .registrieren-hinweis {
    text-align: center;
    font-size: 13px;
    color: #64748b;
    line-height: 1.7;
    margin: 0;
  }

  .registrieren-hinweis a {
    display: block;
    color: #2563eb;
    font-weight: 600;
    text-decoration: none;
  }

  .registrieren-hinweis a:hover {
    text-decoration: underline;
  }

  .fusszeile {
    text-align: center;
    margin-top: 25px;
    color: #94a3b8;
    font-size: 12px;
  }

  @media (max-width: 560px) {
    form {
      padding: 24px;
    }

    h1 {
      font-size: 24px;
    }
  }
</style>
