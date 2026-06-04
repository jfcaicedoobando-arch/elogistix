import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchLiquidaciones, mockGenerar, mockRegistrar, mockFetchVendedoras } = vi.hoisted(() => ({
  mockFetchLiquidaciones: vi.fn(),
  mockGenerar: vi.fn(),
  mockRegistrar: vi.fn(),
  mockFetchVendedoras: vi.fn(),
}));

vi.mock('@/services/comisiones', () => ({
  fetchLiquidaciones: mockFetchLiquidaciones,
  generarLiquidacion: mockGenerar,
  registrarPagoLiquidacion: mockRegistrar,
  fetchVendedorasConfig: mockFetchVendedoras,
}));

import { useLiquidaciones, useGenerarLiquidacion, useRegistrarPagoLiquidacion } from '../useLiquidaciones';
import { useVendedorasConfig } from '../useVendedoras';

describe('useComisiones Hooks', () => {
  it('useLiquidaciones fetches data', async () => {
    mockFetchLiquidaciones.mockResolvedValueOnce([{ id: 'l1' }]);
    const { result } = renderHook(() => useLiquidaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('useGenerarLiquidacion calls service', async () => {
    mockGenerar.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useGenerarLiquidacion(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ vendedora_id: 'v1', mes: 1, anio: 2023 });
    expect(mockGenerar).toHaveBeenCalled();
  });

  it('useRegistrarPagoLiquidacion calls service', async () => {
    mockRegistrar.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useRegistrarPagoLiquidacion(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ liquidacion_id: 'l1', fecha_pago: '2023-01-01', referencia: 'ref' });
    expect(mockRegistrar).toHaveBeenCalled();
  });

  it('useVendedorasConfig fetches config', async () => {
    mockFetchVendedoras.mockResolvedValueOnce([{ id: 'v1', usuario_id: 'u1' }]);
    const { result } = renderHook(() => useVendedorasConfig(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
