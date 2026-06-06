import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';
import { MemoryRouter } from 'react-router-dom';

const { mockFetchER, mockFetchERDevengado } = vi.hoisted(() => ({
  mockFetchER: vi.fn(() => Promise.resolve({ ingresos: [], egresos: [], utilidades: {} })),
  mockFetchERDevengado: vi.fn(() => Promise.resolve({ ingresos: [], egresos: [], utilidades: {} })),
}));

vi.mock('@/services/profit', () => ({
  fetchEstadoResultadosMes: mockFetchER,
  fetchEstadoResultadosDevengado: mockFetchERDevengado,
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
    const { result } = renderHook(() => useEstadoResultados(), { wrapper });
    expect(result.current).toBeDefined();
    await waitFor(() => expect(mockFetchER).toHaveBeenCalled());
  });

  it('useEstadoResultados uses filters', async () => {
    renderHook(() => useEstadoResultados(), { wrapper });
    await waitFor(() => expect(mockFetchER).toHaveBeenCalled());
  });
});
