import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchLiquidaciones, mockGenerar, mockRegistrar, mockFetchVendedoras } = vi.hoisted(() => ({
  mockFetchLiquidaciones: vi.fn(),
  mockGenerar: vi.fn(),
  mockRegistrar: vi.fn(),
  mockFetchVendedoras: vi.fn(),
}));

vi.mock('@/features/comisiones/services', () => ({
  fetchLiquidaciones: mockFetchLiquidaciones,
  generarLiquidacion: mockGenerar,
  registrarPagoLiquidacion: mockRegistrar,
  fetchVendedorasConfig: mockFetchVendedoras,
}));

import { useLiquidaciones, useGenerarLiquidacion, useRegistrarPagoLiquidacion } from '../useLiquidaciones';
import { useVendedorasConfig } from '../useVendedoras';

describe('useComisiones Hooks', () => {
  // v13.137.24: reset explícito para evitar fugas de `mockResolvedValueOnce`
  // entre tests si un test consume más de una llamada o falla antes de drenarlo.
  beforeEach(() => {
    mockFetchLiquidaciones.mockReset();
    mockGenerar.mockReset();
    mockRegistrar.mockReset();
    mockFetchVendedoras.mockReset();
  });
  it('useLiquidaciones fetches data', async () => {
    mockFetchLiquidaciones.mockResolvedValueOnce([{ id: 'l1' }]);
    const { result } = renderHook(() => useLiquidaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('useGenerarLiquidacion calls service', async () => {
    mockGenerar.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useGenerarLiquidacion(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ vendedora_id: 'v1', periodo: '2023-01', organization_id: 'org-1' });
    expect(mockGenerar).toHaveBeenCalled();
  });

  it('useRegistrarPagoLiquidacion calls service', async () => {
    mockRegistrar.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useRegistrarPagoLiquidacion(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ id: 'l1', fecha_pago: '2023-01-01', metodo_pago: 'transferencia', referencia: 'ref' });
    expect(mockRegistrar).toHaveBeenCalled();
  });

  it('useVendedorasConfig fetches config', async () => {
    mockFetchVendedoras.mockResolvedValueOnce([{ id: 'v1', usuario_id: 'u1' }]);
    const { result } = renderHook(() => useVendedorasConfig(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
