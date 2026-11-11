import { act, fireEvent, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import EmbarquesFiltros from "../EmbarquesFiltros";
import { useEmbarquesFilters } from "../../hooks/useEmbarquesFilters";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/shared", () => ({ useIsMobile: () => false, useDebounce: (value: string) => value }));
function Listado() {
  const state = useEmbarquesFilters();
  return <TooltipProvider><EmbarquesFiltros
    search={state.search} onSearchChange={state.setSearch}
    filterEstado={state.filters.estado} onFilterEstadoChange={(v) => state.setFilter("estado", v, "todos")}
    filterCliente={state.filters.cliente} onFilterClienteChange={(v) => state.setFilter("cliente", v, "todos")}
    filterModo={state.filters.modo} onFilterModoChange={(v) => state.setFilter("modo", v, "todos")}
    filterOperador={state.filters.operador} onFilterOperadorChange={(v) => state.setFilter("operador", v, "todos")}
    fechaDesde={state.filters.fechaDesde} onFechaDesdeChange={(v) => state.setFilter("fechaDesde", v, "")}
    fechaHasta={state.filters.fechaHasta} onFechaHastaChange={(v) => state.setFilter("fechaHasta", v, "")}
    clientes={[]} operadores={[]}
  /><output>{`q=${state.search}|estado=${state.filters.estado}|page=${state.page}`}</output></TooltipProvider>;
}
const wrapper = () => withNuqsTestingAdapter({ hasMemory: true, searchParams: "?q=ACME&estado=Confirmado&page=2" });

describe("filtros de embarques", () => {
  it("Limpiar todo elimina búsqueda, chips y página junto con los filtros", async () => {
    render(<Listado />, { wrapper: wrapper() });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Limpiar todo" })); });
    expect(screen.getByPlaceholderText("Buscar por expediente, cliente o mercancía…")).toHaveValue("");
    expect(screen.queryByText("Búsqueda: ACME")).not.toBeInTheDocument();
    expect(screen.getByText("q=|estado=todos|page=0")).toBeInTheDocument();
  });

  it("distingue las fechas por nombre accesible y conserva búsqueda al cancelar el panel", async () => {
    render(<Listado />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    expect(screen.getByRole("textbox", { name: "ETD desde" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "ETA hasta" })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Limpiar$/ })); });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByPlaceholderText("Buscar por expediente, cliente o mercancía…")).toHaveValue("ACME");
  });
});
