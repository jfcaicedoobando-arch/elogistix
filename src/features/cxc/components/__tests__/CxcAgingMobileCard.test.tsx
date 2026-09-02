/** v13.823.25: tarjeta móvil de /cobranza/aging muestra cliente, cubeta y saldo total. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CxcAgingMobileCard } from "../CxcAgingMobileCard";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";

function row(overrides: Partial<CxcAgingRow> = {}): CxcAgingRow {
  return {
    cliente_id: "c1", cliente_nombre: "Cliente Dos", moneda: "MXN",
    saldo_total: 500, vigente: 0, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 500,
    num_facturas: 2,
    ...overrides,
  };
}

describe("CxcAgingMobileCard", () => {
  it("muestra cliente, cubeta más vencida y saldo total", () => {
    render(<CxcAgingMobileCard row={row()} />);
    expect(screen.getByText("Cliente Dos")).toBeInTheDocument();
    expect(screen.getByText(/\+90 días/)).toBeInTheDocument();
    expect(screen.getByText(/\$500\.00|500\.00/)).toBeInTheDocument();
  });
});
