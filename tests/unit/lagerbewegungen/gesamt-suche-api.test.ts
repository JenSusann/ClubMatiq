import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const mocks = vi.hoisted(() => ({ collection: vi.fn(), permission: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (...args: unknown[]) => mocks.collection(...args) } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: (...args: unknown[]) => mocks.permission(...args) }));
import { GET } from '../../../src/routes/api/lagerbewegungen/gesamt/+server';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockReturnValue(null);
});

describe('Issue #66 – Suche vor Vorschaugrenze', () => {
  it('findet ältere Treffer hinter den ersten 200 Bewegungen', async () => {
    const artikelId = new ObjectId();
    const id = new ObjectId();
    const daten = Array.from({ length: 201 }, (_, i) => ({
      _id: new ObjectId(), artikelId: artikelId.toString(), zeitpunkt: new Date(2026, 0, 1),
      art: i === 200 ? 'inventur' : 'verkauf', mengeDelta: 1,
      referenzTyp: 'test', referenzId: i === 200 ? 'gesuchter-beleg' : 'andere-referenz'
    }));
    let limitAufgerufen = false;
    mocks.collection.mockImplementation((name: string) => {
      if (name === 'lagerbewegungen') return {
        find: () => ({
          sort() { return this; },
          limit() { limitAufgerufen = true; return this; },
          async *[Symbol.asyncIterator]() { yield* daten; }
        })
      };
      const rows = name === 'artikel' ? [{ _id: artikelId, name: 'Trainingsshirt' }]
        : name === 'groessen' ? [] : name === 'benutzer' ? [{ _id: id, vorname: 'Test', nachname: 'User' }] : [];
      return { find: () => ({ project: () => ({ toArray: async () => rows }) }) };
    });
    const response = await GET({
      locals: { benutzer: { id: id.toString(), vereinId: 'verein-1', rolle: 'admin' } },
      url: new URL('http://localhost/api/lagerbewegungen/gesamt?suche=gesuchter-beleg')
    } as never);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.bewegungen).toHaveLength(1);
    expect(result.bewegungen[0].referenzId).toBe('gesuchter-beleg');
    expect(limitAufgerufen).toBe(false);
  });
});

describe('Gesamtjournal – Vorschau und Stammdaten',()=>{
  const aid=new ObjectId(), gid=new ObjectId(), uid=new ObjectId();
  const event=(query='')=>({locals:{benutzer:{vereinId:'verein-1',rolle:'admin'}},url:new URL('http://localhost/?'+query)}) as never;
  function setup(count=1){
    const movement={_id:new ObjectId(),artikelId:aid.toString(),groesseId:gid.toString(),benutzerId:uid.toString(),art:'verkauf',mengeDelta:-1,zeitpunkt:new Date()};
    const cursor={sort:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),async *[Symbol.asyncIterator](){for(let i=0;i<count;i++)yield movement;}};
    const find=vi.fn(()=>cursor);
    const findOne=vi.fn(async()=>({_id:aid}));
    const rows:Record<string,unknown[]>={artikel:[{_id:aid,name:'Shirt'},{_id:new ObjectId()}],groessen:[{_id:gid,bezeichnung:'M'},{_id:new ObjectId()}],benutzer:[{_id:uid,nachname:'Test'}]};
    mocks.collection.mockImplementation((name:string)=>name==='lagerbewegungen'?{find}:{findOne,find:()=>({project:()=>({toArray:async()=>rows[name]??[]})})});
    return {cursor,find,findOne};
  }
  it('begrenzt Vorschau auf 200 Einträge und löst Namen auf',async()=>{
    const {cursor,find}=setup(201);
    const r=await GET(event());expect(r.status).toBe(200);
    const data=await r.json();expect(data.bewegungen).toHaveLength(200);
    expect(data.bewegungen[0]).toMatchObject({artikel:'Shirt',groesse:'M',benutzer:'Test',referenzTyp:'',referenzId:''});
    expect(cursor.limit).toHaveBeenCalledWith(200);expect(find).toHaveBeenCalledWith({vereinId:'verein-1'});
  });
  it('verweigert fremden Artikel',async()=>{
    const {findOne,find}=setup();findOne.mockResolvedValueOnce(null as never);
    expect((await GET(event('artikelId='+aid))).status).toBe(404);expect(find).not.toHaveBeenCalled();
    expect(findOne).toHaveBeenCalledWith({vereinId:'verein-1',_id:aid});
  });
  it('filtert vorhandenen Artikel',async()=>{
    const {find}=setup();expect((await GET(event('artikelId='+aid))).status).toBe(200);
    expect(find).toHaveBeenCalledWith({vereinId:'verein-1',artikelId:aid.toString()});
  });
  it.each(['shirt','m','verkauf','test'])('findet Treffer über Stammdaten %s',async suche=>{
    const {cursor}=setup();const r=await GET(event('suche='+suche));
    expect((await r.json()).bewegungen).toHaveLength(1);expect(cursor.limit).not.toHaveBeenCalled();
  });
  it('begrenzt auch Suchtreffer auf 200',async()=>{
    const {cursor}=setup(201);const r=await GET(event('suche=shirt'));
    expect((await r.json()).bewegungen).toHaveLength(200);expect(cursor.limit).not.toHaveBeenCalled();
  });
  it('verweigert fehlende Berechtigung',async()=>{
    mocks.permission.mockReturnValue(new Response(null,{status:403}));
    expect((await GET(event())).status).toBe(403);expect(mocks.collection).not.toHaveBeenCalled();
  });
});
