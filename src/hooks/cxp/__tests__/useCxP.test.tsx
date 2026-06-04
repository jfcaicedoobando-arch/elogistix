import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';

const { mockFetchFacturas, mockListarPagos, mockRegistrarPago, mockEliminarPago } = vi.hoisted(() => ({
  mockFetchFacturas: vi.fn(),
  mockListarPagos: vi.fn(),
  mockRegistrarPago: vi.fn(),
  mockEliminarPago: vi.fn(),
}));

vi.mock('@/services/cxp', () => ({
  fetchFacturasCxP: mockFetchFacturas,
  calcularKPIsCxP: vi.fn(() => ({ total: 100 })),
  listarPagosProveedor: mockListarPagos,
  registrarPagoProveedor: mockRegistrarPago,
  eliminarPagoProveedor: mockEliminarPago,
}));

vi.mock('@/contexts/AuthContext', () => ({
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

  it('useRegistrarPagoProveedor registers a payment', async () => {
    mockRegistrarPago.mockResolvedValueOnce({ id: 'p2' });
    const { result } = renderHook(() => useRegistrarPagoProveedor(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ proveedor_factura_id: 'f1', monto: 50, fecha_pago: '2023-01-01', moneda: 'USD' });
    expect(mockRegistrarPago).toHaveBeenCalled();
  });

  it('useEliminarPagoProveedor deletes a payment', async () => {
    mockEliminarPago.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useEliminarPagoProveedor('f1'), { wrapper: createWrapper() });
    await result.current.mutateAsync('p1');
    expect(mockEliminarPago).toHaveBeenCalledWith('p1', 'f1', 'user-123');
  });
});
