/**
 * La selección usa IDs de negocio y evita navegar al alternar filas o checkboxes.
 * La paginación sigue siendo externa: seleccionar todas sólo afecta la página recibida.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";

interface Row {
  id: string;
  nombre: string;
}

const data: Row[] = [
  { id: "a", nombre: "Uno" },
  { id: "b", nombre: "Dos" },
];
const nextPage: Row[] = [
  { id: "c", nombre: "Tres" },
  { id: "d", nombre: "Cuatro" },
];

const columns = defineColumns<Row>([
  buildSelectionColumn<Row>(),
  { id: "nombre", header: "Nombre", accessorFn: (r) => r.nombre },
]);

function SelectionTable({ rows = data }: { rows?: Row[] }) {
  const selection = useRowSelection();
  const location = useLocation();
  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        getRowHref={(r) => `/detalle/${r.id}`}
        getRowAriaLabel={(r) => `Ver ${r.nombre}`}
        rowSelection={selection.rowSelection}
        onRowSelectionChange={selection.onRowSelectionChange}
      />
      <output data-testid="selected-ids">{JSON.stringify([...selection.selectedIds].sort())}</output>
      <output data-testid="location">{location.pathname}</output>
    </>
  );
}

function renderTabla() {
  return render(<SelectionTable />, { wrapper: MemoryRouter });
}

function rowCheckbox(nombre: string) {
  return within(screen.getByText(nombre).closest("tr")!).getByRole("checkbox", { name: "Seleccionar fila" });
}

function masterCheckbox() {
  return screen.getByRole("checkbox", { name: "Seleccionar todas las filas visibles" });
}

function expectSelected(...ids: string[]) {
  expect(screen.getByTestId("selected-ids").textContent).toBe(JSON.stringify(ids.sort()));
}

function expectNoNavigation() {
  expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
}

describe("DataTable — modo selección", () => {
  it("sin selección la fila sigue siendo un enlace navegable", () => {
    renderTabla();
    const link = screen.getByRole("link", { name: "Ver Uno" });
    expect(link).toHaveAttribute("tabindex", "0");
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/detalle\/a$/);
    expectSelected();
  });

  it("con una fila marcada el clic y teclado alternan IDs exactos sin navegar", () => {
    renderTabla();
    fireEvent.click(rowCheckbox("Uno"));
    expectSelected("a");
    expect(screen.queryByRole("link", { name: "Ver Dos" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Dos"));
    expectSelected("a", "b");
    fireEvent.click(screen.getByText("Dos"));
    expectSelected("a");
    fireEvent.keyDown(screen.getByText("Dos").closest("tr")!, { key: "Enter" });
    expectSelected("a", "b");
    fireEvent.keyDown(screen.getByText("Uno").closest("tr")!, { key: " " });
    expectSelected("b");
    expectNoNavigation();
  });

  it("el checkbox maestro anuncia cero, parcial, todas y ninguna", () => {
    renderTabla();
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "false");
    expectSelected();
    fireEvent.click(rowCheckbox("Uno"));
    expectSelected("a");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(masterCheckbox());
    expectSelected("a", "b");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "true");
    fireEvent.click(masterCheckbox());
    expectSelected();
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "false");
    expectNoNavigation();
  });

  it("checkbox y área ampliada alternan una sola vez sin navegar", () => {
    renderTabla();
    fireEvent.click(rowCheckbox("Uno"));
    expectSelected("a");
    fireEvent.click(rowCheckbox("Uno").closest("[data-no-row-nav]")!);
    expectSelected();
    fireEvent.click(rowCheckbox("Dos").closest("[data-no-row-nav]")!);
    expectSelected("b");
    fireEvent.click(rowCheckbox("Dos"));
    expectSelected();
    fireEvent.click(masterCheckbox().closest("[data-no-row-nav]")!);
    expectSelected("a", "b");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "true");
    fireEvent.click(masterCheckbox().closest("[data-no-row-nav]")!);
    expectSelected();
    expectNoNavigation();
  });

  it("conserva IDs al cambiar páginas externas y reordenar sin seleccionar otras páginas", () => {
    const { rerender } = renderTabla();
    fireEvent.click(rowCheckbox("Uno"));
    expectSelected("a");

    rerender(<SelectionTable rows={nextPage} />);
    expectSelected("a");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "false");
    fireEvent.click(masterCheckbox());
    expectSelected("a", "c", "d");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "true");
    fireEvent.click(masterCheckbox());
    expectSelected("a");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "false");

    rerender(<SelectionTable rows={[data[1], data[0]]} />);
    expectSelected("a");
    expect(rowCheckbox("Uno")).toHaveAttribute("aria-checked", "true");
    expect(rowCheckbox("Dos")).toHaveAttribute("aria-checked", "false");
    expect(masterCheckbox()).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(masterCheckbox());
    expectSelected("a", "b");
    expectNoNavigation();
  });
});
