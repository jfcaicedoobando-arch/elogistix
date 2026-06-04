import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchER } = vi.hoisted(() => ({
  mockFetchER: vi.fn(),
}));

vi.mock('@/services/profit', () => ({
  fetchEstadoResultados: mockFetchER,
}));

import { useEstadoResultados } from '../useEstadoResultados';

describe('useProfit Hooks', () => {
  it('useEstadoResultados fetches data', async () => {
    mockFetchER.mockResolvedValueOnce({ ingresos: [], egresos: [], utilidades: {} });
    const { result } = renderHook(() => useEstadoResultados({ anio: 2023 }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('useEstadoResultados uses filters', async () => {
    mockFetchER.mockResolvedValueOnce({ ingresos: [], egresos: [], utilidades: {} });
    renderHook(() => useEstadoResultados({ anio: 2023, mes: 5 }), { wrapper: createWrapper() });
    expect(mockFetchER).toHaveBeenCalledWith({ anio: 2023, mes: 5 });
  });
});
