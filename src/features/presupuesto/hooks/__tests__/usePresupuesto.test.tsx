import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchMensual, mockUpsert, mockFetchVsReal, mockFetchCats, mockUseOrganization } =
  vi.hoisted(() => ({
    mockFetchMensual: vi.fn(),
    mockUpsert: vi.fn(),
    mockFetchVsReal: vi.fn(),
    mockFetchCats: vi.fn(),
    mockUseOrganization: vi.fn(() => ({ organizationId: "org-1" })),
  }));

vi.mock('@/features/presupuesto/services', () => ({
  fetchPresupuestoMensualAnio: mockFetchMensual,
  upsertCeldaPresupuesto: mockUpsert,
  fetchPresupuestoVsReal: mockFetchVsReal,
  fetchCategorias: mockFetchCats,
}));

vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => mockUseOrganization(),
}));

import { usePresupuestoMensualAnio, useUpsertCeldaPresupuesto } from '../usePresupuestoMensual';
import { usePresupuestoVsReal } from '../usePresupuestoVsReal';
import { usePresupuestoCategorias } from '../usePresupuestoCategorias';

describe('usePresupuesto Hooks', () => {
  beforeEach(() => {
    mockFetchMensual.mockReset();
    mockUpsert.mockReset();
    mockFetchVsReal.mockReset();
    mockFetchCats.mockReset();
    mockUseOrganization.mockReturnValue({ organizationId: "org-1" });
  });


  it('usePresupuestoMensualAnio fetches con organizationId del contexto', async () => {
    mockFetchMensual.mockResolvedValueOnce([{ categoria: 'cat1', meses: [] }]);
    const { result } = renderHook(() => usePresupuestoMensualAnio(2023), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(mockFetchMensual).toHaveBeenCalledWith(2023, "org-1");
  });

  it('usePresupuestoMensualAnio no dispara fetch si no hay organizationId', async () => {
    mockUseOrganization.mockReturnValue({ organizationId: null as unknown as string });
    const { result } = renderHook(() => usePresupuestoMensualAnio(2023), { wrapper: createWrapper() });
    // Debe quedar disabled — nunca alcanza loading true
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchMensual).not.toHaveBeenCalled();
    expect(result.current.isSuccess).toBe(false);
  });

  it('useUpsertCeldaPresupuesto calls service', async () => {
    mockUpsert.mockResolvedValueOnce({ id: '1' });
    const { result } = renderHook(() => useUpsertCeldaPresupuesto(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ categoria_id: 'c1', periodo: '2023-01', monto_mxn: 100, organization_id: 'org-1' });
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('usePresupuestoVsReal fetches comparison data', async () => {
    mockFetchVsReal.mockResolvedValueOnce([{ mes: 1, presupuesto: 100, real: 80 }]);
    const { result } = renderHook(() => usePresupuestoVsReal('2023'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('usePresupuestoCategorias fetches categories', async () => {
    mockFetchCats.mockResolvedValueOnce([{ id: 'c1', nombre: 'Cat1' }]);
    const { result } = renderHook(() => usePresupuestoCategorias(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });
    expect(result.current.data).toHaveLength(1);
  });
});
