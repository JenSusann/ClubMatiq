import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({collections:{} as Record<string,any>,session:{withTransaction:vi.fn(),endSession:vi.fn()},allowed:true}));
vi.mock('../../src/lib/server/mongodb',()=>({db:{collection:(n:string)=>m.collections[n]},client:{startSession:()=>m.session}}));
vi.mock('../../src/lib/server/berechtigungen',()=>({pruefeBerechtigung:()=>m.allowed?null:new Response('{}',{status:403})}));
import {POST} from '../../src/routes/api/inventuren/[id]/zuruecksetzen/+server';
const id='507f1f77bcf86cd799439011';
const context=(inventurId=id)=>({params:{id:inventurId},locals:{benutzer:{id:'u1',vereinId:'v1'}}}) as any;
function setup(){const inventuren={findOne:vi.fn().mockResolvedValue({status:'offen',version:3}),updateOne:vi.fn().mockResolvedValue({modifiedCount:1})};const inventurpositionen={updateMany:vi.fn().mockResolvedValue({matchedCount:4})};const inventurprotokoll={insertOne:vi.fn().mockResolvedValue({})};m.collections={inventuren,inventurpositionen,inventurprotokoll};return {inventuren,inventurpositionen,inventurprotokoll}}
beforeEach(()=>{vi.clearAllMocks();m.allowed=true;m.session.withTransaction.mockImplementation(async(fn:()=>Promise<void>)=>fn());m.session.endSession.mockResolvedValue(undefined)});
async function fails(msg:string){const r=await POST(context());expect(r.status).toBe(409);expect((await r.json()).fehler).toContain(msg);expect(m.session.endSession).toHaveBeenCalledOnce()}
describe('Inventur zurücksetzen',()=>{
 it('prüft Berechtigung',async()=>{setup();m.allowed=false;expect((await POST(context())).status).toBe(403)});
 it('prüft ID',async()=>{setup();expect((await POST(context('invalid'))).status).toBe(400)});
 it('setzt Zählungen und protokolliert',async()=>{const c=setup();const r=await POST(context());expect(r.status).toBe(200);expect((await r.json()).anzahlZurueckgesetzt).toBe(4);expect(c.inventurpositionen.updateMany.mock.calls[0][1].$set).toMatchObject({istBestand:null,bemerkung:'',kontrolliertAm:null,kontrolliertVon:null});expect(c.inventurprotokoll.insertOne.mock.calls[0][0]).toMatchObject({aktion:'zurueckgesetzt',anzahlPositionen:4,versionVorher:3,versionNachher:4});expect(m.session.endSession).toHaveBeenCalledOnce()});
 it('verwendet Version 0 als Standard',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue({status:'offen'});expect((await POST(context())).status).toBe(200);expect(c.inventurprotokoll.insertOne.mock.calls[0][0]).toMatchObject({versionVorher:0,versionNachher:1})});
 it('meldet fehlende Inventur',async()=>{const c=setup();c.inventuren.findOne.mockResolvedValue(null);await fails('nicht gefunden')});
 it.each(['abgeschlossen','storniert'])('verweigert Status %s',async status=>{const c=setup();c.inventuren.findOne.mockResolvedValue({status});await fails('Nur offene')});
 it('erkennt konkurrierende Änderungen',async()=>{const c=setup();c.inventuren.updateOne.mockResolvedValue({modifiedCount:0});await fails('zwischenzeitlich')});
 it('meldet Fehler beim Zurücksetzen der Positionen',async()=>{const c=setup();c.inventurpositionen.updateMany.mockRejectedValue(Error('Update fehlgeschlagen'));await fails('Update fehlgeschlagen')});
 it('meldet Fehler beim Protokollieren',async()=>{const c=setup();c.inventurprotokoll.insertOne.mockRejectedValue(Error('Log fehlgeschlagen'));await fails('Log fehlgeschlagen')});
 it('meldet unerwartete Fehler',async()=>{setup();m.session.withTransaction.mockRejectedValue('unknown');await fails('Inventur konnte nicht zurückgesetzt werden')});
});
