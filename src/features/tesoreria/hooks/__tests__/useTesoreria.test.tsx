import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchFlujo, mockFetchSaldos, mockCobranza, mockCxp } = vi.hoisted(() => ({
  mockFetchFlujo: vi.fn(),
  mockFetchSaldos: vi.fn().mockResolvedValue([]),
  mockCobranza: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  mockCxp: vi.fn(() => ({ data: [], isLoading: false, error: null })),
}));

vi.mock('@/services/tesoreria', () => ({
  fetchFlujoProyectado: mockFetchFlujo,
  fetchSaldosCuentas: mockFetchSaldos,
}));
vi.mock('@/hooks/facturacion', () => ({ useCobranza: mockCobranza }));
vi.mock('@/hooks/cxp', () => ({ useFacturasCxP: mockCxp }));

import { useFlujoProyectado } from '../useFlujoProyectado';

describe('useFlujoProyectado (composer)', () => {
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
