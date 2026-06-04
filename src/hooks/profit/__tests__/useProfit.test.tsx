import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';
import { MemoryRouter } from 'react-router-dom';

const { mockFetchER } = vi.hoisted(() => ({
  mockFetchER: vi.fn(),
}));

vi.mock('@/services/profit', () => ({
  fetchEstadoResultados: mockFetchER,
}));

import { useEstadoResultados } from '../useEstadoResultados';

describe('useProfit Hooks', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const QueryWrapper = createWrapper();
    return (
      <MemoryRouter>
        <QueryWrapper>{children}</QueryWrapper>
      </MemoryRouter>
    );
  };

  it('useEstadoResultados fetches data', async () => {
    mockFetchER.mockResolvedValueOnce({ ingresos: [], egresos: [], utilidades: {} });
    const { result } = renderHook(() => useEstadoResultados({ anio: 2023 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useEstadoResultados uses filters', async () => {
    mockFetchER.mockResolvedValueOnce({ ingresos: [], egresos: [], utilidades: {} });
    renderHook(() => useEstadoResultados({ anio: 2023, mes: 5 }), { wrapper });
    expect(mockFetchER).toHaveBeenCalledWith({ anio: 2023, mes: 5 });
  });
});
