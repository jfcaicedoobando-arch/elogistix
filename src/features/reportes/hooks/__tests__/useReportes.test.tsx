import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockUseRentabilidad } = vi.hoisted(() => ({
  mockUseRentabilidad: vi.fn(),
}));

vi.mock('@/features/cliente/hooks/useRentabilidadClientes', () => ({
  useRentabilidadClientes: mockUseRentabilidad,
}));

import { useReportesPageController } from '../useReportesPageController';

describe('useReportes Hooks', () => {
  beforeEach(() => {
    mockUseRentabilidad.mockReset();
  });


  const mockRentabilidad = {
    clientes: [
      { cliente_id: '1', cliente_nombre: 'A', profit_usd: 100, margen: 10, venta_usd: 1000, costo_usd: 900, total_embarques: 1 },
      { cliente_id: '2', cliente_nombre: 'B', profit_usd: 200, margen: 20, venta_usd: 2000, costo_usd: 1800, total_embarques: 2 },
    ],
    kpis: { revenue: 3000, profit: 300, margenProm: 15 },
    isLoading: false,
  };

  it('useReportesPageController initializes and sorts asc by default', () => {
    mockUseRentabilidad.mockReturnValue(mockRentabilidad);
    const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
    expect(result.current.sorted[0].cliente_id).toBe('1');
  });

  it('useReportesPageController handles sorting toggle', () => {
    mockUseRentabilidad.mockReturnValue(mockRentabilidad);
    const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
    
    act(() => {
      result.current.handleSort('profit_usd');
    });
    // Descending order for 'A', 'B' -> 'B', 'A'
    expect(result.current.sorted[0].cliente_nombre).toBe('B');

    act(() => {
      result.current.handleSort('profit_usd');
    });
    // Ascending order -> 'A', 'B'
    expect(result.current.sorted[0].cliente_nombre).toBe('A');
  });
});
