import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchStats } = vi.hoisted(() => ({
  mockFetchStats: vi.fn(),
}));

vi.mock('@/features/operaciones/services', () => ({
  fetchOperacionesStats: mockFetchStats,
}));

import { useOperacionesData } from '../useOperacionesData';
import { useOperacionesPageController } from '../useOperacionesPageController';

describe('useOperaciones Hooks', () => {
  beforeEach(() => {
    mockFetchStats.mockReset();
  });


  const mockData = {
    global: { totalActivas: 10, totalContenedores: 5, totalCriticos: 1, totalEnPuerto: 2 },
    operadores: [{ nombre: 'Op1', cargasEsteMes: 5, historico: [{ mes: 'Jan', creados: 2, llegados: 1 }] }],
    historicoGlobal: [{ mes: 'Jan', creadas: 5, llegadas: 3 }],
    mesesLabels: ['Jan']
  };

  it('useOperacionesData parses server stats', async () => {
    mockFetchStats.mockResolvedValueOnce(mockData);
    const { result } = renderHook(() => useOperacionesData(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.global.totalActivas).toBe(10);
  });

  it('useOperacionesData handles empty data', async () => {
    mockFetchStats.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useOperacionesData(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.global.totalActivas).toBe(0);
  });

  it('useOperacionesPageController calculates derived state', async () => {
    mockFetchStats.mockResolvedValue(mockData);
    const { result } = renderHook(() => useOperacionesPageController(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalAlertas).toBe(3);
  });

  it('useOperacionesPageController handles operator filter', async () => {
    mockFetchStats.mockResolvedValue(mockData);
    const { result } = renderHook(() => useOperacionesPageController(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    act(() => {
      result.current.setOperadorChart('Op1');
    });
    
    expect(result.current.creadasEsteMes).toBe(5);
  });
});
