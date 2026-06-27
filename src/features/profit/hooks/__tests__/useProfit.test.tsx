import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';
import { MemoryRouter } from 'react-router-dom';

type ERFixture = {
  ingresos: unknown[];
  costos: unknown[];
  totalIngresos: { total: number };
  totalCostos: { total: number };
  utilidad: { total: number };
  margen: { total: number };
};
const erMes: ERFixture = {
  ingresos: [], costos: [],
  totalIngresos: { total: 1000 }, totalCostos: { total: 0 },
  utilidad: { total: 1000 }, margen: { total: 1 },
};
const erDevengado: ERFixture = {
  ingresos: [], costos: [],
  totalIngresos: { total: 999 }, totalCostos: { total: 0 },
  utilidad: { total: 999 }, margen: { total: 1 },
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

  // v13.137.35: `createWrapper()` debe ejecutarse UNA vez por test (no por render).
  // Antes se invocaba dentro del cuerpo del componente wrapper, creando un nuevo
  // tipo de componente en cada render → React desmonta/remonta y las queries
  // duplican `mockFetchER` rompiendo `toHaveBeenCalledTimes(1)`. Además sobrescribía
  // `globalThis.__TEST_QUERY_CLIENT__` rompiendo `cleanupGlobalQueryClient`.
  const makeWrapper = () => {
    const QueryWrapper = createWrapper();
    return ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>
        <QueryWrapper>{children}</QueryWrapper>
      </MemoryRouter>
    );
  };

  it('llama a fetchEstadoResultadosMes por defecto (fuente=embarques) con organizationId', async () => {
    const { result } = renderHook(() => useEstadoResultados(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockFetchER).toHaveBeenCalledTimes(1));
    expect(mockFetchER.mock.calls[0][0]).toMatchObject({ organizationId: 'org-1' });
    expect(mockFetchERDevengado).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.utilidad.total).toBe(1000);
  });

  it('cambia a fuente=facturas e invoca fetchEstadoResultadosDevengado', async () => {
    const { result } = renderHook(() => useEstadoResultados(), { wrapper: makeWrapper() });
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
