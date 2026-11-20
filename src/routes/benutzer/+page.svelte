
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
  let anlageart = $state<'einladung' | 'manuell'>('einladung');
  let startpasswort = $state('');
  let erneutSendenId = $state<string | null>(null);
  let statusAendernId = $state<string | null>(null);

  // Vereinseigene E-Mail-Konfiguration (nur Admin-Zugriff auf diese Seite)
  let mailMethode = $state<'resend' | 'smtp' | 'microsoft365'>('resend');
  let m365TenantId = $state('');
  let m365ClientId = $state('');
  let m365Absender = $state('');
  let m365ZertifikatServerseitig = $state(false);
  let smtpHost = $state('');
  let smtpPort = $state(587);
  let smtpSecure = $state(false);
  let smtpBenutzername = $state('');
  let smtpAbsender = $state('');
  let smtpPasswort = $state('');
  let smtpPasswortHinterlegt = $state(false);
  let mailSpeichern = $state(false);
  let mailFehler = $state('');
  let mailErfolg = $state('');
  let mailTesten = $state(false);

  async function ladeMailEinstellungen() {
    try {
      const antwort = await fetch('/api/mail-einstellungen');
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'E-Mail-Einstellungen konnten nicht geladen werden.');
      mailMethode = daten.methode;
      if (daten.microsoft365) {
        m365TenantId = daten.microsoft365.tenantId;
        m365ClientId = daten.microsoft365.clientId;
        m365Absender = daten.microsoft365.absender;
        m365ZertifikatServerseitig = daten.microsoft365.zertifikatServerseitig;
      }
      if (daten.smtp) {
        smtpHost = daten.smtp.host;
        smtpPort = daten.smtp.port;
        smtpSecure = daten.smtp.secure;
        smtpBenutzername = daten.smtp.benutzername;
        smtpAbsender = daten.smtp.absender;
        smtpPasswortHinterlegt = daten.smtp.passwortHinterlegt;
      }
    } catch (error) {
      mailFehler = error instanceof Error ? error.message : 'E-Mail-Einstellungen konnten nicht geladen werden.';
    }
  }

  async function speichereMailEinstellungen(event: SubmitEvent) {
    event.preventDefault();
    mailSpeichern = true;
    mailFehler = '';
    mailErfolg = '';
    try {
      const antwort = await fetch('/api/mail-einstellungen', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methode: mailMethode,
          ...(mailMethode === 'microsoft365' ? { microsoft365: {
            tenantId: m365TenantId, clientId: m365ClientId,
            absender: m365Absender
          } } : {}),
          ...(mailMethode === 'smtp' ? { smtp: {
            host: smtpHost, port: Number(smtpPort), secure: smtpSecure,
            benutzername: smtpBenutzername, absender: smtpAbsender, passwort: smtpPasswort
          } } : {})
        })
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Speichern fehlgeschlagen.');
      smtpPasswort = '';
      mailErfolg = 'E-Mail-Einstellungen gespeichert.';
      await ladeMailEinstellungen();
    } catch (error) {
      mailFehler = error instanceof Error ? error.message : 'Speichern fehlgeschlagen.';
    } finally {
      mailSpeichern = false;
    }
  }

  async function testeMailEinstellungen() {
    mailTesten = true;
    mailFehler = '';
    mailErfolg = '';
    try {
      const antwort = await fetch('/api/mail-einstellungen/test', { method: 'POST' });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'SMTP-Test fehlgeschlagen.');
      mailErfolg = daten.nachricht;
    } catch (error) {
      mailFehler = error instanceof Error ? error.message : 'SMTP-Test fehlgeschlagen.';
    } finally {
      mailTesten = false;
    }
  }

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
        return 'Offen';

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
      const antwort = await fetch(anlageart === 'manuell' ? '/api/benutzer/manuell' : '/api/benutzer/einladen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          email: email.trim().toLowerCase(),
          ...(anlageart === 'manuell' ? { passwort: startpasswort } : {}),
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

      erfolgsmeldung = daten.nachricht ?? 'Einladung gespeichert.';

      // Formular zurücksetzen
      vorname = '';
      nachname = '';
      email = '';
      rolle = 'mitglied';
      startpasswort = '';

      // Einladungsübersicht aktualisieren
      await Promise.all([ladeEinladungen(), ladeBenutzer()]);
    } catch (fehler) {
      fehlermeldung =
        fehler instanceof Error
          ? fehler.message
          : 'Ein unbekannter Fehler ist aufgetreten.';
    } finally {
      speichern = false;
    }
  }

  async function erneutSenden(id: string) {
    if (erneutSendenId) return;
    erneutSendenId = id;
    fehlermeldung = '';
    erfolgsmeldung = '';
    try {
      const antwort = await fetch(`/api/benutzer/einladen/${encodeURIComponent(id)}/erneut`, { method: 'POST' });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Einladung konnte nicht versendet werden.');
      erfolgsmeldung = daten.nachricht ?? 'Einladung versendet.';
      await ladeEinladungen();
    } catch (error) {
      fehlermeldung = error instanceof Error ? error.message : 'Versand fehlgeschlagen.';
    } finally {
      erneutSendenId = null;
    }
  }

  async function statusAendern(person: Benutzer) {
    if (statusAendernId) return;
    const aktion = person.aktiv ? 'deaktivieren' : 'reaktivieren';
    if (!confirm(`${person.vorname} ${person.nachname} wirklich ${aktion}?`)) return;
    statusAendernId = person.id;
    fehlermeldung = '';
    erfolgsmeldung = '';
    try {
      const antwort = await fetch(`/api/benutzer/${encodeURIComponent(person.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktiv: !person.aktiv })
      });
      const daten = await antwort.json();
      if (!antwort.ok) throw new Error(daten.fehler ?? 'Benutzerstatus konnte nicht geändert werden.');
      erfolgsmeldung = `Benutzer erfolgreich ${person.aktiv ? 'deaktiviert' : 'reaktiviert'}.`;
      await ladeBenutzer();
    } catch (error) {
      fehlermeldung = error instanceof Error ? error.message : 'Änderung fehlgeschlagen.';
    } finally {
      statusAendernId = null;
    }
  }

  // Daten beim Öffnen der Seite laden
  onMount(() => {
    void ladeBenutzer();
    void ladeEinladungen();
    void ladeMailEinstellungen();
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
        Verwalte Benutzer deines Vereins und erstelle Zugänge per E-Mail oder manuell.
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

  <section class="karte">
    <div class="abschnitt-titel">
      <h2>E-Mail-Einstellungen des Vereins</h2>
      <p class="beschreibung">Nur Administratoren können die Versandmethode konfigurieren.</p>
    </div>
    {#if mailFehler}<div class="meldung fehler" role="alert">{mailFehler}</div>{/if}
    {#if mailErfolg}<div class="meldung erfolg" role="status">{mailErfolg}</div>{/if}
    <form onsubmit={speichereMailEinstellungen}>
      <div class="formular-raster">
        <label>Versandmethode
          <select bind:value={mailMethode}>
            <option value="resend">Resend (ClubMatiq)</option>
            <option value="smtp">Eigener SMTP-Server</option>
            <option value="microsoft365">Microsoft 365 (Graph OAuth2)</option>
          </select>
        </label>
        {#if mailMethode === 'microsoft365'}
          <label>Tenant-ID (Entra)<input bind:value={m365TenantId} required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
          <label>Client-ID (App-Registrierung)<input bind:value={m365ClientId} required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
          <label>Absender-E-Mail<input type="email" bind:value={m365Absender} required /></label>
          <p class="beschreibung">Zertifikat: {m365ZertifikatServerseitig ? 'Serverseitig konfiguriert' : 'Noch nicht serverseitig konfiguriert'}. Der private Schlüssel wird ausschliesslich als Server-Umgebungsvariable hinterlegt.</p>
        {/if}
        {#if mailMethode === 'smtp'}
          <label>SMTP-Server<input bind:value={smtpHost} placeholder="smtp.beispiel.ch" required /></label>
          <label>Port<input type="number" bind:value={smtpPort} min="1" max="65535" required /></label>
          <label>Benutzername<input bind:value={smtpBenutzername} required /></label>
          <label>Absender-E-Mail<input type="email" bind:value={smtpAbsender} required /></label>
          <label>SMTP-Passwort<input type="password" bind:value={smtpPasswort} autocomplete="new-password" placeholder={smtpPasswortHinterlegt ? 'Leer lassen, um Passwort beizubehalten' : 'SMTP-Passwort eingeben'} required={!smtpPasswortHinterlegt} /></label>
          <label><span>SSL/TLS direkt beim Verbindungsaufbau (typisch Port 465)</span>
            <input type="checkbox" bind:checked={smtpSecure} />
          </label>
        {/if}
      </div>
      {#if mailMethode === 'microsoft365'}
        <p class="beschreibung">Microsoft Entra ID: Zertifikat (öffentlicher Teil) hochladen, Microsoft Graph Application Permission Mail.Send mit Admin-Consent erteilen und den Zugriff auf das gewünschte Postfach begrenzen. Der private Schlüssel bleibt auf dem Server.</p>
      {/if}
      {#if mailMethode === 'smtp'}
        <p class="beschreibung">Port 587 verwendet normalerweise STARTTLS. Microsoft 365 kann OAuth2 erfordern; die Passwort-Anmeldung funktioniert nicht in jedem Tenant.</p>
      {/if}
      <div class="formular-aktionen">
        <button class="primaer" type="submit" disabled={mailSpeichern}>{mailSpeichern ? 'Speichert …' : 'E-Mail-Einstellungen speichern'}</button>
      </div>
    </form>
    {#if mailMethode === 'smtp'}
      <div class="formular-aktionen" style="margin-top: 12px">
        <button type="button" class="sekundaer" onclick={testeMailEinstellungen} disabled={mailTesten || mailSpeichern}>
          {mailTesten ? 'Test läuft …' : 'Gespeicherte SMTP-Einstellungen testen'}
        </button>
      </div>
      <p class="beschreibung" style="margin-top: 8px">Der Test versendet eine E-Mail an deine eigene Benutzeradresse. Änderungen vorher speichern.</p>
    {/if}
  </section>

  <!-- Neue Einladung -->
  <section class="karte">
    <div class="abschnitt-titel">
      <h2>Benutzer hinzufügen</h2>
      <p class="beschreibung">
        Erfasse die Kontaktdaten und wähle die
        gewünschte Benutzerrolle.
      </p>
    </div>

    <div class="hinweis">
      <span class="hinweis-symbol">ⓘ</span>
      <span>Wähle eine Einladung per E-Mail oder erstelle einen Benutzer mit Startpasswort ohne E-Mail-Versand.</span>
    </div>

    <form onsubmit={einladungErstellen}>
      <div class="formular-raster">
        <label>
          Anlageart
          <select bind:value={anlageart}>
            <option value="einladung">Einladung per E-Mail</option>
            <option value="manuell">Manuell mit Startpasswort</option>
          </select>
        </label>
        {#if anlageart === 'manuell'}
          <label>
            Startpasswort (mindestens 12 Zeichen)
            <input type="password" bind:value={startpasswort} minlength="12" maxlength="1024" autocomplete="new-password" required />
          </label>
        {/if}
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
          {speichern ? 'Wird gespeichert …' : anlageart === 'manuell' ? 'Benutzer erstellen' : 'Einladung senden'}
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
              <th>Aktion</th>
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
                <td>
                  <button type="button" class="sekundaer" disabled={statusAendernId !== null} onclick={() => statusAendern(person)}>
                    {statusAendernId === person.id ? 'Wird gespeichert …' : person.aktiv ? 'Deaktivieren' : 'Reaktivieren'}
                  </button>
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
          Übersicht der Einladungen und ihres Versandstatus.
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
              <th>Versand</th>
              <th>Status</th>
              <th>Aktion</th>
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

                <td>{einladung.versendet ? 'Versendet' : 'Nicht versendet'}</td>

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
                <td>
                  {#if einladung.status === 'offen'}
                    <button type="button" class="sekundaer" disabled={erneutSendenId !== null} onclick={() => erneutSenden(einladung.id)}>
                      {erneutSendenId === einladung.id ? 'Wird gesendet …' : 'Erneut senden'}
                    </button>
                  {/if}
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
