import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { MongoClient, ObjectId, Collection } from 'mongodb';
vi.mock('../../../src/lib/server/mongodb', async () => {
  const { config } = await import('dotenv');
  config({ path: '.env' });
  const { MongoClient } = await import('mongodb');
  if (!process.env.MONGODB_TEST_URI) throw new Error('Testdatenbank fehlt');
  const client = new MongoClient(process.env.MONGODB_TEST_URI);
  return { client, db: client.db('clubmatiq_test') };
});
import { client, db } from '../../../src/lib/server/mongodb';
import { POST } from '../../../src/routes/api/vereinskleider/preise/+server';

describe('Issue #128 – gemeinsame Preise mit MongoDB', () => {
  const vereinId = new ObjectId().toString();
  const artikel = new ObjectId();
  const artikelId = artikel.toString();
  const ids = Array.from({length: 3}, () => new ObjectId().toString());
  const send = (verkaufspreis: number) => POST({
    locals: { benutzer: { id: new ObjectId().toString(), vereinId, rolle: 'admin' } },
    request: new Request('http://localhost', { method: 'POST', body: JSON.stringify({ artikelId, preistyp: 'fix', verkaufspreis }) })
  } as never);
  const preise = () => db.collection('vereinskleider_preise').find({ vereinId, artikelId }).sort({groesseId:1}).toArray();
  beforeAll(async () => {
    if (db.databaseName !== 'clubmatiq_test') throw new Error('Falsche Datenbank');
    await client.connect();
    await db.collection('artikel').insertOne({ _id: artikel, vereinId, istVereinskleidung: true, hatGroessen: true });
    await db.collection('artikelvarianten').insertMany(ids.map((groesseId,i) => ({ vereinId, artikelId, groesseId, aktiv: i !== 2, menge: 3, einzelwert: 20 })));
    await db.collection('vereinskleider_preise').insertMany(ids.map((groesseId,i) => ({ vereinId, artikelId, groesseId, preistyp:'fix', verkaufspreis: 30, druckkosten: i+1 })));
  });
  afterAll(async () => {
    try {
      for (const name of ['artikel','artikelvarianten','vereinskleider_preise']) await db.collection(name).deleteMany({ vereinId });
    } finally { await client.close(); }
  });
  it('aktualisiert ausschliesslich aktive Grössen und erhält individuelle Druckkosten und Bestand', async () => {
    expect((await send(115)).status).toBe(200);
    const p = await preise();
    for (let i=0;i<3;i++) expect(p.find(x=>x.groesseId===ids[i])).toMatchObject({ verkaufspreis: i===2?30:115, druckkosten:i+1 });
    const v = await db.collection('artikelvarianten').find({vereinId}).toArray();
    expect(v.every(x=>x.menge===3 && x.einzelwert===20)).toBe(true);
  });
  it('rollt den ersten echten Schreibvorgang bei einem Fehler des zweiten zurück', async () => {
    const vorher = await preise();
    const original = Collection.prototype.updateOne;
    let anzahl = 0;
    const spy = vi.spyOn(Collection.prototype,'updateOne').mockImplementation(async function(this: Collection, ...args: Parameters<typeof original>) {
      if (this.collectionName === 'vereinskleider_preise' && ++anzahl === 2) throw new Error('Simulierter zweiter Schreibfehler');
      return original.apply(this,args);
    });
    try { expect((await send(98)).status).toBe(500); }
    finally { spy.mockRestore(); }
    expect(anzahl).toBe(2);
    expect(await preise()).toEqual(vorher);
  });
});
