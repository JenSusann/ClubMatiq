
<script lang="ts">
  const stammdaten = [
    {
      titel: 'Kategorien',
      beschreibung: 'Materialkategorien erstellen und verwalten.',
      symbol: '🏷️',
      link: '/stammdaten/kategorien'
    },
    {
      titel: 'Lagerorte',
      beschreibung: 'Lagerorte und Materialräume verwalten.',
      symbol: '📍',
      link: '/stammdaten/lagerorte'
    },
    {
      titel: 'Kleidergrössen',
      beschreibung: 'Grössen für Vereinskleider verwalten.',
      symbol: '👕',
      link: '/stammdaten/groessen'
    }
  ];
</script>

<svelte:head>
  <title>Stammdaten – ClubMatiq</title>
</svelte:head>

<main>
  <div class="kopf">
    <h1>Stammdatenverwaltung</h1>
    <p>
      Verwalte die grundlegenden Daten für dein Vereinsinventar.
    </p>
  </div>

  <div class="karten">
    {#each stammdaten as eintrag}
      <a href={eintrag.link} class="karte">
        <span class="symbol">{eintrag.symbol}</span>

        <h2>{eintrag.titel}</h2>

        <p>{eintrag.beschreibung}</p>

        <span class="weiter">Verwalten →</span>
      </a>
    {/each}
  </div>
</main>

<style>
  main {
    max-width: 1100px;
    margin: 40px auto;
    padding: 20px;
  }

  .kopf {
    margin-bottom: 30px;
  }

  h1 {
    color: #172b4d;
    margin-bottom: 10px;
  }

  .karten {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .karte {
    display: flex;
    flex-direction: column;
    padding: 25px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    text-decoration: none;
    color: #172b4d;
    transition: 0.2s;
  }

  .karte:hover {
    transform: translateY(-3px);
    border-color: #172b4d;
    box-shadow: 0 4px 12px #00000012;
  }

  .symbol {
    font-size: 32px;
    margin-bottom: 15px;
  }

  h2 {
    font-size: 20px;
    margin-bottom: 10px;
  }

  .karte p {
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  }

  .weiter {
    margin-top: auto;
    padding-top: 25px;
    font-weight: 600;
    font-size: 14px;
  }

  @media (max-width: 700px) {
    .karten {
      grid-template-columns: 1fr;
    }
  }
</style>
