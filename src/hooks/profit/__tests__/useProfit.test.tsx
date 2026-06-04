import { vi, describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
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
    const { result } = renderHook(() => useEstadoResultados(), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('useEstadoResultados uses filters', async () => {
    mockFetchER.mockResolvedValueOnce({ ingresos: [], egresos: [], utilidades: {} });
    renderHook(() => useEstadoResultados(), { wrapper });
    expect(mockFetchER).toHaveBeenCalled();
  });
});
