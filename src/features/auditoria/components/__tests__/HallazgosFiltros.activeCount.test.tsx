import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HallazgosFiltros, type HallazgosFiltrosValores } from "../HallazgosFiltros";

vi.mock("@/components/shared/MobileFiltersSheet", () => ({
  MobileFiltersSheet: ({ activeCount, snapshot, restore }: {
    activeCount: number;
    snapshot: () => unknown;
    restore: (foto: unknown) => void;
  }) => (
    <div>
      <span data-testid="mobile-filters-count">{activeCount}</span>
      <button onClick={() => restore(snapshot())}>Cancelar filtros</button>
    </div>
  ),
}));
vi.mock("../HallazgosFiltros.parts", () => ({
  HallazgosFiltrosSelects: () => null,
  HallazgosFiltrosFechas: () => null,
}));

const filtrosBase: HallazgosFiltrosValores = {
  search: "",
  filtroRegla: "todas",
  filtroSev: "todas",
  filtroCliente: "todos",
  filtroRevision: "pendientes",
  defaultRevision: "pendientes",
  selectedIds: new Set(),
  restoreSelection: vi.fn(),
  filtroResponsable: "todos",
  etaDesde: undefined,
  etaHasta: undefined,
  clientes: [],
  hayFiltros: false,
  setSearch: vi.fn(),
  setFiltroRegla: vi.fn(),
  setFiltroSev: vi.fn(),
  setFiltroCliente: vi.fn(),
  setFiltroRevision: vi.fn(),
  setFiltroResponsable: vi.fn(),
  setEtaDesde: vi.fn(),
  setEtaHasta: vi.fn(),
  limpiar: vi.fn(),
};

describe("HallazgosFiltros", () => {
  it("no cuenta la revisión predeterminada como filtro móvil activo", () => {
    const { rerender } = render(
      <HallazgosFiltros filtros={filtrosBase} conteo={{ filtrados: 2, total: 2 }} />,
    );
    expect(screen.getByTestId("mobile-filters-count")).toHaveTextContent("0");

    rerender(
      <HallazgosFiltros
        filtros={{ ...filtrosBase, filtroRevision: "revisados" }}
        conteo={{ filtrados: 0, total: 2 }}
      />,
    );
    expect(screen.getByTestId("mobile-filters-count")).toHaveTextContent("1");

    rerender(
      <HallazgosFiltros
        filtros={{ ...filtrosBase, defaultRevision: "todos", filtroRevision: "todos" }}
        conteo={{ filtrados: 2, total: 2 }}
      />,
    );
    expect(screen.getByTestId("mobile-filters-count")).toHaveTextContent("0");
  });

  it("restaura la selección en lote al cancelar filtros provisionales", () => {
    const restoreSelection = vi.fn();
    render(
      <HallazgosFiltros
        filtros={{ ...filtrosBase, selectedIds: new Set(["embarque:regla"]), restoreSelection }}
        conteo={{ filtrados: 2, total: 2 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar filtros" }));
    expect(restoreSelection).toHaveBeenCalledWith(new Set(["embarque:regla"]));
  });
});
