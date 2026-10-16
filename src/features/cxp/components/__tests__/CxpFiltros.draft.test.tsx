import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CxpFiltros } from "../CxpFiltros";
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/shared/useIsMobile", () => ({ useIsMobile: () => viewport.mobile }));

vi.mock("@/features/proveedor/hooks", () => ({
  useProveedoresLite: () => ({ data: [{ id: "p1", nombre: "Proveedor 1" }] }),
}));
vi.mock("@/features/presupuesto/hooks", () => ({
  usePresupuestoCategorias: () => ({ data: [{ id: "c1", nombre: "Categoría 1" }] }),
}));
vi.mock("@/components/ui/date-picker-mx", () => ({
  DatePickerMx: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Fecha" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
type Props = ComponentProps<typeof CxpFiltros>;
type Values = Pick<Props, "estatus" | "moneda" | "origen" | "aprobacion" |
  "proveedorId" | "categoriaPresupuestoId" | "fechaDesde" | "fechaHasta">;
const initial: Values = {
  estatus: "Vigente", moneda: "USD", origen: "Extranjero", aprobacion: "aprobada",
  proveedorId: "p1", categoriaPresupuestoId: "c1", fechaDesde: "2026-01-01", fechaHasta: "2026-12-31",
};
const empty: Values = {
  estatus: "todos", moneda: "todas", origen: "todos", aprobacion: "todos",
  proveedorId: "todos", categoriaPresupuestoId: "todas", fechaDesde: "", fechaHasta: "",
};
const commit = vi.fn();
function Host({ start = initial }: { start?: Values }) {
  const [values, setValues] = useState(start);
  const [search, setSearch] = useState("factura");
  const change = <K extends keyof Values>(key: K, value: Values[K]) => {
    commit(key, value);
    setValues((current) => ({ ...current, [key]: value }));
  };
  return (
    <>
      <output data-testid="query">{JSON.stringify({ ...values, search })}</output>
      <CxpFiltros
        {...values} search={search} onSearchChange={setSearch}
        onEstatusChange={(v) => change("estatus", v)} onMonedaChange={(v) => change("moneda", v)}
        onOrigenChange={(v) => change("origen", v)} onAprobacionChange={(v) => change("aprobacion", v)}
        onProveedorChange={(v) => change("proveedorId", v)}
        onCategoriaPresupuestoChange={(v) => change("categoriaPresupuestoId", v)}
        onFechaDesdeChange={(v) => change("fechaDesde", v)} onFechaHastaChange={(v) => change("fechaHasta", v)}
      />
    </>
  );
}
const query = () => screen.getByTestId("query").textContent;
const editDate = () => fireEvent.change(screen.getAllByRole("textbox", { name: "Fecha" })[0],
  { target: { value: "2026-10-16" } });
beforeEach(() => { vi.clearAllMocks(); viewport.mobile = false; });

describe.each([true, false])("CxP facturas - mobile %s", (mobile) => {
  beforeEach(() => { viewport.mobile = mobile; });
  const open = () => fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));

  it("keeps one trigger connected while opening, editing and closing", () => {
    render(<Host />);
    const trigger = screen.getByRole("button", { name: /^Filtros/ });
    expect(trigger).toHaveTextContent(mobile ? "8" : "7");
    for (let cycle = 0; cycle < 2; cycle++) {
      open();
      editDate();
      expect(trigger.isConnected).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.getByRole("button", { name: /^Filtros/ })).toBe(trigger);
    }
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(["Cancelar", "Cerrar", "Escape"])("no aplica al editar y cerrar por %s; reabrir renueva", (close) => {
    render(<Host />);
    const applied = query();
    open();
    editDate();
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Pagada" }));
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
    if (close === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("2026-01-01");
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Vigente");
    expect(query()).toBe(applied);
    expect(commit).not.toHaveBeenCalled();
  });

  it("Limpiar + Cancelar conserva los ocho filtros y la búsqueda", () => {
    render(<Host />);
    const applied = query();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("");
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Todos los estatus");
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(query()).toBe(applied);
    open();
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("2026-01-01");
    expect(commit).not.toHaveBeenCalled();
  });

  it("Aplicar confirma una vez y la reapertura conserva el valor aplicado", () => {
    render(<Host />);
    open();
    editDate();
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit.mock.calls).toEqual([["fechaDesde", "2026-10-16"]]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    expect(screen.getAllByRole("textbox", { name: "Fecha" })[0]).toHaveValue("2026-10-16");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit).toHaveBeenCalledOnce();
  });

  it("Limpiar + Aplicar confirma los ocho defaults una sola vez", () => {
    render(<Host />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit.mock.calls).toEqual(Object.entries(empty));
    expect(query()).toBe(JSON.stringify({ ...empty, search: "factura" }));
  });

  it("Limpiar se habilita al editar un borrador vacío", () => {
    render(<Host start={empty} />);
    open();
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeDisabled();
    editDate();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(commit).not.toHaveBeenCalled();
  });
});

it("búsqueda, origen y chips externos siguen vivos; reabrir toma el origen vigente", () => {
  render(<Host />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "folio" } });
  expect(query()).toContain('"search":"folio"');
  fireEvent.click(screen.getByRole("button", { name: "Nacional" }));
  expect(commit.mock.calls).toEqual([["origen", "Nacional"]]);
  fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Moneda" }));
  expect(commit).toHaveBeenLastCalledWith("moneda", "todas");
  fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
  editDate();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(query()).toContain('"origen":"Nacional"');
  expect(query()).toContain('"moneda":"todas"');
  fireEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));
  expect(commit).toHaveBeenCalledTimes(10);
  expect(query()).toBe(JSON.stringify({ ...empty, search: "folio" }));
});
