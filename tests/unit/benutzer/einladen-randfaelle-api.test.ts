import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';

const m = vi.hoisted(() => ({
  permission: vi.fn(), collection: vi.fn(), send: vi.fn(), token: vi.fn(), expiry: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
vi.mock('../../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
vi.mock('../../../src/lib/server/email', () => ({ versendeEinladung: m.send }));
vi.mock('../../../src/lib/server/einladungen', () => ({ erstelleEinladungstoken: m.token, berechneAblaufdatum: m.expiry }));
import { GET, POST } from '../../../src/routes/api/benutzer/einladen/+server';
import { POST as erneutPOST } from '../../../src/routes/api/benutzer/einladen/[id]/erneut/+server';
const vereinId = '507f1f77bcf86cd799439011';
const insertedId = new ObjectId('507f1f77bcf86cd799439012');
const locals = { benutzer: { vereinId, rolle: 'admin' } } as any;
const valid = { vorname: ' Ada ', nachname: ' Lovelace ', email: ' ADA@EXAMPLE.CH ', rolle: 'leiter' };
const post = (data: unknown, raw = false) => POST({ locals, request: new Request('https://clubmatiq.test/api/benutzer/einladen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? String(data) : JSON.stringify(data) }) } as any);
const get = () => GET({ locals } as any);
let users: any, invites: any, clubs: any;
beforeEach(() => {
  vi.clearAllMocks();
  m.permission.mockReturnValue(null);
  m.token.mockReturnValue({ token: 'my-token', tokenHash: 'my-hash' });
  m.expiry.mockReturnValue(new Date('2030-01-01'));
  m.send.mockResolvedValue({ id: 'resend-123' });
  users = { findOne: vi.fn().mockResolvedValue(null) };
  invites = { findOne: vi.fn().mockResolvedValue(null), insertOne: vi.fn().mockResolvedValue({ insertedId }), updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }), find: vi.fn() };
  clubs = { findOne: vi.fn().mockResolvedValue({ name: 'Turnverein' }) };
  m.collection.mockImplementation((name: string) => ({ benutzer: users, einladungen: invites, vereine: clubs } as any)[name]);
  delete process.env.PUBLIC_APP_URL;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Benutzereinladungen POST – Validierung', () => {
  it('prüft die Berechtigung zuerst', async () => { m.permission.mockReturnValue(new Response('verboten', { status: 403 })); expect((await post(valid)).status).toBe(403); expect(m.collection).not.toHaveBeenCalled(); });
  it('weist ungültiges JSON zurück', async () => { expect((await post('{', true)).status).toBe(400); });
  it.each([null, [], 123, 'test', true])('weist nicht-objektartige Eingabe %s zurück', async (input) => { expect((await post(input)).status).toBe(400); });
  it.each([
    {}, { ...valid, vorname: '' }, { ...valid, nachname: ' ' }, { ...valid, email: '' }, { ...valid, rolle: null },
    { ...valid, vorname: 12 }, { ...valid, nachname: 12 }, { ...valid, email: 12 },
  ])('weist fehlende Pflichtfelder zurück %#', async (input) => { expect((await post(input)).status).toBe(400); });
  it.each([
    { ...valid, vorname: 'x'.repeat(101) }, { ...valid, nachname: 'x'.repeat(101) }, { ...valid, email: 'a'.repeat(250) + '@b.ch' },
    { ...valid, email: 'kein-at-zeichen' }, { ...valid, email: 'x@y' }
  ])('weist ungültige Namen/E-Mails zurück %#', async (input) => { expect((await post(input)).status).toBe(400); });
  it('weist unbekannte Rollen zurück', async () => { expect((await post({ ...valid, rolle: 'superuser' })).status).toBe(400); });
  it.each(['admin', 'materialverantwortlich', 'leiter', 'mitglied'])('akzeptiert Rolle %s', async (rolle) => { expect((await post({ ...valid, rolle })).status).toBe(201); });
});

describe('Benutzereinladungen POST – Datenbank und Versand', () => {
  it('weist bestehende Benutzer zurück', async () => { users.findOne.mockResolvedValue({ _id: insertedId }); expect((await post(valid)).status).toBe(409); expect(invites.insertOne).not.toHaveBeenCalled(); });
  it('weist gültige offene Einladungen zurück', async () => { invites.findOne.mockResolvedValue({ _id: insertedId }); expect((await post(valid)).status).toBe(409); expect(invites.insertOne).not.toHaveBeenCalled(); });
  it('speichert und versendet Einladung mit normalisierten Daten', async () => {
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ erfolg: true, einladung: { id: insertedId.toString(), email: 'ada@example.ch', rolle: 'leiter', versendet: true }, versandFehler: false });
    expect(invites.insertOne).toHaveBeenCalledWith(expect.objectContaining({ vereinId, email: 'ada@example.ch', vorname: 'Ada', nachname: 'Lovelace', status: 'offen', tokenHash: 'my-hash' }));
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.ch', verein: 'Turnverein', link: 'https://clubmatiq.test/einladung?token=my-token' }));
    expect(invites.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: insertedId, vereinId }), { $set: expect.objectContaining({ resendId: 'resend-123' }) });
  });
  it('verwendet PUBLIC_APP_URL ohne abschliessenden Slash', async () => { process.env.PUBLIC_APP_URL = 'https://clubmatiq.example/'; await post(valid); expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ link: 'https://clubmatiq.example/einladung?token=my-token' })); });
  it('verwendet Ersatzname, falls Vereinsname fehlt', async () => { clubs.findOne.mockResolvedValue({ name: 123 }); await post(valid); expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ verein: 'deinem Verein' })); });
  it('meldet Versandfehler, bewahrt aber die gespeicherte Einladung', async () => { m.send.mockRejectedValue(new Error('mail')); const r = await post(valid); expect(r.status).toBe(201); expect(await r.json()).toMatchObject({ versandFehler: true, einladung: { versendet: false } }); expect(invites.insertOne).toHaveBeenCalled(); });
  it('meldet Updatefehler als Versandfehler', async () => { invites.updateOne.mockRejectedValue(new Error('update')); const r = await post(valid); expect(r.status).toBe(201); expect((await r.json()).versandFehler).toBe(true); });
  it('meldet Datenbankfehler mit 500', async () => { users.findOne.mockRejectedValue(new Error('db')); expect((await post(valid)).status).toBe(500); });
  it('meldet Insertfehler mit 500', async () => { invites.insertOne.mockRejectedValue(new Error('db')); expect((await post(valid)).status).toBe(500); });
});

describe('Benutzereinladungen GET', () => {
  it('prüft die Berechtigung', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await get()).status).toBe(403); });
  it('liefert offene, abgelaufene und angenommene Einladungen', async () => {
    const toArray = vi.fn().mockResolvedValue([
      { _id: insertedId, vorname: 'A', nachname: 'B', email: 'a@b.ch', rolle: 'leiter', status: 'offen', erstelltAm: new Date('2020-01-01'), ablaufdatum: new Date('2999-01-01') },
      { _id: insertedId, vorname: 'C', nachname: 'D', email: 'c@d.ch', rolle: 'mitglied', status: 'offen', erstelltAm: new Date('2020-01-01'), ablaufdatum: new Date('2020-01-01'), versendetAm: new Date('2020-01-01') },
      { _id: insertedId, vorname: 'E', nachname: 'F', email: 'e@f.ch', rolle: 'admin', status: 'angenommen', erstelltAm: new Date('2020-01-01'), ablaufdatum: new Date('2020-01-01') }
    ]);
    const sort = vi.fn().mockReturnValue({ toArray }); invites.find.mockReturnValue({ sort });
    const r = await get(); expect(r.status).toBe(200);
    const data = await r.json(); expect(data.map((x: any) => x.status)).toEqual(['offen', 'abgelaufen', 'angenommen']); expect(data[0].versendet).toBe(false); expect(data[1].versendet).toBe(true); expect(data[0].versendetAm).toBeNull();
    expect(invites.find).toHaveBeenCalledWith({ vereinId }); expect(sort).toHaveBeenCalledWith({ erstelltAm: -1 });
  });
  it('liefert leere Liste', async () => { invites.find.mockReturnValue({ sort: () => ({ toArray: async () => [] }) }); expect(await (await get()).json()).toEqual([]); });
  it('meldet Datenbankfehler mit 500', async () => { invites.find.mockImplementation(() => { throw new Error('db'); }); expect((await get()).status).toBe(500); });
});


const againvereinId = '507f1f77bcf86cd799439011'; const againid = '507f1f77bcf86cd799439012';
const againlocals = { benutzer: { againvereinId, rolle: 'admin' } } as any;
const againpost = (theId = againid) => erneutPOST({ locals: againlocals, params: { id: theId }, request: new Request('https://clubmatiq.test/api/benutzer/einladen/' + theId + '/erneut', { method: 'POST' }) } as any);
let againinvites: any, againclubs: any, againinvitation: any;
describe('Einladungen – erneut versenden', () => {
 beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {});
  m.permission.mockReturnValue(null); m.send.mockResolvedValue({ againid: 'resend-new' }); m.token.mockReturnValue({ token: 'new-token', tokenHash: 'new-hash' }); m.expiry.mockReturnValue(new Date('2030-01-01'));
  againinvitation = { _id: new ObjectId(againid), vereinId: againvereinId, email: 'ada@example.ch', vorname: 'Ada', status: 'offen' };
  againinvites = { findOne: vi.fn().mockImplementation(async () => againinvitation), updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }) };
  againclubs = { findOne: vi.fn().mockResolvedValue({ name: 'Turnverein' }) };
  m.collection.mockImplementation((name: string) => ({ einladungen: againinvites, vereine: againclubs } as any)[name]);
  delete process.env.PUBLIC_APP_URL;
});
describe('Einladung erneut versenden', () => {
  it('prüft Berechtigung zuerst', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await againpost()).status).toBe(403); expect(m.collection).not.toHaveBeenCalled(); });
  it('weist ungültige ID zurück', async () => { expect((await againpost('invalid')).status).toBe(400); });
  it('weist fehlende offene Einladung zurück', async () => { againinvites.findOne.mockResolvedValue(null); expect((await againpost()).status).toBe(404); });
  it('begrenzt wiederholten Versand innerhalb einer Minute', async () => { againinvitation.versendetAm = new Date(); expect((await againpost()).status).toBe(429); expect(m.send).not.toHaveBeenCalled(); });
  it('versendet ohne früheres Versanddatum', async () => {
    const r = await againpost(); expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ erfolg: true });
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.ch', vorname: 'Ada', verein: 'Turnverein', link: 'https://clubmatiq.test/einladung?token=new-token' }));
    expect(againinvites.updateOne).toHaveBeenCalledWith({ _id: againinvitation._id, againvereinId, status: 'offen' }, { $set: expect.objectContaining({ tokenHash: 'new-hash', resendId: 'resend-new', versendetAm: expect.any(Date) }) });
  });
  it('erlaubt Versand nach mehr als einer Minute', async () => { againinvitation.versendetAm = new Date(Date.now() - 61_000); expect((await againpost()).status).toBe(200); });
  it('verwendet konfigurierte URL und Vereinsersatzname', async () => { process.env.PUBLIC_APP_URL = 'https://app.example/'; againclubs.findOne.mockResolvedValue(null); expect((await againpost()).status).toBe(200); expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ verein: 'deinem Verein', link: 'https://app.example/einladung?token=new-token' })); });
  it('liefert 502 bei Versandfehler', async () => { m.send.mockRejectedValue(new Error('mail')); expect((await againpost()).status).toBe(502); expect(againinvites.updateOne).not.toHaveBeenCalled(); });
  it('liefert 502 bei Updatefehler', async () => { againinvites.updateOne.mockRejectedValue(new Error('db')); expect((await againpost()).status).toBe(502); });
});

});
