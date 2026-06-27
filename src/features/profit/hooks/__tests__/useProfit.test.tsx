import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';
import { MemoryRouter } from 'react-router-dom';

const erMes = {
  ingresos: [], costos: [],
  totalIngresos: { total: 1000 } as any, totalCostos: { total: 0 } as any,
  utilidad: { total: 1000 } as any, margen: { total: 1 } as any,
};
const erDevengado = {
  ingresos: [], costos: [],
  totalIngresos: { total: 999 } as any, totalCostos: { total: 0 } as any,
  utilidad: { total: 999 } as any, margen: { total: 1 } as any,
};

const { mockFetchER, mockFetchERDevengado } = vi.hoisted(() => ({
  mockFetchER: vi.fn(),
  mockFetchERDevengado: vi.fn(),
}));

vi.mock('@/features/profit/services/estadoResultados', () => ({
  fetchEstadoResultadosMes: mockFetchER,
}));
vi.mock('@/features/profit/services/estadoResultadosDevengado', () => ({
  fetchEstadoResultadosDevengado: mockFetchERDevengado,
}));

vi.mock('@/hooks/shared', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/shared')>('@/hooks/shared');
  return {
    ...actual,
    useOrgFilter: () => ({ organizationId: 'org-1' }),
  };
});

import { useEstadoResultados } from '../useEstadoResultados';

describe('useEstadoResultados', () => {
  beforeEach(() => {
    mockFetchER.mockReset().mockResolvedValue(erMes);
    mockFetchERDevengado.mockReset().mockResolvedValue(erDevengado);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const QueryWrapper = createWrapper();
    return (
      <MemoryRouter>
        <QueryWrapper>{children}</QueryWrapper>
      </MemoryRouter>
    );
  };

  it('llama a fetchEstadoResultadosMes por defecto (fuente=embarques) con organizationId', async () => {
    const { result } = renderHook(() => useEstadoResultados(), { wrapper });
    await waitFor(() => expect(mockFetchER).toHaveBeenCalledTimes(1));
    expect(mockFetchER.mock.calls[0][0]).toMatchObject({ organizationId: 'org-1' });
    expect(mockFetchERDevengado).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.utilidad.total).toBe(1000);
  });

  it('cambia a fuente=facturas e invoca fetchEstadoResultadosDevengado', async () => {
    const { result } = renderHook(() => useEstadoResultados(), { wrapper });
    await waitFor(() => expect(mockFetchER).toHaveBeenCalled());

    // v13.137.24: `await act` para que React 18 flushee el re-render y la
    // re-suscripción de React Query antes del `waitFor` siguiente.
    await act(async () => {
      result.current.setFuente('facturas');
    });

    await waitFor(() => expect(mockFetchERDevengado).toHaveBeenCalled());
    expect(result.current.fuente).toBe('facturas');
  });
});
