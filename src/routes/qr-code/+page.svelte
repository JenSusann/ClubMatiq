
<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';

  type Artikel = {
    _id: string;
    name: string;
    menge: number;
    beschreibung?: string;
  };

  let artikel = $state<Artikel[]>([]);
  let laden = $state(true);
  let fehler = $state('');
  let suchbegriff = $state('');
  let ausgewaehlteId = $state('');
  let qrBild = $state('');
  let qrFehler = $state('');
  let qrLaden = $state(false);

  let qrVersion = 0;

  const gefilterteArtikel = $derived(
    artikel.filter((eintrag) =>
      eintrag.name
        .toLocaleLowerCase('de-CH')
        .includes(suchbegriff.toLocaleLowerCase('de-CH').trim())
    )
  );

  const ausgewaehlterArtikel = $derived(
    artikel.find((eintrag) => eintrag._id === ausgewaehlteId)
  );

  const artikelUrl = $derived(
    ausgewaehlteId
      ? `/inventar/${encodeURIComponent(ausgewaehlteId)}`
      : ''
  );

  onMount(() => {
    void ladeArtikel();
  });

  async function ladeArtikel() {
    laden = true;
    fehler = '';

    try {
      const antwort = await fetch('/api/artikel');
      const daten = await antwort.json();

      if (!antwort.ok) {
        throw new Error(
          daten.fehler ?? 'Inventar konnte nicht geladen werden.'
        );
      }

      if (!Array.isArray(daten)) {
        throw new Error('Ungültige Antwort vom Server.');
      }

      artikel = daten as Artikel[];
    } catch (error) {
      fehler =
        error instanceof Error
          ? error.message
          : 'Verbindung zum Server fehlgeschlagen.';
    } finally {
      laden = false;
    }
  }

  async function waehleArtikel(id: string) {
    ausgewaehlteId = id;
    qrBild = '';
    qrFehler = '';

    const aktuelleVersion = ++qrVersion;

    if (!id) {
      qrLaden = false;
      return;
    }

    qrLaden = true;

    try {
      const url = new URL(
        `/inventar/${encodeURIComponent(id)}`,
        'https://clubmatiq.netlify.app'
      ).toString();

      const bild = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        width: 500,
        margin: 3,
        color: {
          dark: '#172B4D',
          light: '#FFFFFF'
        }
      });

      if (aktuelleVersion === qrVersion) {
        qrBild = bild;
      }
    } catch {
      if (aktuelleVersion === qrVersion) {
        qrFehler = 'QR-Code konnte nicht erstellt werden.';
      }
    } finally {
      if (aktuelleVersion === qrVersion) {
        qrLaden = false;
      }
    }
  }

  function dateiname(name: string) {
    return (
      name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 60) || 'artikel'
    );
  }

  function qrHerunterladen() {
    if (!qrBild || !ausgewaehlterArtikel) return;

    const link = document.createElement('a');

    link.href = qrBild;
    link.download =
      `ClubMatiq-QR-${dateiname(ausgewaehlterArtikel.name)}-${ausgewaehlteId}.png`;

    link.click();
  }

  function qrDrucken() {
    if (!qrBild || !ausgewaehlterArtikel) return;

    window.print();
  }
</script>

<svelte:head>
  <title>QR-Code-Verwaltung – ClubMatiq</title>
</svelte:head>

<main>
  <div class="seitenkopf">
    <h1>QR-Code-Verwaltung</h1>
    <p>
      Erstelle QR-Codes für dein Vereinsmaterial.
      Beim Scannen wird der entsprechende Inventarartikel geöffnet.
    </p>
  </div>

  <div class="inhalt">
    <section class="bereich auswahl">
      <h2>1. Material auswählen</h2>

      <p class="hinweis">
        Suche nach einem Inventarartikel und klicke ihn an.
      </p>

      {#if laden}
        <p>Inventar wird geladen ...</p>
      {:else if fehler}
        <p class="fehlermeldung" role="alert">{fehler}</p>

        <button class="sekundaer" onclick={ladeArtikel}>
          Erneut versuchen
        </button>
      {:else if artikel.length === 0}
        <p>Es sind noch keine Inventarartikel vorhanden.</p>

        <a href="/inventar/neu" class="textlink">
          Artikel erfassen
        </a>
      {:else}
        <label for="artikelsuche">Artikel suchen</label>

        <input
          id="artikelsuche"
          type="search"
          placeholder="Artikelname eingeben ..."
          bind:value={suchbegriff}
        />

        <div class="suchergebnisse">
          {#if gefilterteArtikel.length === 0}
            <p class="keine-ergebnisse">
              Keine passenden Artikel gefunden.
            </p>
          {:else}
            {#each gefilterteArtikel as eintrag (eintrag._id)}
              <button
                type="button"
                class="artikel-option"
                class:aktiv={ausgewaehlteId === eintrag._id}
                onclick={() => void waehleArtikel(eintrag._id)}
              >
                <span class="artikelname">
                  {eintrag.name}
                </span>

                <span class="artikelbestand">
                  Bestand: {eintrag.menge}
                </span>
              </button>
            {/each}
          {/if}
        </div>

        <p class="anzahl">
          {gefilterteArtikel.length} von {artikel.length} Artikeln
        </p>

        {#if ausgewaehlterArtikel}
          <div class="artikelinfo">
            <strong>{ausgewaehlterArtikel.name}</strong>

            <span>
              Gesamtbestand: {ausgewaehlterArtikel.menge}
            </span>

            {#if ausgewaehlterArtikel.beschreibung}
              <p>{ausgewaehlterArtikel.beschreibung}</p>
            {/if}
          </div>
        {/if}
      {/if}
    </section>

    <section class="bereich vorschau">
      <h2>2. QR-Code erstellen</h2>

      {#if !ausgewaehlteId}
        <div class="platzhalter">
          <div class="qr-symbol">▦</div>
          <p>Wähle zuerst einen Artikel aus.</p>
        </div>
      {:else if qrLaden}
        <div class="platzhalter">
          <p>QR-Code wird generiert ...</p>
        </div>
      {:else if qrFehler}
        <p class="fehlermeldung" role="alert">
          {qrFehler}
        </p>
      {:else if qrBild && ausgewaehlterArtikel}
        <div class="etikett" id="druckbereich">
          <div class="etikett-kopf">ClubMatiq</div>

          <img
            src={qrBild}
            alt={`QR-Code für ${ausgewaehlterArtikel.name}`}
            class="qr-bild"
          />

          <strong class="etikett-name">
            {ausgewaehlterArtikel.name}
          </strong>

          <span class="etikett-id">
            ID: {ausgewaehlterArtikel._id}
          </span>
        </div>

        <p class="hinweis zentriert">
          Der QR-Code führt zur Artikeldetailseite auf ClubMatiq.
          Für den Zugriff ist eine gültige Anmeldung erforderlich.
        </p>

        <div class="aktionen">
          <button onclick={qrHerunterladen}>
            PNG herunterladen
          </button>

          <button class="sekundaer" onclick={qrDrucken}>
            Etikett drucken
          </button>
        </div>

        <a class="textlink" href={artikelUrl}>
          Artikeldetailseite öffnen
        </a>
      {/if}
    </section>
  </div>

  <section class="bereich info">
    <h2>So funktioniert es</h2>

    <p>
      Suche nach einem Inventarartikel und wähle ihn aus.
      Der passende QR-Code wird automatisch erstellt.
    </p>

    <p>
      Lade den QR-Code herunter oder drucke das Etikett aus.
      Befestige es am entsprechenden Vereinsmaterial.
      Nach dem Scannen öffnet sich die Artikeldetailseite
      von ClubMatiq.
    </p>

    <p>
      Die QR-Codes enthalten keine Passwörter oder persönlichen
      Daten. Sie verweisen ausschliesslich auf die Artikeladresse.
    </p>
  </section>
</main>

<style>
  main {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
  }

  h1,
  h2 {
    color: #172b4d;
  }

  h1 {
    margin-bottom: 8px;
  }

  .seitenkopf {
    margin-bottom: 28px;
  }

  .seitenkopf p,
  .hinweis,
  .anzahl {
    color: #64748b;
  }

  .inhalt {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
  }

  .bereich {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
  }

  .bereich h2 {
    margin-top: 0;
  }

  label {
    display: block;
    font-weight: 600;
    margin: 22px 0 8px;
    color: #334155;
  }

  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: white;
    color: #172b4d;
    font: inherit;
  }

  input:focus {
    outline: 2px solid #93c5fd;
    border-color: #2563eb;
  }

  .suchergebnisse {
    margin-top: 12px;
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .artikel-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px;
    border: none;
    border-bottom: 1px solid #e2e8f0;
    border-radius: 0;
    background: white;
    color: #172b4d;
    text-align: left;
    cursor: pointer;
  }

  .artikel-option:last-child {
    border-bottom: none;
  }

  .artikel-option:hover {
    background: #f1f5f9;
  }

  .artikel-option.aktiv {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .artikelname {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .artikelbestand {
    font-size: 13px;
    color: #64748b;
    white-space: nowrap;
  }

  .keine-ergebnisse {
    padding: 14px;
    color: #64748b;
  }

  .anzahl {
    font-size: 13px;
    margin-top: 10px;
  }

  .artikelinfo {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 16px;
    margin-top: 24px;
  }

  .artikelinfo span,
  .artikelinfo p {
    color: #64748b;
    margin: 0;
  }

  .platzhalter {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
    text-align: center;
    border: 2px dashed #e2e8f0;
    border-radius: 12px;
  }

  .qr-symbol {
    font-size: 90px;
    line-height: 1;
    color: #94a3b8;
  }

  .etikett {
    max-width: 320px;
    margin: 20px auto;
    padding: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    text-align: center;
    background: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .etikett-kopf {
    font-size: 22px;
    font-weight: 800;
    color: #172b4d;
  }

  .qr-bild {
    width: 100%;
    max-width: 260px;
    height: auto;
  }

  .etikett-name {
    color: #172b4d;
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  .etikett-id {
    color: #64748b;
    font-size: 10px;
    overflow-wrap: anywhere;
  }

  .zentriert {
    text-align: center;
  }

  .aktionen {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin: 20px 0;
  }

  button {
    padding: 12px 18px;
    border: none;
    border-radius: 8px;
    background: #172b4d;
    color: white;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    background: #25456f;
  }

  button.sekundaer {
    background: #e2e8f0;
    color: #172b4d;
  }

  button.sekundaer:hover {
    background: #cbd5e1;
  }

  .textlink {
    display: block;
    text-align: center;
    color: #2563eb;
    margin-top: 16px;
    text-decoration: none;
  }

  .fehlermeldung {
    color: #b91c1c;
  }

  .info {
    margin-top: 24px;
  }

  @media (max-width: 800px) {
    .inhalt {
      grid-template-columns: 1fr;
    }

    main {
      margin: 16px auto;
      padding: 12px;
    }

    .bereich {
      padding: 18px;
    }
  }

  @media print {
    :global(body) {
      background: white !important;
    }

    :global(body *) {
      visibility: hidden !important;
    }

    :global(#druckbereich),
    :global(#druckbereich *) {
      visibility: visible !important;
    }

    :global(#druckbereich) {
      position: absolute;
      top: 0;
      left: 0;
      border: none !important;
      margin: 0 !important;
      max-width: none !important;
    }
  }
</style>
