import { describe, it, expect } from "vitest";
import { RentabilidadDocument } from "../RentabilidadDocument";
import { render } from "@testing-library/react";

const mockKpis = {
  total_venta_usd: 1000,
  total_costo_usd: 800,
  total_profit_usd: 200,
  margen_promedio: 20,
};

describe("RentabilidadDocument", () => {
  it("renderiza título, período y mensaje cuando no hay clientes", () => {
    const { container } = render(
      <RentabilidadDocument
        fechaDesde="2023-01-01"
        fechaHasta="2023-01-31"
        kpis={mockKpis}
        clientes={[]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Rentabilidad por cliente");
    expect(text).toContain("2023-01-01");
    expect(text).toContain("2023-01-31");
    expect(text).toContain("No hay datos");
    expect(text).toContain("20.0%");
  });

  it("renderiza filas de clientes con sus métricas", () => {
    const clientes = [
      { cliente_nombre: "Acme MX", total_embarques: 3, venta_usd: 5000, costo_usd: 3500, profit_usd: 1500, margen: 30 },
      { cliente_nombre: "Beta SA", total_embarques: 1, venta_usd: 800, costo_usd: 700, profit_usd: 100, margen: 12.5 },
    ];
    const { container } = render(
      <RentabilidadDocument
        fechaDesde="2023-01-01"
        fechaHasta="2023-01-31"
        kpis={mockKpis}
        clientes={clientes}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Acme MX");
    expect(text).toContain("Beta SA");
    expect(text).not.toContain("No hay datos");
  });
});
