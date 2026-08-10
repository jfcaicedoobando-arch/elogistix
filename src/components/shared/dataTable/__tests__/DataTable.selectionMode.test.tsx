/**
 * v13.490.0 — Modo selección: con filas marcadas, el clic en la fila alterna
 * la selección en lugar de navegar (no se pierde el trabajo por un clic fuera
 * del checkbox).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable, defineColumns } from "@/components/shared/DataTable";

interface Row {
  id: string;
  nombre: string;
}

const data: Row[] = [
  { id: "a", nombre: "Uno" },
  { id: "b", nombre: "Dos" },
];

const columns = defineColumns<Row>([
  { id: "nombre", header: "Nombre", accessorFn: (r) => r.nombre },
]);

function renderTabla(rowSelection: Record<string, boolean>, onChange: (u: unknown) => void) {
  return render(
    <MemoryRouter>
      <DataTable
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
        getRowHref={(r) => `/detalle/${r.id}`}
        getRowAriaLabel={(r) => `Ver ${r.nombre}`}
        rowSelection={rowSelection}
        onRowSelectionChange={onChange as never}
      />
    </MemoryRouter>,
  );
}

describe("DataTable · modo selección", () => {
  it("sin selección la fila sigue siendo un enlace navegable", () => {
    renderTabla({}, vi.fn());
    expect(screen.getByRole("link", { name: "Ver Uno" })).toBeInTheDocument();
  });

  it("con una fila marcada el clic en otra fila alterna la selección y no navega", () => {
    const onChange = vi.fn();
    renderTabla({ a: true }, onChange);
    expect(screen.queryByRole("link", { name: "Ver Dos" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Dos"));
    expect(onChange).toHaveBeenCalled();
  });
});
