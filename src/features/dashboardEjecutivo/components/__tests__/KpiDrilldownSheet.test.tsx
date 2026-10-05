import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { KpiDrilldownSheet } from "../KpiDrilldownSheet";

describe("KpiDrilldownSheet signos de vencimiento (81)", () => {
  it.each(["vencido", "porVencer"] as const)("mantiene signo canónico con tono %s e identifica hoy", (diasTone) => {
    render(<MemoryRouter><KpiDrilldownSheet open onOpenChange={() => {}} title="Vencimientos"
      description="Detalle" verTodosHref="/compras/facturas" diasTone={diasTone} items={[
        { nombre: "Vencida", saldo: 95, moneda: "USD", dias: 1 },
        { nombre: "Próxima", saldo: 100, moneda: "MXN", dias: -7 },
        { nombre: "Hoy", saldo: 20, moneda: "MXN", dias: 0 },
      ]} /></MemoryRouter>);
    expect(screen.getByText("1 d vencido")).toBeInTheDocument();
    expect(screen.getByText("Vence en 7 d")).toBeInTheDocument();
    expect(screen.getByText("Vence hoy")).toBeInTheDocument();
    expect(screen.queryByText("Vence en 1 d")).not.toBeInTheDocument();
  });
});
