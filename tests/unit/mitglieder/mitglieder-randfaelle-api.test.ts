import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  collection: { find: vi.fn(), createIndex: vi.fn(), bulkWrite: vi.fn() },
  permission: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: () => m.collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
import { GET, POST } from '../../../src/routes/api/mitglieder/+server';
const locals = { benutzer: { vereinId: 'verein-1' } } as any;
const url = (suche = '') => new URL('http://localhost/api/mitglieder?suche=' + encodeURIComponent(suche));
const member = (id: number, vorname = 'Anna', nachname = 'Muster') => ({ _id: { toString: () => String(id) }, clubdeskId: String(id), vorname, nachname, anrede: '', adresse: '', ort: '', plz: '', status: '', aktiv: true });
const csv = '[Id];Vorname;Nachname;Anrede;Adresse;Ort;PLZ;Status\n1;Anna;Muster;Frau;Weg 1;Zürich;8000;Aktiv';
function upload(content: string, filename = 'clubdesk.csv') {
  const form = new FormData(); form.set('datei', new File([content], filename, { type: 'text/csv' }));
  return new Request('http://localhost/api/mitglieder', { method: 'POST', body: form });
}
async function post(request: Request) { return POST({ request, locals } as any) as Promise<Response>; }
async function thrown(request: Request, status: number, message?: string) {
  try { await post(request); throw new Error('Erwarteter HTTP-Fehler wurde nicht ausgelöst'); }
  catch (e: any) { expect(e.status).toBe(status); if (message) expect(e.body?.message ?? e.message).toContain(message); }
}
beforeEach(() => {
  vi.clearAllMocks(); m.permission.mockReturnValue(null);
  m.collection.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [member(1), member(2, 'Berta', 'Meier')] }) }) });
  m.collection.createIndex.mockResolvedValue('index');
  m.collection.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });
});
describe('Mitglieder lesen', () => {
  it('prüft die Berechtigung', async () => { const r = await GET({ locals, url: url() } as any) as Response; expect(r.status).toBe(200); expect(m.permission).toHaveBeenCalledWith(locals.benutzer, 'mitglieder:verwalten'); });
  it('bricht bei fehlender Berechtigung ab', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); const r = await GET({ locals, url: url() } as any) as Response; expect(r.status).toBe(403); expect(m.collection.find).not.toHaveBeenCalled(); });
  it('filtert nach Vorname, Nachname und ClubDesk-ID', async () => { for (const s of ['Anna', 'Muster', '1']) { const r = await GET({ locals, url: url(s) } as any) as Response; const data = await r.json(); expect(data).toHaveLength(1); expect(data[0].anzeigename).toBe('Anna Muster'); } });
  it('liefert leere Liste ohne Treffer', async () => { const r = await GET({ locals, url: url('unbekannt') } as any) as Response; expect(await r.json()).toEqual([]); });
  it('begrenzt die Ausgabe auf 50 Treffer', async () => { m.collection.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => Array.from({ length: 70 }, (_, i) => member(i)) }) }) }); const r = await GET({ locals, url: url() } as any) as Response; expect(await r.json()).toHaveLength(50); });
});
describe('ClubDesk CSV Import', () => {
  it('prüft Berechtigung vor Verarbeitung', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await post(upload(csv))).status).toBe(403); });
  it('verlangt multipart', async () => { await thrown(new Request('http://localhost/api/mitglieder', { method: 'POST', body: csv }), 400); });
  it('verlangt Datei im Feld datei', async () => { const f = new FormData(); f.set('anderes', 'wert'); await thrown(new Request('http://localhost/api/mitglieder', { method: 'POST', body: f }), 400); });
  it('verweigert Dateien über 5 MB', async () => { await thrown(upload('x'.repeat(5_000_001)), 413); });
  it('verweigert leere CSV', async () => { await thrown(upload('[Id];Vorname;Nachname\n'), 400); });
  it.each(['[Id];Vorname\n1;Anna', 'Vorname;Nachname\nAnna;Muster', '[Id];Nachname\n1;Muster'])('verlangt alle Pflichtspalten: %s', async (s) => { await thrown(upload(s), 400); });
  it('verweigert fehlende ClubDesk-ID', async () => { await thrown(upload('[Id];Vorname;Nachname\n;Anna;Muster'), 400); });
  it('verweigert Datensatz ohne Vor- und Nachnamen', async () => { await thrown(upload('[Id];Vorname;Nachname\n1;;'), 400); });
  it('verweigert doppelte ClubDesk-ID mit unterschiedlichen Namen', async () => { await thrown(upload('[Id];Vorname;Nachname\n1;Anna;Muster\n1;Berta;Meier'), 400); });
  it('verweigert ungeschlossene Anführungszeichen', async () => { await thrown(upload('[Id];Vorname;Nachname\n1;"Anna;Muster'), 400); });
  it('importiert Mitglieder vereinsgebunden mit Upsert', async () => { const r = await post(upload(csv)); expect(r.status).toBe(200); expect((await r.json()).eingelesen).toBe(1); expect(m.collection.createIndex).toHaveBeenCalled(); expect(m.collection.bulkWrite).toHaveBeenCalledWith([expect.objectContaining({ updateOne: expect.objectContaining({ filter: { vereinId: 'verein-1', clubdeskId: '1' }, upsert: true }) })], { ordered: true }); });
  it('verarbeitet BOM, CRLF und gequotete Semikolons', async () => { const r = await post(upload('\uFEFF[Id];Vorname;Nachname;Adresse\r\n1;"Anna;Maria";Muster;"Weg; 2"\r\n')); expect(r.status).toBe(200); expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('Anna;Maria'); });
  it('verarbeitet doppelte Anführungszeichen', async () => { const r = await post(upload('[Id];Vorname;Nachname\n1;"An""na";Muster')); expect(r.status).toBe(200); expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('An"na'); });
  it('importiert Windows-1252 kodierte CSV', async () => { const bytes = new Uint8Array([91,73,100,93,59,86,111,114,110,97,109,101,59,78,97,99,104,110,97,109,101,10,49,59,74,246,114,103,59,77,252,108,108,101,114]); const f = new FormData(); f.set('datei', new File([bytes], 'latin.csv')); const r = await post(new Request('http://localhost/api/mitglieder', { method: 'POST', body: f })); expect(r.status).toBe(200); expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('Jörg'); });
  it('berechnet Neu, Aktualisiert und Unverändert', async () => { m.collection.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 2, matchedCount: 4 }); const r = await post(upload(csv)); expect(await r.json()).toMatchObject({ neu: 1, aktualisiert: 2, unveraendert: 2 }); });
});

// Zusätzliche Such- und CSV-Fälle mit denselben Modul-Mocks.
const extraMocks = { sort: vi.fn(), limit: vi.fn(), toArray: vi.fn() };
const benutzer = { id: 'user-1', vereinId: 'verein-1', rolle: 'admin' };
const memberZusatz = (vorname: string, nachname: string, clubdeskId: string) => ({
  _id: 'mongo-id', vorname, nachname, clubdeskId, anrede: '', adresse: '', ort: '', plz: '', status: '', aktiv: true
});
const getZusatz = (suche?: string) => GET({ locals: { benutzer }, url: new URL('http://localhost/api/mitglieder' + (suche === undefined ? '' : '?suche=' + encodeURIComponent(suche))) } as never);
const postZusatz = (csv: string, type = 'text/csv') => {
  const fd = new FormData();
  fd.set('datei', new File([csv], 'mitglieder.csv', { type }));
  return POST({ locals: { benutzer }, request: { headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }), formData: async () => fd } } as never);
};
const messageZusatz = async (promise: Response | Promise<Response>, status: number, contains: string) => {
  try { await promise; throw new Error('Expected HTTP error'); }
  catch (e: any) { expect(e.status).toBe(status); expect(e.body?.message ?? e.message).toContain(contains); }
};

describe('Paket 18 – Mitglieder CSV und Suchfilter', () => {
beforeEach(() => {
  vi.clearAllMocks();
  m.collection.find.mockReturnValue({ sort: extraMocks.sort });
  extraMocks.sort.mockReturnValue({ limit: extraMocks.limit });
  extraMocks.limit.mockReturnValue({ toArray: extraMocks.toArray });
  extraMocks.toArray.mockResolvedValue([]);
  m.collection.createIndex.mockResolvedValue('index');
  m.collection.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });
  m.permission.mockReturnValue(null);
});


  it('GET ohne Suchbegriff gibt alle Mitglieder zurück', async () => {
    extraMocks.toArray.mockResolvedValue([memberZusatz('Anna', 'Muster', '123')]);
    const r = await getZusatz();
    expect(r.status).toBe(200);
    expect((await r.json())[0].anzeigename).toBe('Anna Muster');
  });
  it('GET filtert Treffer und Nichttreffer nach Name', async () => {
    extraMocks.toArray.mockResolvedValue([memberZusatz('Anna', 'Muster', '123'), memberZusatz('Max', 'Meier', '456')]);
    const r = await getZusatz('muster anna');
    expect((await r.json()).map((v: any) => v.clubdeskId)).toEqual(['123']);
  });
  it('GET akzeptiert leere und getrimmte Suche', async () => {
    extraMocks.toArray.mockResolvedValue([memberZusatz('Anna', 'Muster', '123')]);
    expect((await (await getZusatz('   ')).json())).toHaveLength(1);
    expect((await (await getZusatz(' ANNA ')).json())).toHaveLength(1);
  });
  it('GET gibt maximal 50 Treffer zurück', async () => {
    extraMocks.toArray.mockResolvedValue(Array.from({ length: 60 }, (_, i) => memberZusatz('Anna', 'Muster', String(i))));
    expect((await (await getZusatz()).json())).toHaveLength(50);
  });
  it('GET gibt Berechtigungsfehler unverändert zurück', async () => {
    m.permission.mockReturnValueOnce(new Response('verboten', { status: 403 }));
    expect((await getZusatz()).status).toBe(403);
  });
  it('POST gibt Berechtigungsfehler unverändert zurück', async () => {
    m.permission.mockReturnValueOnce(new Response('verboten', { status: 403 }));
    expect((await postZusatz('')).status).toBe(403);
  });
  it('POST verweigert falschen Content-Type', async () => {
    await messageZusatz(POST({ locals: { benutzer }, request: { headers: new Headers({ 'content-type': 'text/plain' }) } } as never), 400, 'CSV-Datei');
  });
  it('POST verweigert fehlende Datei', async () => {
    await messageZusatz(POST({ locals: { benutzer }, request: { headers: new Headers({ 'content-type': 'multipart/form-data' }), formData: async () => new FormData() } } as never), 400, 'Keine CSV-Datei');
  });
  it('POST importiert gültige CSV mit optionalen Spalten', async () => {
    const r = await postZusatz('[Id];Vorname;Nachname\n100;Anna;Muster');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ erfolg: true, eingelesen: 1 });
    expect(m.collection.bulkWrite).toHaveBeenCalledOnce();
  });
  it('POST verarbeitet BOM, CRLF und Anführungszeichen', async () => {
    const r = await postZusatz('\uFEFF[Id];Vorname;Nachname;Ort\r\n100;"Anna; Maria";"Muster";Zürich\r\n');
    expect(r.status).toBe(200);
    expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('Anna; Maria');
  });
  it('POST verarbeitet escaped Anführungszeichen', async () => {
    const r = await postZusatz('[Id];Vorname;Nachname\n100;"An""na";Muster\n');
    expect(r.status).toBe(200);
    expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('An"na');
  });
  it('POST verweigert nicht geschlossene Anführungszeichen', async () => {
    await messageZusatz(postZusatz('[Id];Vorname;Nachname\n100;"Anna;Muster'), 400, 'Anführungszeichen');
  });
  it('POST verweigert CSV ohne Datensätze', async () => {
    await messageZusatz(postZusatz('[Id];Vorname;Nachname\n'), 400, 'keine Mitglieder');
  });
  it('POST verweigert fehlende Pflichtspalte', async () => {
    await messageZusatz(postZusatz('[Id];Vorname\n100;Anna'), 400, 'Pflichtspalte');
  });
  it('POST verweigert fehlende ClubDesk-ID', async () => {
    await messageZusatz(postZusatz('[Id];Vorname;Nachname\n;Anna;Muster'), 400, 'Ungültiger Mitgliedereintrag');
  });
  it('POST verweigert fehlende Vor- und Nachnamen', async () => {
    await messageZusatz(postZusatz('[Id];Vorname;Nachname\n100;;'), 400, 'Ungültiger Mitgliedereintrag');
  });
  it('POST verweigert widersprüchliche Namen zur gleichen ClubDesk-ID', async () => {
    await messageZusatz(postZusatz('[Id];Vorname;Nachname\n100;Anna;Muster\n100;Max;Meier'), 400, 'Widersprüchliche Namen zur gleichen ClubDesk-ID');
  });
  it('POST berechnet aktualisierte und unveränderte Einträge', async () => {
    m.collection.bulkWrite.mockResolvedValue({ upsertedCount: 0, modifiedCount: 1, matchedCount: 2 });
    const r = await postZusatz('[Id];Vorname;Nachname\n100;Anna;Muster');
    expect(await r.json()).toMatchObject({ aktualisiert: 1, unveraendert: 1 });
  });
});

 it('führt identische ClubDesk-IDs mit gleichem Namen zusammen', async () => {
  const r = await post(upload('[Id];Vorname;Nachname;Gruppen\n1;Anna;Muster;Gruppe A (TurnerIn)\n1;Anna;Muster;Gruppe B (TurnerIn)'));
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ eingelesen: 1 });
  const ops = m.collection.bulkWrite.mock.calls[0][0];
  expect(ops).toHaveLength(1);
  expect(ops[0].updateOne.update.$set.clubdeskGruppen).toEqual(['Gruppe A (TurnerIn)', 'Gruppe B (TurnerIn)']);
  expect(ops[0].updateOne.update.$set).not.toHaveProperty('erstbezugsRabattIds');
});

describe('Mitglieder – Riegenfilter und Importdetails (#38)',()=>{
 const rows=[{...member(1),riegen:['Aktive'],erstbezugsRabattIds:['r1']},{...member(2),riegen:[]},member(3),{...member(4),clubdeskGruppen:['Unbekannt'],clubdeskHauptgruppe:'Unbekannt',clubdeskGruppendetails:[{gruppe:'Unbekannt',funktion:null}]}];
 const get=(query:string)=>GET({locals,url:new URL('http://localhost/?'+query)} as never);
 beforeEach(()=>{
  m.collection.find.mockImplementation((filter:Record<string,unknown>)=>({sort:()=>({limit:()=>({toArray:async()=>rows})}),toArray:async()=>filter.aktiv?[{_id:'r1',name:'Aktive',bereich:'aktive',aktiv:true}]:[]}));
 });
 it.each([['riege=Aktive',['1']],['riege=__ohne',['2','3','4']],['riege=Unbekannt',[]],['details=1&bereich=aktive',['1']],['details=1&bereich=juko',[]]])('filtert %s',async(query,ids)=>{
  expect((await (await get(query as string)).json()).map((x:any)=>x.clubdeskId)).toEqual(ids);
 });
 it('liefert optionale Felder und berechnete Bereiche',async()=>{
  const data=await (await get('details=1')).json();
  expect(data[0]).toMatchObject({bereiche:['aktive'],erstbezugsRabattIds:['r1']});
  expect(data[2]).not.toHaveProperty('riegen');
  expect(data[3]).toMatchObject({riegen:[],clubdeskGruppen:['Unbekannt'],clubdeskHauptgruppe:'Unbekannt',clubdeskGruppendetails:[{gruppe:'Unbekannt',funktion:null}],bereiche:[]});
 });
 it('importiert Gruppen und Riegen ohne Duplikate',async()=>{
  const r=await post(upload('[Id];Vorname;Nachname;Gruppen;Riegen\n1;Anna;Muster;A, A, B (Leitung), ;X|X|Y\n1;Anna;Muster;C;Y|Z'));
  expect(r.status).toBe(200);
  expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set).toMatchObject({clubdeskGruppen:['A','B (Leitung)','C'],clubdeskGruppendetails:[{gruppe:'A',funktion:null},{gruppe:'B',funktion:'Leitung'},{gruppe:'C',funktion:null}],riegen:['X','Y','Z']});
 });
 it('berechnet Riegen bei vollständigen ClubDesk-Gruppenspalten',async()=>{
  const r=await post(upload('[Id];Vorname;Nachname;Gruppe;Gruppen\n1;Anna;Muster;A;A\n1;Anna;Muster;B;B'));
  expect(r.status).toBe(200);
  expect(m.collection.bulkWrite.mock.calls[0][0][0].updateOne.update.$set).toMatchObject({clubdeskHauptgruppe:'B',clubdeskGruppen:['A','B'],riegen:[]});
 });
 it('akzeptiert einzelne Namen und fehlende optionale Spaltenwerte',async()=>{
  const r=await post(upload('[Id];Vorname;Nachname;Ort\r1;Anna;\r\r2;;Muster'));
  expect(r.status).toBe(200);
  const ops=m.collection.bulkWrite.mock.calls[0][0];
  expect(ops[0].updateOne.update.$set).toMatchObject({vorname:'Anna',nachname:'',ort:''});
  expect(ops[1].updateOne.update.$set).toMatchObject({vorname:'',nachname:'Muster',ort:''});
 });
 it('verweigert fehlenden Content-Type',async()=>{
  await messageZusatz(POST({locals,request:{headers:new Headers()}} as never),400,'CSV-Datei');
 });
});
