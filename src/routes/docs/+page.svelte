<script lang="ts">
  import { hilfeArtikel, hilfeGruppen } from '../../lib/hilfe';
  let suche = $state('');
  const gefunden = $derived(hilfeArtikel.filter((artikel) =>
    `${artikel.titel} ${artikel.beschreibung} ${artikel.gruppe} ${artikel.abschnitte.map(a=>`${a.titel} ${a.text ?? ''} ${(a.schritte ?? []).join(' ')}`).join(' ')}`
      .toLocaleLowerCase('de-CH').includes(suche.trim().toLocaleLowerCase('de-CH'))));
</script>
<svelte:head><title>Hilfe-Center – ClubMatiq</title><meta name="description" content="ClubMatiq Hilfe und Schritt-für-Schritt-Anleitungen für alle Funktionen." /></svelte:head>
<main><div class="hero"><span>CLUBMATIQ DOKUMENTATION</span><h1>Wie können wir dir helfen?</h1><p>Hier findest du Anleitungen zu allen wichtigen Funktionen – von der Registrierung bis zur Inventarbewertung.</p><label for="hilfe-suche">Anleitungen durchsuchen</label><input id="hilfe-suche" type="search" placeholder="z. B. CSV-Import, Mindestbestand, Ausleihe ..." bind:value={suche} /></div>
  <div class="inhalt">{#if gefunden.length === 0}<p class="leer">Keine Anleitung gefunden. Versuche einen anderen Suchbegriff.</p>{:else}
  {#each hilfeGruppen as gruppe}{@const artikelDerGruppe = gefunden.filter((artikel)=>artikel.gruppe===gruppe)}{#if artikelDerGruppe.length}<section><h2>{gruppe}</h2><div class="karten">{#each artikelDerGruppe as artikel (artikel.slug)}<a class="karte" href={`/docs/${artikel.slug}`}><h3>{artikel.titel} <span>→</span></h3><p>{artikel.beschreibung}</p><small>{artikel.rollen}</small></a>{/each}</div></section>{/if}{/each}{/if}</div>
</main>
<style>
 main{max-width:1120px;margin:0 auto;padding:25px 20px 70px}.hero{background:#172b4d;color:white;border-radius:22px;padding:45px;margin:15px 0 35px}.hero>span{font-size:12px;letter-spacing:.12em;color:#93c5fd;font-weight:800}h1{font-size:clamp(30px,4vw,46px);margin:14px 0}.hero p{color:#cbd5e1;max-width:690px;line-height:1.6}.hero label{display:block;font-size:13px;margin:25px 0 9px}.hero input{width:100%;max-width:700px;border:1px solid #cbd5e1;border-radius:10px;padding:16px;font:inherit;color:#172b4d;background:white}.inhalt section{margin-bottom:36px}h2{color:#172b4d;font-size:23px}.karten{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.karte{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;color:#172b4d;text-decoration:none}.karte:hover{border-color:#2563eb;box-shadow:0 5px 20px #172b4d10}.karte h3{display:flex;justify-content:space-between;margin:0 0 9px}.karte h3 span{color:#2563eb}.karte p{color:#64748b;font-size:14px;line-height:1.6}.karte small{color:#64748b}.leer{padding:30px;background:white;border-radius:12px}@media(max-width:650px){.hero{padding:25px}.karten{grid-template-columns:1fr}}
</style>
