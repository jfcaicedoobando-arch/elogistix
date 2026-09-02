import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsultaRepsMobileCard } from "../ConsultaRepsMobileCard";
import type { ConsultarFacturapiRep } from "@/features/facturacion/services/facturapi";

function rep(overrides: Partial<ConsultarFacturapiRep> = {}): ConsultarFacturapiRep {
  return {
    pago_id: "1", folio: "REP-1", uuid: "uuid-abc", fecha_pago: "2026-01-01",
    monto: 300, moneda: "MXN", estado_rep: "Timbrado", reconciliado: false,
    estatus_sat: "vigente", error: null, rep_cancellation_status: null,
    ...overrides,
  } as ConsultarFacturapiRep;
}

describe("ConsultaRepsMobileCard", () => {
  it("muestra folio, fecha y monto", () => {
    render(<ConsultaRepsMobileCard row={rep()} />);
    expect(screen.getByText("REP-1")).toBeInTheDocument();
    expect(screen.getByText(/300\.00/)).toBeInTheDocument();
  });
});
