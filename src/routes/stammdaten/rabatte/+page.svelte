<script lang="ts">
  import Aktionsmeldung from '../../../lib/Aktionsmeldung.svelte';
  import { onMount } from 'svelte';

  type Rabattart = 'prozent' | 'betrag' | 'fixpreis';
  type Geltungsbereich = 'warenkorb' | 'artikel' | 'kategorie';
  type Option = { _id: string; name: string };
  type Rabattregel = {
    _id: string;
    name: string;
    rabattart: Rabattart;
    wert: number;
    geltungsbereich: Geltungsbereich;
    artikelIds: string[];
    kategorieIds: string[];
    riegen: string[];
    maximaleMenge: number | null;
    gueltigAb: string | null;
    gueltigBis: string | null;
    einmaligProMitglied: boolean;
    anspruchsgruppe: string;
    kombinierbar: boolean;
    aktiv: boolean;
  };
  type Formular = Omit<Rabattregel, '_id'>;

  let aktiveRiegen = $state<string[]>([]);
  const leer: Formular = {
    name: '', rabattart: 'prozent', wert: 0, geltungsbereich: 'warenkorb',
    artikelIds: [], kategorieIds: [], riegen: [], maximaleMenge: null,
    gueltigAb: null, gueltigBis: null, einmaligProMitglied: false, anspruchsgruppe: '', kombinierbar: true, aktiv: true
  };

  let regeln = $state<Rabattregel[]>([]);
  let artikel = $state<Option[]>([]);
  let kategorien = $state<Option[]>([]);
  let formular = $state<Formular>({ ...leer });
  const riegenOptionen = $derived([...new Set([...aktiveRiegen, ...formular.riegen])]);
  let anspruchsmodus = $state<'einzeln' | 'bestehend' | 'neu'>('einzeln');
  let anspruchsname = $state('');
  const anspruchsoptionen = $derived([...new Set(regeln.filter(r => r.einmaligProMitglied && r.anspruchsgruppe).map(r => r.anspruchsgruppe))].sort());
  function anspruchsmodusSetzen(modus: 'einzeln' | 'bestehend' | 'neu') {
    anspruchsmodus = modus;
    anspruchsname = '';
    formular.anspruchsgruppe = modus === 'bestehend' ? (anspruchsoptionen[0] ?? '') : '';
  }
  function anspruchsnameSetzen(name: string) {
    anspruchsname = name;
    formular.anspruchsgruppe = name.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  let bearbeiteteId = $state<string | null>(null);
  let laden = $state(true);
  let speichern = $state(false);
  let fehler = $state('');
  let meldung = $state('');

  const istGueltig = $derived(
    formular.name.trim().length > 0 &&
    Number.isFinite(formular.wert) && formular.wert >= 0 &&
    (formular.rabattart !== 'prozent' || formular.wert <= 100) &&
    Math.abs(formular.wert * 100 - Math.round(formular.wert * 100)) < 0.000001 &&
    !(formular.rabattart === 'fixpreis' && formular.geltungsbereich === 'warenkorb') &&
    (formular.geltungsbereich !== 'artikel' || formular.artikelIds.length > 0) &&
    (formular.geltungsbereich !== 'kategorie' || formular.kategorieIds.length > 0) &&
    (formular.maximaleMenge === null || (Number.isInteger(formular.maximaleMenge) && formular.maximaleMenge > 0)) &&
    (!formular.einmaligProMitglied || (formular.rabattart === 'fixpreis' && formular.geltungsbereich !== 'warenkorb' && formular.maximaleMenge === 1)) &&
    (!formular.einmaligProMitglied || anspruchsmodus === 'einzeln' || (!!formular.anspruchsgruppe && (anspruchsmodus !== 'neu' || !anspruchsoptionen.includes(formular.anspruchsgruppe)))) &&
    (!formular.einmaligProMitglied || !formular.anspruchsgruppe.trim() || /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(formular.anspruchsgruppe.trim())) &&
    (!formular.gueltigAb || !formular.gueltigBis || formular.gueltigAb <= formular.gueltigBis)
  );

  function umschalten(feld: 'artikelIds' | 'kategorieIds' | 'riegen', id: string, aktiv: boolean) {
    const werte = formular[feld];
    formular = { ...formular, [feld]: aktiv ? [...werte.filter((wert) => wert !== id), id] : werte.filter((wert) => wert !== id) };
  }

  function neu() {
    formular = { ...leer, artikelIds: [], kategorieIds: [], riegen: [] };
    anspruchsmodus = 'einzeln';
    anspruchsname = '';
    bearbeiteteId = null;
    fehler = '';
    meldung = '';
  }

  function bearbeiten(regel: Rabattregel) {
    bearbeiteteId = regel._id;
    anspruchsmodus = regel.anspruchsgruppe ? 'bestehend' : 'einzeln';
    anspruchsname = '';
    formular = {
      name: regel.name, rabattart: regel.rabattart, wert: regel.wert,
      geltungsbereich: regel.geltungsbereich,
      artikelIds: [...(regel.artikelIds ?? [])],
      kategorieIds: [...(regel.kategorieIds ?? [])],
      riegen: [...(regel.riegen ?? [])],
      maximaleMenge: regel.maximaleMenge ?? null,
      gueltigAb: regel.gueltigAb ? regel.gueltigAb.slice(0, 10) : null,
      gueltigBis: regel.gueltigBis ? regel.gueltigBis.slice(0, 10) : null,
      einmaligProMitglied: regel.einmaligProMitglied ?? false,
      anspruchsgruppe: regel.anspruchsgruppe ?? '',
      kombinierbar: regel.kombinierbar,
      aktiv: regel.aktiv
    };
    fehler = '';
    meldung = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function leseAntwort(antwort: Response): Promise<unknown> {
    const inhalt: unknown = await antwort.json().catch(() => null);
    if (!antwort.ok) {
      const objekt = inhalt && typeof inhalt === 'object' ? inhalt as Record<string, unknown> : {};
      throw new Error(typeof objekt.fehler === 'string' ? objekt.fehler : typeof objekt.error === 'string' ? objekt.error : `Anfrage fehlgeschlagen (${antwort.status}).`);
    }
    return inhalt;
  }

  async function ladenAlle() {
    laden = true;
    fehler = '';
    try {
      const [rabattAntwort, artikelAntwort, kategorienAntwort, riegenAntwort] = await Promise.all([
        fetch('/api/rabatte'), fetch('/api/artikel'), fetch('/api/kategorien'), fetch('/api/riegen')
      ]);
      const [rabattDaten, artikelDaten, kategorieDaten, riegenDaten] = await Promise.all([
        leseAntwort(rabattAntwort), leseAntwort(artikelAntwort), leseAntwort(kategorienAntwort), leseAntwort(riegenAntwort)
      ]);
      if (!Array.isArray(rabattDaten) || !Array.isArray(artikelDaten) || !Array.isArray(kategorieDaten) || !Array.isArray(riegenDaten)) {
        throw new Error('Die API hat ein unerwartetes Datenformat zurückgegeben.');
      }
      aktiveRiegen = (riegenDaten as (Option & { aktiv: boolean })[]).filter(r => r.aktiv).map(r => r.name);
      regeln = rabattDaten as Rabattregel[];
      artikel = (artikelDaten as Option[]).sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
      kategorien = (kategorieDaten as Option[]).sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
    } catch (err) {
      fehler = err instanceof Error ? err.message : 'Die Daten konnten nicht geladen werden.';
    } finally {
      laden = false;
    }
  }

  async function speichernRegel() {
    if (speichern || !istGueltig) return;
    speichern = true;
    fehler = '';
    meldung = '';
    try {
      const antwort = await fetch('/api/rabatte', {
        method: bearbeiteteId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(bearbeiteteId ? { _id: bearbeiteteId } : {}),
          ...formular,
          anspruchsgruppe: formular.einmaligProMitglied ? formular.anspruchsgruppe.trim() : '',
          artikelIds: formular.geltungsbereich === 'artikel' ? formular.artikelIds : [],
          kategorieIds: formular.geltungsbereich === 'kategorie' ? formular.kategorieIds : []
        })
      });
      await leseAntwort(antwort);
      const warBearbeitung = bearbeiteteId !== null;
      neu();
      await ladenAlle();
      meldung = warBearbeitung ? 'Rabattregel aktualisiert.' : 'Rabattregel erstellt.';
    } catch (err) {
      fehler = err instanceof Error ? err.message : 'Die Rabattregel konnte nicht gespeichert werden.';
    } finally {
      speichern = false;
    }
  }

  function wertText(regel: Rabattregel): string {
    if (regel.rabattart === 'prozent') return `${regel.wert} %`;
    const chf = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(regel.wert);
    return regel.rabattart === 'fixpreis' ? `Fixpreis ${chf}` : `Rabatt ${chf}`;
  }

  onMount(() => { void ladenAlle(); });
</script>
<Aktionsmeldung fehler={fehler} erfolg={meldung} fehlerSchliessen={() => fehler = ''} erfolgSchliessen={() => meldung = ''} />

<svelte:head><title>Rabattregeln – ClubMatiq</title></svelte:head>

<main>
  <a class="zurueck" href="/stammdaten">← Zurück zu Stammdaten</a>
  <header>
    <h1>Rabattregeln</h1>
    <p>Vereinsweite Rabatte verwalten. Die Regeln stehen im Verkaufsformular zur Auswahl. Riegen werden aus den Vereinsstammdaten übernommen.</p>
  </header>

  
  

  <section class="karte">
    <div class="titelzeile">
      <h2>{bearbeiteteId ? 'Rabattregel bearbeiten' : 'Neue Rabattregel'}</h2>
      {#if bearbeiteteId}<button type="button" class="sekundaer" onclick={neu}>Neue Regel</button>{/if}
    </div>
    <form onsubmit={(event) => { event.preventDefault(); void speichernRegel(); }}>
      <div class="felder">
        <div class="breit">
          <label for="name">Bezeichnung</label>
          <input id="name" type="text" maxlength="150" placeholder="z. B. Erstes JUKO-T-Shirt" bind:value={formular.name} required />
        </div>
        <div>
          <label for="art">Rabattart</label>
          <select id="art" bind:value={formular.rabattart}>
            <option value="prozent">Prozentualer Rabatt</option>
            <option value="betrag">Fester Rabattbetrag (CHF)</option>
            <option value="fixpreis">Reduzierter Fixpreis (CHF)</option>
          </select>
        </div>
        <div>
          <label for="wert">{formular.rabattart === 'prozent' ? 'Rabatt in %' : formular.rabattart === 'fixpreis' ? 'Neuer Stückpreis (CHF)' : 'Rabattbetrag (CHF)'}</label>
          <input id="wert" type="number" min="0" max={formular.rabattart === 'prozent' ? 100 : undefined} step="0.01" bind:value={formular.wert} required />
        </div>
        <div>
          <label for="bereich">Gilt für</label>
          <select id="bereich" bind:value={formular.geltungsbereich}>
            <option value="warenkorb">Gesamten Warenkorb</option>
            <option value="artikel">Bestimmte Artikel</option>
            <option value="kategorie">Bestimmte Kategorien</option>
          </select>
        </div>
        <div>
          <label for="menge">Maximale rabattierte Menge (optional)</label>
          <input id="menge" type="number" min="1" step="1" value={formular.maximaleMenge ?? ''} oninput={(event) => { const wert = event.currentTarget.value; formular.maximaleMenge = wert === '' ? null : Number(wert); }} placeholder="Keine Begrenzung" />
        </div>
      </div>

      {#if formular.rabattart === 'fixpreis' && formular.geltungsbereich === 'warenkorb'}
        <p class="hinweis warnung">Ein Fixpreis muss auf bestimmte Artikel oder Kategorien angewendet werden.</p>
      {/if}

      {#if formular.geltungsbereich === 'artikel'}
        <fieldset>
          <legend>Artikel auswählen</legend>
          <div class="auswahl">
            {#each artikel as eintrag (eintrag._id)}
              <label class="checkbox"><input type="checkbox" checked={formular.artikelIds.includes(eintrag._id)} onchange={(event) => umschalten('artikelIds', eintrag._id, event.currentTarget.checked)} />{eintrag.name}</label>
            {/each}
          </div>
          {#if artikel.length === 0}<p class="hinweis">Keine Artikel vorhanden.</p>{/if}
        </fieldset>
      {:else if formular.geltungsbereich === 'kategorie'}
        <fieldset>
          <legend>Kategorien auswählen</legend>
          <div class="auswahl">
            {#each kategorien as kategorie (kategorie._id)}
              <label class="checkbox"><input type="checkbox" checked={formular.kategorieIds.includes(kategorie._id)} onchange={(event) => umschalten('kategorieIds', kategorie._id, event.currentTarget.checked)} />{kategorie.name}</label>
            {/each}
          </div>
        </fieldset>
      {/if}

      <fieldset>
        <legend>Riegen (keine Auswahl = alle Riegen)</legend>
        <div class="auswahl">
          {#each riegenOptionen as riege}
            <label class="checkbox"><input type="checkbox" checked={formular.riegen.includes(riege)} onchange={(event) => umschalten('riegen', riege, event.currentTarget.checked)} />{riege}{aktiveRiegen.includes(riege) ? '' : ' (inaktiv oder nicht zugeordnet)'}</label>
          {/each}
        </div>
      </fieldset>

      <div class="felder">
        <div>
          <label for="ab">Gültig ab (optional)</label>
          <input id="ab" type="date" value={formular.gueltigAb ?? ''} onchange={(event) => { formular.gueltigAb = event.currentTarget.value || null; }} />
        </div>
        <div>
          <label for="bis">Gültig bis (optional)</label>
          <input id="bis" type="date" value={formular.gueltigBis ?? ''} onchange={(event) => { formular.gueltigBis = event.currentTarget.value || null; }} />
        </div>
      </div>

      <div class="schalter">
        <label class="checkbox"><input type="checkbox" bind:checked={formular.einmaligProMitglied} onchange={(event) => { if (event.currentTarget.checked) { formular.rabattart = 'fixpreis'; formular.wert = 0; formular.maximaleMenge = 1; if (formular.geltungsbereich === 'warenkorb') formular.geltungsbereich = 'artikel'; formular.kombinierbar = false; } }} />Einmaliger Bezug pro Mitglied</label>
        <label class="checkbox"><input type="checkbox" bind:checked={formular.kombinierbar} />Mit anderen Rabattregeln kombinierbar</label>
        <label class="checkbox"><input type="checkbox" bind:checked={formular.aktiv} />Rabattregel aktiv</label>
      </div>
      {#if formular.einmaligProMitglied}
        <div>
          <label for="anspruchsmodus">Erstbezugsanspruch</label>
          <select id="anspruchsmodus" value={anspruchsmodus} onchange={(event) => anspruchsmodusSetzen(event.currentTarget.value as 'einzeln' | 'bestehend' | 'neu')}>
            <option value="einzeln">Eigener Anspruch pro Artikel</option>
            <option value="bestehend" disabled={!anspruchsoptionen.length}>Bestehenden gemeinsamen Anspruch verwenden</option>
            <option value="neu">Neuen gemeinsamen Anspruch erstellen</option>
          </select>
          {#if anspruchsmodus === 'bestehend'}
            <label for="anspruchsgruppe">Gemeinsamer Anspruch</label>
            <select id="anspruchsgruppe" bind:value={formular.anspruchsgruppe}>
              {#each anspruchsoptionen as gruppe}
                <option value={gruppe}>{gruppe.replace(/[-_]/g, ' ')} ({regeln.filter(r => r.anspruchsgruppe === gruppe).map(r => r.name).join(', ')})</option>
              {/each}
            </select>
          {:else if anspruchsmodus === 'neu'}
            <label for="anspruchsname">Name des gemeinsamen Anspruchs</label>
            <input id="anspruchsname" type="text" maxlength="80" placeholder="z. B. JUKO T-Shirt" value={anspruchsname} oninput={(event) => anspruchsnameSetzen(event.currentTarget.value)} />
            {#if anspruchsoptionen.includes(formular.anspruchsgruppe)}<p class="hinweis" role="status">Dieser Anspruch existiert bereits. Bitte den bestehenden Anspruch auswählen.</p>{/if}
          {/if}
          <p class="hinweis">Ein gemeinsamer Anspruch verhindert, dass ein Mitglied mehrere Artikelvarianten vergünstigt bezieht. Die berechtigten Riegen werden separat oben ausgewählt.</p>
        </div>
      {/if}
      <p class="hinweis">Einmalige Regeln benötigen einen Fixpreis, Artikel oder Kategorien und maximal ein Stück. Der Anspruch wird beim Verkauf serverseitig geprüft.</p>
      <div class="aktionen">
        {#if !istGueltig && formular.einmaligProMitglied}<p class="hinweis" role="status">Bitte Bezeichnung, gültigen Fixpreis, Artikel oder Kategorie und maximale Menge 1 prüfen. Bei einem gemeinsamen Anspruch bitte einen gültigen, eindeutigen Namen oder einen bestehenden Anspruch auswählen.</p>{/if}
        <button type="submit" disabled={!istGueltig || speichern || laden}>{speichern ? 'Wird gespeichert ...' : bearbeiteteId ? 'Änderungen speichern' : 'Rabattregel erstellen'}</button>
        {#if bearbeiteteId}<button type="button" class="sekundaer" onclick={neu}>Abbrechen</button>{/if}
      </div>
    </form>
  </section>

  <section class="karte">
    <div class="titelzeile"><h2>Gespeicherte Rabattregeln</h2><button type="button" class="sekundaer" onclick={() => void ladenAlle()} disabled={laden}>Aktualisieren</button></div>
    {#if laden}
      <p>Rabattregeln werden geladen ...</p>
    {:else if regeln.length === 0}
      <p class="hinweis">Noch keine Rabattregeln vorhanden.</p>
    {:else}
      <div class="regelliste">
        {#each regeln as regel (regel._id)}
          <div class="regel">
            <div>
              <strong>{regel.name}</strong>
              <div class="meta">{wertText(regel)} · {regel.geltungsbereich === 'warenkorb' ? 'Warenkorb' : regel.geltungsbereich === 'artikel' ? 'Artikel' : 'Kategorie'} · {regel.aktiv ? 'Aktiv' : 'Inaktiv'}{regel.einmaligProMitglied ? ' · Erstbezug' : ''}{regel.anspruchsgruppe ? ` · Gemeinsamer Erstbezugsanspruch: ${regel.anspruchsgruppe}` : ''}</div>
              <div class="meta">{regel.riegen?.length ? regel.riegen.join(', ') : 'Alle Riegen'}{regel.maximaleMenge ? ` · Max. ${regel.maximaleMenge} Stück` : ''}</div>
            </div>
            <button type="button" class="sekundaer" onclick={() => bearbeiten(regel)}>Bearbeiten</button>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  main { max-width: 1100px; margin: 36px auto; padding: 20px; }
  .zurueck { color: #2563eb; font-weight: 600; text-decoration: none; font-size: 14px; }
  header { margin: 28px 0; }
  h1, h2 { color: #172b4d; }
  header p, .hinweis, .meta { color: #64748b; }
  .karte { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 20px 0; }
  .titelzeile { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .titelzeile h2 { margin: 0 0 18px; }
  .felder { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
  .breit { grid-column: 1 / -1; }
  label, legend { display: block; font-weight: 600; color: #334155; font-size: 14px; margin-bottom: 8px; }
  input:not([type='checkbox']), select { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; font: inherit; }
  fieldset { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 18px 0; }
  .auswahl { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px 12px; max-height: 220px; overflow-y: auto; }
  .checkbox { display: flex; align-items: center; gap: 8px; margin: 5px 0; font-weight: 400; }
  .checkbox input { flex: 0 0 auto; }
  .schalter { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 20px 0; }
  .aktionen { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
  button { padding: 11px 16px; border: 0; border-radius: 8px; background: #2563eb; color: white; font: inherit; font-weight: 600; cursor: pointer; }
  button.sekundaer { background: #eff6ff; color: #1d4ed8; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .regelliste { display: grid; }
  .regel { display: flex; justify-content: space-between; gap: 16px; padding: 16px 0; border-top: 1px solid #e2e8f0; align-items: center; }
  .meta { font-size: 13px; margin-top: 6px; }

  .fehler, .warnung { background: #fef2f2; color: #991b1b; }

  .hinweis { font-size: 13px; line-height: 1.5; }
  @media (max-width: 650px) { .felder { grid-template-columns: 1fr; } .breit { grid-column: auto; } .karte { padding: 16px; } .regel { align-items: flex-start; } }
</style>
