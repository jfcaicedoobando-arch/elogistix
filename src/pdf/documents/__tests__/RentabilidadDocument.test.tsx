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
  it("debe renderizar sin errores con lista de clientes vacía", () => {
    const { getByTestId } = render(
      <RentabilidadDocument 
        fechaDesde="2023-01-01" 
        fechaHasta="2023-01-31" 
        kpis={mockKpis} 
        clientes={[]} 
      />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con datos de clientes", () => {
    const clientes = [
      { cliente_nombre: "Test", total_embarques: 1, venta_usd: 100, costo_usd: 80, profit_usd: 20, margen: 20 }
    ];
    const { getByTestId } = render(
      <RentabilidadDocument 
        fechaDesde="2023-01-01" 
        fechaHasta="2023-01-31" 
        kpis={mockKpis} 
        clientes={clientes} 
      />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
