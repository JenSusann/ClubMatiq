<script lang="ts">
  import { verwendeBestaetigung } from '../../../lib/bestaetigung';
  const bestaetigen = verwendeBestaetigung();
  import { onMount } from 'svelte';

  type Bedarf = {
    artikelId: string;
    groesseId: string | null;
    artikelname: string;
    lieferantId?: string | null;
    lieferantName?: string | null;
    offen: number;
    bestand: number | null;
    verfuegbar: number;
    bereitsInSammelbestellungen: number;
    nachbestellen: number;
  };
  type SammelPosition = { artikelId: string; groesseId: string | null; artikelname: string; menge: number; geliefertMenge?: number; offenMenge?: number; kundenbedarfMenge?: number; lagerreserveMenge?: number };
  type Sammelbestellung = {
    _id: string;
    status: 'entwurf' | 'bestellt' | 'geliefert';
    lieferantId?: string | null;
    lieferantName?: string | null;
    positionen: SammelPosition[];
    bemerkung: string;
    erstelltAm: string;
    aktualisiertAm: string;
    bestelltAm?: string | null;
    geliefertAm?: string | null;
  };
  type Groesse = { _id: string; bezeichnung: string };
  type Uebersicht = { bedarf: Bedarf[]; sammelbestellungen: Sammelbestellung[] };

  let bedarf = $state<Bedarf[]>([]);
  let sammelbestellungen = $state<Sammelbestellung[]>([]);
  let groessen = $state<Groesse[]>([]);
  let mengen = $state<Record<string, number>>({});
  let suche = $state('');
  let ansicht = $state<'bedarf' | 'reserve'>('bedarf');
  let aufgeklappteArtikel = $state<string[]>([]);
  let bemerkung = $state('');
  let ausgewaehlterLieferant = $state('');
  let laden = $state(true);
  let aktualisieren = $state(false);
  let speichern = $state(false);
  let fehler = $state('');
  let groessenFehler = $state('');
  let erfolg = $state('');
  let filterStatus = $state<'alle' | Sammelbestellung['status']>('alle');
  let filterArt = $state<'alle' | 'bedarf' | 'reserve' | 'gemischt' | 'unbekannt'>('alle');
  let gruppierung = $state<'lieferant' | 'datum'>('lieferant');
  let ausgewaehlteBestellungen = $state<string[]>([]);
  let pdfExportLaeuft = $state(false);
  let offeneDetails = $state<string[]>([]);
  let wareneingangOffen = $state<string | null>(null);
  let eingangsMengen = $state<Record<string, number>>({});
  let bearbeitungId = $state<string | null>(null);

  function schluessel(p: { artikelId: string; groesseId: string | null }): string {
    return `${p.artikelId}:${p.groesseId ?? ''}`;
  }
  function groesseName(id: string | null): string {
    return id === null ? 'Ohne Grösse' : groessen.find((g) => g._id === id)?.bezeichnung ?? 'Unbekannte Grösse';
  }
  function formatDatum(wert: string | null | undefined): string {
    if (!wert) return '–';
    const datum = new Date(wert);
    return Number.isNaN(datum.getTime()) ? '–' : new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(datum);
  }
  function statusName(status: Sammelbestellung['status']): string {
    return status === 'entwurf' ? 'Entwurf' : status === 'bestellt' ? 'Bestellt' : 'Geliefert';
  }
  // Nur der ausgewählte Lieferant; in der Bedarfsansicht nur Positionen mit Bedarf.
  const sichtbarePositionen = $derived(bedarf.filter((p) => {
    if (p.lieferantId !== aktiverLieferant) return false;
    if (ansicht === 'bedarf' && p.nachbestellen <= 0) return false;
    const text = suche.trim().toLocaleLowerCase('de-CH');
    return !text || `${p.artikelname} ${groesseName(p.groesseId)} ${p.lieferantName ?? ''}`.toLocaleLowerCase('de-CH').includes(text);
  }));
  const bedarfOhneLieferant = $derived(bedarf.filter((p) => p.nachbestellen > 0 && !p.lieferantId));
  const bedarfOhneLieferantGruppen = $derived.by(() => {
    const gruppen = new Map<string, { artikelId: string; artikelname: string; menge: number }>();
    for (const p of bedarfOhneLieferant) {
      const vorhanden = gruppen.get(p.artikelId);
      if (vorhanden) vorhanden.menge += p.nachbestellen;
      else gruppen.set(p.artikelId, { artikelId: p.artikelId, artikelname: p.artikelname, menge: p.nachbestellen });
    }
    return [...gruppen.values()];
  });
  const artikelGruppen = $derived.by(() => {
    const gruppen = new Map<string, { id: string; name: string; positionen: Bedarf[]; bedarf: number; auswahl: number }>();
    for (const p of sichtbarePositionen) {
      let gruppe = gruppen.get(p.artikelId);
      if (!gruppe) {
        gruppe = { id: p.artikelId, name: p.artikelname, positionen: [], bedarf: 0, auswahl: 0 };
        gruppen.set(p.artikelId, gruppe);
      }
      gruppe.positionen.push(p);
      gruppe.bedarf += p.nachbestellen;
      gruppe.auswahl += mengen[schluessel(p)] ?? 0;
    }
    return [...gruppen.values()].sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
  });
  function artikelUmschalten(id: string): void {
    aufgeklappteArtikel = aufgeklappteArtikel.includes(id)
      ? aufgeklappteArtikel.filter((wert) => wert !== id)
      : [...aufgeklappteArtikel, id];
  }
  const lieferantenAuswahl = $derived.by(() => {
    const gruppen = new Map<string, string>();
    for (const p of bedarf) if (p.lieferantId) gruppen.set(p.lieferantId, p.lieferantName || 'Unbekannter Lieferant');
    return [...gruppen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
  });
  const aktiverLieferant = $derived(lieferantenAuswahl.some((l) => l.id === ausgewaehlterLieferant) ? ausgewaehlterLieferant : (lieferantenAuswahl[0]?.id ?? ''));
  function bestellart(s: Sammelbestellung): 'bedarf' | 'reserve' | 'gemischt' | 'unbekannt' {
    if (!s.positionen.length || s.positionen.some((p) =>
      !Number.isSafeInteger(p.kundenbedarfMenge) || !Number.isSafeInteger(p.lagerreserveMenge) ||
      (p.kundenbedarfMenge ?? -1) < 0 || (p.lagerreserveMenge ?? -1) < 0 ||
      (p.kundenbedarfMenge ?? 0) + (p.lagerreserveMenge ?? 0) !== p.menge)) return 'unbekannt';
    const kunden = s.positionen.reduce((summe, p) => summe + (p.kundenbedarfMenge ?? 0), 0);
    const reserve = s.positionen.reduce((summe, p) => summe + (p.lagerreserveMenge ?? 0), 0);
    return kunden > 0 && reserve > 0 ? 'gemischt' : kunden > 0 ? 'bedarf' : 'reserve';
  }
  function bestellartName(s: Sammelbestellung): string {
    const art = bestellart(s);
    return art === 'bedarf' ? 'Nachbestellbedarf' : art === 'reserve' ? 'Lagerreserve' : art === 'gemischt' ? 'Bedarf + Reserve' : 'Bestellart unbekannt';
  }
  const sichtbareSammelbestellungen = $derived(sammelbestellungen.filter((s) =>
    (filterStatus === 'alle' || s.status === filterStatus) &&
    (filterArt === 'alle' || bestellart(s) === filterArt)));
  const bestellGruppen = $derived.by(() => {
    const gruppen = new Map<string, { id: string; name: string; bestellungen: Sammelbestellung[] }>();
    for (const s of sichtbareSammelbestellungen) {
      const id = gruppierung === 'lieferant' ? (s.lieferantId ?? `ohne-${s._id}`) : s.erstelltAm.slice(0, 10);
      const name = gruppierung === 'lieferant' ? (s.lieferantName || 'Lieferant nicht hinterlegt') : formatDatum(s.erstelltAm).split(',')[0];
      if (!gruppen.has(id)) gruppen.set(id, { id, name, bestellungen: [] });
      gruppen.get(id)!.bestellungen.push(s);
    }
    return [...gruppen.values()].sort((a, b) => gruppierung === 'lieferant' ?
      a.name.localeCompare(b.name, 'de-CH') : b.id.localeCompare(a.id));
  });
  const ausgewaehlteObjekte = $derived(sammelbestellungen.filter((s) => ausgewaehlteBestellungen.includes(s._id)));
  const auswahlLieferant = $derived(ausgewaehlteObjekte[0]?.lieferantId ?? null);
  const auswahlStueck = $derived(ausgewaehlteObjekte.reduce((summe, s) =>
    summe + s.positionen.reduce((a, p) => a + p.menge, 0), 0));
  function bestellungWaehlen(s: Sammelbestellung, checked: boolean): void {
    if (!checked) {
      ausgewaehlteBestellungen = ausgewaehlteBestellungen.filter((id) => id !== s._id);
      return;
    }
    if (!s.lieferantId) { fehler = 'Diese Bestellung hat keinen gültigen Lieferanten und kann nicht gemeinsam exportiert werden.'; return; }
    if (auswahlLieferant && auswahlLieferant !== s.lieferantId) {
      fehler = 'Für den gemeinsamen PDF-Export dürfen nur Bestellungen desselben Lieferanten ausgewählt werden.';
      return;
    }
    fehler = '';
    ausgewaehlteBestellungen = [...new Set([...ausgewaehlteBestellungen, s._id])];
  }
  function gruppeWaehlen(gruppe: { bestellungen: Sammelbestellung[] }): void {
    const moeglich = gruppe.bestellungen.filter((s) => s.lieferantId && (!auswahlLieferant || s.lieferantId === auswahlLieferant));
    if (!moeglich.length) { fehler = 'Bitte nur Bestellungen desselben Lieferanten auswählen.'; return; }
    ausgewaehlteBestellungen = [...new Set([...ausgewaehlteBestellungen, ...moeglich.map((s) => s._id)])];
  }
  async function gesamtPdfHerunterladen(): Promise<void> {
    if (pdfExportLaeuft || ausgewaehlteBestellungen.length === 0) return;
    if (!auswahlLieferant || ausgewaehlteObjekte.length !== ausgewaehlteBestellungen.length ||
        ausgewaehlteObjekte.some((s) => s.lieferantId !== auswahlLieferant)) {
      fehler = 'Bitte ausschliesslich Bestellungen eines Lieferanten auswählen.';
      return;
    }
    pdfExportLaeuft = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/vereinskleider/sammelbestellungen/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bestellungIds: ausgewaehlteBestellungen })
      });
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => null) as { message?: string; fehler?: string } | null;
        throw new Error(daten?.fehler ?? daten?.message ?? `PDF-Export fehlgeschlagen (HTTP ${antwort.status}).`);
      }
      const datei = await antwort.blob();
      if (!datei.size) throw new Error('Die PDF-Datei ist leer.');
      const url = URL.createObjectURL(datei);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `bestelluebersicht-${auswahlLieferant.slice(-8)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      erfolg = 'Bestellübersicht wurde als PDF erstellt. Bestellstatus und Lagerbestand bleiben unverändert.';
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'PDF-Export fehlgeschlagen.';
    } finally {
      pdfExportLaeuft = false;
    }
  }

  const MAX_BESTELLMENGE = 10000;
  const ausgewaehltePositionen = $derived(bedarf.filter((p) => {
    if (!p.lieferantId || p.lieferantId !== aktiverLieferant) return false;
    const menge = mengen[schluessel(p)] ?? 0;
    return Number.isSafeInteger(menge) && menge > 0 && menge <= MAX_BESTELLMENGE && p.bestand !== null;
  }).map((p) => ({ artikelId: p.artikelId, groesseId: p.groesseId, menge: mengen[schluessel(p)] })));
  const ausgewaehlteStueck = $derived(ausgewaehltePositionen.reduce((summe, p) => summe + p.menge, 0));
  const zusaetzlicheReserve = $derived(bedarf.reduce((summe, p) => summe + (p.lieferantId === aktiverLieferant ? Math.max(0, (mengen[schluessel(p)] ?? 0) - p.nachbestellen) : 0), 0));
  const nachbestellenGesamt = $derived(bedarf.reduce((summe, p) => summe + p.nachbestellen, 0));
  const offenGesamt = $derived(bedarf.reduce((summe, p) => summe + p.offen, 0));

  async function datenLaden(): Promise<void> {
    aktualisieren = true;
    fehler = '';
    groessenFehler = '';
    try {
      const [antwort, groessenAntwort] = await Promise.all([
        fetch('/api/vereinskleider/sammelbestellungen'),
        fetch('/api/groessen')
      ]);
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({})) as { fehler?: string };
        throw new Error(daten.fehler ?? 'Sammelbestellungen konnten nicht geladen werden.');
      }
      const daten = await antwort.json() as Uebersicht;
      bedarf = Array.isArray(daten.bedarf) ? daten.bedarf : [];
      sammelbestellungen = Array.isArray(daten.sammelbestellungen) ? daten.sammelbestellungen : [];
      ausgewaehlteBestellungen = ausgewaehlteBestellungen.filter((id) => sammelbestellungen.some((s) => s._id === id));
      if (groessenAntwort.ok) {
        groessen = await groessenAntwort.json() as Groesse[];
      } else {
        groessenFehler = 'Grössenbezeichnungen konnten nicht geladen werden.';
      }
      // Vorhandene Eingaben erhalten, aber an den aktuellen Bedarf anpassen.
      const neu: Record<string, number> = {};
      for (const p of bedarf) {
        const bisher = mengen[schluessel(p)] ?? 0;
        neu[schluessel(p)] = p.bestand === null || !p.lieferantId ? 0 : Number.isSafeInteger(bisher) ? Math.min(Math.max(0, bisher), MAX_BESTELLMENGE) : 0;
      }
      mengen = neu;
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Laden.';
    } finally {
      laden = false;
      aktualisieren = false;
    }
  }

  function alleVorschlagen(): void {
    // Nur Mengen des aktuellen Lieferanten vorschlagen; vorhandene Reserven
    // in der anderen Ansicht nicht überschreiben, wenn kein Bedarf besteht.
    const neu = { ...mengen };
    for (const p of bedarf) {
      if (p.lieferantId === aktiverLieferant && p.bestand !== null && p.nachbestellen > 0)
        neu[schluessel(p)] = p.nachbestellen;
    }
    mengen = neu;
  }
  function auswahlLeeren(): void {
    mengen = Object.fromEntries(bedarf.map((p) => [schluessel(p), 0]));
  }
  function umschalten(id: string): void {
    offeneDetails = offeneDetails.includes(id) ? offeneDetails.filter((wert) => wert !== id) : [...offeneDetails, id];
  }

  async function entwurfErstellen(): Promise<void> {
    if (speichern || aktualisieren) return;
    if (!aktiverLieferant || ausgewaehltePositionen.length === 0) {
      fehler = 'Bitte mindestens eine gültige Bestellmenge eingeben.';
      return;
    }
    if (bedarf.some((p) => {
      const menge = mengen[schluessel(p)] ?? 0;
      return !Number.isSafeInteger(menge) || menge < 0 || menge > MAX_BESTELLMENGE || (menge > 0 && p.lieferantId !== aktiverLieferant);
    })) {
      fehler = 'Bitte nur ganze Bestellmengen zwischen 0 und 10’000 beim ausgewählten Lieferanten eingeben.';
      return;
    }
    speichern = true;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch('/api/vereinskleider/sammelbestellungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lieferantId: aktiverLieferant, positionen: ausgewaehltePositionen, bemerkung: bemerkung.trim() })
      });
      const daten = await antwort.json().catch(() => ({})) as { erfolg?: boolean; fehler?: string };
      if (!antwort.ok || daten.erfolg !== true) throw new Error(daten.fehler ?? 'Entwurf konnte nicht gespeichert werden.');
      mengen = {};
      bemerkung = '';
      erfolg = 'Sammelbestellung wurde als Entwurf gespeichert.';
      await datenLaden();
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Unbekannter Fehler beim Speichern.';
    } finally {
      speichern = false;
    }
  }

  function restmenge(p: SammelPosition): number {
    return Math.max(0, p.menge - (p.geliefertMenge ?? 0));
  }

  function eingangUmschalten(s: Sammelbestellung): void {
    if (wareneingangOffen === s._id) {
      wareneingangOffen = null;
      eingangsMengen = {};
      return;
    }
    wareneingangOffen = s._id;
    offeneDetails = [...new Set([...offeneDetails, s._id])];
    eingangsMengen = Object.fromEntries(s.positionen.map((p) => [schluessel(p), 0]));
    fehler = '';
    erfolg = '';
  }

  async function alsBestelltMarkieren(s: Sammelbestellung): Promise<void> {
    if (bearbeitungId || speichern || aktualisieren || s.status !== 'entwurf') return;
    if (!(await bestaetigen(`Sammelbestellung #${s._id.slice(-8)} als beim Lieferanten bestellt markieren?`, 'Als bestellt markieren'))) return;
    bearbeitungId = s._id;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch(`/api/vereinskleider/sammelbestellungen/${encodeURIComponent(s._id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'bestellen' })
      });
      const daten = await antwort.json().catch(() => ({})) as { erfolg?: boolean; fehler?: string };
      if (!antwort.ok || daten.erfolg !== true) throw new Error(daten.fehler ?? 'Statuswechsel fehlgeschlagen.');
      await datenLaden();
      erfolg = 'Sammelbestellung wurde als bestellt markiert.';
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Statuswechsel fehlgeschlagen.';
    } finally {
      bearbeitungId = null;
    }
  }

  async function eingangSpeichern(s: Sammelbestellung): Promise<void> {
    if (bearbeitungId || speichern || aktualisieren || s.status !== 'bestellt') return;
    const positionen = s.positionen.map((p) => ({
      artikelId: p.artikelId, groesseId: p.groesseId, menge: eingangsMengen[schluessel(p)] ?? 0
    }));
    if (positionen.some((p) => !Number.isSafeInteger(p.menge) || p.menge < 0 ||
      p.menge > restmenge(s.positionen.find((x) => schluessel(x) === schluessel(p))!))) {
      fehler = 'Bitte nur ganze, nicht negative Mengen bis zur offenen Bestellmenge erfassen.';
      return;
    }
    const geliefert = positionen.filter((p) => p.menge > 0);
    if (geliefert.length === 0) {
      fehler = 'Bitte mindestens eine gelieferte Menge eingeben.';
      return;
    }
    if (!(await bestaetigen(`${geliefert.reduce((summe, p) => summe + p.menge, 0)} Stück verbindlich ins Lager buchen?`, 'Wareneingang buchen'))) return;
    bearbeitungId = s._id;
    fehler = '';
    erfolg = '';
    try {
      const antwort = await fetch(`/api/vereinskleider/sammelbestellungen/${encodeURIComponent(s._id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'wareneingang', positionen: geliefert })
      });
      const daten = await antwort.json().catch(() => ({})) as { erfolg?: boolean; fehler?: string; vollstaendig?: boolean };
      if (!antwort.ok || daten.erfolg !== true) throw new Error(daten.fehler ?? 'Wareneingang konnte nicht gebucht werden.');
      wareneingangOffen = null;
      eingangsMengen = {};
      await datenLaden();
      erfolg = daten.vollstaendig ? 'Wareneingang gebucht. Bestellung vollständig geliefert.' : 'Teillieferung gebucht. Die restlichen Mengen bleiben offen.';
    } catch (e) {
      fehler = e instanceof Error ? e.message : 'Wareneingang konnte nicht gebucht werden.';
    } finally {
      bearbeitungId = null;
    }
  }

  onMount(() => { void datenLaden(); });
</script>

<svelte:head><title>Sammelbestellungen – ClubMatiq</title></svelte:head>

<main>
  <a class="zurueck" href="/vereinskleider">← Zurück zu Vereinskleider</a>
  <header>
    <div>
      <h1>Sammelbestellungen</h1>
      <p>Kundenbedarf decken oder zusätzliche Lagerreserven beim Lieferanten bestellen.</p>
    </div>
    <button class="primaer" type="button" onclick={() => void datenLaden()} disabled={aktualisieren || speichern || bearbeitungId !== null}>
      {aktualisieren ? 'Wird geladen ...' : '↻ Aktualisieren'}
    </button>
  </header>

  {#if fehler}<p class="warnung" role="alert">{fehler}</p>{/if}
  {#if erfolg}<p class="erfolg" role="status">{erfolg}</p>{/if}
  {#if groessenFehler}<p class="warnung" role="status">{groessenFehler}</p>{/if}

  {#if laden}
    <section class="karte">Sammelbestellungen werden geladen ...</section>
  {:else}
    <div class="kennzahlen">
      <div class="kennzahl"><span>Offene Kundenbestellungen</span><strong>{offenGesamt} Stk.</strong></div>
      <div class="kennzahl"><span>Aktueller Nachbestellbedarf</span><strong>{nachbestellenGesamt} Stk.</strong></div>
      <div class="kennzahl"><span>Ausgewählt für neuen Entwurf</span><strong>{ausgewaehlteStueck} Stk.</strong><small>Davon {zusaetzlicheReserve} Stk. zusätzliche Reserve</small></div>
      <div class="kennzahl"><span>Sammelbestellungen</span><strong>{sammelbestellungen.length}</strong></div>
    </div>

    <section class="karte">
      <div class="abschnitt-kopf">
        <div><h2>Neue Sammelbestellung</h2><p class="dezent">Kundenbedarf und Lagerreserven können in einem Entwurf kombiniert werden.</p></div>
        <div class="aktionen">
          <button class="sekundaer" type="button" onclick={alleVorschlagen} disabled={aktualisieren || speichern || bearbeitungId !== null}>Bedarf übernehmen</button>
          <button class="sekundaer" type="button" onclick={auswahlLeeren} disabled={aktualisieren || speichern || bearbeitungId !== null}>Auswahl leeren</button>
        </div>
      </div>
      <div class="ansicht-tabs" role="group" aria-label="Bestellansicht">
        <button type="button" class:aktiv={ansicht === 'bedarf'} aria-pressed={ansicht === 'bedarf'} onclick={() => { ansicht = 'bedarf'; aufgeklappteArtikel = []; }}>Nachbestellbedarf</button>
        <button type="button" class:aktiv={ansicht === 'reserve'} aria-pressed={ansicht === 'reserve'} onclick={() => { ansicht = 'reserve'; aufgeklappteArtikel = []; }}>Lagerreserven</button>
      </div>
      {#if bedarfOhneLieferantGruppen.length > 0}
        <div class="lieferant-hinweis" role="status">
          <strong>Nachbestellbedarf ohne Standardlieferanten</strong>
          <p>Für die folgenden Artikel liegt Kundenbedarf vor, aber es ist kein gültiger Standardlieferant hinterlegt. Ordne den Lieferanten im Inventar zu, damit du den Bedarf als Sammelbestellung übernehmen kannst.</p>
          <ul>
            {#each bedarfOhneLieferantGruppen as eintrag (eintrag.artikelId)}
              <li><span>{eintrag.artikelname} · {eintrag.menge} Stk.</span><a href={`/inventar/${eintrag.artikelId}/bearbeiten`}>Lieferant zuordnen</a></li>
            {/each}
          </ul>
        </div>
      {/if}
      <div class="filterzeile">
        <div class="filterfeld">
          <label for="lieferant">Lieferant</label>
          <select id="lieferant" value={aktiverLieferant} onchange={(e) => { ausgewaehlterLieferant = e.currentTarget.value; auswahlLeeren(); bemerkung = ''; aufgeklappteArtikel = []; }} disabled={speichern || aktualisieren || bearbeitungId !== null}>
            {#if lieferantenAuswahl.length === 0}<option value="">Keine Lieferanten zugeordnet</option>{/if}
            {#each lieferantenAuswahl as lieferant (lieferant.id)}<option value={lieferant.id}>{lieferant.name}</option>{/each}
          </select>
        </div>
        <div class="filterfeld">
          <label for="suche">Artikel oder Grösse suchen</label>
          <input id="suche" type="search" placeholder="Artikelname oder Grösse ..." bind:value={suche} />
        </div>
      </div>
      <p class="dezent">{ansicht === 'bedarf' ? 'Nur Artikel mit offenem Nachbestellbedarf. Die Bestellmenge darf höher sein als der Bedarf.' : 'Alle Artikel des gewählten Lieferanten, auch ohne Kundenbedarf. Artikel aufklappen und Grössen auswählen.'} Beim Ansichtswechsel bleiben deine Mengen erhalten.</p>
      {#if artikelGruppen.length === 0}
        <p class="dezent leer">{ansicht === 'bedarf' ? 'Kein offener Nachbestellbedarf für diesen Lieferanten gefunden.' : 'Keine passenden Artikel für diesen Lieferanten gefunden.'}</p>
      {:else}
        <div class="artikelliste">
          {#each artikelGruppen as gruppe (gruppe.id)}
            <div class="artikelkarte">
              <button type="button" class="artikelkopf" aria-expanded={aufgeklappteArtikel.includes(gruppe.id)} onclick={() => artikelUmschalten(gruppe.id)}>
                <span class="artikelbezeichnung"><strong>{gruppe.name}</strong><small>{gruppe.positionen.length} {gruppe.positionen.length === 1 ? 'Grösse / Variante' : 'Grössen / Varianten'} · {gruppe.bedarf} Stk. Bedarf{#if gruppe.auswahl > 0} · {gruppe.auswahl} Stk. ausgewählt{/if}</small></span>
                <span aria-hidden="true">{aufgeklappteArtikel.includes(gruppe.id) ? '−' : '+'}</span>
              </button>
              {#if aufgeklappteArtikel.includes(gruppe.id)}
                <div class="tabellen-scroll">
                  <table class="variantentabelle">
                    <thead><tr><th>Grösse</th><th class="zahl">Offen</th><th class="zahl">Lager</th><th class="zahl">Verfügbar</th><th class="zahl">Eingeplant</th><th class="zahl">Bedarf</th><th>Bestellen</th></tr></thead>
                    <tbody>
                      {#each gruppe.positionen as p (schluessel(p))}
                        <tr>
                          <td>{groesseName(p.groesseId)}</td>
                          <td class="zahl">{p.offen}</td><td class="zahl">{p.bestand ?? '–'}</td><td class="zahl">{p.verfuegbar}</td><td class="zahl">{p.bereitsInSammelbestellungen}</td><td class="zahl"><strong>{p.nachbestellen}</strong></td>
                          <td>
                            <label class="nur-screenreader" for={`menge-${schluessel(p)}`}>Bestellmenge für {p.artikelname} {groesseName(p.groesseId)}</label>
                            <input class="mengenfeld" id={`menge-${schluessel(p)}`} type="number" min="0" max={MAX_BESTELLMENGE} step="1" value={mengen[schluessel(p)] ?? 0}
                              oninput={(e) => { mengen[schluessel(p)] = e.currentTarget.value === '' ? 0 : Number(e.currentTarget.value); }}
                              disabled={p.bestand === null || speichern || aktualisieren || bearbeitungId !== null} />
                            {#if p.bestand === null}<small class="warntext">Bestand unbekannt</small>{/if}
                            {#if (mengen[schluessel(p)] ?? 0) > MAX_BESTELLMENGE}<small class="warntext">Maximal 10’000 Stück</small>{:else if (mengen[schluessel(p)] ?? 0) > p.nachbestellen}<small class="reservetext">+{(mengen[schluessel(p)] ?? 0) - p.nachbestellen} Reserve</small>{/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      <div class="auswahlzusammenfassung"><strong>Entwurf: {ausgewaehlteStueck} Stück</strong><span>Davon {zusaetzlicheReserve} Stück zusätzliche Reserve</span></div>
      <div class="formularabschluss">
        <div class="bemerkung"><label for="bemerkung">Bemerkung zum Entwurf (optional)</label><textarea id="bemerkung" rows="3" maxlength="2000" bind:value={bemerkung} placeholder="Zum Beispiel gewünschter Liefertermin"></textarea></div>
        <button class="primaer" type="button" onclick={() => void entwurfErstellen()} disabled={speichern || aktualisieren || !aktiverLieferant || ausgewaehltePositionen.length === 0}>
          {speichern ? 'Wird gespeichert ...' : `Entwurf erstellen (${ausgewaehlteStueck} Stk.)`}
        </button>
      </div>
    </section>

    <section class="karte">
      <div class="abschnitt-kopf">
        <div><h2>Bestehende Sammelbestellungen</h2><p class="dezent">Nach Lieferant gruppieren, Bestellart filtern und Bestellungen für einen gemeinsamen PDF-Export auswählen.</p></div>
      </div>
      <div class="bestell-filter">
        <div><label for="gruppenfilter">Gruppieren nach</label><select id="gruppenfilter" bind:value={gruppierung}><option value="lieferant">Lieferant</option><option value="datum">Erstellungsdatum</option></select></div>
        <div><label for="artfilter">Bestellart</label><select id="artfilter" bind:value={filterArt}><option value="alle">Alle Bestellarten</option><option value="bedarf">Nachbestellbedarf</option><option value="reserve">Lagerreserve</option><option value="gemischt">Bedarf + Reserve</option><option value="unbekannt">Unbekannt (ältere Bestellungen)</option></select></div>
        <div><label for="statusfilter">Status</label><select id="statusfilter" bind:value={filterStatus}><option value="alle">Alle</option><option value="entwurf">Entwurf</option><option value="bestellt">Bestellt</option><option value="geliefert">Geliefert</option></select></div>
      </div>
      <div class="auswahlleiste">
        <div><strong>{ausgewaehlteBestellungen.length} Bestellungen ausgewählt</strong><small>{auswahlStueck} Stück · {ausgewaehlteObjekte[0]?.lieferantName ?? 'Noch kein Lieferant ausgewählt'}</small></div>
        <div class="aktionen"><button class="sekundaer" type="button" onclick={() => { ausgewaehlteBestellungen = []; fehler = ''; }} disabled={ausgewaehlteBestellungen.length === 0}>Auswahl aufheben</button>
        <button class="primaer" type="button" onclick={() => void gesamtPdfHerunterladen()} disabled={pdfExportLaeuft || ausgewaehlteBestellungen.length === 0 || aktualisieren || speichern || bearbeitungId !== null}>{pdfExportLaeuft ? 'PDF wird erstellt ...' : '↓ Gesamt-PDF herunterladen'}</button></div>
      </div>
      {#if sichtbareSammelbestellungen.length === 0}
        <p class="dezent leer">Keine Sammelbestellungen für diese Filter gefunden.</p>
      {:else}
        <div class="bestellgruppen">
          {#each bestellGruppen as gruppe (gruppe.id)}
            <div class="bestellgruppe">
              <div class="bestellgruppe-kopf"><div><h3>{gruppe.name}</h3><small>{gruppe.bestellungen.length} Bestellungen · {gruppe.bestellungen.reduce((summe, s) => summe + s.positionen.reduce((a, p) => a + p.menge, 0), 0)} Stück</small></div>
                <button class="sekundaer" type="button" onclick={() => gruppeWaehlen(gruppe)}>Gruppe auswählen</button>
              </div>
              <div class="bestellliste">
                {#each gruppe.bestellungen as s (s._id)}
<div class="bestellkarte">
              <div class="bestellkopf">
                <label class="auswahl-checkbox"><input type="checkbox" checked={ausgewaehlteBestellungen.includes(s._id)} disabled={!s.lieferantId || (auswahlLieferant !== null && auswahlLieferant !== s.lieferantId && !ausgewaehlteBestellungen.includes(s._id))} onchange={(e) => bestellungWaehlen(s, e.currentTarget.checked)} /><span class="nur-screenreader">Bestellung #{s._id.slice(-8)} auswählen</span></label>
                <div><strong>#{s._id.slice(-8)}</strong><small>{s.lieferantName || (s.lieferantId ? 'Lieferant nicht mehr verfügbar' : 'Alte Bestellung ohne Lieferant')}</small><small>Erstellt: {formatDatum(s.erstelltAm)}</small><small>{bestellartName(s)}</small></div>
                <span class:entwurf={s.status === 'entwurf'} class:bestellt={s.status === 'bestellt'} class:geliefert={s.status === 'geliefert'} class="status">{statusName(s.status)}</span>
                <strong>{s.positionen.reduce((summe, p) => summe + p.menge, 0)} Stück</strong>
                <a class="sekundaer pdf-download" href={`/api/vereinskleider/sammelbestellungen/${s._id}/pdf`} download={`bestellung-${s._id.slice(-8)}.pdf`} aria-label={`Bestell-PDF für Sammelbestellung ${s._id.slice(-8)} herunterladen`}>↓ Bestell-PDF</a>
                {#if s.status === 'entwurf'}
                  <button class="primaer" type="button" disabled={bearbeitungId !== null || aktualisieren || speichern} onclick={() => void alsBestelltMarkieren(s)}>{bearbeitungId === s._id ? 'Wird gespeichert ...' : 'Als bestellt markieren'}</button>
                {:else if s.status === 'bestellt'}
                  <button class="primaer" type="button" disabled={bearbeitungId !== null || aktualisieren || speichern} onclick={() => eingangUmschalten(s)}>{wareneingangOffen === s._id ? 'Wareneingang schliessen' : 'Wareneingang erfassen'}</button>
                {/if}
                <button class="sekundaer" type="button" onclick={() => umschalten(s._id)} aria-expanded={offeneDetails.includes(s._id)}>
                  {offeneDetails.includes(s._id) ? 'Details schliessen' : 'Details anzeigen'}
                </button>
              </div>
              {#if offeneDetails.includes(s._id)}
                <div class="details">
                  <table><thead><tr><th>Artikel</th><th>Grösse</th><th class="zahl">Kundenbedarf</th><th class="zahl">Lagerreserve</th><th class="zahl">Bestellt</th><th class="zahl">Geliefert</th><th class="zahl">Offen</th>{#if wareneingangOffen === s._id && s.status === 'bestellt'}<th>Jetzt geliefert</th>{/if}</tr></thead>
                    <tbody>{#each s.positionen as p, i (`${s._id}:${i}`)}<tr><td>{p.artikelname}</td><td>{groesseName(p.groesseId)}</td><td class="zahl">{p.kundenbedarfMenge ?? "–"}</td><td class="zahl">{p.lagerreserveMenge ?? "–"}</td><td class="zahl">{p.menge}</td><td class="zahl">{p.geliefertMenge ?? 0}</td><td class="zahl">{restmenge(p)}</td>{#if wareneingangOffen === s._id && s.status === 'bestellt'}<td><label class="nur-screenreader" for={`eingang-${s._id}-${i}`}>Jetzt gelieferte Menge: {p.artikelname}, {groesseName(p.groesseId)}</label><input id={`eingang-${s._id}-${i}`} class="mengenfeld" type="number" min="0" max={restmenge(p)} step="1" value={eingangsMengen[schluessel(p)] ?? 0} disabled={restmenge(p) === 0 || bearbeitungId !== null} oninput={(e) => { eingangsMengen[schluessel(p)] = e.currentTarget.value === '' ? 0 : Number(e.currentTarget.value); }} /></td>{/if}</tr>{/each}</tbody>
                  </table>
                  {#if wareneingangOffen === s._id && s.status === 'bestellt'}
                    <div class="eingangsaktionen"><p class="dezent">Nur tatsächlich eingetroffene Mengen eintragen. Jede Buchung erhöht den Lagerbestand.</p><button class="primaer" type="button" disabled={bearbeitungId !== null || aktualisieren || speichern} onclick={() => void eingangSpeichern(s)}>{bearbeitungId === s._id ? 'Wird gebucht ...' : 'Wareneingang ins Lager buchen'}</button></div>
                  {/if}
                  {#if s.bestelltAm}<p><strong>Bestellt am:</strong> {formatDatum(s.bestelltAm)}</p>{/if}
                  {#if s.geliefertAm}<p><strong>Vollständig geliefert am:</strong> {formatDatum(s.geliefertAm)}</p>{/if}
                  {#if s.bemerkung}<p><strong>Bemerkung:</strong> {s.bemerkung}</p>{/if}
                  <p class="dezent">Zuletzt geändert: {formatDatum(s.aktualisiertAm)}</p>
                </div>
              {/if}
            </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
      <p class="dezent">Die Gesamt-PDF fasst nur ausgewählte Bestellungen desselben Lieferanten zusammen. Sie ist eine Bestellübersicht und erstellt keine neue Bestellung. Einzel-PDFs bleiben verfügbar.</p>
    </section>

    <section class="karte hinweis"><h2>Wichtig</h2><p>Entwürfe können als bestellt markiert werden. Bei bestellten Sammelbestellungen kannst du Teil- oder Vollwareneingänge erfassen und direkt ins Lager buchen.</p><p>Entwürfe und bestellte Mengen werden bereits vom Nachbestellbedarf abgezogen. Ein Entwurf ist noch keine tatsächliche Bestellung beim Lieferanten. Bereits eingegangene Mengen werden nicht erneut als unterwegs gezählt.</p></section>
  {/if}
</main>

<style>
  main { max-width: 1350px; margin: 40px auto; padding: 20px; }
  .zurueck { color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600; }
  header, .abschnitt-kopf { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  header { margin: 28px 0; }
  h1, h2 { color: #172b4d; }
  h1 { margin: 0 0 8px; }
  h2 { margin: 0 0 8px; font-size: 20px; }
  header p, .dezent { color: #64748b; }
  header p { margin: 0; }
  .karte { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; margin-bottom: 20px; }
  .kennzahlen { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
  .kennzahl { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .kennzahl span { font-size: 13px; color: #64748b; }
  .kennzahl strong { font-size: 24px; color: #172b4d; }
  .kennzahl small { font-size: 12px; color: #64748b; }
  .aktionen { display: flex; gap: 8px; flex-wrap: wrap; }
  button { cursor: pointer; font: inherit; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primaer { border: 0; border-radius: 8px; padding: 11px 16px; color: white; background: #2563eb; font-weight: 600; }
  .sekundaer { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 13px; color: #334155; background: white; font-weight: 600; }
  .pdf-download { display: inline-flex; align-items: center; text-decoration: none; white-space: nowrap; font-size: 14px; }
  .pdf-download:hover { background: #f1f5f9; }
  .pdf-download:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  label { display: block; color: #334155; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  input, select, textarea { box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; background: white; }
  input[type='search'] { width: 100%; margin-bottom: 14px; }
  .tabellen-scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: 790px; font-size: 14px; }
  th { text-align: left; background: #f8fafc; color: #475569; font-size: 12px; padding: 12px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 13px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
  td small, .bestellkopf small { display: block; color: #64748b; margin-top: 5px; font-size: 12px; }
  .zahl { text-align: right; white-space: nowrap; }
  .mengenfeld { width: 95px; }
  .warntext { color: #b45309; }
  .reservetext { color: #166534; }
  .formularabschluss { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 22px; }
  .bemerkung { flex: 1; max-width: 620px; }
  textarea { width: 100%; resize: vertical; }
  .bestellliste { display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
  .bestellkarte { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .bestellkopf { display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap; padding: 15px; }
  .details { border-top: 1px solid #e2e8f0; padding: 15px; overflow-x: auto; }
  .details table { min-width: 400px; }
  .details p { margin-bottom: 0; }
  .eingangsaktionen { margin-top: 16px; display: flex; gap: 14px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .status { border-radius: 100px; padding: 5px 10px; font-size: 12px; font-weight: 600; }
  .status.entwurf { color: #92400e; background: #fef3c7; }
  .status.bestellt { color: #1d4ed8; background: #dbeafe; }
  .status.geliefert { color: #166534; background: #dcfce7; }
  .warnung { background: #fffbeb; color: #92400e; border-radius: 8px; padding: 12px; }
  .erfolg { background: #ecfdf5; color: #166534; border-radius: 8px; padding: 12px; }
  .leer { text-align: center; padding: 25px 0; }
  .hinweis h2 { font-size: 17px; }
  .hinweis p { font-size: 13px; line-height: 1.6; color: #64748b; }
  .ansicht-tabs { display: flex; gap: 6px; padding: 5px; background: #f1f5f9; border-radius: 10px; margin: 18px 0; width: fit-content; }
  .ansicht-tabs button { padding: 10px 16px; border: 0; background: transparent; border-radius: 8px; color: #475569; font-weight: 600; }
  .ansicht-tabs button.aktiv { background: white; color: #1d4ed8; box-shadow: 0 1px 4px #00000018; }
  .filterzeile { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(230px, 2fr); gap: 16px; margin-bottom: 12px; }
  .filterfeld select, .filterfeld input { width: 100%; margin-bottom: 0; }
  .artikelliste { display: flex; flex-direction: column; gap: 9px; margin-top: 18px; }
  .artikelkarte { border: 1px solid #e2e8f0; border-radius: 9px; overflow: hidden; }
  .artikelkopf { display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 14px 16px; border: 0; background: #f8fafc; text-align: left; color: #172b4d; }
  .artikelkopf:hover { background: #eff6ff; }
  .artikelbezeichnung { display: flex; flex-direction: column; gap: 5px; }
  .artikelbezeichnung small { color: #64748b; font-size: 12px; }
  .variantentabelle { min-width: 690px; }
  .variantentabelle td { padding: 10px 12px; }
  .auswahlzusammenfassung { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 18px; padding: 12px 14px; background: #eff6ff; border-radius: 8px; color: #1e40af; }
  .auswahlzusammenfassung span { font-size: 13px; }
  .nur-screenreader { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  @media (max-width: 900px) { .kennzahlen { grid-template-columns: repeat(2, minmax(0, 1fr)); } .abschnitt-kopf { align-items: flex-start; flex-direction: column; } }
  @media (max-width: 600px) { .bestell-filter { grid-template-columns: 1fr; } .filterzeile { grid-template-columns: 1fr; } .ansicht-tabs { width: 100%; } .ansicht-tabs button { flex: 1; } main { margin: 20px auto; padding: 16px; } header, .formularabschluss { flex-direction: column; align-items: stretch; } .kennzahlen { grid-template-columns: 1fr 1fr; } }
  .lieferant-hinweis { margin:16px 0; padding:16px; border:1px solid #f3d08b; border-radius:9px; background:#fffbeb; color:#713f12; }
  .lieferant-hinweis p { margin:7px 0 10px; font-size:13px; }
  .lieferant-hinweis ul { padding-left:18px; margin:0; }
  .lieferant-hinweis li { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; margin:7px 0; }
  .lieferant-hinweis a { color:#1d4ed8; font-weight:600; }
</style>
