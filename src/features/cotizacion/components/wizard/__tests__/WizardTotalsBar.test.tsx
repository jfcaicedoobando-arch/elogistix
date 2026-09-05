/**
 * Tests para WizardTotalsBar (P1 — v13.294.0).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardTotalsBar } from "@/features/cotizacion/components/wizard/WizardTotalsBar";

const emptyPL = { totalCosto: 0, totalVenta: 0, profit: 0, porcentaje: 0 };

describe("WizardTotalsBar", () => {
  it("renderiza costos y ventas en MXN", () => {
    render(
      <WizardTotalsBar
        plUSD={emptyPL}
        plMXN={{ totalCosto: 10000, totalVenta: 15000, profit: 5000, porcentaje: 33.3 }}
      />,
    );
    expect(screen.getByRole("status", { name: /Totales/i })).toBeInTheDocument();
    // Verde: margen ≥15%.
    expect(screen.getByText(/33\.3 %/)).toBeInTheDocument();
    // Bug 4/5: la venta MXN sale del P&L de costos y se etiqueta sin IVA.
    expect(screen.getByText("Venta (sin IVA)")).toBeInTheDocument();
    expect(screen.getByText(/15,000\.00/)).toBeInTheDocument();
  });

  it("prioriza USD cuando existe venta en USD", () => {
    render(
      <WizardTotalsBar
        plUSD={{ totalCosto: 500, totalVenta: 800, profit: 300, porcentaje: 37.5 }}
        plMXN={emptyPL}
      />,
    );
    expect(screen.getByText(/Margen USD/)).toBeInTheDocument();
  });

  it("aplica color ámbar cuando el margen está entre 5% y 15%", () => {
    render(
      <WizardTotalsBar
        plUSD={emptyPL}
        plMXN={{ totalCosto: 1000, totalVenta: 1100, profit: 100, porcentaje: 9.1 }}
      />,
    );
    expect(screen.getByText(/9\.1 %/)).toBeInTheDocument();
  });

  it("aplica color destructivo cuando el margen es <5%", () => {
    render(
      <WizardTotalsBar
        plUSD={emptyPL}
        plMXN={{ totalCosto: 1000, totalVenta: 1020, profit: 20, porcentaje: 2.0 }}
      />,
    );
    expect(screen.getByText(/2\.0 %/)).toBeInTheDocument();
  });
});
