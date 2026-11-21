import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(),
  movement: vi.fn(), permission: vi.fn(() => null), endSession: vi.fn()
}));
vi.mock('../../../src/lib/server/mongodb', () => ({
  db: { collection: () => ({
    findOne: mock.findOne, find: mock.find, updateOne: mock.updateOne,
    insertOne: mock.insertOne
  }) },
  client: { startSession: () => ({
    withTransaction: async (cb: () => Promise<unknown>) => cb(),
    endSession: mock.endSession
  }) }
}));
vi.mock('../../../src/lib/server/berechtigungen', () => ({
  pruefeBerechtigung: mock.permission
}));
vi.mock('../../../src/lib/server/lagerbewegungen', () => ({
  protokolliereLagerbewegung: mock.movement
}));
import { GET, POST } from '../../../src/routes/api/vereinskleider/retouren/+server';
const id = '507f1f77bcf86cd799439011';
const request = (body: Record<string, unknown>) => ({
  locals: { benutzer: { vereinId: 'verein-1', id: 'user-1' } },
  request: new Request('http://localhost/api/vereinskleider/retouren', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verkaufId: id, positionsIndex: 0, menge: 1,
      grund: 'falsche_groesse', wiederverkaufbar: true,
      bemerkung: '', datum: '2026-11-21', ...body })
  })
}) as never;
beforeEach(() => {
  vi.clearAllMocks();
  mock.permission.mockReturnValue(null);
});
describe('Issue #69 – Retouren API', () => {
  it('verweigert ungültige Mengen und Daten vor Datenbankzugriff', async () => {
    for (const body of [
      { menge: 0 }, { menge: 1.5 }, { grund: 'unbekannt' },
      { datum: '2026-02-30' }, { wiederverkaufbar: 'ja' },
      { positionsIndex: -1 }
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(mock.findOne).not.toHaveBeenCalled();
  });
  it('verweigert fehlende Verkäufe mandantengetrennt', async () => {
    mock.findOne.mockResolvedValue(null);
    const response = await POST(request({}));
    expect(response.status).toBe(404);
    expect(mock.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-1' }), expect.any(Object)
    );
  });
  it('verweigert nicht nachweisbare Übergaben', async () => {
    mock.findOne.mockResolvedValue({
      positionen: [{ artikelId: id, groesseId: null, menge: 1, einzelpreis: 28 }],
      uebergaben: []
    });
    expect((await POST(request({}))).status).toBe(409);
    expect(mock.updateOne).not.toHaveBeenCalled();
  });
  it('verweigert mehrdeutige Rechnungszuordnung ohne Lagerbewegung', async () => {
    mock.findOne.mockResolvedValue({
      positionen: [{ artikelId: id, groesseId: null, menge: 1, einzelpreis: 28, uebergebenMenge: 1 }],
      uebergaben: [{ positionsIndex: 0, menge: 1 }], retouren: []
    });
    mock.find.mockReturnValue({ toArray: async () => [] });
    expect((await POST(request({}))).status).toBe(409);
    expect(mock.movement).not.toHaveBeenCalled();
  });
  it('prüft Berechtigungen vor Datenbankzugriff', async () => {
    mock.permission.mockReturnValue(new Response('Forbidden', { status: 403 }) as never);
    expect((await POST(request({}))).status).toBe(403);
    expect(mock.findOne).not.toHaveBeenCalled();
  });
  const vorbereiten = () => {
    mock.findOne.mockResolvedValue({
      _id: id, vereinId: 'verein-1',
      positionen: [{ artikelId: id, groesseId: null, menge: 2,
        einzelpreis: 28, verkaufsart: 'direkt' }],
      retouren: [], rabattTotal: 0, rabatte: []
    });
    mock.find.mockImplementation((filter: { rechnungId?: string }) => ({ toArray: async () => filter.rechnungId ? [] : [{
      _id: id, vereinId: 'verein-1', rechnungsnummer: '2026-001',
      positionen: [{ positionsIndex: 0, artikelId: id, groesseId: null,
        menge: 2, einzelpreis: 28 }],
      gesamtbetrag: 56, bezahltBetrag: 56, gutgeschriebenBetrag: 0,
      rueckerstattungOffen: 0
    }] }));
    mock.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mock.insertOne.mockResolvedValue({ insertedId: id });
    mock.movement.mockResolvedValue(undefined);
  };
  it('verbucht eine wiederverkaufbare Direktverkaufsretoure mit Gutschrift und Lagerzugang', async () => {
    vorbereiten();
    const response = await POST(request({}));
    expect(response.status).toBe(201);
    expect(mock.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-1' }),
      expect.objectContaining({ $inc: { menge: 1 } }),
      expect.any(Object)
    );
    expect(mock.insertOne).toHaveBeenCalledTimes(1);
    expect(mock.movement).toHaveBeenCalledTimes(1);
  });
  it('erstellt bei nicht wiederverkaufbarer Ware eine Gutschrift ohne Lagerzugang', async () => {
    vorbereiten();
    const response = await POST(request({ wiederverkaufbar: false, grund: 'defekt' }));
    expect(response.status).toBe(201);
    expect(mock.movement).not.toHaveBeenCalled();
    expect(mock.updateOne).not.toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ $inc: { menge: 1 } }), expect.anything()
    );
    expect(mock.insertOne).toHaveBeenCalledTimes(1);
  });
  it('blockiert bereits vollständig retournierte Positionen ohne zweite Gutschrift', async () => {
    vorbereiten();
    mock.findOne.mockResolvedValue({
      positionen: [{ artikelId: id, groesseId: null, menge: 1,
        einzelpreis: 28, verkaufsart: 'direkt' }],
      retouren: [{ positionsIndex: 0, menge: 1 }]
    });
    expect((await POST(request({}))).status).toBe(409);
    expect(mock.insertOne).not.toHaveBeenCalled();
  });
  it('berücksichtigt eine bereits dokumentierte Rückerstattung bei der nächsten Gutschrift', async () => {
    vorbereiten();
    mock.find.mockImplementation((filter: { rechnungId?: string }) => ({
      toArray: async () => filter.rechnungId ? [{
        betrag: 28, rueckerstattetBetrag: 28
      }] : [{
        _id: id, vereinId: 'verein-1', rechnungsnummer: '2026-001',
        positionen: [{ positionsIndex: 0, artikelId: id, groesseId: null,
          menge: 2, einzelpreis: 28 }],
        gesamtbetrag: 56, bezahltBetrag: 56, gutgeschriebenBetrag: 28,
        rueckerstattungOffen: 0
      }]
    }));
    const antwort = await POST(request({}));
    expect(antwort.status).toBe(201);
    expect(mock.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ vereinId: 'verein-1' }),
      expect.objectContaining({ $set: expect.objectContaining({
        rueckerstattungOffen: 28
      }) }), expect.any(Object)
    );
  });
  it('sperrt inkonsistente Gutschriften ohne Bestandsänderung', async () => {
    vorbereiten();
    mock.find.mockImplementation((filter: { rechnungId?: string }) => ({
      toArray: async () => filter.rechnungId ? [] : [{
        _id: id, vereinId: 'verein-1', rechnungsnummer: '2026-001',
        positionen: [{ positionsIndex: 0, artikelId: id, groesseId: null,
          menge: 2, einzelpreis: 28 }],
        gesamtbetrag: 56, bezahltBetrag: 56, gutgeschriebenBetrag: 28,
        rueckerstattungOffen: 0
      }]
    }));
    expect((await POST(request({}))).status).toBe(409);
    expect(mock.updateOne).not.toHaveBeenCalled();
  });
  it('verhindert eine Gutschrift, wenn der Retourenstand parallel geändert wurde', async () => {
    vorbereiten();
    mock.updateOne.mockImplementation(async (filter: Record<string, unknown>) => {
      if ('retouren' in filter) return { modifiedCount: 0 };
      return { modifiedCount: 1 };
    });
    const antwort = await POST(request({}));
    expect(antwort.status).toBe(409);
    expect(mock.insertOne).not.toHaveBeenCalled();
    expect(mock.movement).not.toHaveBeenCalled();
    expect(mock.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        vereinId: 'verein-1',
        retouren: []
      }),
      expect.any(Object), expect.any(Object)
    );
  });
  it('verknüpft Retourengutschrift mit Rechnung und markiert ClubDesk-Export als ausstehend', async () => {
    vorbereiten();
    const antwort = await POST(request({}));
    expect(antwort.status).toBe(201);
    expect(mock.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        vereinId: 'verein-1',
        verkaufId: id,
        rechnungId: id,
        rechnungsnummer: '2026-001',
        retourId: expect.any(String),
        gutschriftnummer: expect.stringMatching(/^GS-/),
        clubdeskExportStatus: 'nicht_exportiert',
        pdfStatus: 'ausstehend'
      }),
      expect.any(Object)
    );
  });
  it('GET validiert Verkaufs-ID', async () => {
    const response = await GET({
      locals: { benutzer: { vereinId: 'verein-1' } },
      url: new URL('http://localhost/api/vereinskleider/retouren?verkaufId=invalid')
    } as never);
    expect(response.status).toBe(400);
  });
});
