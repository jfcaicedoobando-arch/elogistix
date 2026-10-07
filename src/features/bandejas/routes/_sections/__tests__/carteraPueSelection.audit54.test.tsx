import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DataTable } from "@/components/shared/DataTable";
import { buildCarteraSelectionColumns } from "../carteraColumns.selection";
import { puedeSeleccionarCobro } from "../carteraLote";
import type { CarteraRow } from "../carteraColumns.types";
const row = (id: string, metodo_pago: string, pagado: number): CarteraRow => ({
  factura_id: id, numero: id, cliente_id: "c1", cliente_nombre: "Ficticio", embarque_id: null, expediente: null,
  fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", dias_vencido: 1, moneda: "MXN",
  total: 1.16, pagado, saldo: 1.16 - pagado, ultimo_contacto: null, estado: "Pagada", metodo_pago,
});
function Harness() {
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  return <MemoryRouter>
    <DataTable columns={buildCarteraSelectionColumns()} data={[row("A8", "PUE", 1.15), row("PPD", "PPD", 0)]}
      rowKey={(r) => r.factura_id} rowSelection={selection} onRowSelectionChange={setSelection}
      enableRowSelection={(r) => puedeSeleccionarCobro(r.original)} />
    <output data-testid="selection">{Object.keys(selection).filter((id) => selection[id]).join(",")}</output>
  </MemoryRouter>;
}

describe("AUD54 P2: selección real de tabla", () => {
  it("muestra A8 enlazada para revisión, deshabilita su checkbox y Seleccionar todas sólo marca PPD", () => {
    render(<Harness />);
    expect(screen.getByRole("link", { name: "A8" })).toHaveAttribute("href", "/facturacion/A8");
    const a8 = screen.getByRole("checkbox", { name: "Seleccionar factura A8" });
    expect(a8).toBeDisabled();
    expect(a8).toHaveAttribute("title", expect.stringContaining("Revisa el pago previo"));
    fireEvent.click(a8);
    expect(screen.getByTestId("selection")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar todas" }));
    expect(screen.getByTestId("selection")).toHaveTextContent(/^PPD$/);
    expect(a8).toHaveAttribute("aria-checked", "false");
  });
});
