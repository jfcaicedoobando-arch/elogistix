import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockUseRentabilidad, notifyWarning } = vi.hoisted(() => ({
  mockUseRentabilidad: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock('@/features/cliente/hooks/useRentabilidadClientes', () => ({
  useRentabilidadClientes: mockUseRentabilidad,
}));
vi.mock('@/lib/ui/appFeedback', () => ({
  notifyWarning: (...args: unknown[]) => notifyWarning(...args),
}));
vi.mock('@/generators/exportCsv', () => ({ exportToCsv: vi.fn() }));

import { useReportesPageController } from '../useReportesPageController';

describe('useReportes Hooks', () => {
  beforeEach(() => {
    mockUseRentabilidad.mockReset();
    notifyWarning.mockReset();
  });

  const clientes = [
    { cliente_id: '1', cliente_nombre: 'A', profit_usd: 100, margen: 10, venta_usd: 1000, costo_usd: 900, total_embarques: 1 },
    { cliente_id: '2', cliente_nombre: 'B', profit_usd: 200, margen: 20, venta_usd: 2000, costo_usd: 1800, total_embarques: 2 },
  ];

  const mockRentabilidad = {
    clientes,
    kpis: { revenue: 3000, profit: 300, margenProm: 15, embarquesSinTc: 0 },
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

  describe('DEFECTO 8: bloqueo de exportación cuando hay embarques sin TC', () => {
    it('canExport es true y no advierte cuando embarquesSinTc es 0', () => {
      mockUseRentabilidad.mockReturnValue(mockRentabilidad);
      const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
      expect(result.current.hayEmbarquesSinTc).toBe(false);
      expect(result.current.canExport).toBe(true);

      act(() => result.current.handleExport());
      expect(notifyWarning).not.toHaveBeenCalled();
    });

    it('canExport es false y CSV queda bloqueado/advertido cuando embarquesSinTc > 0', () => {
      mockUseRentabilidad.mockReturnValue({
        ...mockRentabilidad,
        kpis: { ...mockRentabilidad.kpis, embarquesSinTc: 2 },
      });
      const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
      expect(result.current.hayEmbarquesSinTc).toBe(true);
      expect(result.current.canExport).toBe(false);

      act(() => result.current.handleExport());
      expect(notifyWarning).toHaveBeenCalledTimes(1);
      expect(notifyWarning.mock.calls[0][1]).toMatchObject({ id: 'reportes-export-sin-tc' });
    });

    it('PDF queda bloqueado/advertido cuando embarquesSinTc > 0', () => {
      mockUseRentabilidad.mockReturnValue({
        ...mockRentabilidad,
        kpis: { ...mockRentabilidad.kpis, embarquesSinTc: 1 },
      });
      const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });

      act(() => result.current.handleExportPdf());
      expect(notifyWarning).toHaveBeenCalledTimes(1);
      expect(notifyWarning.mock.calls[0][1]).toMatchObject({ id: 'reportes-export-sin-tc' });
    });
  });
});
