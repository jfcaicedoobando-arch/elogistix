/** P2-A2/A3/A4: ruta del URL, "Nueva tarifa" desde ruta y KPIs excluyentes. */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/features/costeo/hooks/useCosteoTarifas", () => ({
  useCosteoTarifas: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCosteoTarifaMutations: () => ({ eliminar: { mutate: vi.fn(), isPending: false } }),
}));

import { useCosteoTarifasPageState } from "../useCosteoTarifasPageState";

const RUTA = "4a74ea99-a0f5-46cf-80b4-3c45e50d9a26";

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ s: useCosteoTarifasPageState(), loc: useLocation() }), { wrapper });
}

describe("useCosteoTarifasPageState", () => {
  it("?ruta= cuenta como filtro activo y 'Limpiar filtros' la quita del URL", () => {
    const { result } = setup(`/costeo/tarifas?ruta=${RUTA}&aprobacion=borrador`);
    expect(result.current.s.hasActiveFilters).toBe(true);
    act(() => result.current.s.clearAll());
    expect(result.current.loc.search).toBe("");
    expect(result.current.s.rutaIdFromUrl).toBeUndefined();
    expect(result.current.s.hasActiveFilters).toBe(false);
  });

  it("'Nueva tarifa' desde una ruta la preselecciona", () => {
    const { result } = setup(`/costeo/tarifas?ruta=${RUTA}`);
    act(() => result.current.s.nuevo());
    expect(result.current.s.open).toBe(true);
    expect(result.current.s.initial).toEqual({ ruta_id: RUTA });
    expect(result.current.s.editId).toBeUndefined();
  });

  it("alta global (sin ruta o ruta inválida) abre vacío", () => {
    const { result } = setup(`/costeo/tarifas?ruta=no-es-uuid`);
    act(() => result.current.s.nuevo());
    expect(result.current.s.initial).toBeUndefined();
  });

  it("Por vencer → Pendientes quita 'Por vencer'", () => {
    const { result } = setup("/costeo/tarifas");
    act(() => result.current.s.onFilterPorVencer());
    expect(result.current.s.activeKpi).toBe("porVencer");
    act(() => result.current.s.onFilterPendientes());
    expect(result.current.s.soloPorVencer).toBe(false);
    expect(result.current.s.aprobacion).toBe("borrador");
    expect(result.current.s.activeKpi).toBe("pendientes");
  });

  it("Pendientes → Por vencer quita 'Pendientes'", () => {
    const { result } = setup("/costeo/tarifas");
    act(() => result.current.s.onFilterPendientes());
    act(() => result.current.s.onFilterPorVencer());
    expect(result.current.s.aprobacion).toBe("todas");
    expect(result.current.s.soloPorVencer).toBe(true);
    expect(result.current.s.activeKpi).toBe("porVencer");
  });
});
