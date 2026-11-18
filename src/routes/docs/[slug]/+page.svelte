<script lang="ts">
 import type { PageData } from './$types';
 import { hilfeArtikel } from '../../../lib/hilfe';
 let { data }: { data: PageData } = $props();
 const weitere = $derived(hilfeArtikel.filter((artikel)=>artikel.gruppe===data.artikel.gruppe && artikel.slug!==data.artikel.slug));
</script>
<svelte:head><title>{data.artikel.titel} – ClubMatiq Hilfe</title><meta name="description" content={data.artikel.beschreibung}/></svelte:head>
<main><a class="zurueck" href="/docs">← Alle Anleitungen</a><div class="layout"><article><div class="kopf"><span>{data.artikel.gruppe}</span><h1>{data.artikel.titel}</h1><p>{data.artikel.beschreibung}</p><div class="rollen"><strong>Berechtigung:</strong> {data.artikel.rollen}</div></div>
 {#each data.artikel.abschnitte as abschnitt, index}<section id={`abschnitt-${index}`}><h2>{index+1}. {abschnitt.titel}</h2>{#if abschnitt.text}<p>{abschnitt.text}</p>{/if}{#if abschnitt.schritte}<ol>{#each abschnitt.schritte as schritt}<li>{schritt}</li>{/each}</ol>{/if}</section>{/each}
 <div class="fuss">Du hast eine Funktion nicht gefunden? Weitere Anleitungen werden mit der Weiterentwicklung von ClubMatiq ergänzt.</div></article>
 <aside><h3>In dieser Anleitung</h3>{#each data.artikel.abschnitte as abschnitt, index}<a href={`#abschnitt-${index}`}>{abschnitt.titel}</a>{/each}{#if weitere.length}<h3>Weitere Artikel</h3>{#each weitere as eintrag}<a href={`/docs/${eintrag.slug}`}>{eintrag.titel}</a>{/each}{/if}</aside></div></main>
<style>
 main{max-width:1120px;margin:30px auto;padding:0 20px 65px;color:#172b4d}.zurueck{color:#2563eb;text-decoration:none;font-weight:600;font-size:14px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:30px;margin-top:24px}article{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:35px}.kopf>span{color:#2563eb;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}h1{font-size:38px;margin:14px 0}.kopf p{font-size:17px;color:#64748b;line-height:1.6}.rollen{background:#eff6ff;padding:14px;border-radius:10px;font-size:13px;margin:24px 0}section{border-top:1px solid #e2e8f0;padding-top:18px;margin-top:28px}h2{font-size:21px}section p,li{color:#475569;line-height:1.8}li{margin:10px 0}aside{align-self:start;position:sticky;top:20px;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px}aside h3{font-size:14px;margin:8px 0 14px}aside a{display:block;color:#475569;text-decoration:none;font-size:13px;padding:9px 0}aside a:hover{color:#2563eb}.fuss{background:#f1f5f9;border-radius:10px;padding:16px;margin-top:30px;font-size:13px;color:#64748b}@media(max-width:800px){.layout{grid-template-columns:1fr}aside{position:static}article{padding:22px}}
</style>
