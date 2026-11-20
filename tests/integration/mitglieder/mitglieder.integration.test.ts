import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  permission: vi.fn(),
  toArray: vi.fn(),
  createIndex: vi.fn(),
  bulkWrite: vi.fn(),
  find: vi.fn(),
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: m.permission
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: vi.fn(() => ({
    find: m.find,
    createIndex: m.createIndex,
    bulkWrite: m.bulkWrite
  })) }
}));
import { GET, POST } from '../../../src/routes/api/mitglieder/+server';

const locals = { benutzer: { vereinId: 'verein-1', rolle: 'admin' } };
const url = (search = '') => new URL(`http://localhost/api/mitglieder${search}`);
const get = (search = '') => GET({ locals, url: url(search) } as any);
function post(csv: string, filename = 'mitglieder.csv') {
  const form = new FormData();
  form.append('datei', new File([csv], filename, { type: 'text/csv' }));
  return POST({
    locals,
    request: new Request('http://localhost/api/mitglieder', { method: 'POST', body: form })
  } as any);
}
const header = '[Id];Vorname;Nachname;Anrede;Adresse;Ort;PLZ;Status';
const row = '42;Anna;Muster;Frau;Hauptstrasse 1;Zürich;8000;Aktiv';
const csv = (rows: string[]) => [header, ...rows].join('\n');
const member = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => 'mitglied-1' },
  vereinId: 'verein-1', clubdeskId: '42', vorname: 'Anna',
  nachname: 'Muster', anrede: 'Frau', adresse: 'Hauptstrasse 1',
  ort: 'Zürich', plz: '8000', status: 'Aktiv', aktiv: true,
  ...overrides
});

beforeEach(() => {
  vi.resetAllMocks();
  m.permission.mockReturnValue(null);
  m.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: m.toArray }) }) });
  m.toArray.mockResolvedValue([]);
  m.bulkWrite.mockResolvedValue({ upsertedCount: 1, modifiedCount: 0, matchedCount: 0 });
  m.createIndex.mockResolvedValue('index');
});

describe('Mitglieder – zusätzliche CSV- und Suchzweige', () => {
  it('GET ohne Suche liefert aktive Mitglieder und berechnet Anzeigenamen', async () => {
    m.toArray.mockResolvedValue([member()]);
    const response = await get();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data[0]).toMatchObject({ _id: 'mitglied-1', anzeigename: 'Anna Muster', clubdeskId: '42' });
  });
  it.each([
    ['Vorname', '?suche=anna'],
    ['Nachname', '?suche=muster'],
    ['Nachname Vorname', '?suche=MUSTER%20ANNA'],
    ['ClubDesk-ID', '?suche=42']
  ])('GET findet über %s', async (_, search) => {
    m.toArray.mockResolvedValue([member()]);
    expect((await (await get(search)).json())).toHaveLength(1);
  });
  it('GET filtert Nichttreffer und begrenzt auf 50', async () => {
    m.toArray.mockResolvedValue(Array.from({ length: 60 }, (_, i) => member({
      _id: { toString: () => String(i) }, clubdeskId: String(i)
    })));
    expect((await (await get()).json())).toHaveLength(50);
    expect((await (await get('?suche=unbekannt')).json())).toHaveLength(0);
  });
  it('POST akzeptiert CRLF, BOM, leere Zeilen und ein letztes Feld ohne Zeilenumbruch', async () => {
    const response = await post('\uFEFF' + header + '\r\n\r\n' + row);
    expect(response.status).toBe(200);
    expect((await response.json()).eingelesen).toBe(1);
  });
  it('POST liest Semikolon und Zeilenumbruch innerhalb von Anführungszeichen', async () => {
    const response = await post(csv(['42;"Anna;Maria";"Mus\nter";;;;;']));
    expect(response.status).toBe(200);
    const operations = m.bulkWrite.mock.calls[0][0];
    expect(operations[0].updateOne.update.$set.vorname).toBe('Anna;Maria');
    expect(operations[0].updateOne.update.$set.nachname).toBe('Mus\nter');
  });
  it('POST liest doppelte Anführungszeichen im CSV-Feld', async () => {
    expect((await post(csv(['42;"An""na";Muster;;;;;']))).status).toBe(200);
    expect(m.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('An"na');
  });
  it('POST setzt fehlende optionale Spalten auf leere Zeichenketten', async () => {
    expect((await post('[Id];Vorname;Nachname\n42;Anna;Muster')).status).toBe(200);
    expect(m.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.ort).toBe('');
  });
  it('POST berechnet aktualisierte und unveränderte Mitglieder', async () => {
    m.bulkWrite.mockResolvedValue({ upsertedCount: 0, modifiedCount: 1, matchedCount: 3 });
    const result = await (await post(csv([row]))).json();
    expect(result).toMatchObject({ neu: 0, aktualisiert: 1, unveraendert: 2 });
  });
  it.each([
    ['fehlender Header', 'Vorname;Nachname\nAnna;Muster', 'Pflichtspalte'],
    ['fehlender Vorname', '[Id];Nachname\n42;Muster', 'Pflichtspalte'],
    ['fehlender Nachname', '[Id];Vorname\n42;Anna', 'Pflichtspalte'],
    ['kein Datensatz', header, 'keine Mitglieder'],
    ['leere ID', csv([';Anna;Muster;;;;;']), 'Ungültiger Mitgliedereintrag'],
    ['kein Name', csv(['42;;;;;;;']), 'Ungültiger Mitgliedereintrag'],
    ['doppelte ID', csv([row, row]), 'Doppelte ClubDesk-ID'],
    ['offenes Zitat', csv(['42;"Anna;Muster;;;;;']), 'nicht geschlossenes Anführungszeichen']
  ])('POST weist %s zurück', async (_, input, message) => {
    await expect(post(input)).rejects.toMatchObject({ status: 400, body: { message: expect.stringContaining(message) } });
    expect(m.bulkWrite).not.toHaveBeenCalled();
  });
  it('POST weist Requests ohne Multipart zurück', async () => {
    await expect(POST({
      locals,
      request: new Request('http://localhost/api/mitglieder', {
        method: 'POST', body: '{}', headers: { 'content-type': 'application/json' }
      })
    } as any)).rejects.toMatchObject({ status: 400 });
  });
  it('POST weist fehlendes Datei-Feld zurück', async () => {
    await expect(POST({
      locals,
      request: new Request('http://localhost/api/mitglieder', { method: 'POST', body: new FormData() })
    } as any)).rejects.toMatchObject({ status: 400 });
  });
  it('POST weist Dateien über 5 MB zurück', async () => {
    const form = new FormData();
    form.append('datei', new File(['x'.repeat(5_000_001)], 'gross.csv'));
    await expect(POST({
      locals, request: new Request('http://localhost/api/mitglieder', { method: 'POST', body: form })
    } as any)).rejects.toMatchObject({ status: 413 });
  });
  it('POST verwendet Windows-1252 bei ungültigem UTF-8', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode(header + '\n42;'), 0xE4, ...new TextEncoder().encode('nne;Muster;;;;;')]);
    const form = new FormData();
    form.append('datei', new File([bytes], 'latin.csv'));
    const response = await POST({
      locals, request: new Request('http://localhost/api/mitglieder', { method: 'POST', body: form })
    } as any);
    expect(response.status).toBe(200);
    expect(m.bulkWrite.mock.calls[0][0][0].updateOne.update.$set.vorname).toBe('änne');
  });
});
