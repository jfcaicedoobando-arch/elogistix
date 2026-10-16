import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import { CxpPorPagarFiltersBar } from "../CxpPorPagarFiltersBar";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => mobile.value }));
vi.mock("@/components/ui/date-picker-mx", () => ({
  DatePickerMx: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Fecha" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
const commit = vi.fn();
const reset = vi.fn();
const url = vi.fn();
function Host() {
  const list = useTableFilters({ defaultFilters: { moneda: "todas", vencidas: "todas" } });
  return (
    <>
      <output data-testid="query">{JSON.stringify({
        filters: list.filters, page: list.page, search: list.search, from: list.dateFrom, to: list.dateTo,
      })}</output>
      <CxpPorPagarFiltersBar
        search={list.search} onSearchChange={list.setSearch}
        vencidas={list.filters.vencidas} onVencidasChange={(v) => { commit("vencidas", v); list.setFilter("vencidas", v); }}
        moneda={list.filters.moneda} onMonedaChange={(v) => { commit("moneda", v); list.setFilter("moneda", v); }}
        monedas={["MXN", "USD"]}
        dateFrom={list.dateFrom} onDateFromChange={(v) => { commit("from", v); list.setDateFrom(v); }}
        dateTo={list.dateTo} onDateToChange={(v) => { commit("to", v); list.setDateTo(v); }}
        chips={list.activeChips} activeCount={list.activeCount}
        onClearAll={() => { reset(); list.resetAll(); }}
      />
    </>
  );
}
const open = () => fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
const query = () => screen.getByTestId("query").textContent;
function mount(params = "?q=proveedor&page=4&from=2026-01-01&moneda=USD") {
  render(<Host />, { wrapper: withNuqsTestingAdapter({ searchParams: params, onUrlUpdate: url }) });
}
function select(name: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}
beforeEach(() => { vi.clearAllMocks(); mobile.value = false; });

describe.each([false, true])("CxP Por pagar · borrador móvil=%s", (isMobile) => {
  beforeEach(() => { mobile.value = isMobile; });

  it.each(["Cancelar", "Cerrar", "Escape"])("editar y cerrar por %s conserva la consulta", (close) => {
    mount();
    const applied = query();
    open();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Fecha" })[0], { target: { value: "2026-10-16" } });
    if (isMobile) select("Moneda", "MXN");
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
    if (close === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: close }));
    open();
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("2026-01-01");
    if (isMobile) expect(screen.getByRole("combobox", { name: "Moneda" })).toHaveTextContent("USD");
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
  });

  it("Limpiar + Cancelar conserva los filtros aplicados", () => {
    mount();
    const applied = query();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
    open();
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("2026-01-01");
  });

  it("Aplicar confirma una vez cada cambio y cierra", async () => {
    mount();
    open();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Fecha" })[0], { target: { value: "2026-10-16" } });
    if (isMobile) select("Moneda", "MXN");
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit.mock.calls).toEqual(isMobile ? [["moneda", "MXN"], ["from", "2026-10-16"]] : [["from", "2026-10-16"]]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(query()).toContain('"page":0'));
    open();
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("2026-10-16");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit).toHaveBeenCalledTimes(isMobile ? 2 : 1);
  });

  it("Limpiar + Aplicar confirma defaults sin borrar la búsqueda", () => {
    mount();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit.mock.calls).toEqual([["moneda", "todas"], ["from", ""]]);
    expect(query()).toContain('"search":"proveedor"');
    expect(reset).not.toHaveBeenCalled();
  });

  it("Limpiar se habilita al editar un borrador sin filtros aplicados", () => {
    mount("?page=4");
    open();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeDisabled();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Fecha" })[0], { target: { value: "2026-10-16" } });
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit).not.toHaveBeenCalled();
    expect(url).not.toHaveBeenCalled();
    expect(query()).toContain('"page":4');
  });
});

it("mantiene vivos los selects de escritorio, búsqueda, chips y Limpiar todo", () => {
  mount();
  select("Moneda", "MXN");
  expect(commit).toHaveBeenCalledWith("moneda", "MXN");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "otro" } });
  expect(query()).toContain('"search":"otro"');
  fireEvent.click(screen.getByRole("button", { name: "Quitar moneda: MXN" }));
  expect(query()).toContain('"moneda":"todas"');
  fireEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));
  expect(reset).toHaveBeenCalledOnce();
});
