import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchFacturas, mockListarPagos, mockRegistrarPago, mockEliminarPago } = vi.hoisted(() => ({
  mockFetchFacturas: vi.fn(),
  mockListarPagos: vi.fn(),
  mockRegistrarPago: vi.fn(),
  mockEliminarPago: vi.fn(),
}));

vi.mock('@/features/cxp/services', () => ({
  fetchFacturasCxP: mockFetchFacturas,
  calcularKPIsCxP: vi.fn(() => ({ total: 100 })),
  listarPagosProveedor: mockListarPagos,
  registrarPagoProveedor: mockRegistrarPago,
  eliminarPagoProveedor: mockEliminarPago,
}));

vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

import { useFacturasCxP } from '../useFacturasCxP';
import { usePagosProveedor, useRegistrarPagoProveedor, useEliminarPagoProveedor } from '../usePagosProveedor';

describe('useCxP Hooks', () => {
  it('useFacturasCxP fetches and calculates KPIs', async () => {
    mockFetchFacturas.mockResolvedValueOnce([{ id: '1', monto: 100 }]);
    const { result } = renderHook(() => useFacturasCxP(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.kpis).toEqual({ total: 100 });
  });

  it('usePagosProveedor fetches payments for a factura', async () => {
    mockListarPagos.mockResolvedValueOnce([{ id: 'p1', monto: 50 }]);
    const { result } = renderHook(() => usePagosProveedor('f1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(mockListarPagos).toHaveBeenCalledWith('f1');
  });

  it('useRegistrarPagoProveedor pasa el payload completo al servicio', async () => {
    mockRegistrarPago.mockResolvedValueOnce({ id: 'p2' });
    const { result } = renderHook(() => useRegistrarPagoProveedor(), { wrapper: createWrapper() });
    const pago = { proveedor_factura_id: 'f1', monto: 50, fecha_pago: '2023-01-01', moneda: 'USD' as const, tipo_cambio_usd: 1, metodo_pago: 'transferencia' };
    await result.current.mutateAsync(pago);
    expect(mockRegistrarPago).toHaveBeenCalledTimes(1);
    expect(mockRegistrarPago).toHaveBeenCalledWith(
      expect.objectContaining({ proveedor_factura_id: 'f1', monto: 50, moneda: 'USD', metodo_pago: 'transferencia' }),
      'user-123',
    );
  });

  it('useEliminarPagoProveedor deletes a payment', async () => {
    mockEliminarPago.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useEliminarPagoProveedor('f1'), { wrapper: createWrapper() });
    await result.current.mutateAsync('p1');
    expect(mockEliminarPago).toHaveBeenCalledWith('p1', 'f1', 'user-123');
  });
});
