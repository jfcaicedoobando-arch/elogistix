import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper as createQueryWrapper } from '@/test/utils/queryWrapper';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

const createWrapper = () => {
  const QueryWrapper = createQueryWrapper();
  return ({ children }: { children: ReactNode }) => <MemoryRouter><QueryWrapper>{children}</QueryWrapper></MemoryRouter>;
};

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

import { exportToCsv } from '@/generators/exportCsv';
import { BASE_CSV_RENTABILIDAD } from '@/types/rentabilidad';
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

  it('conserva el nombre completo en el ranking', () => {
    mockUseRentabilidad.mockReturnValue({ ...mockRentabilidad, clientes: [{ ...clientes[0], cliente_nombre: 'QA Cliente Smoke 2026-09-05' }] });
    const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
    expect(result.current.top10[0].name).toBe('QA Cliente Smoke 2026-09-05');
  });

  it('restablece periodo y modo de forma atómica, incluso desde un mes futuro', () => {
    mockUseRentabilidad.mockReturnValue(mockRentabilidad);
    const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
    act(() => result.current.setFechaDesde(new Date(2030, 5, 10)));
    act(() => result.current.setModo('Terrestre'));
    notifyWarning.mockClear();
    act(() => result.current.resetFilters());
    const hoy = new Date();
    expect(result.current.fechaDesde.getDate()).toBe(1);
    expect(result.current.fechaDesde.getMonth()).toBe(hoy.getMonth());
    expect(result.current.fechaHasta.getMonth()).toBe(hoy.getMonth());
    expect(result.current.fechaHasta.getFullYear()).toBe(hoy.getFullYear());
    expect(result.current.modo).toBe('all');
    expect(notifyWarning).not.toHaveBeenCalled();
  });

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

  it('CSV carries ETA period, mode and base without changing financial precision', () => {
    mockUseRentabilidad.mockReturnValue({ ...mockRentabilidad, clientes: [{ ...clientes[0], venta_usd: 12.3693, costo_usd: 12.1185, profit_usd: 0.2508, margen: 2.0276 }] });
    const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
    act(() => result.current.applyFilters({ fechaDesde: new Date(2026, 9, 5), fechaHasta: new Date(2026, 9, 5), modo: 'Terrestre' }));
    act(() => result.current.handleExport());
    expect(exportToCsv).toHaveBeenLastCalledWith(
      'rentabilidad_clientes_2026-10-05_2026-10-05_terrestre.csv',
      expect.arrayContaining([
        { key: 'venta_usd', label: 'Venta equivalente (USD)' },
        { key: 'costo_usd', label: 'Costo equivalente (USD)' },
        { key: 'profit_usd', label: 'Utilidad equivalente (USD)' },
        { key: 'desde_eta', label: 'Desde (ETA)' },
        { key: 'hasta_eta', label: 'Hasta (ETA)' },
        { key: 'modo', label: 'Modo' },
        { key: 'base', label: 'Base' },
      ]),
      [expect.objectContaining({ venta_usd: 12.3693, costo_usd: 12.1185, profit_usd: 0.2508, margen: '2.0', desde_eta: '2026-10-05', hasta_eta: '2026-10-05', modo: 'Terrestre', base: BASE_CSV_RENTABILIDAD })],
    );
  });

  it('CSV keeps zero revenue margin non-calculable and labels all modes', () => {
    mockUseRentabilidad.mockReturnValue({ ...mockRentabilidad, clientes: [{ ...clientes[0], venta_usd: 0 }] });
    const { result } = renderHook(() => useReportesPageController(), { wrapper: createWrapper() });
    act(() => result.current.handleExport());
    expect(exportToCsv).toHaveBeenLastCalledWith(expect.stringMatching(/_todos.csv$/), expect.any(Array), [expect.objectContaining({ margen: 'No calculable', modo: 'Todos los modos' })]);
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
