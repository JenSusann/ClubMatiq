export type Gruppendetail = { gruppe: string; funktion: string | null };
export type Gruppenmitglied = {
  clubdeskHauptgruppe?: string;
  clubdeskGruppen?: string[];
  clubdeskGruppendetails?: Gruppendetail[];
};
export type Riegenregel = Gruppendetail & { riegeId: { toString(): string } };
export type Zuordnungsriege = { _id: { toString(): string }; name: string; aktiv: boolean };

export function ermittleRiegen(mitglied: Gruppenmitglied, regeln: Riegenregel[], riegen: Zuordnungsriege[]): string[] {
  const details = [...(mitglied.clubdeskGruppendetails ?? (mitglied.clubdeskGruppen ?? []).map(g => {
    const treffer = /^(.+?) \((.*)\)$/.exec(g);
    return treffer ? { gruppe: treffer[1].trim(), funktion: treffer[2].trim() } : { gruppe: g, funktion: null };
  }))];
  if (mitglied.clubdeskHauptgruppe && !details.some(g => g.gruppe === mitglied.clubdeskHauptgruppe)) {
    details.push({ gruppe: mitglied.clubdeskHauptgruppe, funktion: null });
  }
  const ids = new Set(regeln.filter(r => details.some(g => g.gruppe === r.gruppe && g.funktion === r.funktion)).map(r => r.riegeId.toString()));
  return [...new Set(riegen.filter(r => r.aktiv && ids.has(r._id.toString())).map(r => r.name))].sort((a, b) => a.localeCompare(b, 'de-CH'));
}
