import { describe,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({command:vi.fn()}));vi.mock('../../../src/lib/server/mongodb',()=>({db:{command:m.command}}));
import * as route0 from '../../../src/routes/api/test-db/+server';

// Ursprüngliche Datei: 22-db-ping-error.integration.test.ts
describe('DB Ping failure',()=>{it('liefert 500',async()=>{const spy=vi.spyOn(console,'error').mockImplementation(()=>{});try{m.command.mockRejectedValueOnce(new Error('offline'));const response=await route0.GET();expect(response.status).toBe(500);expect((await response.json()).erfolg).toBe(false);}finally{spy.mockRestore();}});});
import * as route1 from '../../../src/routes/api/test-db/+server';

// Ursprüngliche Datei: 22-db-ping-success.integration.test.ts
describe('DB Ping',()=>{it('liefert Erfolg bei Ping',async()=>{m.command.mockResolvedValueOnce({ok:1});const response=await route1.GET();expect(response.status).toBe(200);expect((await response.json()).erfolg).toBe(true);expect(m.command).toHaveBeenCalledWith({ping:1});});});
