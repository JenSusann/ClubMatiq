import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ insertOne: vi.fn(), uploadStream: vi.fn(), destroy: vi.fn() }));
vi.mock('cloudinary', () => ({ v2: { config: vi.fn(), uploader: { upload_stream: m.uploadStream, destroy: m.destroy } } }));
vi.mock('../../../src/lib/server/mongodb', () => ({ db: { collection: vi.fn(() => ({ insertOne: m.insertOne })) } }));

const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0]);
const jpeg = new Uint8Array([255,216,255,0,1]);
const webp = new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]);
function evt(data?: Uint8Array, type='image/png', logged=true, field='foto') {
 const fd = new FormData();
 if (data) fd.append(field, new File([data], 'foto.bin', { type }));
 return { locals: { benutzer: logged ? { id:'u1', vereinId:'v1', rolle:'mitglied' } : null },
   request: new Request('http://localhost/api/upload', { method:'POST', body:fd }) };
}
beforeEach(() => { vi.clearAllMocks(); m.insertOne.mockResolvedValue({ insertedId: 'x' });
 m.uploadStream.mockImplementation((_opts, cb) => ({ end: () => cb(null,{secure_url:'https://res.cloudinary.com/test/image.png',public_id:'test/1'}) }));
 m.destroy.mockResolvedValue({ result:'ok' });
});
import * as route0 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-cloudinary-error.integration.test.ts
describe('Cloudinary-Ausfall',()=>{it('liefert 500 und registriert kein Bild',async()=>{const spy=vi.spyOn(console,'error').mockImplementation(()=>{});try {m.uploadStream.mockImplementation((_opts,cb)=>({end:()=>cb(new Error('cloud unavailable'))}));const response=await route0.POST(evt(png) as never);expect(response.status).toBe(500);expect(m.insertOne).not.toHaveBeenCalled();}finally{spy.mockRestore();}});});
import * as route1 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-db-rollback.integration.test.ts
describe('DB-Fehler nach Upload',()=>{it('löscht Cloudinary-Bild nach DB-Fehler',async()=>{const spy=vi.spyOn(console,'error').mockImplementation(()=>{});try {m.insertOne.mockRejectedValue(new Error('DB offline'));const response=await route1.POST(evt(png) as never);expect(response.status).toBe(500);expect(m.destroy).toHaveBeenCalledWith('test/1',{resource_type:'image'});}finally{spy.mockRestore();}});});
import * as route2 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-empty.integration.test.ts
describe('Upload empty', () => { it('prüft Upload', async () => { const response=await route2.POST(evt(new Uint8Array()) as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route3 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-mime.integration.test.ts
describe('Upload mime', () => { it('prüft Upload', async () => { const response=await route3.POST(evt(png,'application/pdf') as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route4 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-missing.integration.test.ts
describe('Upload missing', () => { it('prüft Upload', async () => { const response=await route4.POST(evt() as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route5 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-oversize.integration.test.ts
describe('Dateigrösse',()=>{it('lehnt mehr als 5 MB ab',async()=>{const response=await route5.POST(evt(new Uint8Array(5*1024*1024+1)) as never);expect(response.status).toBe(400);expect(m.uploadStream).not.toHaveBeenCalled();});});
import * as route6 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-signature-jpeg.integration.test.ts
describe('Upload signature-jpeg', () => { it('prüft Upload', async () => { const response=await route6.POST(evt(png,'image/jpeg') as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route7 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-signature-png.integration.test.ts
describe('Upload signature-png', () => { it('prüft Upload', async () => { const response=await route7.POST(evt(jpeg,'image/png') as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route8 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-signature-webp.integration.test.ts
describe('Upload signature-webp', () => { it('prüft Upload', async () => { const response=await route8.POST(evt(png,'image/webp') as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route9 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-success-jpeg.integration.test.ts
describe('Upload success-jpeg', () => { it('prüft Upload', async () => { const response=await route9.POST(evt(jpeg,'image/jpeg') as never); expect(response.status).toBe(201); expect(m.uploadStream).toHaveBeenCalledOnce(); }); });

import * as route10 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-success-png.integration.test.ts
describe('Upload success-png', () => { it('prüft Upload', async () => { const response=await route10.POST(evt(png) as never); expect(response.status).toBe(201); expect(m.insertOne).toHaveBeenCalledOnce(); expect((await response.json()).foto.publicId).toBe('test/1'); }); });

import * as route11 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-success-webp.integration.test.ts
describe('Upload success-webp', () => { it('prüft Upload', async () => { const response=await route11.POST(evt(webp,'image/webp') as never); expect(response.status).toBe(201); expect(m.uploadStream).toHaveBeenCalledOnce(); }); });

import * as route12 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-unauth.integration.test.ts
describe('Upload unauth', () => { it('prüft Upload', async () => { const response=await route12.POST(evt(png,'image/png',false) as never); expect(response.status).toBe(401); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

import * as route13 from '../../../src/routes/api/upload/+server';

// Ursprüngliche Datei: 22-upload-wrong-field.integration.test.ts
describe('Upload wrong-field', () => { it('prüft Upload', async () => { const response=await route13.POST(evt(png,'image/png',true,'bild') as never); expect(response.status).toBe(400); expect(m.uploadStream).not.toHaveBeenCalled(); }); });

