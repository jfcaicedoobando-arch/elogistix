/**
 * Regresión (v13.823.336): sin venta capturada el margen es indeterminado.
 * Antes el badge mostraba "0.0%", que se leía como un margen real de cero.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfitBadge } from "@/features/cotizacion/components/ProfitBadge";

describe("ProfitBadge (regresión sin venta)", () => {
  it("con venta 0 muestra guion largo y no un porcentaje", () => {
    render(<ProfitBadge porcentaje={0} venta={0} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/0\.0\s?%/)).toBeNull();
  });

  it("con venta capturada muestra el porcentaje", () => {
    render(<ProfitBadge porcentaje={25} venta={1000} />);
    expect(screen.getByText(/25/)).toBeInTheDocument();
  });

  it("sin dato de venta conserva el comportamiento previo", () => {
    render(<ProfitBadge porcentaje={12.5} />);
    expect(screen.getByText(/12\.5/)).toBeInTheDocument();
  });
});
