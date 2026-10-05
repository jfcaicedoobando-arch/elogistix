import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act, render, screen, fireEvent } from '@testing-library/react';
import { createWrapper } from '@/test/utils/queryWrapper';
import { FuenteEerrToggle } from '@/features/profit/components/FuenteEerrToggle';
import { STORAGE_KEYS } from '@/lib/browserStorage';
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
  const makeWrapper = (initialEntry = "/") => {
    const QueryWrapper = createWrapper();
    return ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>
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
  it('Auditoría90: recarga del detalle mantiene septiembre y la fuente explícita del KPI', async () => {
    const { result } = renderHook(() => useEstadoResultados(), {
      wrapper: makeWrapper('/profit/estado-resultados?mes=2026-09&fuente=facturas'),
    });
    await waitFor(() => expect(mockFetchERDevengado).toHaveBeenCalled());
    expect(mockFetchERDevengado.mock.calls[0][0]).toMatchObject({ year: 2026, month: 9 });
    expect(result.current.mesActual.key).toBe('2026-09');
    expect(result.current.fuente).toBe('facturas');
    expect(mockFetchER).not.toHaveBeenCalled();
  });

  it('Auditoría90: el selector controlado coincide con la fuente URL y cambiarlo cambia los datos', async () => {
    localStorage.setItem(STORAGE_KEYS.eerrFuente, 'embarques');
    function Detalle() {
      const c = useEstadoResultados();
      return <><FuenteEerrToggle fuente={c.fuente} onFuenteChange={c.setFuente} /><output>{c.mesActual.key}:{c.fuente}</output></>;
    }
    render(<Detalle />, { wrapper: makeWrapper('/profit/estado-resultados?mes=2026-09&fuente=facturas') });
    expect(screen.getByLabelText('Fuente devengada (facturas emitidas y CxP)')).toHaveAttribute('data-state', 'on');
    await waitFor(() => expect(mockFetchERDevengado).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByLabelText('Fuente operativa (por ETA de embarque)'));
    await waitFor(() => expect(mockFetchER).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Fuente operativa (por ETA de embarque)')).toHaveAttribute('data-state', 'on');
    expect(screen.getByText('2026-09:embarques')).toBeInTheDocument();
    expect(mockFetchER.mock.calls[0][0]).toMatchObject({ year: 2026, month: 9 });
  });

});
