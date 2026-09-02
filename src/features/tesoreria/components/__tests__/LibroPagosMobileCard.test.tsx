/** v13.823.25: tarjeta móvil del libro de pagos muestra contraparte/folio/monto. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LibroPagosMobileCard } from "../LibroPagosMobileCard";
import type { PagoLibro } from "@/features/tesoreria/domain/libroPagos";

function pago(overrides: Partial<PagoLibro> = {}): PagoLibro {
  return {
    id: "1", tipo: "cobro", fecha: "2026-01-01", contraparte: "Cliente X",
    documento_folio: "F-1", metodo_pago: "03", referencia: null,
    cuenta_alias: "BBVA MXN", monto: 500, moneda: "MXN", monto_mxn: 500,
    conciliado: false, estado_rep: null, notas: null, lote_id: null,
    ...overrides,
  } as PagoLibro;
}

describe("LibroPagosMobileCard", () => {
  it("muestra contraparte, folio y monto con moneda", () => {
    render(<LibroPagosMobileCard row={pago()} />);
    expect(screen.getByText("Cliente X")).toBeInTheDocument();
    expect(screen.getByText("F-1")).toBeInTheDocument();
    expect(screen.getByText(/500\.00/)).toBeInTheDocument();
  });
});
