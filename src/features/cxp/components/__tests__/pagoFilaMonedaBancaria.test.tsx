import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PagoFila, type PagoRow } from "../DialogDetallePagosProveedor.fila";

vi.mock("@/features/cxp/hooks/useConciliacionPagoCellController", () => ({
  useConciliacionPagoCellController: () => ({
    open: false, setOpen: vi.fn(), candidatos: { data: [], isLoading: false },
    vincular: { mutate: vi.fn(), isPending: false },
    desvincular: { mutate: vi.fn(), isPending: false },
  }),
}));

function pago(monedaPago: string, monedaBanco?: string | null): PagoRow {
  return {
    id: "pago-fixture", fecha_pago: "2026-10-03", metodo_pago: "Transferencia",
    monto: monedaPago === "MXN" ? 20 : 1, moneda: monedaPago,
    cuenta_bancaria_id: "cuenta-fixture",
    bbva_movimientos: [{
      id: "movimiento-fixture", fecha: "2026-10-03", concepto: null, referencia: null,
      cargo: monedaBanco === "MXN" ? "20" : "1", abono: 0, estado_conciliacion: "Conciliado",
      cuentas_bancarias: monedaBanco != null ? { moneda: monedaBanco } : monedaBanco,
    }],
  };
}

function celdas(registro: PagoRow) {
  render(<table><tbody><PagoFila pago={registro} canEdit={false} onEliminar={vi.fn()} /></tbody></table>);
  return within(screen.getByRole("row")).getAllByRole("cell");
}

describe("AUD42: moneda bancaria en la fila de un pago conciliado", () => {
  it.each([
    { monedaPago: "MXN", monedaBanco: "USD", cargo: "USD 1.00", monto: "MXN 20.00" },
    { monedaPago: "USD", monedaBanco: "MXN", cargo: "MXN 20.00", monto: "USD 1.00" },
    { monedaPago: "MXN", monedaBanco: "MXN", cargo: "MXN 20.00", monto: "MXN 20.00" },
    { monedaPago: "USD", monedaBanco: "USD", cargo: "USD 1.00", monto: "USD 1.00" },
  ])("pago $monedaPago y cuenta $monedaBanco conservan sus unidades", ({ monedaPago, monedaBanco, cargo, monto }) => {
    const columnas = celdas(pago(monedaPago, monedaBanco));
    expect(columnas[2]).toHaveTextContent(monto);
    expect(columnas[5]).toHaveTextContent("Conciliado");
    expect(columnas[5]).toHaveTextContent(`03/10/2026 · ${cargo}`);
    expect(columnas[5]).not.toHaveTextContent(monedaBanco === "USD" ? "MXN" : "USD");
  });

  it.each([null, undefined])("cuenta no disponible (%s) no inventa la moneda del pago", (monedaBanco) => {
    const columnas = celdas(pago("MXN", monedaBanco));
    expect(columnas[2]).toHaveTextContent("MXN 20.00");
    expect(columnas[5]).toHaveTextContent("03/10/2026 · 1.00");
    expect(columnas[5]).toHaveTextContent("Moneda bancaria no disponible");
    expect(columnas[5]).not.toHaveTextContent(/MXN|USD/);
  });
});
