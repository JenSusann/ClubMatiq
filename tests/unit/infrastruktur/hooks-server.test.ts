import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';

const { findOne, collection, updateOne } = vi.hoisted(() => ({ findOne: vi.fn(), collection: vi.fn(), updateOne: vi.fn() }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection } }));
import { handle } from '../../../src/hooks.server';

const uid = '507f1f77bcf86cd799439011';
const sid = '507f1f77bcf86cd799439012';
const user = { _id: new ObjectId(uid), vereinId: 'verein-a', vorname: 'Ada', nachname: 'Test', email: 'ada@example.test', rolle: 'admin' };
const session = { _id: new ObjectId(sid), benutzerId: uid, erstelltAm: new Date(), ablaufdatum: new Date(Date.now() + 7200000), letzteAktivitaet: new Date() };
function run(path: string, token?: string) {
  const cookies = { get: vi.fn(() => token), delete: vi.fn() };
  const event = { url: new URL('http://localhost' + path), cookies, locals: { benutzer: { alt: true }, sessionId: 'alt' } };
  const resolve = vi.fn(async () => new Response('OK', { status: 200 }));
  return { event, cookies, resolve, response: handle({ event, resolve } as never) };
}
describe('Server-Hook – Authentifizierung und Routing', () => {
  beforeEach(() => { vi.clearAllMocks(); collection.mockReturnValue({ findOne, updateOne }); updateOne.mockResolvedValue({ matchedCount: 1 }); findOne.mockResolvedValue(null); });
  it.each(['/', '/anmelden', '/registrieren', '/funktionen', '/einladung', '/docs', '/docs/api', '/api/anmelden', '/api/registrieren', '/api/einladung'])('erlaubt öffentliche Route %s', async (path) => {
    const x = run(path); expect((await x.response).status).toBe(200); expect(x.resolve).toHaveBeenCalledOnce(); expect(x.event.locals.benutzer).toBeNull(); expect(x.event.locals.sessionId).toBeNull();
  });
  it.each(['/api/artikel', '/api/ausleihen', '/api/vereine'])('schützt API %s ohne Anmeldung', async path => {
    const x = run(path); const r = await x.response; expect(r.status).toBe(401); expect(await r.json()).toMatchObject({ code: 'NICHT_ANGEMELDET' }); expect(x.resolve).not.toHaveBeenCalled();
  });
  it.each(['/dashboard', '/inventar', '/ausleihen'])('leitet geschützte Seite %s zur Anmeldung um', async path => {
    const x = run(path); await expect(x.response).rejects.toMatchObject({ status: 303, location: '/anmelden?redirect=' + encodeURIComponent(path) });
  });
  it('prüft Session-Token als SHA-256 und lädt angemeldeten Benutzer', async () => {
    findOne.mockImplementation(async (_query: unknown) => collection.mock.calls.at(-1)?.[0] === 'sessions' ? session : user);
    const x = run('/dashboard', 'geheim'); expect((await x.response).status).toBe(200);
    expect(collection).toHaveBeenCalledWith('sessions'); expect(collection).toHaveBeenCalledWith('benutzer');
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: createHash('sha256').update('geheim').digest('hex') }));
    expect(x.event.locals.benutzer).toMatchObject({ id: uid, vereinId: 'verein-a', rolle: 'admin' });
    expect(x.event.locals.sessionId).toBe(sid); expect(x.cookies.delete).not.toHaveBeenCalled();
  });
  it('leitet angemeldete Benutzer von /anmelden aufs Dashboard', async () => {
    findOne.mockImplementation(async () => collection.mock.calls.at(-1)?.[0] === 'sessions' ? session : user);
    const x = run('/anmelden', 'token'); await expect(x.response).rejects.toMatchObject({ status: 303, location: '/dashboard' });
  });
  it('entfernt ungültige Session, wenn kein Datenbankeintrag existiert', async () => {
    const x = run('/'); expect((await x.response).status).toBe(200); // kein Token
    const y = run('/', 'abgelaufen'); expect((await y.response).status).toBe(200);
    expect(y.cookies.delete).toHaveBeenCalledWith('clubmatiq_session', { path: '/' });
  });
  it.each([{ benutzerId: 123 }, { benutzerId: 'ungueltig' }, { benutzerId: null }])('verwirft Session mit ungültiger Benutzer-ID', async bad => {
    findOne.mockResolvedValueOnce({ ...session, ...bad });
    const x = run('/', 'token'); await x.response; expect(x.cookies.delete).toHaveBeenCalledOnce(); expect(collection).not.toHaveBeenCalledWith('benutzer');
  });
  it.each(['/api/artikel', '/api/ausleihen'])('blockiert Geschäfts-API bei Startpasswortwechsel: %s', async path => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...user, passwortwechselErforderlich: true });
    const x = run(path, 'token');
    const r = await x.response;
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: 'PASSWORTWECHSEL_ERFORDERLICH' });
    expect(x.resolve).not.toHaveBeenCalled();
  });
  it('leitet bei Startpasswortwechsel auf die Passwortseite um', async () => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...user, passwortwechselErforderlich: true });
    await expect(run('/dashboard', 'token').response).rejects.toMatchObject({ status: 303, location: '/passwort-aendern' });
  });
  it.each(['/passwort-aendern', '/api/passwort-aendern', '/api/abmelden'])('erlaubt notwendige Route bei Startpasswortwechsel: %s', async path => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...user, passwortwechselErforderlich: true });
    expect((await run(path, 'token').response).status).toBe(200);
  });
  it('Statusabfrage verlängert die Sitzung nicht', async () => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce(user);
    expect((await run('/api/session', 'token').response).status).toBe(200);
    expect(updateOne).not.toHaveBeenCalled();
  });
  it('Aktivität aktualisiert nur die letzte Aktivität', async () => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce(user);
    expect((await run('/api/session/aktivitaet', 'token').response).status).toBe(200);
    expect(updateOne).toHaveBeenCalledWith(expect.objectContaining({ letzteAktivitaet: { $gt: expect.any(Date) }, erstelltAm: { $gt: expect.any(Date) } }), { $max: { letzteAktivitaet: expect.any(Date) } });
  });
  it('verwirft zwischenzeitlich widerrufene Session', async () => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce(user);
    updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    expect((await run('/api/artikel', 'token').response).status).toBe(401);
  });
  it('verwirft Session ohne aktiven Benutzer', async () => {
    findOne.mockResolvedValueOnce(session).mockResolvedValueOnce(null);
    const x = run('/', 'token'); await x.response; expect(x.cookies.delete).toHaveBeenCalledOnce();
  });
});
