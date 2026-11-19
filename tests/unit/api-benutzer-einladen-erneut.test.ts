import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
const m = vi.hoisted(() => ({ permission: vi.fn(), collection: vi.fn(), send: vi.fn(), token: vi.fn(), expiry: vi.fn() }));
vi.mock('../../src/lib/server/mongodb', () => ({ db: { collection: m.collection } }));
vi.mock('../../src/lib/server/berechtigungen', () => ({ pruefeBerechtigung: m.permission }));
vi.mock('../../src/lib/server/email', () => ({ versendeEinladung: m.send }));
vi.mock('../../src/lib/server/einladungen', () => ({ erstelleEinladungstoken: m.token, berechneAblaufdatum: m.expiry }));
import { POST } from '../../src/routes/api/benutzer/einladen/[id]/erneut/+server';
const vereinId = '507f1f77bcf86cd799439011'; const id = '507f1f77bcf86cd799439012';
const locals = { benutzer: { vereinId, rolle: 'admin' } } as any;
const post = (theId = id) => POST({ locals, params: { id: theId }, request: new Request('https://clubmatiq.test/api/benutzer/einladen/' + theId + '/erneut', { method: 'POST' }) } as any);
let invites: any, clubs: any, invitation: any;
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {});
  m.permission.mockReturnValue(null); m.send.mockResolvedValue({ id: 'resend-new' }); m.token.mockReturnValue({ token: 'new-token', tokenHash: 'new-hash' }); m.expiry.mockReturnValue(new Date('2030-01-01'));
  invitation = { _id: new ObjectId(id), vereinId, email: 'ada@example.ch', vorname: 'Ada', status: 'offen' };
  invites = { findOne: vi.fn().mockImplementation(async () => invitation), updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }) };
  clubs = { findOne: vi.fn().mockResolvedValue({ name: 'Turnverein' }) };
  m.collection.mockImplementation((name: string) => ({ einladungen: invites, vereine: clubs } as any)[name]);
  delete process.env.PUBLIC_APP_URL;
});
describe('Einladung erneut versenden', () => {
  it('prüft Berechtigung zuerst', async () => { m.permission.mockReturnValue(new Response(null, { status: 403 })); expect((await post()).status).toBe(403); expect(m.collection).not.toHaveBeenCalled(); });
  it('weist ungültige ID zurück', async () => { expect((await post('invalid')).status).toBe(400); });
  it('weist fehlende offene Einladung zurück', async () => { invites.findOne.mockResolvedValue(null); expect((await post()).status).toBe(404); });
  it('begrenzt wiederholten Versand innerhalb einer Minute', async () => { invitation.versendetAm = new Date(); expect((await post()).status).toBe(429); expect(m.send).not.toHaveBeenCalled(); });
  it('versendet ohne früheres Versanddatum', async () => {
    const r = await post(); expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ erfolg: true });
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.ch', vorname: 'Ada', verein: 'Turnverein', link: 'https://clubmatiq.test/einladung?token=new-token' }));
    expect(invites.updateOne).toHaveBeenCalledWith({ _id: invitation._id, vereinId, status: 'offen' }, { $set: expect.objectContaining({ tokenHash: 'new-hash', resendId: 'resend-new', versendetAm: expect.any(Date) }) });
  });
  it('erlaubt Versand nach mehr als einer Minute', async () => { invitation.versendetAm = new Date(Date.now() - 61_000); expect((await post()).status).toBe(200); });
  it('verwendet konfigurierte URL und Vereinsersatzname', async () => { process.env.PUBLIC_APP_URL = 'https://app.example/'; clubs.findOne.mockResolvedValue(null); expect((await post()).status).toBe(200); expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ verein: 'deinem Verein', link: 'https://app.example/einladung?token=new-token' })); });
  it('liefert 502 bei Versandfehler', async () => { m.send.mockRejectedValue(new Error('mail')); expect((await post()).status).toBe(502); expect(invites.updateOne).not.toHaveBeenCalled(); });
  it('liefert 502 bei Updatefehler', async () => { invites.updateOne.mockRejectedValue(new Error('db')); expect((await post()).status).toBe(502); });
});
