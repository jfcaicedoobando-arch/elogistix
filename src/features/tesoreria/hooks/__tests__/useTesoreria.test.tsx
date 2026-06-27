import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchFlujo, mockFetchSaldos, mockCobranza, mockCxp } = vi.hoisted(() => ({
  mockFetchFlujo: vi.fn(),
  mockFetchSaldos: vi.fn(),
  mockCobranza: vi.fn(),
  mockCxp: vi.fn(),
}));

vi.mock('@/features/tesoreria/services', () => ({
  fetchFlujoProyectado: mockFetchFlujo,
  fetchSaldosCuentas: mockFetchSaldos,
}));
vi.mock('@/features/facturacion/hooks', () => ({ useCobranza: mockCobranza }));
vi.mock('@/features/cxp/hooks', () => ({ useFacturasCxP: mockCxp }));

import { useFlujoProyectado } from '../useFlujoProyectado';

describe('useFlujoProyectado (composer)', () => {
  beforeEach(() => {
    mockFetchFlujo.mockReset();
    mockFetchSaldos.mockReset().mockResolvedValue([]);
    mockCobranza.mockReset().mockReturnValue({ data: [], isLoading: false, error: null });
    mockCxp.mockReset().mockReturnValue({ data: [], isLoading: false, error: null });
  });


  it('fetches projection data when sources are ready', async () => {
    mockFetchFlujo.mockResolvedValueOnce({ semanas: [{ semana_iso: '2026-W01' }] });
    const { result } = renderHook(() => useFlujoProyectado(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchFlujo).toHaveBeenCalled();
    expect(result.current.data?.semanas).toHaveLength(1);
  });

  it('queda deshabilitado mientras alguna fuente no está lista', () => {
    mockCobranza.mockReturnValueOnce({ data: [] as never[], isLoading: true, error: null });
    // Cobranza vacía pero loading → enabled false → no se invoca queryFn.
    mockFetchFlujo.mockClear();
    const { result } = renderHook(() => useFlujoProyectado(), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
