import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ permission: vi.fn(), members: vi.fn(), rules: vi.fn(), groups: vi.fn() }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: (name: string) => ({
  find: name === 'clubdesk_mitglieder' ? m.members : name === 'clubdesk_gruppenzuordnungen' ? m.rules : m.groups
}) } }));
import { GET } from '../../../src/routes/api/vereinskleider/mitglieder/+server';
const benutzer = { vereinId: 'verein-1', rolle: 'materialverantwortlich' };
const get = (suche = 'Anna') => GET({ locals: { benutzer }, url: new URL('http://localhost/api/vereinskleider/mitglieder?suche=' + encodeURIComponent(suche)) } as never);
const member = { _id: 'm1', clubdeskId: '42', vorname: 'Anna', nachname: 'Muster', adresse: 'Testadresse', clubdeskGruppen: ['K3/4 Ti (TurnerIn)'], erstbezugsRabattIds: ['gruppe:juko-tshirt'] };
beforeEach(() => {
  vi.resetAllMocks();
  m.permission.mockReturnValue(null);
  m.members.mockReturnValue({ sort: () => ({ toArray: async () => [member] }) });
  m.rules.mockReturnValue({ toArray: async () => [{ gruppe: 'K3/4 Ti', funktion: 'TurnerIn', riegeId: 'r1' }] });
  m.groups.mockReturnValue({ toArray: async () => [{ _id: 'r1', name: 'GETU Meitli', aktiv: true }] });
});
describe('Issue #71 – Mitgliedersuche im Verkauf', () => {
  it('prüft Verkaufsberechtigung und übernimmt aktuelle Riegen', async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(m.permission).toHaveBeenCalledWith(benutzer, 'verkauf:verwalten');
    expect(await r.json()).toEqual([expect.objectContaining({ anzeigename: 'Anna Muster', riegen: ['GETU Meitli'], erstbezugsRabattIds: ['gruppe:juko-tshirt'] })]);
  });
  it('gibt keine Adressen oder Rohgruppen aus', async () => {
    const [result] = await (await get()).json();
    expect(result).not.toHaveProperty('adresse');
    expect(result).not.toHaveProperty('clubdeskGruppen');
  });
  it('beschränkt alle Abfragen auf den eigenen Verein', async () => {
    await get();
    expect(m.members).toHaveBeenCalledWith({ vereinId: 'verein-1', aktiv: true });
    expect(m.rules).toHaveBeenCalledWith({ vereinId: 'verein-1' });
    expect(m.groups).toHaveBeenCalledWith({ vereinId: 'verein-1', aktiv: true });
  });
  it.each([401, 403])('verweigert Zugriff mit Status %s', async status => {
    m.permission.mockReturnValue(new Response(null, { status }));
    expect((await get()).status).toBe(status);
    expect(m.members).not.toHaveBeenCalled();
  });
  it.each(['', 'A'])('vermeidet Abfragen bei zu kurzer Suche: %s', async suche => {
    expect(await (await get(suche)).json()).toEqual([]);
    expect(m.members).not.toHaveBeenCalled();
  });
  it('verweigert zu lange Suche', async () => expect((await get('a'.repeat(121))).status).toBe(400));
  it.each(['MUSTER ANNA', '42', ' anna '])('findet Mitglied über %s', async suche => expect(await (await get(suche)).json()).toHaveLength(1));
  it('liefert keine Nichttreffer', async () => expect(await (await get('unbekannt')).json()).toEqual([]));
  it('berücksichtigt entfernte Zuordnung sofort', async () => {
    m.rules.mockReturnValue({ toArray: async () => [] });
    expect((await (await get()).json())[0].riegen).toEqual([]);
  });
  it('begrenzt Treffer auf 50', async () => {
    m.members.mockReturnValue({ sort: () => ({ toArray: async () => Array.from({ length: 60 }, (_, i) => ({ ...member, _id: String(i) })) }) });
    expect(await (await get()).json()).toHaveLength(50);
  });
});

describe('Mitgliedersuche – historische Felder und Grenzen (#38)', () => {
  it('vermeidet Abfrage ohne Suchparameter', async () => {
    const r=await GET({locals:{benutzer},url:new URL('http://localhost/api/vereinskleider/mitglieder')} as never);
    expect(await r.json()).toEqual([]); expect(m.members).not.toHaveBeenCalled();
  });
  it('liefert Standardwerte für historische Mitglieder ohne Rabatt und Status', async () => {
    m.members.mockReturnValue({sort:()=>({toArray:async()=>[{_id:'alt',clubdeskId:'123',vorname:'Anna',nachname:''}]})});
    expect(await (await get()).json()).toEqual([{_id:'alt',clubdeskId:'123',vorname:'Anna',nachname:'',anzeigename:'Anna',status:'',erstbezugsRabattIds:[],riegen:[]}]);
  });
  it('erhält vorhandenen Status', async () => {
    m.members.mockReturnValue({sort:()=>({toArray:async()=>[{...member,status:'Aktiv'}]})});
    expect((await (await get()).json())[0].status).toBe('Aktiv');
  });
  it('akzeptiert exakt 120 Zeichen', async () => {
    expect((await get('a'.repeat(120))).status).toBe(200);
    expect(m.members).toHaveBeenCalled();
  });
});
