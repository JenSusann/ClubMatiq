import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  find: vi.fn(), sort: vi.fn(), limit: vi.fn(), toArray: vi.fn(),
  createIndex: vi.fn(), bulkWrite: vi.fn(), pruefe: vi.fn()
}));
vi.mock('../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({
    find: m.find, createIndex: m.createIndex, bulkWrite: m.bulkWrite
  })) }
}));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.pruefe }));
import { GET, POST } from '../../src/routes/api/mitglieder/+server';

const benutzer = { id: 'user-1', vereinId: 'verein-1', rolle: 'admin' };
const member = (vorname: string, nachname: string, clubdeskId: string) => ({
  _id: 'mongo-id', vorname, nachname, clubdeskId, anrede: '', adresse: '', ort: '', plz: '', status: '', aktiv: true
});
const get = (suche?: string) => GET({ locals: { benutzer }, url: new URL('http://localhost/api/mitglieder' + (suche === undefined ? '' : '?suche=' + encodeURIComponent(suche))) } as never);
const post = (csv: string, type = 'text/csv') => {
  const fd = new FormData();
  fd.set('datei', new File([csv], 'mitglieder.csv', { type }));
  return POST({ locals: { benutzer }, request: { headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }), formData: async () => fd } } as never);
};
const message = async (promise: Response | Promise<Response>, status: number, contains: string) => {
  try { await promise; throw new Error('Expected HTTP error'); }
  catch (e: any) { expect(e.status).toBe(status); expect(e.body?.message ?? e.message).toContain(contains); }
};

beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockReturnValue({ sort: m.sort });
  m.sort.mockReturnValue({ limit: m.limit });
  m.limit.mockReturnValue({ toArray: m.toArray });
  m.toArray.mockResolvedValue([]);
  m.createIndex.mockResolvedValue('index');
  m.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });
  m.pruefe.mockReturnValue(null);
});

describe('Paket 18 – Mitglieder CSV und Suchfilter', () => {
  it('GET ohne Suchbegriff gibt alle Mitglieder zurück', async () => {
    m.toArray.mockResolvedValue([member('Anna', 'Muster', '123')]);
    const r = await get();
    expect(r.status).toBe(200);
    expect((await r.json())[0].anzeigename).toBe('Anna Muster');
  });
  it('GET filtert Treffer und Nichttreffer nach Name', async () => {
    m.toArray.mockResolvedValue([member('Anna', 'Muster', '123'), member('Max', 'Meier', '456')]);
    const r = await get('muster anna');
    expect((await r.json()).map((v: any) => v.clubdeskId)).toEqual(['123']);
  });
  it('GET akzeptiert leere und getrimmte Suche', async () => {
    m.toArray.mockResolvedValue([member('Anna', 'Muster', '123')]);
    expect((await (await get('   ')).json())).toHaveLength(1);
    expect((await (await get(' ANNA ')).json())).toHaveLength(1);
  });
  it('GET gibt maximal 50 Treffer zurück', async () => {
    m.toArray.mockResolvedValue(Array.from({ length: 60 }, (_, i) => member('Anna', 'Muster', String(i))));
    expect((await (await get()).json())).toHaveLength(50);
  });
  it('GET gibt Berechtigungsfehler unverändert zurück', async () => {
    m.pruefe.mockReturnValueOnce(new Response('verboten', { status: 403 }));
    expect((await get()).status).toBe(403);
  });
  it('POST gibt Berechtigungsfehler unverändert zurück', async () => {
    m.pruefe.mockReturnValueOnce(new Response('verboten', { status: 403 }));
    expect((await post('')).status).toBe(403);
  });
  it('POST verweigert falschen Content-Type', async () => {
    await message(POST({ locals: { benutzer }, request: { headers: new Headers({ 'content-type': 'text/plain' }) } } as never), 400, 'CSV-Datei');
  });
  it('POST verweigert fehlende Datei', async () => {
    await message(POST({ locals: { benutzer }, request: { headers: new Headers({ 'content-type': 'multipart/form-data' }), formData: async () => new FormData() } } as never), 400, 'Keine CSV-Datei');
  });
  it('POST importiert gültige CSV mit optionalen Spalten', async () => {
    const r = await post('[Id];Vorname;Nachname\n100;Anna;Muster');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ erfolg: true, eingelesen: 1 });
    expect(m.bulkWrite).toHaveBeenCalledOnce();
  });
  it('POST verarbeitet BOM, CRLF und Anführungszeichen', async () => {
    const r = await post('\uFEFF[Id];Vorname;Nachname;Ort\r\n100;"Anna; Maria";"Muster";Zürich\r\n');
    expect(r.status).toBe(200);
    expect(m.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('Anna; Maria');
  });
  it('POST verarbeitet escaped Anführungszeichen', async () => {
    const r = await post('[Id];Vorname;Nachname\n100;"An""na";Muster\n');
    expect(r.status).toBe(200);
    expect(m.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('An"na');
  });
  it('POST verweigert nicht geschlossene Anführungszeichen', async () => {
    await message(post('[Id];Vorname;Nachname\n100;"Anna;Muster'), 400, 'Anführungszeichen');
  });
  it('POST verweigert CSV ohne Datensätze', async () => {
    await message(post('[Id];Vorname;Nachname\n'), 400, 'keine Mitglieder');
  });
  it('POST verweigert fehlende Pflichtspalte', async () => {
    await message(post('[Id];Vorname\n100;Anna'), 400, 'Pflichtspalte');
  });
  it('POST verweigert fehlende ClubDesk-ID', async () => {
    await message(post('[Id];Vorname;Nachname\n;Anna;Muster'), 400, 'Ungültiger Mitgliedereintrag');
  });
  it('POST verweigert fehlende Vor- und Nachnamen', async () => {
    await message(post('[Id];Vorname;Nachname\n100;;'), 400, 'Ungültiger Mitgliedereintrag');
  });
  it('POST verweigert doppelte ClubDesk-ID', async () => {
    await message(post('[Id];Vorname;Nachname\n100;Anna;Muster\n100;Max;Meier'), 400, 'Doppelte ClubDesk-ID');
  });
  it('POST berechnet aktualisierte und unveränderte Einträge', async () => {
    m.bulkWrite.mockResolvedValue({ upsertedCount: 0, modifiedCount: 1, matchedCount: 2 });
    const r = await post('[Id];Vorname;Nachname\n100;Anna;Muster');
    expect(await r.json()).toMatchObject({ aktualisiert: 1, unveraendert: 1 });
  });
});
