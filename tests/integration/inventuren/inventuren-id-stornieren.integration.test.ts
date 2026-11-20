
// Diese beiden Mocks gelten nur für diese Tests; andere Tests nutzen weiterhin clubmatiq_test.
vi.mock('../../../src/lib/server/mongodb', async () => {
 const { m } = await import('../helper');
 return { db: { collection: m.collection }, client: { startSession: () => ({ withTransaction: m.withTransaction, endSession: m.endSession }) } };
});
vi.mock('../../../src/lib/server/berechtigungen', async () => {
 const { m } = await import('../helper');
 return { pruefeBerechtigung: m.permission };
});
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {reset,inventory,position,docs,ev,m,ID,ART,SIZE} from '../helper';
import * as route0 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-abgeschlossene-inventur.integration.test.ts
describe('abgeschlossene-inventur',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position()];
const res=await route0.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toEqual(1);});});

import * as route1 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-inventur-falscher-status.integration.test.ts
describe('inventur-falscher-status',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory("storniert")
const res=await route1.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Diese Inventur kann nicht mehr storniert werden.");});});

import * as route2 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-inventur-fehlt.integration.test.ts
describe('inventur-fehlt',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{
const res=await route2.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Inventur nicht gefunden.");});});

import * as route3 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-kein-delta.integration.test.ts
describe('kein-delta',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position({istBestand:10})];
const res=await route3.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toEqual(0);});});

import * as route4 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-konflikt-groessenstruktur.integration.test.ts
describe('konflikt-groessenstruktur',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position(),position({_id:new ObjectId(),groesseId:SIZE})];
const res=await route4.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Inkonsistente Grössenstruktur in der Inventur.");});});

import * as route5 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-korrektur-fremde-position.integration.test.ts
describe('korrektur-fremde-position',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position()];docs.inventurprotokoll=[{vereinId:ID,inventurId:ID,aktion:"nachtraeglich_korrigiert",positionId:"fremd",alterIstBestand:8,neuerIstBestand:9,differenz:1}];
const res=await route5.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Korrekturprotokoll verweist auf eine fehlende Position.");});});

import * as route6 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-korrektur-istbestand-konflikt.integration.test.ts
describe('korrektur-istbestand-konflikt',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position()];docs.inventurprotokoll=[{vereinId:ID,inventurId:ID,aktion:"nachtraeglich_korrigiert",positionId:SIZE,alterIstBestand:7,neuerIstBestand:9,differenz:2}];
const res=await route6.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Der Ist-Bestand stimmt nicht mit dem Korrekturprotokoll überein.");});});

import * as route7 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-korrekturprotokoll-unvollstaendig.integration.test.ts
describe('korrekturprotokoll-unvollstaendig',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory("abgeschlossen",{anzahlNachtraeglicheKorrekturen:1});docs.inventurpositionen=[position()];
const res=await route7.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Das Korrekturprotokoll ist unvollständig. Stornierung abgebrochen.");});});

import * as route8 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-mehrere-positionen.integration.test.ts
describe('mehrere-positionen',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position(),position({ _id:new ObjectId(),artikelId:ID,sollBestand:3,istBestand:1})];
const res=await route8.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toEqual(2);});});

import * as route9 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-nachtraegliche-korrektur.integration.test.ts
describe('nachtraegliche-korrektur',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position()];docs.inventurprotokoll=[{vereinId:ID,inventurId:ID,aktion:"nachtraeglich_korrigiert",positionId:SIZE,alterIstBestand:7,neuerIstBestand:8,differenz:1}];
const res=await route9.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toEqual(1);});});

import * as route10 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-offene-inventur.integration.test.ts
describe('offene-inventur',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory("offen")
const res=await route10.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toEqual(0);});});

import * as route11 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-positionen-fehlen.integration.test.ts
describe('positionen-fehlen',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();
const res=await route11.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Die Inventurpositionen sind unvollständig.");});});

import * as route12 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-positionenzahl-abweichend.integration.test.ts
describe('positionenzahl-abweichend',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory("abgeschlossen",{anzahlPositionen:2});docs.inventurpositionen=[position()];
const res=await route12.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Die Inventurpositionen sind unvollständig.");});});

import * as route13 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-sperre-fehlgeschlagen.integration.test.ts
describe('sperre-fehlgeschlagen',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory(); m.collection.mockImplementationOnce(()=>({findOne:async()=>docs.inventuren[0],updateOne:async()=>({modifiedCount:0})}));
const res=await route13.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Die Inventur wurde zwischenzeitlich verändert.");});});

import * as route14 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-ungueltige-artikelid.integration.test.ts
describe('ungueltige-artikelid',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position({artikelId:"no"})];
const res=await route14.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Ungültige Inventurposition: Rückbuchung nicht möglich.");});});

import * as route15 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-ungueltige-groesse.integration.test.ts
describe('ungueltige-groesse',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position({groesseId:"invalid"})];
const res=await route15.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Ungültige Grösse in der Inventurposition.");});});

import * as route16 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-ungueltige-istmenge.integration.test.ts
describe('ungueltige-istmenge',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position({istBestand:null})];
const res=await route16.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Ungültige Inventurposition: Rückbuchung nicht möglich.");});});

import * as route17 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-ungueltige-sollmenge.integration.test.ts
describe('ungueltige-sollmenge',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position({sollBestand:-1})];
const res=await route17.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Ungültige Inventurposition: Rückbuchung nicht möglich.");});});

import * as route18 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-ungueltiger-korrektureintrag.integration.test.ts
describe('ungueltiger-korrektureintrag',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position()];docs.inventurprotokoll=[{vereinId:ID,inventurId:ID,aktion:"nachtraeglich_korrigiert",positionId:"abc",alterIstBestand:-1,neuerIstBestand:4,differenz:5}];
const res=await route18.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Ungültiger Eintrag im Korrekturprotokoll.");});});

import * as route19 from '../../../src/routes/api/inventuren/[id]/stornieren/+server';

// Ursprüngliche Datei: 29-inventur-variante-erfolgreich.integration.test.ts
describe('variante-erfolgreich',()=>{beforeEach(reset);it('prüft den Inventurstorno',async()=>{inventory();docs.inventurpositionen=[position({groesseId:SIZE})];
const res=await route19.POST(ev({begruendung:'Korrektur notwendig'}) as never);expect(res.status).toBe(200);expect((await res.json()).anzahlRueckbuchungen).toEqual(1);});});

