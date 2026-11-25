import { describe, it, expect } from 'vitest';
import { ermittleRiegen } from '../../src/lib/server/riegenzuordnung';

const riegen = [
  { _id: '1', name: 'GETU Meitli', aktiv: true },
  { _id: '2', name: 'Aktive', aktiv: true },
  { _id: '3', name: 'Allround', aktiv: false }
];
const regeln = [
  { gruppe: 'K3/4 Ti', funktion: 'TurnerIn', riegeId: '1' },
  { gruppe: 'Ti/Tu TV', funktion: 'TurnerIn', riegeId: '2' },
  { gruppe: '05_Allround', funktion: null, riegeId: '3' }
];
describe('Issue #71 – Riegenzuordnung', () => {
  it('ordnet Turnende zu', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)'] }, regeln, riegen)).toEqual(['GETU Meitli']));
  it('ignoriert reine Leitungsfunktionen', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (LeiterIn)'] }, regeln, riegen)).toEqual([]));
  it('unterstützt Mehrfachmitgliedschaften', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)', 'Ti/Tu TV (TurnerIn)'] }, regeln, riegen)).toEqual(['Aktive', 'GETU Meitli']));
  it('ignoriert deaktivierte Riegen', () => expect(ermittleRiegen({ clubdeskGruppen: ['05_Allround'] }, regeln, riegen)).toEqual([]));
  it('entfernt doppelte Zuordnungen', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)', 'K3/4 Ti (TurnerIn)'] }, regeln, riegen)).toEqual(['GETU Meitli']));
  it('ignoriert unbekannte Gruppen', () => expect(ermittleRiegen({ clubdeskGruppen: ['Vorstand'] }, regeln, riegen)).toEqual([]));
  it('liefert ohne Gruppen keine Riegen', () => expect(ermittleRiegen({}, regeln, riegen)).toEqual([]));
  it('verwendet strukturierte Gruppendetails bevorzugt', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)'], clubdeskGruppendetails: [{ gruppe: 'K3/4 Ti', funktion: 'LeiterIn' }] }, regeln, riegen)).toEqual([]));
  it('verwendet Hauptgruppe ohne Funktion als Rückfall', () => expect(ermittleRiegen({ clubdeskHauptgruppe: 'Ti/Tu TV' }, [{ gruppe: 'Ti/Tu TV', funktion: null, riegeId: '2' }], riegen)).toEqual(['Aktive']));
  it('umgeht Funktionsprüfung nicht über Hauptgruppe', () => expect(ermittleRiegen({ clubdeskHauptgruppe: 'K3/4 Ti', clubdeskGruppen: ['K3/4 Ti (LeiterIn)'] }, [{ gruppe: 'K3/4 Ti', funktion: null, riegeId: '1' }], riegen)).toEqual([]));
  it('ignoriert Zuordnungen zu nicht vorhandenen Riegen', () => expect(ermittleRiegen({ clubdeskGruppen: ['K3/4 Ti (TurnerIn)'] }, regeln, [])).toEqual([]));
  it('unterscheidet Funktionen mit verschachtelten Klammern', () => expect(ermittleRiegen({ clubdeskGruppen: ['Vorstand (Kassier(in))'] }, [{ gruppe: 'Vorstand', funktion: 'Kassier(in)', riegeId: '2' }], riegen)).toEqual(['Aktive']));
});
