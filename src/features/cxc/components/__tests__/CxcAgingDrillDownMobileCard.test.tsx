import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CxcAgingDrillDownMobileCard } from "../CxcAgingDrillDownMobileCard";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";

function factura(overrides: Partial<FacturaCobranza> = {}): FacturaCobranza {
  return {
    id: "1", numero: "F-100", expediente: "EXP-1", fecha_emision: "2026-01-01",
    fecha_vencimiento: "2026-02-01", dias_vencido: 10, saldo: 1000, moneda: "MXN",
    ...overrides,
  } as FacturaCobranza;
}

describe("CxcAgingDrillDownMobileCard", () => {
  it("muestra número de factura, expediente y saldo", () => {
    render(<CxcAgingDrillDownMobileCard row={factura()} />);
    expect(screen.getByText("F-100")).toBeInTheDocument();
    expect(screen.getByText("EXP-1")).toBeInTheDocument();
    expect(screen.getByText(/1,000\.00/)).toBeInTheDocument();
  });
});
