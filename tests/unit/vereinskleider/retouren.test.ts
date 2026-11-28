import { describe, expect, it, vi, beforeEach } from 'vitest';
import { pruefeRetourenmenge, type RetourenVorgang } from '../../../src/lib/server/vereinskleider-retouren';

const basis = (): RetourenVorgang => ({
  positionen: [{ menge: 4, uebergebenMenge: 3, einzelpreis: 28, verkaufsart: 'bestellung' }],
  uebergaben: [
    { positionsIndex: 0, menge: 1 },
    { positionsIndex: 0, menge: 2 }
  ],
  retouren: []
});

describe('Issue #69 – sichere Retourenprüfung', () => {
  it('erlaubt eine vollständige Retoure über mehrere Übergaben', () => {
    expect(pruefeRetourenmenge(basis(), 0, 3)).toEqual({ maximal: 3, einzelpreisRappen: 2800 });
  });
  it('erlaubt Direktverkäufe ohne separaten Übergabebeleg', () => {
    const v: RetourenVorgang = {
      positionen: [{ menge: 1, verkaufsart: 'direkt', einzelpreis: 28 }],
      uebergaben: [], retouren: []
    };
    expect(pruefeRetourenmenge(v, 0, 1).maximal).toBe(1);
    v.retouren = [{ positionsIndex: 0, menge: 1 }];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Nur 0/);
  });
  it('zieht bereits retournierte Mengen ab', () => {
    const v = basis();
    v.retouren = [{ positionsIndex: 0, menge: 2 }];
    expect(pruefeRetourenmenge(v, 0, 1).maximal).toBe(1);
    expect(() => pruefeRetourenmenge(v, 0, 2)).toThrow(/Nur 1/);
  });
  it('verweigert Retouren ohne nachgewiesene Übergabe', () => {
    const v = basis();
    v.uebergaben = [];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Keine dokumentierte Übergabe/);
  });
  it('verweigert inkonsistente Übergaben', () => {
    const v = basis();
    v.positionen![0].uebergebenMenge = 2;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/stimmen nicht überein/);
  });
  it('verweigert Rabattfälle ohne sichere Finanzzuordnung', () => {
    const v = basis();
    v.rabattTotal = 5;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/nicht eindeutig/);
  });
  it('verweigert offene Preise', () => {
    const v = basis();
    v.positionen![0].preisOffen = true;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/nicht eindeutig/);
  });
  it('verweigert ungültige Mengen und Positionen', () => {
    expect(() => pruefeRetourenmenge(basis(), 0, 0)).toThrow(/Ungültige/);
    expect(() => pruefeRetourenmenge(basis(), 9, 1)).toThrow(/nicht gefunden/);
  });
  it('berücksichtigt Stornierungen ohne diese als Retoure zu zählen', () => {
    const v = basis();
    v.positionen![0].menge = 3;
    v.positionen![0].storniertMenge = 1;
    expect(pruefeRetourenmenge(v, 0, 3).maximal).toBe(3);
  });
});

import { ObjectId } from 'mongodb';
import { PATCH as Abgleich } from '../../../src/routes/api/vereinskleider/clubdesk-abgleich/+server';
import { GET as Export } from '../../../src/routes/api/vereinskleider/gutschriften/export/+server';
import { GET as Historie } from '../../../src/routes/api/vereinskleider/retouren/historie/+server';
const m=vi.hoisted(()=>({permission:vi.fn(),collection:vi.fn(),find:vi.fn(),sort:vi.fn(),limit:vi.fn(),toArray:vi.fn(),updateOne:vi.fn(),findOne:vi.fn(),aggregate:vi.fn(),insertOne:vi.fn(),startSession:vi.fn(),withTransaction:vi.fn(),endSession:vi.fn(),lager:vi.fn()}));
vi.mock('../../../src/lib/server/mongodb',()=>({db:{collection:m.collection},client:{startSession:m.startSession}}));
vi.mock('../../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:m.permission}));
describe('Vereinskleider – Abgleich, Export und Retourenhistorie',()=>{
  const id='507f1f77bcf86cd799439011', oid=new ObjectId(id);
  const benutzer={id,vereinId:'verein-a',vorname:'Ada',nachname:'Test'};
  const event=(data:unknown={},query='',user:object=benutzer)=>({locals:{benutzer:user},request:new Request('http://localhost',{method:'PATCH',body:JSON.stringify(data)}),url:new URL('http://localhost/?'+query)}) as never;
  const valid={typ:'rechnung',id,datum:'2026-11-26',referenz:' Buchung 1 '};
  const g={_id:oid,rechnungId:id,rechnungsnummer:'R1',gutschriftnummer:'G1',betrag:48,rueckerstattetBetrag:12,erstelltAm:'2026-11-26',artikelname:'Shirt "A"',menge:1};
  const invoice={_id:oid,rechnungsnummer:'R1',gesamtbetrag:48,bezahltBetrag:48,gutgeschriebenBetrag:48};
  beforeEach(()=>{
    vi.resetAllMocks();
    m.permission.mockReturnValue(null);m.collection.mockReturnValue(m);
    m.find.mockReturnValue(m);m.sort.mockReturnValue(m);m.limit.mockReturnValue(m);m.aggregate.mockReturnValue(m);
    m.toArray.mockResolvedValue([]);m.updateOne.mockResolvedValue({modifiedCount:1});m.findOne.mockResolvedValue(null);
  });
  it.each([Abgleich,Export,Historie])('verweigert Zugriff ohne Recht',async handler=>{
    m.permission.mockReturnValue(new Response(null,{status:403}));
    expect((await handler(event())).status).toBe(403);expect(m.collection).not.toHaveBeenCalled();
  });
  it.each([null,[],42,{...valid,typ:'bad'},{...valid,id:42},{...valid,id:'bad'},{...valid,datum:42},{...valid,datum:'bad'},{...valid,datum:'2026-13-01'},{...valid,datum:'2026-02-30'},{...valid,referenz:42},{...valid,referenz:'x'.repeat(121)}])('weist ungültigen Abgleich ab',async data=>{
    expect((await Abgleich(event(data))).status).toBe(400);expect(m.updateOne).not.toHaveBeenCalled();
  });
  it.each(['rechnung','gutschrift'])('bestätigt Buchung für %s ohne Zahlungsänderung',async typ=>{
    const r=await Abgleich(event({...valid,typ}));expect(r.status).toBe(200);
    expect(m.collection).toHaveBeenCalledWith(typ==='rechnung'?'vereinskleider_rechnungen':'vereinskleider_gutschriften');
    expect(m.updateOne).toHaveBeenCalledWith({_id:oid,vereinId:'verein-a',clubdeskVerbuchung:{$exists:false}},{$set:{clubdeskVerbuchung:{datum:valid.datum,referenz:'Buchung 1',erfasstAm:expect.any(Date),erfasstVon:id,erfasstVonName:'Ada Test'}}});
  });
  it('verwendet Ersatzname bei fehlendem Namen',async()=>{
    const r=await Abgleich(event(valid,'',{id,vereinId:'verein-a'}));expect((await r.json()).clubdeskVerbuchung.erfasstVonName).toBe('Unbekannt');
  });
  it.each([null,{}])('unterscheidet fehlenden und bereits verbuchten Beleg',async found=>{
    m.updateOne.mockResolvedValue({modifiedCount:0});m.findOne.mockResolvedValue(found);
    expect((await Abgleich(event(valid))).status).toBe(found?409:404);
    expect(m.findOne).toHaveBeenCalledWith({_id:oid,vereinId:'verein-a'},{projection:{clubdeskVerbuchung:1}});
  });
  it('meldet Abgleichfehler',async()=>{m.updateOne.mockRejectedValue(new Error('db'));expect((await Abgleich(event(valid))).status).toBe(500);});
  it('exportiert CSV mit korrekter Maskierung und Beträgen',async()=>{
    m.toArray.mockResolvedValueOnce([g,{...g,rueckerstattetBetrag:undefined,clubdeskVerbuchung:{datum:valid.datum,referenz:'B1',erfasstVonName:'Ada'},clubdeskExportStatus:'exportiert'}]).mockResolvedValueOnce([{...invoice,gesamtbetrag:96,bezahltBetrag:96,gutgeschriebenBetrag:96}]);
    const r=await Export(event());expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/csv');expect(r.headers.get('cache-control')).toBe('no-store');
    const csv=await r.text();expect(csv).toContain('"Shirt ""A"""');expect(csv).toContain('"48,00";"12,00";"36,00"');expect(csv).toContain('"exportiert";"Ja"');
    expect(m.find).toHaveBeenNthCalledWith(1,{vereinId:'verein-a'});expect(m.find).toHaveBeenNthCalledWith(2,{vereinId:'verein-a',_id:{$in:[oid]}});
  });
  it('begrenzt Exportmenge',async()=>{m.toArray.mockResolvedValue(Array(10001).fill(g));expect((await Export(event())).status).toBe(409);});
  it.each([42,'bad'])('verweigert ungültige Rechnungsreferenz',async rechnungId=>{m.toArray.mockResolvedValueOnce([{...g,rechnungId}]);expect((await Export(event())).status).toBe(409);});
  it.each([{invoices:[]},{invoices:[{...invoice,rechnungsnummer:'falsch'}]}])('verweigert uneindeutige Rechnungszuordnung',async ({invoices})=>{m.toArray.mockResolvedValueOnce([g]).mockResolvedValueOnce(invoices);expect((await Export(event())).status).toBe(409);});
  it.each(['48',NaN,-1,Number.MAX_SAFE_INTEGER,1.001])('verweigert ungültigen Betrag',async betrag=>{m.toArray.mockResolvedValueOnce([{...g,betrag}]).mockResolvedValueOnce([invoice]);expect((await Export(event())).status).toBe(500);});
  it.each([{rueckerstattetBetrag:49},{erstelltAm:'bad'}])('verweigert inkonsistente Gutschrift',async patch=>{m.toArray.mockResolvedValueOnce([{...g,...patch}]).mockResolvedValueOnce([invoice]);expect((await Export(event())).status).toBe(409);});
  it('meldet Export-Datenbankfehler',async()=>{m.toArray.mockRejectedValue(new Error('db'));expect((await Export(event())).status).toBe(500);});
  it.each(['0','-1','1.5','abc','9007199254740992'])('verweigert ungültige Seite',async seite=>{expect((await Historie(event({},'seite='+seite))).status).toBe(400);expect(m.aggregate).not.toHaveBeenCalled();});
  it.each([{result:[]},{result:[{}]},{result:[{anzahl:[],daten:[]}]}])('liefert leere Historie',async ({result})=>{m.toArray.mockResolvedValue(result);expect(await (await Historie(event())).json()).toEqual({retouren:[],seite:1,seiten:1,total:0});});
  it('paginiert vereinsbezogene Retouren',async()=>{
    m.toArray.mockResolvedValue([{daten:[{menge:1}],anzahl:[{total:51}]}]);
    expect(await (await Historie(event({},'seite=2'))).json()).toEqual({retouren:[{menge:1}],seite:2,seiten:3,total:51});
    const pipeline=m.aggregate.mock.calls[0][0];expect(pipeline[0]).toEqual({$match:{vereinId:'verein-a','retouren.0':{$exists:true}}});expect(pipeline[3].$facet.daten.slice(0,2)).toEqual([{$skip:25},{$limit:25}]);
  });
  it('meldet Historienfehler',async()=>{m.toArray.mockRejectedValue(new Error('db'));expect((await Historie(event())).status).toBe(500);});
});

import { GET as RetourenGET, POST as RetourenPOST } from '../../../src/routes/api/vereinskleider/retouren/+server';
vi.mock('../../../src/lib/server/lagerbewegungen',()=>({protokolliereLagerbewegung:m.lager}));
describe('Retouren-API – Validierung und Finanzkonsistenz (#38)',()=>{
 const id='507f1f77bcf86cd799439011', rid='507f1f77bcf86cd799439012';
 const input={verkaufId:id,positionsIndex:0,menge:1,grund:'defekt',wiederverkaufbar:false,bemerkung:' Test ',datum:'2026-11-26'};
 const p={artikelId:id,groesseId:null,menge:2,einzelpreis:28,verkaufsart:'direkt'};
 const sale={positionen:[p],retouren:[],uebergaben:[]};
 const invoice={_id:new ObjectId(rid),positionen:[{positionsIndex:0,menge:2,einzelpreis:28}],gesamtbetrag:56,bezahltBetrag:0,rechnungsnummer:'R1'};
 const event=(body:unknown=input,query='verkaufId='+id)=>({locals:{benutzer:{id,vereinId:'verein-a'}},url:new URL('http://localhost/?'+query),request:new Request('http://localhost',{method:'POST',body:JSON.stringify(body)})}) as never;
 beforeEach(()=>{
  vi.resetAllMocks();m.permission.mockReturnValue(null);m.collection.mockReturnValue(m);m.find.mockReturnValue(m);
  m.findOne.mockResolvedValue(sale);m.toArray.mockResolvedValueOnce([invoice]).mockResolvedValue([]);
  m.updateOne.mockResolvedValue({modifiedCount:1});m.insertOne.mockResolvedValue({insertedId:new ObjectId()});
  m.startSession.mockReturnValue({withTransaction:m.withTransaction,endSession:m.endSession});
  m.withTransaction.mockImplementation(async(fn)=>fn());
 });
 it.each([RetourenGET,RetourenPOST])('verweigert fehlendes Recht',async handler=>{m.permission.mockReturnValue(new Response(null,{status:403}));expect((await handler(event())).status).toBe(403);});
 it.each(['','verkaufId=bad'])('verwirft GET-ID',async q=>{expect((await RetourenGET(event(input,q))).status).toBe(400);});
 it('meldet fehlenden Verkauf',async()=>{m.findOne.mockResolvedValue(null);expect((await RetourenGET(event())).status).toBe(404);expect((await RetourenPOST(event())).status).toBe(404);});
 it('zeigt Direktverkauf ohne Finanzfreigabe',async()=>{const r=await RetourenGET(event());expect((await r.json()).positionen[0]).toMatchObject({maximal:2,freigegeben:false,artikelname:'',groesseId:null});});
 it('zeigt Rabattkonflikt und bereits retournierte Mengen',async()=>{m.findOne.mockResolvedValue({...sale,rabattTotal:1,retouren:[{positionsIndex:0,menge:1}]});const r=await RetourenGET(event());expect((await r.json()).positionen[0]).toMatchObject({maximal:1,hinweis:expect.stringContaining('nicht eindeutig')});});
 it('liefert leere Übersicht bei fehlenden Positionen',async()=>{m.findOne.mockResolvedValue({});expect((await (await RetourenGET(event())).json()).positionen).toEqual([]);});
 it('meldet GET-Datenbankfehler',async()=>{m.findOne.mockRejectedValue(Error('DB'));expect((await RetourenGET(event())).status).toBe(500);});
 it.each([{body:null},{body:[]},...[{verkaufId:1},{positionsIndex:-1},{positionsIndex:1.5},{menge:0},{menge:10001},{menge:1.5},{grund:'bad'},{wiederverkaufbar:1},{bemerkung:1},{bemerkung:'x'.repeat(1001)},{datum:1},{datum:'bad'},{datum:'2026-02-30'},{datum:'2026-13-01'}].map(p=>({body:{...input,...p}}))])('verwirft Eingabe %j',async({body})=>{expect((await RetourenPOST(event(body))).status).toBe(400);expect(m.startSession).not.toHaveBeenCalled();});
 it.each([{artikelId:1},{groesseId:'bad'},{einzelpreis:0},{einzelpreis:1.001},{preisOffen:true}])('verweigert inkonsistente Position %j',async patch=>{m.findOne.mockResolvedValue({...sale,positionen:[{...p,...patch}]});expect((await RetourenPOST(event())).status).toBe(409);expect(m.updateOne).not.toHaveBeenCalled();});
 it.each([{menge:'2'},{menge:1.5},{menge:0},{einzelpreis:'28'},{einzelpreis:Infinity},{einzelpreis:29}])('verweigert abweichende Rechnungsposition %j',async patch=>{m.toArray.mockReset().mockResolvedValueOnce([{...invoice,positionen:[{...invoice.positionen[0],...patch}]}]);expect((await RetourenPOST(event())).status).toBe(409);expect(m.updateOne).not.toHaveBeenCalled();});
 it.each([{gesamtbetrag:-1},{gesamtbetrag:NaN},{bezahltBetrag:-1},{bezahltBetrag:57},{gutgeschriebenBetrag:-1},{gutgeschriebenBetrag:1},{gesamtbetrag:10},{rueckerstattungOffen:1}])('verweigert inkonsistente Rechnung %j',async patch=>{m.toArray.mockReset().mockResolvedValueOnce([{...invoice,...patch}]).mockResolvedValue([]);expect((await RetourenPOST(event())).status).toBe(409);expect(m.updateOne).not.toHaveBeenCalled();});
 it.each([{bezahltBetrag:0,status:'offen'},{bezahltBetrag:10,status:'teilweise_bezahlt'},{bezahltBetrag:56,status:'bezahlt'}])('berechnet Rechnungsstatus %j',async({bezahltBetrag,status})=>{m.toArray.mockReset().mockResolvedValueOnce([{...invoice,bezahltBetrag}]).mockResolvedValue([]);expect((await RetourenPOST(event())).status).toBe(201);expect(m.updateOne.mock.calls[0][1].$set).toMatchObject({status,gutgeschriebenBetrag:28,rueckerstattungOffen:Math.max(0,bezahltBetrag-28)});expect(m.lager).not.toHaveBeenCalled();});
 it.each([1,2,3,4])('verhindert konkurrierende Änderung bei Update %s',async n=>{m.findOne.mockResolvedValue({...sale,positionen:[{...p,groesseId:id}]});for(let i=1;i<n;i++)m.updateOne.mockResolvedValueOnce({modifiedCount:1});m.updateOne.mockResolvedValueOnce({modifiedCount:0});expect((await RetourenPOST(event({...input,wiederverkaufbar:true}))).status).toBe(409);expect(m.insertOne).not.toHaveBeenCalled();expect(m.endSession).toHaveBeenCalled();});

 it('übernimmt historischen Rechnungsaussteller und bucht wiederverkaufbare Variante',async()=>{
  const aussteller={name:'Historischer TV',kuerzel:'HTV'};
  m.findOne.mockResolvedValue({...sale,positionen:[{...p,groesseId:id,artikelname:'Shirt'}]});
  m.toArray.mockReset().mockResolvedValueOnce([{...invoice,aussteller}]).mockResolvedValue([]);
  expect((await RetourenPOST(event({...input,wiederverkaufbar:true}))).status).toBe(201);
  expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({aussteller,artikelname:'Shirt',betrag:28}),expect.anything());
  expect(m.lager).toHaveBeenCalledWith(expect.objectContaining({mengeDelta:1,groesseId:id,referenzTyp:'vereinskleider-retoure'}),expect.anything());
 });
 it('verweigert Retoure ohne Rechnung',async()=>{
  m.toArray.mockReset().mockResolvedValue([]);
  expect((await RetourenPOST(event())).status).toBe(409);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
 it.each([[],[{positionsIndex:0,menge:2,einzelpreis:28},{positionsIndex:0,menge:2,einzelpreis:28}]])('verweigert nicht eindeutige Rechnungspositionen %#',async positionen=>{
  m.toArray.mockReset().mockResolvedValueOnce([{...invoice,positionen}]).mockResolvedValue([]);
  expect((await RetourenPOST(event())).status).toBe(409);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
 it('akzeptiert eindeutige historische Artikelzuordnung ohne Positionsindex',async()=>{
  m.toArray.mockReset().mockResolvedValueOnce([{...invoice,positionen:[{artikelId:id,groesseId:null,menge:2,einzelpreis:28}]}]).mockResolvedValue([]);
  expect((await RetourenPOST(event())).status).toBe(201);
 });
 it.each([{trancheRechnungIds:[rid,'507f1f77bcf86cd799439013']},{trancheRechnungIds:['507f1f77bcf86cd799439013']},{trancheRechnungIds:[rid],rechnungId:rid}])('verweigert inkonsistente Tranchendaten %#',async patch=>{
  m.findOne.mockResolvedValue({...sale,...patch});
  expect((await RetourenPOST(event())).status).toBe(409);
  expect(m.updateOne).not.toHaveBeenCalled();
 });
 it('akzeptiert eindeutige Teilrechnung und vollständige Retoure',async()=>{
  m.findOne.mockResolvedValue({...sale,trancheRechnungIds:[rid]});
  m.toArray.mockReset().mockResolvedValueOnce([{...invoice,bezahltBetrag:56}]).mockResolvedValue([]);
  expect((await RetourenPOST(event({...input,menge:2}))).status).toBe(201);
  expect(m.updateOne.mock.calls[0][1].$set).toMatchObject({status:'storniert',gutgeschriebenBetrag:56,rueckerstattungOffen:56});
 });
 it('berücksichtigt bereits ausbezahlte Gutschrift bei zweiter Retoure',async()=>{
  m.findOne.mockResolvedValue({...sale,retouren:[{positionsIndex:0,menge:1,rechnungId:rid}],aktualisiertAm:new Date()});
  m.toArray.mockReset().mockResolvedValueOnce([{...invoice,bezahltBetrag:56,gutgeschriebenBetrag:28,rueckerstattungOffen:0}]).mockResolvedValueOnce([{betrag:28,rueckerstattetBetrag:28}]);
  expect((await RetourenPOST(event())).status).toBe(201);
  expect(m.updateOne.mock.calls[0][1].$set).toMatchObject({status:'storniert',gutgeschriebenBetrag:56,rueckerstattungOffen:28});
 });
 it('zeigt keine verbleibende Menge nach vollständiger Retoure',async()=>{
  m.findOne.mockResolvedValue({...sale,retouren:[{positionsIndex:0,menge:2}]});
  expect((await (await RetourenGET(event())).json()).positionen[0]).toMatchObject({maximal:0,hinweis:'',freigegeben:false});
 });
 it('meldet Transaktionsfehler',async()=>{m.withTransaction.mockRejectedValue(Error('DB'));expect((await RetourenPOST(event())).status).toBe(500);expect(m.endSession).toHaveBeenCalled();});
});


describe('Retourenprüfung – zusätzliche Grenzwerte', () => {
  it.each([{ index: -1, menge: 1 }, { index: 0.5, menge: 1 }, { index: 0, menge: 0.5 }, { index: 0, menge: 10001 }])('verweigert ungültige Eingabe %j', ({ index, menge }) => {
    expect(() => pruefeRetourenmenge(basis(), index, menge)).toThrow(/Ungültige/);
  });
  it('verweigert fehlende Positionen', () => {
    expect(() => pruefeRetourenmenge({}, 0, 1)).toThrow(/nicht gefunden/);
  });
  it.each([undefined, 0, -1, 0.5])('verweigert inkonsistente Übergabemenge %s', menge => {
    const v = basis(); v.uebergaben = [{ positionsIndex: 0, menge }];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Übergabedaten inkonsistent/);
  });
  it.each([undefined, 0, -1, 0.5])('verweigert inkonsistente Retourenmenge %s', menge => {
    const v = basis(); v.retouren = [{ positionsIndex: 0, menge }];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Retourendaten inkonsistent/);
  });
  it.each([{ menge: undefined }, { menge: -1 }, { menge: 0.5 }, { menge: 2 }, { storniertMenge: -1 }, { storniertMenge: 0.5 }])('verweigert inkonsistente Verkaufsposition %j', patch => {
    const v = basis(); Object.assign(v.positionen![0], patch);
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Verkaufs- oder Retourenmengen inkonsistent/);
  });
  it('verweigert überhöhte historische Retourenmenge', () => {
    const v = basis(); v.retouren = [{ positionsIndex: 0, menge: 4 }];
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/Verkaufs- oder Retourenmengen inkonsistent/);
  });
  it.each([undefined, null, NaN, Infinity, -1, 0.001, Number.MAX_SAFE_INTEGER])('verweigert nicht eindeutig berechenbaren Preis %s', einzelpreis => {
    const v = basis(); v.positionen![0].einzelpreis = einzelpreis;
    expect(() => pruefeRetourenmenge(v, 0, 1)).toThrow(/nicht eindeutig/);
  });
  it.each([{ rabatte: [{}] }, { zusaetzlicherRabatt: 1 }])('verweigert weitere Rabattarten %j', patch => {
    expect(() => pruefeRetourenmenge({ ...basis(), ...patch }, 0, 1)).toThrow(/nicht eindeutig/);
  });
  it('berücksichtigt nur die ausgewählte Position und erlaubt kostenlose Retouren', () => {
    const v = basis(); v.positionen![0].einzelpreis = 0; v.positionen![0].uebergebenMenge = undefined;
    v.uebergaben!.push({ positionsIndex: 1, menge: 99 }); v.retouren = [{ positionsIndex: 1, menge: 99 }];
    expect(pruefeRetourenmenge(v, 0, 3)).toEqual({ maximal: 3, einzelpreisRappen: 0 });
  });
});

describe('Retouren – historische Daten (#38)', () => {
  it('erlaubt Direktverkauf ohne optionale Historienfelder', () => {
    expect(pruefeRetourenmenge({positionen:[{menge:2,verkaufsart:'direkt',einzelpreis:12.35}]},0,1)).toEqual({maximal:2,einzelpreisRappen:1235});
  });
  it('verweigert Direktverkauf ohne Mengenfeld', () => {
    expect(() => pruefeRetourenmenge({positionen:[{verkaufsart:'direkt',einzelpreis:12}]},0,1)).toThrow('Keine dokumentierte Übergabe');
  });
  it('verwendet dokumentierte Übergaben auch beim Direktverkauf', () => {
    expect(pruefeRetourenmenge({positionen:[{menge:4,verkaufsart:'direkt',einzelpreis:12}],uebergaben:[{positionsIndex:0,menge:2}]},0,1).maximal).toBe(2);
  });
});
