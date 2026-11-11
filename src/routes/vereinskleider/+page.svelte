
<script lang="ts">
  const menues = [
    {
      titel: 'Verkauf erfassen',
      beschreibung: 'Direktverkäufe an der Kleiderbörse und Abgaben an Mitglieder erfassen.',
      icon: '🛍️',
      pfad: '/vereinskleider/verkauf'
    },
    {
      titel: 'Bestellungen',
      beschreibung: 'Mitgliederbestellungen, offene Lieferungen und Abgaben verwalten.',
      icon: '📋',
      pfad: '/vereinskleider/bestellungen'
    },
    {
      titel: 'Verrechnung',
      beschreibung: 'Zahlungen kontrollieren und Verkäufe für ClubDesk aufbereiten.',
      icon: '💳',
      pfad: '/vereinskleider/verrechnung'
    },
    {
      titel: 'Kleiderbestand',
      beschreibung: 'Vorhandene Vereinskleider, Grössen, Preise und Lagerbestände einsehen.',
      icon: '👕',
      pfad: '/vereinskleider/bestand'
    },
    {
      titel: 'Sammelbestellungen',
      beschreibung: 'Nachbestellungen bündeln und definitive Preise festlegen.',
      icon: '📦',
      pfad: '/vereinskleider/sammelbestellungen'
    },
    {
      titel: 'Verkaufshistorie',
      beschreibung: 'Frühere Verkäufe, Zahlungen und vergünstigte Erstbezüge nachvollziehen.',
      icon: '📜',
      pfad: '/vereinskleider/historie'
    }
  ];
</script>

<svelte:head>
  <title>Vereinskleider – ClubMatiq</title>
</svelte:head>

<main>
  <header class="seitenkopf">
    <div>
      <h1>Vereinskleider</h1>
      <p>
        Verwalte Vereinskleider, Verkäufe, Bestellungen und
        Verrechnungen an einem zentralen Ort.
      </p>
    </div>
  </header>

  <section class="menue-grid" aria-label="Vereinskleider-Menü">
    {#each menues as menue}
      <a class="menue-karte" href={menue.pfad}>
        <div class="symbol">{menue.icon}</div>

        <h2>{menue.titel}</h2>
        <p>{menue.beschreibung}</p>

        <span class="pfeil">Öffnen →</span>
      </a>
    {/each}
  </section>

  <section class="hinweis">
    <h2>Vereinskleiderverwaltung</h2>
    <p>
      Die Vereinskleiderverwaltung verwendet die bestehende
      Artikel- und Lagerverwaltung von ClubMatiq.
      Verkäufe, Bestellungen und Verrechnungen werden
      schrittweise ergänzt.
    </p>
  </section>
</main>

<style>
  main {
    max-width: 1100px;
    margin: 40px auto;
    padding: 20px;
  }

  .seitenkopf {
    margin-bottom: 32px;
  }

  h1 {
    color: #172b4d;
    font-size: 30px;
    margin: 0 0 10px;
  }

  .seitenkopf p {
    color: #64748b;
    line-height: 1.6;
    margin: 0;
  }

  .menue-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }

  .menue-karte {
    display: flex;
    flex-direction: column;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 24px;
    text-decoration: none;
    color: inherit;
    min-height: 210px;
    transition:
      transform 0.2s,
      box-shadow 0.2s,
      border-color 0.2s;
  }

  .menue-karte:hover {
    transform: translateY(-3px);
    border-color: #94a3b8;
    box-shadow: 0 8px 24px rgba(23, 43, 77, 0.08);
  }

  .menue-karte:focus-visible {
    outline: 3px solid #2563eb;
    outline-offset: 3px;
  }

  .symbol {
    font-size: 30px;
    margin-bottom: 18px;
  }

  h2 {
    color: #172b4d;
    font-size: 18px;
    margin: 0 0 10px;
  }

  .menue-karte p {
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 20px;
    flex: 1;
  }

  .pfeil {
    color: #2563eb;
    font-weight: 600;
    font-size: 14px;
  }

  .hinweis {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    margin-top: 32px;
  }

  .hinweis p {
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 0;
  }

  @media (max-width: 850px) {
    .menue-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 550px) {
    .menue-grid {
      grid-template-columns: 1fr;
    }

    main {
      margin: 20px auto;
      padding: 16px;
    }
  }
</style>
