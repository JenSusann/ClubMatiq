import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ermittleRiegen } from '../../src/lib/server/riegenzuordnung';

const riegen = [
  { _id: '1', name: 'GETU Meitli', aktiv: true },
  { _id: '2', name: 'Aktive', aktiv: true },
  { _id: '3', name: 'Allround', aktiv: false }
];
const regeln = [
  { gruppe: 'K3/4 Ti', funktion: 'TurnerIn', riegeId: '1' },
  { gruppe: 'Ti/Tu TV', funktion: 'TurnerIn', riegeId: '2' },
  { gruppe: '05_Allround', funktion: null, riegeId: '3' }
];
describe('Issue #71 – Riegenzuordnung', () => {
  it('ordnet Turnende zu', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)'] }, regeln, riegen)).toEqual(['GETU Meitli']));
  it('ignoriert reine Leitungsfunktionen', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (LeiterIn)'] }, regeln, riegen)).toEqual([]));
  it('unterstützt Mehrfachmitgliedschaften', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)', 'Ti/Tu TV (TurnerIn)'] }, regeln, riegen)).toEqual(['Aktive', 'GETU Meitli']));
  it('ignoriert deaktivierte Riegen', () => expect(ermittleRiegen({ clubdeskGruppen: ['05_Allround'] }, regeln, riegen)).toEqual([]));
  it('entfernt doppelte Zuordnungen', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)', 'K3/4 Ti (TurnerIn)'] }, regeln, riegen)).toEqual(['GETU Meitli']));
  it('ignoriert unbekannte Gruppen', () => expect(ermittleRiegen({ clubdeskGruppen: ['Vorstand'] }, regeln, riegen)).toEqual([]));
  it('liefert ohne Gruppen keine Riegen', () => expect(ermittleRiegen({}, regeln, riegen)).toEqual([]));
  it('verwendet strukturierte Gruppendetails bevorzugt', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)'], clubdeskGruppendetails: [{ gruppe: 'K3/4 Ti', funktion: 'LeiterIn' }] }, regeln, riegen)).toEqual([]));
  it('verwendet Hauptgruppe ohne Funktion als Rückfall', () => expect(ermittleRiegen({ clubdeskHauptgruppe: 'Ti/Tu TV' }, [{ gruppe: 'Ti/Tu TV', funktion: null, riegeId: '2' }], riegen)).toEqual(['Aktive']));
  it('umgeht Funktionsprüfung nicht über Hauptgruppe', () => expect(ermittleRiegen({ clubdeskHauptgruppe: 'K3/4 Ti', clubdeskGruppen: ['K3/4 Ti (LeiterIn)'] }, [{ gruppe: 'K3/4 Ti', funktion: null, riegeId: '1' }], riegen)).toEqual([]));
  it('ignoriert Zuordnungen zu nicht vorhandenen Riegen', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)'] }, regeln, [])).toEqual([]));
  it('unterscheidet Funktionen mit verschachtelten Klammern', () => expect(ermittleRiegen({ clubdeskGruppen: ['Vorstand (Kassier(in))'] }, [{ gruppe: 'Vorstand', funktion: 'Kassier(in)', riegeId: '2' }], riegen)).toEqual(['Aktive']));
});

import { ObjectId, MongoServerError } from 'mongodb';
import * as R from '../../src/routes/api/riegen/+server';
import * as Z from '../../src/routes/api/gruppenzuordnungen/+server';
import { GET as Gruppen } from '../../src/routes/api/gruppenzuordnungen/gruppen/+server';
const m = vi.hoisted(() => ({ collection: vi.fn(), permission: vi.fn(), find: vi.fn(), sort: vi.fn(), toArray: vi.fn(), findOne: vi.fn(), createIndex: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
describe('Riegen und Gruppenzuordnungen API', () => {
  const id = '507f1f77bcf86cd799439011';
  const oid = new ObjectId(id);
  const benutzer = { vereinId: 'verein-a', rolle: 'admin' };
  const event = (data: unknown = {}, query = '') => ({ locals: { benutzer }, request: new Request('http://localhost', { method: 'POST', body: JSON.stringify(data) }), url: new URL('http://localhost/?' + query) }) as never;
  const riege = { name: ' GETU ', bereich: 'juko' };
  const zuordnung = { gruppe: ' GETU ', funktion: ' TurnerIn ', riegeId: id };
  beforeEach(() => {
    vi.resetAllMocks();
    m.permission.mockReturnValue(null);
    m.collection.mockReturnValue(m);
    m.find.mockReturnValue(m);
    m.sort.mockReturnValue(m);
    m.toArray.mockResolvedValue([]);
    m.findOne.mockResolvedValue({ _id: oid });
    m.insertOne.mockResolvedValue({ insertedId: oid });
    m.updateOne.mockResolvedValue({ matchedCount: 1 });
    m.deleteOne.mockResolvedValue({ deletedCount: 1 });
  });
  it.each([R.GET,R.POST,R.PATCH,Z.GET,Z.POST,Z.DELETE,Gruppen])('blockiert fehlende Berechtigung', async handler => {
    m.permission.mockReturnValue(new Response(null,{status:403}));
    expect((await handler(event())).status).toBe(403);
    expect(m.collection).not.toHaveBeenCalled();
  });
  it('listet Riegen des eigenen Vereins', async () => {
    m.toArray.mockResolvedValue([{ _id: oid, name: 'GETU' }]);
    expect(await (await R.GET(event())).json()).toEqual([{ _id:id,name:'GETU' }]);
    expect(m.find).toHaveBeenCalledWith({vereinId:'verein-a'});
    expect(m.sort).toHaveBeenCalledWith({name:1});
  });
  it.each([null, [], 42, {name:42}, {...riege,name:''}, {...riege,name:'x'.repeat(101)}, {...riege,bereich:'falsch'}, {...riege,aktiv:42}])('weist ungültige Riege ab', async data => {
    expect((await R.POST(event(data))).status).toBe(400);
    expect(m.insertOne).not.toHaveBeenCalled();
  });
  it.each([true,false,undefined])('erstellt normalisierte Riege mit Aktivstatus %s', async aktiv => {
    expect((await R.POST(event({...riege,aktiv,vereinId:'fremd'}))).status).toBe(201);
    expect(m.createIndex).toHaveBeenCalledWith({vereinId:1,namensschluessel:1},{unique:true});
    expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({name:'GETU',namensschluessel:'getu',vereinId:'verein-a',aktiv:aktiv!==false}));
  });
  it.each([R.POST,Z.POST])('behandelt Duplicate Key und sonstige DB-Fehler', async handler => {
    const data = handler === R.POST ? riege : zuordnung;
    m.insertOne.mockRejectedValueOnce(new MongoServerError({message:'duplicate',code:11000}));
    expect((await handler(event(data))).status).toBe(409);
    m.insertOne.mockRejectedValueOnce(new MongoServerError({message:'db',code:123}));
    await expect(handler(event(data))).rejects.toThrow();
    m.insertOne.mockRejectedValueOnce(new Error('db'));
    await expect(handler(event(data))).rejects.toThrow('db');
  });
  it.each([null,{}, {id:'bad',aktiv:true},{id,aktiv:1}])('weist ungültige Statusänderung ab', async data => {
    expect((await R.PATCH(event(data))).status).toBe(400);
    expect(m.updateOne).not.toHaveBeenCalled();
  });
  it('ändert Aktivstatus nur im eigenen Verein', async () => {
    expect((await R.PATCH(event({id,aktiv:false}))).status).toBe(200);
    expect(m.updateOne).toHaveBeenCalledWith({_id:oid,vereinId:'verein-a'},{$set:{aktiv:false,aktualisiertAm:expect.any(Date)}});
    m.updateOne.mockResolvedValueOnce({matchedCount:0});
    expect((await R.PATCH(event({id,aktiv:true}))).status).toBe(404);
  });
  it('listet Zuordnungen mit serialisierten IDs', async () => {
    m.toArray.mockResolvedValue([{_id:oid,riegeId:oid}]);
    expect(await (await Z.GET(event())).json()).toEqual([{_id:id,riegeId:id}]);
    expect(m.find).toHaveBeenCalledWith({vereinId:'verein-a'});
  });
  it.each([null,{}, {...zuordnung,gruppe:' '},{...zuordnung,gruppe:'x'.repeat(251)},{...zuordnung,funktion:42},{...zuordnung,funktion:'x'.repeat(151)},{...zuordnung,riegeId:42},{...zuordnung,riegeId:'bad'}])('weist ungültige Zuordnung ab', async data => {
    expect((await Z.POST(event(data))).status).toBe(400);
    expect(m.insertOne).not.toHaveBeenCalled();
  });
  it.each([' TurnerIn ', ' ', null, undefined])('speichert normalisierte Zuordnung', async funktion => {
    expect((await Z.POST(event({...zuordnung,funktion}))).status).toBe(201);
    expect(m.findOne).toHaveBeenCalledWith({_id:oid,vereinId:'verein-a',aktiv:true});
    expect(m.insertOne).toHaveBeenCalledWith(expect.objectContaining({vereinId:'verein-a',gruppe:'GETU',funktion:funktion?.trim()||null,riegeId:oid}));
  });
  it('verweigert Zuordnung zu fehlender aktiver Riege', async () => {
    m.findOne.mockResolvedValue(null);
    expect((await Z.POST(event(zuordnung))).status).toBe(404);
    expect(m.insertOne).not.toHaveBeenCalled();
  });
  it.each(['','id=bad'])('weist ungültige Lösch-ID ab', async query => {
    expect((await Z.DELETE(event({},query))).status).toBe(400);
  });
  it('löscht nur eigene Zuordnung und meldet fehlende Zuordnung', async () => {
    expect((await Z.DELETE(event({},'id='+id))).status).toBe(200);
    expect(m.deleteOne).toHaveBeenCalledWith({_id:oid,vereinId:'verein-a'});
    m.deleteOne.mockResolvedValueOnce({deletedCount:0});
    expect((await Z.DELETE(event({},'id='+id))).status).toBe(404);
  });
  it('vereinigt strukturierte und alte Gruppen ohne Duplikate', async () => {
    m.toArray.mockResolvedValue([
      {clubdeskHauptgruppe:'GETU',clubdeskGruppen:['GETU (TurnerIn)','GETU (TurnerIn)','Aktive',' ']},
      {clubdeskGruppendetails:[{gruppe:'GETU',funktion:'LeiterIn'}],clubdeskGruppen:['Ignoriert']},
      {}
    ]);
    expect(await (await Gruppen(event())).json()).toEqual([
      {gruppe:'Aktive',funktion:null},{gruppe:'GETU',funktion:null},{gruppe:'GETU',funktion:'LeiterIn'},{gruppe:'GETU',funktion:'TurnerIn'}
    ]);
    expect(m.find).toHaveBeenCalledWith({vereinId:'verein-a',aktiv:true},expect.any(Object));
  });
});
