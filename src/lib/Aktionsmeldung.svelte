<script lang="ts">
  let { fehler = '', erfolg = '', fehlerSchliessen, erfolgSchliessen }: {
    fehler?: string;
    erfolg?: string;
    fehlerSchliessen: () => void;
    erfolgSchliessen: () => void;
  } = $props();
</script>

{#if fehler || erfolg}
  <div class="aktionsmeldungen">
    {#if fehler}
      <div class="meldung fehler">
        <div role="alert"><strong>Fehler</strong><p>{fehler}</p></div>
        <button type="button" aria-label="Fehlermeldung schliessen" onclick={fehlerSchliessen}>×</button>
      </div>
    {/if}
    {#if erfolg}
      <div class="meldung erfolg">
        <div role="status"><strong>Erfolgreich</strong><p>{erfolg}</p></div>
        <button type="button" aria-label="Erfolgsmeldung schliessen" onclick={erfolgSchliessen}>×</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .aktionsmeldungen { position: fixed; top: 16px; right: 16px; z-index: 900; width: min(420px, calc(100% - 32px)); display: grid; gap: 8px; pointer-events: none; }
  .meldung { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 16px; border: 1px solid; border-radius: 10px; box-shadow: 0 5px 20px #172b4d22; pointer-events: auto; overflow-wrap: anywhere; max-height: 40vh; overflow-y: auto; }
  .fehler { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
  .erfolg { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
  p { margin: 5px 0 0; font-size: 14px; }
  button { background: transparent; color: inherit; border: 0; font-size: 24px; line-height: 1; cursor: pointer; padding: 4px; }
</style>
