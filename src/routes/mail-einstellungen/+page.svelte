<script lang="ts">
  import Aktionsmeldung from '../../lib/Aktionsmeldung.svelte';
  import { onMount } from 'svelte';
  // Vereinseigene E-Mail-Konfiguration (nur Admin-Zugriff auf diese Seite)
  let mailMethode = $state<'resend' | 'smtp' | 'microsoft365'>('resend');
  let m365TenantId = $state('');
  let m365ClientId = $state('');
  let m365Absender = $state('');
  let m365ZertifikatServerseitig = $state(false);
  let m365ZertifikatPem = $state('');
  let m365PrivaterSchluesselPem = $state('');
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
            absender: m365Absender,
            ...(m365ZertifikatPem || m365PrivaterSchluesselPem ? { zertifikatPem: m365ZertifikatPem, privaterSchluesselPem: m365PrivaterSchluesselPem } : {})
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
      m365ZertifikatPem = '';
      m365PrivaterSchluesselPem = '';
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
      if (!antwort.ok) throw new Error(daten.fehler ?? 'E-Mail-Test fehlgeschlagen.');
      mailErfolg = daten.nachricht;
    } catch (error) {
      mailFehler = error instanceof Error ? error.message : 'E-Mail-Test fehlgeschlagen.';
    } finally {
      mailTesten = false;
    }
  }

  onMount(() => { void ladeMailEinstellungen(); });
</script>
<Aktionsmeldung fehler={mailFehler} erfolg={mailErfolg} fehlerSchliessen={() => mailFehler = ''} erfolgSchliessen={() => mailErfolg = ''} />
<svelte:head><title>E-Mail-Einstellungen | ClubMatiq</title></svelte:head>
<div class="seite"><header class="kopf"><div><p class="untertitel">Administration</p><h1>E-Mail-Einstellungen</h1><p>Versandmethode des Vereins konfigurieren und testen – nur für Administratoren.</p></div></header><p style="margin-bottom:20px"><a href="/docs/e-mail-einstellungen">Ausführliche Einrichtungsanleitung →</a></p>
  <section class="karte">
    <div class="abschnitt-titel">
      <h2>Versandmethode des Vereins</h2>
      <p class="beschreibung">Nur Administratoren können die Versandmethode konfigurieren.</p>
    </div>
    
    
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
          <p class="beschreibung">Zertifikat für diesen Verein: {m365ZertifikatServerseitig ? 'Verschlüsselt hinterlegt' : 'Noch nicht hinterlegt'}. Zertifikat und privater Schlüssel werden verschlüsselt pro Verein gespeichert und niemals wieder im Browser angezeigt.</p>
          <label>Öffentliches Zertifikat (PEM, bei Neueinrichtung oder Erneuerung)<textarea bind:value={m365ZertifikatPem} rows="5" placeholder="-----BEGIN CERTIFICATE-----" autocomplete="off"></textarea></label>
          <label>Privater Schlüssel (PEM, gemeinsam mit Zertifikat einfügen)<textarea bind:value={m365PrivaterSchluesselPem} rows="5" placeholder="-----BEGIN PRIVATE KEY-----" autocomplete="off"></textarea></label>
          <p class="beschreibung">Beide PEM-Inhalte nur bei Neueinrichtung oder Erneuerung eingeben; zum Beibehalten leer lassen. Nur über HTTPS verwenden. Nicht in Git oder Screenshots veröffentlichen.</p>
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
        <p class="beschreibung">Microsoft Entra ID: Zertifikat (öffentlicher Teil) hochladen und Exchange Online Application RBAC mit der Rolle Application Mail.Send auf das gewünschte Postfach beschränken. Keine zusätzliche tenantweite Microsoft-Graph-Mail.Send-Berechtigung freigeben. Der private Schlüssel wird verschlüsselt in der Vereinskonfiguration gespeichert; MAIL_ENCRYPTION_KEY muss auf dem Server bzw. bei Netlify hinterlegt sein.</p>
      {/if}
      {#if mailMethode === 'smtp'}
        <p class="beschreibung">Port 587 verwendet normalerweise STARTTLS. Microsoft 365 kann OAuth2 erfordern; die Passwort-Anmeldung funktioniert nicht in jedem Tenant.</p>
      {/if}
      <div class="formular-aktionen">
        <button class="primaer" type="submit" disabled={mailSpeichern}>{mailSpeichern ? 'Speichert …' : 'E-Mail-Einstellungen speichern'}</button>
      </div>
    </form>
    {#if mailMethode === 'smtp' || mailMethode === 'microsoft365'}
      <div class="formular-aktionen" style="margin-top: 12px">
        <button type="button" class="sekundaer" onclick={testeMailEinstellungen} disabled={mailTesten || mailSpeichern}>
          {mailTesten ? 'Test läuft …' : mailMethode === 'microsoft365' ? 'Microsoft-365-Testmail senden' : 'Gespeicherte SMTP-Einstellungen testen'}
        </button>
      </div>
      <p class="beschreibung" style="margin-top: 8px">Der Test versendet eine E-Mail an deine eigene Benutzeradresse. Änderungen vorher speichern.</p>
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
  select,
  textarea {
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

      h1 {
      font-size: 26px;
    }

    h2 {
      font-size: 19px;
    }
  }
</style>
