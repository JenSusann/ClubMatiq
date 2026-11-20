
// Diese beiden Mocks gelten nur für diese Tests; andere Tests nutzen weiterhin clubmatiq_test.
vi.mock('../../../../src/lib/server/mongodb', async () => {
 const { m } = await import('../../helper');
 return { db: { collection: m.collection }, client: { startSession: () => ({ withTransaction: m.withTransaction, endSession: m.endSession }) } };
});
vi.mock('../../../../src/lib/server/berechtigungen', async () => {
 const { m } = await import('../../helper');
 return { pruefeBerechtigung: m.permission };
});
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {reset,order,docs,ev,m,ID,ART,SIZE} from '../../helper';
import * as route0 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-bestellen-erfolg.integration.test.ts
describe('bestellen-erfolg',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order("entwurf")
const res=await route0.PATCH(ev({aktion:'bestellen'}) as never);expect(res.status).toBe(200);expect((await res.json()).status).toEqual("bestellt");});});

import * as route1 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-bestellen-falscher-status.integration.test.ts
describe('bestellen-falscher-status',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order("bestellt")
const res=await route1.PATCH(ev({aktion:'bestellen'}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Nur Entwürfe können als bestellt markiert werden.");});});

import * as route2 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-bestellen-fehlt.integration.test.ts
describe('bestellen-fehlt',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{
const res=await route2.PATCH(ev({aktion:'bestellen'}) as never);expect(res.status).toBe(404);expect((await res.json()).fehler).toEqual("Sammelbestellung nicht gefunden.");});});

import * as route3 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-bestand-ungueltig.integration.test.ts
describe('wareneingang-bestand-ungueltig',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order();docs.artikel=[{_id:new ObjectId(ART),vereinId:ID,hatGroessen:false,menge:-1}]
const res=await route3.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:2}]}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Lagerbestand ist ungültig.");});});

import * as route4 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-erfolg.integration.test.ts
describe('wareneingang-erfolg',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order();docs.artikel=[{_id:new ObjectId(ART),vereinId:ID,hatGroessen:false,menge:12}]
const res=await route4.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:2}]}) as never);expect(res.status).toBe(200);expect((await res.json()).status).toEqual("bestellt");});});

import * as route5 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-falscher-status.integration.test.ts
describe('wareneingang-falscher-status',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order("entwurf")
const res=await route5.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:1}]}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Wareneingänge sind nur für bestellte, noch nicht abgeschlossene Bestellungen möglich.");});});

import * as route6 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-fremder-artikel.integration.test.ts
describe('wareneingang-fremder-artikel',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order()
const res=await route6.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ID,groesseId:null,menge:1}]}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Eine gelieferte Position gehört nicht zu dieser Bestellung.");});});

import * as route7 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-reservierung-ungueltig.integration.test.ts
describe('wareneingang-reservierung-ungueltig',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order();docs.artikel=[{_id:new ObjectId(ART),vereinId:ID,hatGroessen:false,menge:12}];docs.vereinskleider_verkaeufe=[{_id:new ObjectId(ID),vereinId:ID,positionen:[{artikelId:ART,groesseId:null,verkaufsart:"bestellung",menge:3,reserviertMenge:5}]}]
const res=await route7.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:3}]}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Kundenbestellmengen oder Reservierungen sind inkonsistent.");});});

import * as route8 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-reservierung.integration.test.ts
describe('wareneingang-reservierung',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order();docs.artikel=[{_id:new ObjectId(ART),vereinId:ID,hatGroessen:false,menge:12}];docs.vereinskleider_verkaeufe=[{_id:new ObjectId(ID),vereinId:ID,positionen:[{artikelId:ART,groesseId:null,verkaufsart:"bestellung",menge:3,reserviertMenge:0,uebergebenMenge:0}]}]
const res=await route8.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:3}]}) as never);expect(res.status).toBe(200);expect((await res.json()).status).toEqual("bestellt");});});

import * as route9 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-uebermenge.integration.test.ts
describe('wareneingang-uebermenge',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order()
const res=await route9.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:6}]}) as never);expect(res.status).toBe(409);expect((await res.json()).fehler).toEqual("Gelieferte Menge für \"Ball\" überschreitet die offene Bestellmenge.");});});

import * as route10 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-varianten-erfolg.integration.test.ts
describe('wareneingang-varianten-erfolg',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order("bestellt",{positionen:[{artikelId:ART,groesseId:SIZE,artikelname:"Jacke",menge:2}]});docs.artikelvarianten=[{vereinId:ID,artikelId:ART,groesseId:SIZE,menge:12}];docs.artikel=[{_id:new ObjectId(ART),vereinId:ID,hatGroessen:true,menge:12}]
const res=await route10.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:SIZE,menge:2}]}) as never);expect(res.status).toBe(200);expect((await res.json()).status).toEqual("geliefert");});});

import * as route11 from '../../../../src/routes/api/vereinskleider/sammelbestellungen/[id]/+server';

// Ursprüngliche Datei: 29-bestellung-wareneingang-vollstaendig.integration.test.ts
describe('wareneingang-vollstaendig',()=>{beforeEach(reset);it('prüft die Sammelbestellung',async()=>{order();docs.artikel=[{_id:new ObjectId(ART),vereinId:ID,hatGroessen:false,menge:12}]
const res=await route11.PATCH(ev({aktion:'wareneingang',positionen:[{artikelId:ART,groesseId:null,menge:5}]}) as never);expect(res.status).toBe(200);expect((await res.json()).status).toEqual("geliefert");});});

