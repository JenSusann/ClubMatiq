import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  docs: {} as Record<string, any>, rows: {} as Record<string, any[]>,
  update: vi.fn(async (_filter: any, _update: any) => ({ modifiedCount: 1 })),
  updateMany: vi.fn(async (_filter: any, _update: any) => ({ matchedCount: 2 })),
  insert: vi.fn(async (_document: any) => ({})),
  counter: vi.fn(async (): Promise<{ nummer: unknown } | null> => ({ nummer: 1 })),
  auth: vi.fn(() => null as Response | null),
  failure: '' as string,
  transactionFailure: false,
  ended: vi.fn(async () => {}),
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: h.auth }));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: (name: string) => ({
    findOne: async () => { if (h.failure === name) throw Error('DB'); return h.docs[name] ?? null; },
    findOneAndUpdate: h.counter,
    insertOne: h.insert,
    updateOne: h.update,
    updateMany: h.updateMany,
    find: () => ({ sort() { return this; }, limit() { return this; }, project() { return this; },
      toArray: async () => { if (h.failure === name) throw Error('DB'); return h.rows[name] ?? []; } }),
  }) },
  client: { startSession: () => ({ withTransaction: async (fn: () => Promise<any>) => {
    if (h.transactionFailure) throw Error('transaction'); return fn();
  }, endSession: h.ended }) },
}));

import { GET as rechnungenGET, POST as rechnungenPOST } from '../../../src/routes/api/vereinskleider/verrechnung/+server';
import { PATCH as zahlungPATCH } from '../../../src/routes/api/vereinskleider/verrechnung/[id]/+server';
import { POST as uebergabePOST } from '../../../src/routes/api/vereinskleider/bestellungen/uebergabe/+server';

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const id2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const id3 = 'cccccccccccccccccccccccc';
const uuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const req = (method: string, body: unknown) => new Request('http://localhost/api', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const verkauf = () => ({ kaeufer: 'Muster', positionen: [{ artikelId: id, groesseId: null, menge: 2, einzelpreis: 10, positionsbetrag: 20 }], endbetrag: 20, zwischentotal: 20, rabattTotal: 0, zahlungsart: 'rechnung' });
const rechnung = () => ({ status: 'offen', gesamtbetrag: 20, bezahltBetrag: 0, zahlungen: [] });
const position = () => ({ artikelId: id2, groesseId: null, menge: 5, verkaufsart: 'bestellung', uebergebenMenge: 0, reserviertMenge: 0 });
const postRechnung = (v: unknown) => rechnungenPOST({ locals, request: req('POST', v) } as any);
const patchZahlung = (v: unknown) => zahlungPATCH({ locals, params: { id }, request: req('PATCH', v) } as any);
const postUebergabe = (v: unknown) => uebergabePOST({ locals, request: req('POST', v) } as any);
const zahlung = () => ({ betrag: 5, datum: '2026-11-18', zahlungsart: 'twint', zahlungId: uuid });
const uebergabe = () => ({ vorgangId: id, positionsIndex: 0, menge: 2 });
const initUebergabe = () => {
  h.docs.vereinskleider_verkaeufe = { positionen: [position()] };
  h.docs.artikel = { menge: 20, hatGroessen: false };
  h.rows.vereinskleider_verkaeufe = [{ positionen: [position()] }];
};
beforeEach(() => {
  h.docs = {}; h.rows = {}; h.failure = ''; h.transactionFailure = false;
  h.update.mockReset().mockResolvedValue({ modifiedCount: 1 });
  h.insert.mockReset().mockResolvedValue({});
  h.updateMany.mockReset().mockResolvedValue({ matchedCount: 2 });
  h.counter.mockReset().mockResolvedValue({ nummer: 1 });
  h.auth.mockReset().mockReturnValue(null);
  h.ended.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});


import { POST as stornierenPOST, GET as gutschriftenGET } from '../../../src/routes/api/vereinskleider/stornierungen/+server';
import { POST as inventurResetPOST } from '../../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';
const stornieren = (body:unknown) => stornierenPOST({locals,request:req('POST',body)} as any);
const resetInventur = (inventurId=id) => inventurResetPOST({locals,params:{id:inventurId}} as any);
const stornPos = () => ({artikelId:id2,groesseId:null,artikelname:'T-Shirt',verkaufsart:'bestellung',menge:5,einzelpreis:10,positionsbetrag:50,uebergebenMenge:0,reserviertMenge:2});
const stornVerkauf = () => ({status:'offen',positionen:[stornPos()],endbetrag:50,zwischentotal:50,rabattTotal:0,bezahltBetrag:0,zahlungen:[]});
const stornRechnung = () => ({_id:{toString:()=>id3},status:'offen',rechnungsnummer:'2026-00001',gesamtbetrag:50,bezahltBetrag:0,positionen:[stornPos()]});
const stornBody = () => ({verkaufId:id,positionsIndex:0,menge:2,grund:'Retour'});

describe('Paket 18 – weitere Verrechnungszweige',()=>{
  it('liefert nicht begrenzte Rechnungsübersicht',async()=>{
    h.rows.vereinskleider_rechnungen=[{_id:{toString:()=>id}}];
    h.rows.vereinskleider_verkaeufe=[{_id:{toString:()=>id2}}];
    const b=await (await rechnungenGET({locals} as any)).json();
    expect(b.begrenzt).toBe(false);expect(b.rechnungen).toHaveLength(1);expect(b.unverrechneteVerkaeufe).toHaveLength(1);
  });
  it('erstellt Rechnung ohne optionale Felder und ohne gespeicherte Zahlungen',async()=>{
    h.docs.vereinskleider_verkaeufe=verkauf();
    const r=await postRechnung({verkaufId:id});expect(r.status).toBe(201);
    expect(h.insert.mock.calls[0][0]).toMatchObject({status:'offen',bezahltBetrag:0,rabatte:[],zusaetzlicherRabatt:0,riegen:[],bemerkung:''});
  });
  it('erstellt Rechnung mit optionalen Stammdaten und vorhandener Teilzahlung',async()=>{
    h.docs.vereinskleider_verkaeufe={...verkauf(),riegen:['Aktive'],bemerkung:'Probe',
      rabatte:[{rabattId:id,name:'Rabatt',betrag:1}],zusaetzlicherRabatt:2,
      zahlungen:[{betrag:5,datum:'2026-11-18',zahlungsart:'bar'}]};
    const r=await postRechnung({verkaufId:id});expect(r.status).toBe(201);
    expect(h.insert.mock.calls[0][0]).toMatchObject({status:'teilweise_bezahlt',bezahltBetrag:5,riegen:['Aktive'],bemerkung:'Probe'});
  });
  it.each([
    [{zahlungen:[{betrag:5,datum:'2026-11-18',zahlungsart:'bar'}],bezahltBetrag:5,zahlungsstatus:'bezahlt'},409],
    [{zahlungen:[{betrag:20,datum:'2026-11-18',zahlungsart:'bar'}],zahlungsstatus:'bezahlt'},201],
    [{zahlungen:[{betrag:5,datum:'2026-11-18',zahlungsart:'bar'}],bezahltBetrag:5.001},409],
    [{zahlungen:[{betrag:5,datum:'2026-11-18',zahlungsart:'bar'}],bezahltBetrag:5.01},409],
    [{zahlungen:[{betrag:5,datum:'2026-11-18',zahlungsart:'bar'}],bezahltBetrag:5},201],
  ] as const)('prüft unterschiedliche Zahlungsstatus- und Rundungszweige %#',async(extra,status)=>{
    h.docs.vereinskleider_verkaeufe={...verkauf(),...extra};
    expect((await postRechnung({verkaufId:id})).status).toBe(status);
  });
  it('fängt Fehler beim Einfügen der Rechnung ab',async()=>{
    h.docs.vereinskleider_verkaeufe=verkauf();h.insert.mockRejectedValueOnce(new Error('DB'));
    expect((await postRechnung({verkaufId:id})).status).toBe(500);
    expect(h.ended).toHaveBeenCalledTimes(1);
  });
});
describe('Paket 18 – weitere Zahlungszweige',()=>{
  it('akzeptiert Zahlung bei bereits vorhandenen Gutschriften',async()=>{
    h.docs.vereinskleider_rechnungen={...rechnung(),gutgeschriebenBetrag:5};
    const r=await patchZahlung(zahlung());expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('teilweise_bezahlt');
  });
  it('setzt bezahlten Status bei Erreichen der Nettosumme nach Gutschrift',async()=>{
    h.docs.vereinskleider_rechnungen={...rechnung(),gutgeschriebenBetrag:15};
    const r=await patchZahlung(zahlung());expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('bezahlt');
  });
  it('sperrt weitere Zahlung wenn Gutschrift die Restforderung auf null reduziert',async()=>{
    h.docs.vereinskleider_rechnungen={...rechnung(),gutgeschriebenBetrag:20};
    expect((await patchZahlung(zahlung())).status).toBe(409);
  });
  it('akzeptiert wiederholte Zahlung trotz stornierter Rechnung',async()=>{
    h.docs.vereinskleider_rechnungen={...rechnung(),status:'storniert',bezahltBetrag:5,
      zahlungen:[{...zahlung(),datum:new Date('2026-11-18')}]};
    const r=await patchZahlung(zahlung());expect(r.status).toBe(200);
    expect((await r.json()).bereitsErfasst).toBe(true);
  });
  it.each([
    {betrag:4},{zahlungsart:'bar'},{datum:new Date('2026-11-19')},{datum:'ungültig'}
  ])('erkennt abweichende Zahlungs-ID Wiederholung %#',async(extra)=>{
    h.docs.vereinskleider_rechnungen={...rechnung(),zahlungen:[{...zahlung(),datum:new Date('2026-11-18'),...extra}]};
    expect((await patchZahlung(zahlung())).status).toBe(409);
  });
  it('verwendet vorhandene Zahlungen ohne explizite Gutschrift',async()=>{
    h.docs.vereinskleider_rechnungen={...rechnung(),bezahltBetrag:5,zahlungen:[{betrag:5,datum:new Date('2026-11-10'),zahlungsart:'bar',zahlungId:id3}]};
    const r=await patchZahlung(zahlung());expect(r.status).toBe(200);
    expect(h.update.mock.calls[0][1].$set.zahlungen).toHaveLength(2);
  });
});
describe('Paket 18 – weitere Übergabezweige',()=>{
  it('erkennt Reservierungen fremder Bestellungen und schützt deren Bestand',async()=>{
    initUebergabe();h.docs.artikel.menge=5;
    h.rows.vereinskleider_verkaeufe=[{positionen:[{...position(),reserviertMenge:4}]}];
    expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('übergibt Menge unter Berücksichtigung fremder Reservierung',async()=>{
    initUebergabe();h.docs.artikel.menge=10;
    h.rows.vereinskleider_verkaeufe=[{positionen:[{...position(),reserviertMenge:2}]}];
    expect((await postUebergabe(uebergabe())).status).toBe(200);
  });
  it('überspringt direkte, andere Artikel und andere Grössen bei Reservierungszählung',async()=>{
    initUebergabe();h.rows.vereinskleider_verkaeufe=[{positionen:[
      {...position(),verkaufsart:'direkt',reserviertMenge:100},
      {...position(),artikelId:id3,reserviertMenge:100},
      {...position(),groesseId:id3,reserviertMenge:100},
      {...position(),reserviertMenge:0}
    ]},{positionen:undefined}];
    expect((await postUebergabe(uebergabe())).status).toBe(200);
  });
  it('akzeptiert bereits teilweise übergebene Menge und vorhandene Übergabehistorie',async()=>{
    initUebergabe();h.docs.vereinskleider_verkaeufe.positionen[0].uebergebenMenge=1;
    h.docs.vereinskleider_verkaeufe.uebergaben=[{positionsIndex:0,menge:1}];
    const r=await postUebergabe(uebergabe());expect(r.status).toBe(200);
    expect((await r.json()).uebergabe.uebergeben).toBe(3);
    expect(h.update.mock.calls[1][1].$set.uebergaben).toHaveLength(2);
  });
  it('lässt weitere offene Position bestehen',async()=>{
    initUebergabe();h.docs.vereinskleider_verkaeufe.positionen.push({...position(),artikelId:id3,menge:1});
    const r=await postUebergabe({...uebergabe(),menge:5});
    expect(r.status).toBe(200);expect((await r.json()).uebergabe.status).toBe('offen');
  });
  it('erkennt fehlende Grössenvariante',async()=>{
    initUebergabe();h.docs.vereinskleider_verkaeufe.positionen[0].groesseId=id3;
    h.docs.artikel.hatGroessen=true;
    expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('erkennt fehlgeschlagenen Artikelupdate nach erfolgreichem Variantenupdate',async()=>{
    initUebergabe();h.docs.vereinskleider_verkaeufe.positionen[0].groesseId=id3;
    h.docs.artikel.hatGroessen=true;h.docs.artikelvarianten={menge:10};
    h.update.mockResolvedValueOnce({modifiedCount:1}).mockResolvedValueOnce({modifiedCount:0});
    expect((await postUebergabe(uebergabe())).status).toBe(409);
  });
  it('übergibt Varianten mit eigener Reservierung und vollständigem Abschluss',async()=>{
    initUebergabe();h.docs.vereinskleider_verkaeufe.positionen[0].groesseId=id3;
    h.docs.vereinskleider_verkaeufe.positionen[0].reserviertMenge=3;
    h.docs.artikel.hatGroessen=true;h.docs.artikelvarianten={menge:10};
    const r=await postUebergabe({...uebergabe(),menge:5});
    expect(r.status).toBe(200);expect((await r.json()).uebergabe.reserviert).toBe(0);
  });
});
describe('Paket 18 – Inventur zurücksetzen',()=>{
  it('verweigert fehlende Berechtigung',async()=>{
    h.auth.mockReturnValue(new Response('',{status:403}));
    expect((await resetInventur()).status).toBe(403);
  });
  it('verweigert ungültige Inventur-ID',async()=>{expect((await resetInventur('x')).status).toBe(400);});
  it('meldet fehlende Inventur',async()=>{expect((await resetInventur()).status).toBe(409);});
  it('verweigert abgeschlossene Inventur',async()=>{
    h.docs.inventuren={status:'abgeschlossen'};
    expect((await resetInventur()).status).toBe(409);
  });
  it('erkennt konkurrierende Inventuränderung',async()=>{
    h.docs.inventuren={status:'offen',version:2};
    h.update.mockResolvedValueOnce({modifiedCount:0});
    expect((await resetInventur()).status).toBe(409);
  });
  it('setzt Positionen zurück und protokolliert Versionswechsel',async()=>{
    h.docs.inventuren={status:'offen',version:3};
    h.updateMany.mockResolvedValueOnce({matchedCount:7});
    const r=await resetInventur();expect(r.status).toBe(200);
    expect((await r.json()).anzahlZurueckgesetzt).toBe(7);
    expect(h.insert.mock.calls[0][0]).toMatchObject({versionVorher:3,versionNachher:4,anzahlPositionen:7});
  });
  it('verwendet Version null als Version 0',async()=>{
    h.docs.inventuren={status:'offen'};
    const r=await resetInventur();expect(r.status).toBe(200);
    expect(h.insert.mock.calls[0][0]).toMatchObject({versionVorher:0,versionNachher:1});
  });
  it('behandelt unerwartete Datenbankfehler',async()=>{
    h.docs.inventuren={status:'offen'};h.updateMany.mockRejectedValueOnce(new Error('DB'));
    expect((await resetInventur()).status).toBe(409);
    expect(h.ended).toHaveBeenCalledTimes(1);
  });
});
describe('Paket 18 – Gutschriftenliste und Stornierungen',()=>{
  it('liefert Gutschriften und begrenzt bei 1000 Datensätzen',async()=>{
    h.rows.vereinskleider_gutschriften=Array.from({length:1000},()=>({_id:{toString:()=>id}}));
    const r=await gutschriftenGET({locals} as any);expect(r.status).toBe(200);
    expect((await r.json()).begrenzt).toBe(true);
  });
  it('liefert leere Gutschriftenliste',async()=>{
    const r=await gutschriftenGET({locals} as any);
    expect((await r.json()).begrenzt).toBe(false);
  });
  it('behandelt Fehler beim Laden der Gutschriften',async()=>{
    h.failure='vereinskleider_gutschriften';
    expect((await gutschriftenGET({locals} as any)).status).toBe(500);
  });
  it('storniert Teilmenge ohne Rechnung und gibt Reservierung frei',async()=>{
    h.docs.vereinskleider_verkaeufe=stornVerkauf();
    const r=await stornieren(stornBody());expect(r.status).toBe(200);
    expect((await r.json()).stornierung).toMatchObject({freigegebeneReserve:2,status:'offen',gutschriftId:null});
  });
  it('storniert letzte Position vollständig',async()=>{
    h.docs.vereinskleider_verkaeufe=stornVerkauf();
    const r=await stornieren({...stornBody(),menge:5});
    expect(r.status).toBe(200);expect((await r.json()).stornierung.status).toBe('storniert');
  });
  it('storniert nach bereits erfolgter Teilübergabe',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),positionen:[{...stornPos(),uebergebenMenge:2,reserviertMenge:1}]};
    const r=await stornieren({...stornBody(),menge:3});
    expect(r.status).toBe(200);expect((await r.json()).stornierung.freigegebeneReserve).toBe(1);
  });
  it('verhindert Stornierung bezahlter Verkäufe ohne Rechnung',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),zahlungen:[{betrag:2}]};
    expect((await stornieren(stornBody())).status).toBe(409);
  });
  it('verhindert Stornierung mit Rabatt',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),rabatte:[{betrag:2}]};
    expect((await stornieren(stornBody())).status).toBe(409);
  });
  it('verhindert Stornierung bei zu grosser Menge',async()=>{
    h.docs.vereinskleider_verkaeufe=stornVerkauf();
    expect((await stornieren({...stornBody(),menge:6})).status).toBe(409);
  });
  it('erkennt fehlende Rechnung bei vorhandenem Belegverweis',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),rechnungId:id3};
    expect((await stornieren(stornBody())).status).toBe(409);
  });
  it('erstellt Gutschrift bei vorhandener Rechnung',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),rechnungId:id3};
    h.docs.vereinskleider_rechnungen=stornRechnung();
    const r=await stornieren(stornBody());expect(r.status).toBe(200);
    expect((await r.json()).stornierung.gutschriftBetrag).toBe(20);
    expect(h.insert).toHaveBeenCalledTimes(1);
  });
  it('berechnet offene Rückerstattung bei bereits bezahlter Rechnung',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),rechnungId:id3};
    h.docs.vereinskleider_rechnungen={...stornRechnung(),status:'bezahlt',bezahltBetrag:50};
    const r=await stornieren(stornBody());expect(r.status).toBe(200);
    expect((await r.json()).stornierung.rueckerstattungOffen).toBe(20);
  });
  it('verhindert Gutschrift bei widersprüchlicher Rechnungsposition',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),rechnungId:id3};
    h.docs.vereinskleider_rechnungen={...stornRechnung(),positionen:[{...stornPos(),artikelId:id3}]};
    expect((await stornieren(stornBody())).status).toBe(409);
  });
  it('erkennt konkurrierende Rechnungsänderung bei Gutschrift',async()=>{
    h.docs.vereinskleider_verkaeufe={...stornVerkauf(),rechnungId:id3};
    h.docs.vereinskleider_rechnungen=stornRechnung();
    h.update.mockResolvedValueOnce({modifiedCount:0});
    expect((await stornieren(stornBody())).status).toBe(409);
  });
  it('erkennt konkurrierende Verkaufsänderung',async()=>{
    h.docs.vereinskleider_verkaeufe=stornVerkauf();
    h.update.mockResolvedValueOnce({modifiedCount:0});
    expect((await stornieren(stornBody())).status).toBe(409);
  });
});
