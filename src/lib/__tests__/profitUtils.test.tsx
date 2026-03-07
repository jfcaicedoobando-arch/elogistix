import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { calcularTotalesPL, ProfitBadge, RentabilidadGlobalBadge } from "@/lib/profitUtils";

describe("calcularTotalesPL", () => {
  it("calcula totales correctamente para múltiples filas", () => {
    const filas = [
      { cantidad: 2, costo_unitario: 100, precio_venta: 150 },
      { cantidad: 3, costo_unitario: 200, precio_venta: 300 },
    ];
    const result = calcularTotalesPL(filas);
    expect(result.totalCosto).toBe(2 * 100 + 3 * 200); // 800
    expect(result.totalVenta).toBe(2 * 150 + 3 * 300); // 1200
    expect(result.profit).toBe(400);
    expect(result.porcentaje).toBeCloseTo((400 / 1200) * 100);
  });

  it("retorna ceros para array vacío", () => {
    const result = calcularTotalesPL([]);
    expect(result.totalCosto).toBe(0);
    expect(result.totalVenta).toBe(0);
    expect(result.profit).toBe(0);
    expect(result.porcentaje).toBe(0);
  });

  it("maneja escenario sin utilidad", () => {
    const filas = [{ cantidad: 1, costo_unitario: 500, precio_venta: 500 }];
    const result = calcularTotalesPL(filas);
    expect(result.profit).toBe(0);
    expect(result.porcentaje).toBe(0);
  });
});

describe("ProfitBadge", () => {
  it("muestra badge verde para > 15%", () => {
    render(<ProfitBadge porcentaje={20} />);
    expect(screen.getByText("20.0%")).toBeInTheDocument();
  });

  it("muestra badge rojo para negativo", () => {
    render(<ProfitBadge porcentaje={-5} />);
    expect(screen.getByText("-5.0%")).toBeInTheDocument();
  });

  it("muestra 0% para cero", () => {
    render(<ProfitBadge porcentaje={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("RentabilidadGlobalBadge", () => {
  it("muestra saludable cuando ambos márgenes son altos", () => {
    render(<RentabilidadGlobalBadge porcentajeUSD={20} porcentajeMXN={15} tieneUSD={true} tieneMXN={true} />);
    expect(screen.getByText("Rentabilidad Saludable")).toBeInTheDocument();
  });

  it("muestra negativa cuando USD es negativo", () => {
    render(<RentabilidadGlobalBadge porcentajeUSD={-5} porcentajeMXN={15} tieneUSD={true} tieneMXN={true} />);
    expect(screen.getByText("Rentabilidad Negativa")).toBeInTheDocument();
  });

  it("muestra baja cuando margen es positivo pero bajo", () => {
    render(<RentabilidadGlobalBadge porcentajeUSD={5} porcentajeMXN={5} tieneUSD={true} tieneMXN={true} />);
    expect(screen.getByText("Rentabilidad Baja")).toBeInTheDocument();
  });
});
