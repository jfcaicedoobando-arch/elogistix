import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import { CotizacionesFiltersBar } from "../CotizacionesFiltersBar";
import type { ReactNode } from "react";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => mobile.value }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../CotizacionesFilterSelects", () => ({
  EstadoSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select aria-label="Estado" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="todos">Todos</option><option value="Enviada">Enviada</option>
      <option value="Borrador">Borrador</option>
    </select>
  ),
  ClienteSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select aria-label="Cliente" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="todos">Todos</option><option value="c1">Cliente 1</option>
    </select>
  ),
}));

const defaults = {
  estado: "todos", cliente: "todos", aceptadasSinEmbarque: "no",
  sinCostos: "no", incluirInactivas: "no", segmento: "clientes",
};
const commit = vi.fn();
const reset = vi.fn();
const url = vi.fn();
function Host() {
  const list = useTableFilters({ defaultFilters: defaults });
  return (
    <>
      <output data-testid="query">{JSON.stringify({ filters: list.filters, page: list.page, search: list.search })}</output>
      <CotizacionesFiltersBar
        search={list.search} setSearch={list.setSearch}
        filterEstado={list.filters.estado} filterCliente={list.filters.cliente} clientes={[]}
        soloAceptadasSinEmbarque={list.filters.aceptadasSinEmbarque === "si"}
        filterSinCostos={list.filters.sinCostos === "si"}
        incluirInactivas={list.filters.incluirInactivas === "si"} totalAceptadasSinEmbarque={0}
        setFilter={(k, v) => { commit(k, v); list.setFilter(k, v); }}
        activeChips={list.activeChips} activeCount={list.activeCount}
        resetAll={() => { reset(); list.resetAll(); }}
      />
    </>
  );
}
const open = () => fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
const query = () => screen.getByTestId("query").textContent;
function mount(params = "?q=barco&page=3&estado=Enviada&segmento=prospectos") {
  render(<Host />, { wrapper: withNuqsTestingAdapter({ searchParams: params, onUrlUpdate: url }) });
}
beforeEach(() => { vi.clearAllMocks(); mobile.value = false; });

describe.each([false, true])("Cotizaciones · borrador móvil=%s", (isMobile) => {
  beforeEach(() => { mobile.value = isMobile; });

  it.each(["Cancelar", "Cerrar", "Escape"])("descarta al cerrar por %s y renueva al abrir", (close) => {
    mount();
    const applied = query();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Sólo sin costos" }));
    if (isMobile) fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), { target: { value: "Borrador" } });
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
    if (close === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    expect(screen.getByRole("button", { name: "Sólo sin costos" })).toHaveAttribute("aria-pressed", "false");
    if (isMobile) expect(screen.getByRole("combobox", { name: "Estado" })).toHaveValue("Enviada");
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
  });

  it("Limpiar y Cancelar conservan consulta, búsqueda y página", () => {
    mount();
    const applied = query();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
    open();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeEnabled();
  });

  it("Aplicar confirma cada cambio una vez, cierra y conserva búsqueda/segmento", async () => {
    mount();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Sólo sin costos" }));
    fireEvent.click(screen.getByRole("button", { name: "Incluir vencidas/archivadas" }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit.mock.calls).toEqual([["sinCostos", "si"], ["incluirInactivas", "si"]]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(query()).toContain('"page":0'));
    expect(query()).toContain('"search":"barco"');
    expect(query()).toContain('"segmento":"prospectos"');
    open();
    expect(screen.getByRole("button", { name: "Sólo sin costos" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("Limpiar + Aplicar confirma defaults y conserva búsqueda/segmento", () => {
    mount();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit.mock.calls).toEqual([["estado", "todos"]]);
    expect(query()).toContain('"search":"barco"');
    expect(query()).toContain('"segmento":"prospectos"');
    expect(reset).not.toHaveBeenCalled();
  });

  it("Limpiar se habilita con un borrador nuevo y sólo se confirma al aplicar", () => {
    mount("?page=3");
    open();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sólo sin costos" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
    expect(query()).toContain('"page":3');
  });
});

it("conserva vivos los primarios de escritorio, búsqueda, chips y Limpiar todo", async () => {
  mount();
  fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), { target: { value: "Borrador" } });
  expect(commit).toHaveBeenCalledWith("estado", "Borrador");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nuevo" } });
  expect(query()).toContain('"search":"nuevo"');
  fireEvent.click(screen.getByRole("button", { name: "Quitar estado: Borrador" }));
  expect(query()).toContain('"estado":"todos"');
  fireEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));
  expect(reset).toHaveBeenCalledOnce();
  await waitFor(() => expect(query()).toContain('"search":""'));
});
