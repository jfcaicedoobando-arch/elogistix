import { describe, it, expect, vi, beforeEach } from 'vitest';

// v13.137.24: usamos el helper estándar del proyecto en vez de un mock manual
// con sólo 4 métodos encadenados (que reventaba como `TypeError: undefined is
// not a function` si la implementación llamaba `.eq` / `.match` / etc.).
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import('@/services/__tests__/_supabaseChainMock');
  return createSupabaseMock();
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock.supabase }));

import { createTrackingLink, deleteTrackingLink, esTrackingLinkVigente, fetchTrackingLinks, fetchTrackingPublico, TRACKING_LINK_VIGENCIA_DIAS } from '../index';

describe('tracking/index', () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  it('createTrackingLink inserta un nuevo link', async () => {
    const mockData = { id: '1', embarque_id: 'emb1' };
    mock.setTableResult('tracking_links', { data: mockData, error: null });
    const result = await createTrackingLink({ embarqueId: 'emb1' });
    expect(mock.tableCalls.some((c) => c.table === 'tracking_links')).toBe(true);
    expect(result).toEqual(mockData);
  });

  it('fetchTrackingPublico llama a fetch con el token', async () => {
    // v13.137.25: `vi.stubGlobal` se restaura via `vi.unstubAllGlobals()`
    // del afterEach global. Antes `global.fetch = ...` directo quedaba
    // residual entre archivos bajo singleFork.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embarque: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchTrackingPublico('token123');
    expect(fetchMock).toHaveBeenCalled();
    expect(result).toEqual({ embarque: {} });
  });

  it('fetchTrackingPublico lanza error si el fetch retorna !ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Token inválido' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTrackingPublico('bad-token')).rejects.toThrow('Token inválido');
  });

  it('createTrackingLink propaga error de insert', async () => {
    mock.setTableResult('tracking_links', { data: null, error: new Error('insert fail') });
    await expect(createTrackingLink({ embarqueId: 'emb1' })).rejects.toThrow('insert fail');
  });

  it('fetchTrackingLinks consulta por embarque', async () => {
    const rows = [{ id: '1', embarque_id: 'emb1' }];
    mock.setTableResult('tracking_links', { data: rows, error: null });
    const result = await fetchTrackingLinks('emb1');
    expect(mock.tableCalls.some((c) => c.table === 'tracking_links')).toBe(true);
    expect(result).toEqual(rows);
  });

  it('deleteTrackingLink borra por id', async () => {
    mock.setTableResult('tracking_links', { data: null, error: null });
    await deleteTrackingLink({ linkId: 'l1', embarqueId: 'emb1' });
    expect(mock.tableCalls.some((c) => c.table === 'tracking_links')).toBe(true);
  });

  it('deleteTrackingLink propaga error de delete', async () => {
    mock.setTableResult('tracking_links', { data: null, error: new Error('delete fail') });
    await expect(deleteTrackingLink({ linkId: 'l1', embarqueId: 'emb1' })).rejects.toThrow('delete fail');
  });

  it('la vigencia por defecto es de 30 días (alineada con proformas)', () => {
    expect(TRACKING_LINK_VIGENCIA_DIAS).toBe(30);
  });
});

describe('esTrackingLinkVigente', () => {
  const ahora = new Date('2026-08-31T12:00:00Z').getTime();

  it('vigente cuando expires_at está en el futuro', () => {
    expect(
      esTrackingLinkVigente({ expires_at: '2026-09-30T12:00:00Z' } as never, ahora),
    ).toBe(true);
  });

  it('no vigente cuando expires_at ya pasó', () => {
    expect(
      esTrackingLinkVigente({ expires_at: '2026-08-01T12:00:00Z' } as never, ahora),
    ).toBe(false);
  });

  it('liga legacy sin expires_at (eterna) NO se reutiliza', () => {
    expect(esTrackingLinkVigente({ expires_at: null } as never, ahora)).toBe(false);
  });
});
