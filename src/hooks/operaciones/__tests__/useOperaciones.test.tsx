import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchStats } = vi.hoisted(() => ({
  mockFetchStats: vi.fn(),
}));

vi.mock('@/services/operaciones', () => ({
  fetchOperacionesStats: mockFetchStats,
}));

import { useOperacionesData } from '../useOperacionesData';
import { useOperacionesPageController } from '../useOperacionesPageController';

describe('useOperaciones Hooks', () => {
  const mockData = {
    global: { totalActivas: 10, totalContenedores: 5, totalCriticos: 1, totalEnPuerto: 2 },
    operadores: [{ nombre: 'Op1', cargasActivas: 5, historico: [{ mes: 'Jan', creados: 2, llegados: 1 }] }],
    historicoGlobal: [{ mes: 'Jan', creadas: 5, llegadas: 3 }],
    mesesLabels: ['Jan']
  };

  it('useOperacionesData parses server stats', async () => {
    mockFetchStats.mockResolvedValueOnce(mockData);
    const { result } = renderHook(() => useOperacionesData(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.global.totalActivas).toBe(10);
    expect(result.current.operadores).toHaveLength(1);
  });

  it('useOperacionesData handles empty data', async () => {
    mockFetchStats.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useOperacionesData(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.global.totalActivas).toBe(0);
  });

  it('useOperacionesPageController calculates derived state', async () => {
    mockFetchStats.mockResolvedValueOnce(mockData);
    const { result } = renderHook(() => useOperacionesPageController(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalAlertas).toBe(3); // 1 + 2
    expect(result.current.balancePct).toBe(60); // 3/5 * 100
  });

  it('useOperacionesPageController handles operator filter', async () => {
    mockFetchStats.mockResolvedValueOnce(mockData);
    const { result } = renderHook(() => useOperacionesPageController(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    act(() => {
      result.current.setOperadorChart('Op1');
    });
    
    expect(result.current.operadorChart).toBe('Op1');
    expect(result.current.creadasEsteMes).toBe(5);
  });
});
