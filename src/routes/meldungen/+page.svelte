
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { verwendeRollenVorschau } from '../../lib/rollenVorschau.svelte';

  const rollenVorschau = verwendeRollenVorschau();
  // Die Vorschau ist nur für Administratoren verfügbar.
  // Der Server prüft beim Speichern weiterhin die echte Rolle.
  const echteRolle = $derived(page.data.benutzer?.rolle ?? 'mitglied');
  const angezeigteRolle = $derived(
    echteRolle === 'admin' ? rollenVorschau.rolle : echteRolle
  );
  let darfBearbeiten = $derived(
    angezeigteRolle === 'admin' ||
    angezeigteRolle === 'materialverantwortlich'
  );

  type Artikel = {
    _id: string;
    name: string;
    kategorie: string;
    lagerort: string;
  };

  type Meldungsstatus =
    | 'offen'
    | 'in_bearbeitung'
    | 'erledigt';

  type Schadensfoto = { url: string; publicId: string };

  type VorschauFoto = { datei: File; vorschauUrl: string };

  type Schadensmeldung = {
    _id: string;
    artikelId: string;
    artikelName: string;
    beschreibung: string;
    fotos: (Schadensfoto | string)[];
    gemeldetVonName: string;
    status: Meldungsstatus;
    bearbeitungsnotiz: string;
    erstelltAm: string;
  };

  // ========================================
  // Formulardaten
  // ========================================

  let artikel = $state<Artikel[]>([]);
  let meldungen = $state<Schadensmeldung[]>([]);

  let artikelId = $state('');
  let beschreibung = $state('');

  let wirdGeladen = $state(true);
  let wirdGespeichert = $state(false);
  let fehlermeldung = $state('');
  let erfolgsmeldung = $state('');
  let wirdAktualisiert = $state<string | null>(null);
  let bearbeitungFehler = $state<Record<string, string>>({});
  let bearbeitungErfolg = $state<Record<string, string>>({});
  let entwuerfe = $state<Record<string, { status: Meldungsstatus; bearbeitungsnotiz: string }>>({});

  function entwurfFuer(meldung: Schadensmeldung) {
    return entwuerfe[meldung._id] ?? {
      status: meldung.status,
      bearbeitungsnotiz: meldung.bearbeitungsnotiz ?? ''
    };
  }

  function entwurfAktualisieren(
    meldung: Schadensmeldung,
    feld: 'status' | 'bearbeitungsnotiz',
    wert: string
  ) {
    const aktuell = entwurfFuer(meldung);
    entwuerfe = {
      ...entwuerfe,
      [meldung._id]: {
        ...aktuell,
        [feld]: wert
      }
    };
  }

  async function bearbeitungSpeichern(meldung: Schadensmeldung) {
    if (!darfBearbeiten || wirdAktualisiert !== null) return;
    const entwurf = entwurfFuer(meldung);
    bearbeitungFehler = { ...bearbeitungFehler, [meldung._id]: '' };
    bearbeitungErfolg = { ...bearbeitungErfolg, [meldung._id]: '' };
    wirdAktualisiert = meldung._id;
    try {
      const antwort = await fetch(`/api/meldungen/${meldung._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entwurf)
      });
      const daten = await antwort.json();
      if (!antwort.ok) {
        throw new Error(daten.fehler || 'Änderungen konnten nicht gespeichert werden.');
      }
      meldungen = meldungen.map((eintrag) =>
        eintrag._id === meldung._id
          ? { ...eintrag, status: entwurf.status, bearbeitungsnotiz: entwurf.bearbeitungsnotiz.trim() }
          : eintrag
      );
      bearbeitungErfolg = { ...bearbeitungErfolg, [meldung._id]: 'Änderungen gespeichert.' };
    } catch (error) {
      bearbeitungFehler = {
        ...bearbeitungFehler,
        [meldung._id]: error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'
      };
    } finally {
      wirdAktualisiert = null;
    }
  }

  // ========================================
  // Fotoauswahl und Vorschau
  // ========================================

  const MAX_FOTOS = 3;
  const MAX_FOTOGROESSE = 5 * 1024 * 1024;
  const FOTO_TYPEN = ['image/jpeg', 'image/png', 'image/webp'];
  let ausgewaehlteFotos = $state<VorschauFoto[]>([]);
  let fotoEingabe = $state<HTMLInputElement>();
  let uploadFortschritt = $state('');

  function fotosAuswaehlen(event: Event) {
    const eingabe = event.currentTarget as HTMLInputElement;
    const dateien = Array.from(eingabe.files ?? []);
    fehlermeldung = '';
    erfolgsmeldung = '';

    if (ausgewaehlteFotos.length + dateien.length > MAX_FOTOS) {
      fehlermeldung = `Du kannst maximal ${MAX_FOTOS} Fotos hinzufügen.`;
      eingabe.value = '';
      return;
    }

    for (const datei of dateien) {
      if (!FOTO_TYPEN.includes(datei.type)) {
        fehlermeldung = 'Nur JPG-, PNG- und WebP-Fotos sind erlaubt.';
        eingabe.value = '';
        return;
      }
      if (datei.size === 0 || datei.size > MAX_FOTOGROESSE) {
        fehlermeldung = 'Jedes Foto muss zwischen 1 Byte und 5 MB gross sein.';
        eingabe.value = '';
        return;
      }
    }

    ausgewaehlteFotos = [
      ...ausgewaehlteFotos,
      ...dateien.map((datei) => ({
        datei,
        vorschauUrl: URL.createObjectURL(datei)
      }))
    ];
    eingabe.value = '';
  }

  function fotoEntfernen(index: number) {
    const foto = ausgewaehlteFotos[index];
    if (foto) URL.revokeObjectURL(foto.vorschauUrl);
    ausgewaehlteFotos = ausgewaehlteFotos.filter((_, i) => i !== index);
  }

  function fotosZuruecksetzen() {
    for (const foto of ausgewaehlteFotos) {
      URL.revokeObjectURL(foto.vorschauUrl);
    }
    ausgewaehlteFotos = [];
    if (fotoEingabe) fotoEingabe.value = '';
  }

  async function fotoHochladen(datei: File): Promise<Schadensfoto> {
    const formular = new FormData();
    formular.append('foto', datei);
    const antwort = await fetch('/api/upload', {
      method: 'POST',
      body: formular
    });
    const daten = await antwort.json();
    if (!antwort.ok || !daten.foto?.url || !daten.foto?.publicId) {
      throw new Error(daten.fehler || 'Foto konnte nicht hochgeladen werden.');
    }
    return { url: daten.foto.url, publicId: daten.foto.publicId };
  }

  function fotoUrl(foto: Schadensfoto | string): string {
    return typeof foto === 'string' ? foto : foto.url;
  }

  // ========================================
  // Status und Formatierung
  // ========================================

  const statusNamen: Record<Meldungsstatus, string> = {
    offen: 'Offen',
    in_bearbeitung: 'In Bearbeitung',
    erledigt: 'Erledigt'
  };

  function formatiereDatum(wert: string) {
    return new Date(wert).toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // ========================================
  // Daten laden
  // ========================================

  async function datenLaden() {
    wirdGeladen = true;
    fehlermeldung = '';

    try {
      const [artikelAntwort, meldungenAntwort] =
        await Promise.all([
          fetch('/api/inventar-uebersicht'),
          fetch('/api/meldungen')
        ]);

      if (!artikelAntwort.ok) {
        throw new Error(
          'Inventarartikel konnten nicht geladen werden.'
        );
      }

      if (!meldungenAntwort.ok) {
        throw new Error(
          'Schadensmeldungen konnten nicht geladen werden.'
        );
      }

      artikel = await artikelAntwort.json();
      meldungen = await meldungenAntwort.json();
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Daten konnten nicht geladen werden.';
    } finally {
      wirdGeladen = false;
    }
  }

  onMount(() => {
    datenLaden();
    return () => {
      for (const foto of ausgewaehlteFotos) URL.revokeObjectURL(foto.vorschauUrl);
    };
  });

  // ========================================
  // Schadensmeldung speichern
  // ========================================

  async function meldungSpeichern() {
    if (wirdGespeichert) return;

    fehlermeldung = '';
    erfolgsmeldung = '';

    if (!artikelId) {
      fehlermeldung = 'Bitte einen Artikel auswählen.';
      return;
    }

    if (!beschreibung.trim()) {
      fehlermeldung = 'Bitte den Schaden beschreiben.';
      return;
    }

    if (beschreibung.trim().length > 2000) {
      fehlermeldung =
        'Die Beschreibung darf maximal 2000 Zeichen enthalten.';
      return;
    }

    wirdGespeichert = true;
    uploadFortschritt = '';

    try {
      const fotos: Schadensfoto[] = [];
      for (const [index, foto] of ausgewaehlteFotos.entries()) {
        uploadFortschritt = `Foto ${index + 1} von ${ausgewaehlteFotos.length} wird hochgeladen ...`;
        fotos.push(await fotoHochladen(foto.datei));
      }
      uploadFortschritt = 'Schadensmeldung wird gespeichert ...';
      const antwort = await fetch('/api/meldungen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artikelId,
          beschreibung: beschreibung.trim(),
          fotos
        })
      });

      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ||
            'Schadensmeldung konnte nicht gespeichert werden.'
        );
      }

      artikelId = '';
      beschreibung = '';
      fotosZuruecksetzen();

      // Nur die Übersicht neu laden, damit die
      // Erfolgsmeldung erhalten bleibt.
      const meldungenAntwort = await fetch('/api/meldungen');

      if (meldungenAntwort.ok) {
        meldungen = await meldungenAntwort.json();
      }

      erfolgsmeldung = 'Schadensmeldung erfolgreich erfasst.';
    } catch (error) {
      fehlermeldung =
        error instanceof Error
          ? error.message
          : 'Schadensmeldung konnte nicht gespeichert werden.';
    } finally {
      wirdGespeichert = false;
      uploadFortschritt = '';
    }
  }
</script>

<svelte:head>
  <title>Schadensmeldungen – ClubMatiq</title>
</svelte:head>

<main>
  <div class="kopf">
    <div>
      <h1>🔧 Schadensmeldungen</h1>
      <p>
        Melde beschädigtes Vereinsmaterial und
        verfolge den Bearbeitungsstatus.
      </p>
    </div>

    <a href="/" class="zurueck">
      ← Zur Startseite
    </a>
  </div>

  {#if fehlermeldung}
    <p class="meldung fehler" role="alert">
      {fehlermeldung}
    </p>
  {/if}

  {#if erfolgsmeldung}
    <p class="meldung erfolg" role="status">
      {erfolgsmeldung}
    </p>
  {/if}

  {#if wirdGeladen}
    <p>Schadensmeldungen werden geladen ...</p>
  {:else}
    <!-- Neue Schadensmeldung -->
    <section class="bereich">
      <h2>Neuen Schaden melden</h2>

      <form
        onsubmit={(event) => {
          event.preventDefault();
          meldungSpeichern();
        }}
      >
        <div class="feld">
          <label for="artikel">Inventarartikel *</label>

          <select
            id="artikel"
            bind:value={artikelId}
            required
          >
            <option value="">Bitte Artikel auswählen</option>

            {#each artikel as a (a._id)}
              <option value={a._id}>
                {a.name} – {a.kategorie} ({a.lagerort})
              </option>
            {/each}
          </select>
        </div>

        <div class="feld">
          <label for="beschreibung">
            Schadensbeschreibung *
          </label>

          <textarea
            id="beschreibung"
            rows="5"
            maxlength="2000"
            placeholder="Was ist beschädigt? Wie wurde der Schaden festgestellt?"
            bind:value={beschreibung}
            required
          ></textarea>

          <span class="zeichen">
            {beschreibung.length} / 2000 Zeichen
          </span>
        </div>

        <!-- Fotos auswählen und vor dem Hochladen ansehen -->
        <div class="foto-bereich">
          <div class="foto-symbol">📷</div>
          <strong>Fotos zum Schaden (optional)</strong>
          <p>Bis zu 3 Fotos, JPG, PNG oder WebP, maximal 5 MB pro Foto.</p>
          <input
            id="schadensfotos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            bind:this={fotoEingabe}
            onchange={fotosAuswaehlen}
            disabled={wirdGespeichert || ausgewaehlteFotos.length >= MAX_FOTOS}
          />
          <span class="foto-hinweis">{ausgewaehlteFotos.length} von {MAX_FOTOS} Fotos ausgewählt</span>
          {#if ausgewaehlteFotos.length > 0}
            <div class="foto-vorschauen">
              {#each ausgewaehlteFotos as foto, index (foto.vorschauUrl)}
                <div class="foto-vorschau">
                  <img src={foto.vorschauUrl} alt={`Vorschau Foto ${index + 1}`} />
                  <span class="foto-dateiname" title={foto.datei.name}>{foto.datei.name}</span>
                  <button
                    type="button"
                    class="foto-entfernen"
                    onclick={() => fotoEntfernen(index)}
                    disabled={wirdGespeichert}
                    aria-label={`Foto ${index + 1} entfernen`}
                  >Entfernen</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if uploadFortschritt}
            <p role="status">{uploadFortschritt}</p>
          {/if}
        </div>

        <div class="aktionen">
          <button
            type="submit"
            disabled={wirdGespeichert || artikel.length === 0}
          >
            {wirdGespeichert
              ? 'Wird gespeichert ...'
              : 'Schaden melden'}
          </button>
        </div>
      </form>
    </section>

    <!-- Bestehende Meldungen -->
    <section class="bereich">
      <div class="bereich-kopf">
        <h2>Schadensmeldungen</h2>

        <span class="anzahl">
          {meldungen.length} Meldungen
        </span>
      </div>

      {#if meldungen.length === 0}
        <div class="leer">
          <span>✅</span>
          <p>Noch keine Schadensmeldungen vorhanden.</p>
        </div>
      {:else}
        <div class="meldungs-liste">
          {#each meldungen as meldung (meldung._id)}
            <article class="meldungs-karte">
              <div class="karten-kopf">
                <div>
                  <h3>{meldung.artikelName}</h3>

                  <span class="datum">
                    Gemeldet am
                    {formatiereDatum(meldung.erstelltAm)}
                  </span>
                </div>

                <span
                  class="status"
                  class:offen={meldung.status === 'offen'}
                  class:bearbeitung={meldung.status === 'in_bearbeitung'}
                  class:erledigt={meldung.status === 'erledigt'}
                >
                  {statusNamen[meldung.status] ??
                    meldung.status}
                </span>
              </div>

              <p class="beschreibung">
                {meldung.beschreibung}
              </p>

              <div class="karten-info">
                <span>
                  👤 {meldung.gemeldetVonName}
                </span>
              </div>

              {#if darfBearbeiten}
                <div class="bearbeitungsformular">
                  <h4>Meldung bearbeiten</h4>
                  <div class="feld">
                    <label for={`status-${meldung._id}`}>Status</label>
                    <select
                      id={`status-${meldung._id}`}
                      value={entwurfFuer(meldung).status}
                      onchange={(event) => entwurfAktualisieren(meldung, 'status', event.currentTarget.value)}
                    >
                      <option value="offen">Offen</option>
                      <option value="in_bearbeitung">In Bearbeitung</option>
                      <option value="erledigt">Erledigt</option>
                    </select>
                  </div>
                  <div class="feld">
                    <label for={`notiz-${meldung._id}`}>Bearbeitungsnotiz</label>
                    <textarea
                      id={`notiz-${meldung._id}`}
                      rows="3"
                      maxlength="2000"
                      value={entwurfFuer(meldung).bearbeitungsnotiz}
                      oninput={(event) => entwurfAktualisieren(meldung, 'bearbeitungsnotiz', event.currentTarget.value)}
                      placeholder="Optional: Was wurde unternommen?"
                    ></textarea>
                  </div>
                  {#if bearbeitungFehler[meldung._id]}
                    <p class="meldung fehler" role="alert">{bearbeitungFehler[meldung._id]}</p>
                  {/if}
                  {#if bearbeitungErfolg[meldung._id]}
                    <p class="meldung erfolg" role="status">{bearbeitungErfolg[meldung._id]}</p>
                  {/if}
                  <div class="aktionen">
                    <button
                      type="button"
                      disabled={wirdAktualisiert !== null}
                      onclick={() => bearbeitungSpeichern(meldung)}
                    >
                      {wirdAktualisiert === meldung._id ? 'Wird gespeichert ...' : 'Änderungen speichern'}
                    </button>
                  </div>
                </div>
              {:else if meldung.bearbeitungsnotiz}
                <div class="bearbeitungsnotiz">
                  <strong>Bearbeitungsnotiz</strong>
                  <p>{meldung.bearbeitungsnotiz}</p>
                </div>
              {/if}

              {#if meldung.fotos?.length}
                <div class="fotos">
                  {#each meldung.fotos as foto}
                    <a
                      href={fotoUrl(foto)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={fotoUrl(foto)}
                        alt="Foto des gemeldeten Schadens"
                        loading="lazy"
                      />
                    </a>
                  {/each}
                </div>
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
    max-width: 1000px;
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
    line-height: 1.5;
  }

  .zurueck {
    color: #64748b;
    text-decoration: none;
    white-space: nowrap;
  }

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 30px;
  }

  h2 {
    color: #172b4d;
    margin: 0 0 25px;
    font-size: 21px;
  }

  .bereich-kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
  }

  .bereich-kopf h2 {
    margin: 0;
  }

  .anzahl {
    color: #64748b;
    font-size: 13px;
  }

  .feld {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 22px;
  }

  label {
    font-size: 14px;
    font-weight: 600;
  }

  select,
  textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
    box-sizing: border-box;
  }

  textarea {
    resize: vertical;
  }

  .zeichen {
    color: #64748b;
    font-size: 12px;
    text-align: right;
  }

  .foto-bereich {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    padding: 30px;
    text-align: center;
    margin-bottom: 25px;
  }

  .foto-symbol {
    font-size: 34px;
  }

  .foto-bereich p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  }

  .foto-hinweis {
    color: #2563eb;
    font-size: 12px;
    font-weight: 500;
  }

  .foto-bereich input[type="file"] {
    max-width: 100%;
    font: inherit;
    font-size: 13px;
  }

  .foto-vorschauen {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    width: 100%;
    margin-top: 10px;
  }

  .foto-vorschau {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    width: 145px;
  }

  .foto-vorschau img {
    width: 140px;
    height: 110px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
  }

  .foto-dateiname {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #475569;
  }

  button.foto-entfernen {
    background: #fee2e2;
    color: #991b1b;
    padding: 7px 12px;
    font-size: 12px;
  }

  button.foto-entfernen:hover {
    background: #fecaca;
  }

  .aktionen {
    display: flex;
    justify-content: flex-end;
  }

  button {
    background: #172b4d;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 13px 24px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  button:hover {
    background: #29456f;
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

  .meldungs-liste {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .meldungs-karte {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 22px;
  }

  .karten-kopf {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 15px;
    margin-bottom: 15px;
  }

  h3 {
    color: #172b4d;
    margin: 0 0 7px;
    font-size: 17px;
  }

  .datum {
    color: #64748b;
    font-size: 12px;
  }

  .status {
    display: inline-block;
    padding: 7px 11px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .status.offen {
    background: #fef3c7;
    color: #92400e;
  }

  .status.bearbeitung {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status.erledigt {
    background: #dcfce7;
    color: #166534;
  }

  .beschreibung {
    white-space: pre-wrap;
    line-height: 1.6;
    color: #334155;
  }

  .karten-info {
    color: #64748b;
    font-size: 13px;
    margin-top: 16px;
  }

  .bearbeitungsformular {
    margin-top: 18px;
    padding: 18px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .bearbeitungsformular h4 {
    margin: 0 0 18px;
    color: #172b4d;
  }

  .bearbeitungsnotiz {
    background: #f1f5f9;
    padding: 15px;
    border-radius: 8px;
    margin-top: 18px;
  }

  .bearbeitungsnotiz strong {
    font-size: 13px;
  }

  .bearbeitungsnotiz p {
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .fotos {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }

  .fotos img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .leer {
    text-align: center;
    padding: 35px 15px;
    color: #64748b;
  }

  .leer span {
    font-size: 32px;
  }

  @media (max-width: 700px) {
    .kopf,
    .karten-kopf,
    .bereich-kopf {
      flex-direction: column;
      align-items: flex-start;
    }

    .bereich {
      padding: 18px;
    }

    main {
      padding: 12px;
      margin: 20px auto;
    }
  }
</style>
