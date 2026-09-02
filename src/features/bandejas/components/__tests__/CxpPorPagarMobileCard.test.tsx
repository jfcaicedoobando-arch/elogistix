/** v13.823.25: tarjeta móvil de /compras/por-pagar muestra folio/vencimiento/saldo. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CxpPorPagarMobileCard } from "../CxpPorPagarMobileCard";
import type { CxpRow } from "../../routes/_sections/cxpPorPagarColumns";

function row(overrides: Partial<CxpRow> = {}): CxpRow {
  return {
    factura_id: "f1", proveedor_nombre: "acme sa de cv", proveedor_origen: "Nacional",
    folio_proveedor: "FP-1", expediente: null, fecha_vencimiento: "2026-02-01",
    dias_para_vencer: 5, moneda: "MXN", total: 100, pagado: 0, saldo: 100,
    fecha_programada_pago: null,
    ...overrides,
  } as CxpRow;
}

describe("CxpPorPagarMobileCard", () => {
  it("muestra proveedor, folio y saldo con moneda", () => {
    render(<CxpPorPagarMobileCard row={row()} />);
    expect(screen.getByText("Acme SA de CV")).toBeInTheDocument();
    expect(screen.getByText("FP-1")).toBeInTheDocument();
    expect(screen.getByText(/\$1,?00\.00|100\.00/)).toBeInTheDocument();
  });
});
