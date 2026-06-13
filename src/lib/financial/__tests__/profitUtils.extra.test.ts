import { describe, it, expect } from "vitest";
import { calcularTotalesPL, type TotalesPL } from "@/lib/financial/profitUtils";

const fila = (cantidad: number, costo_unitario: number, precio_venta: number) => ({
  cantidad,
  costo_unitario,
  precio_venta,
});

describe("profitUtils.extra — calcularTotalesPL estructura", () => {
  it("retorna todas las claves del TotalesPL", () => {
    const result: TotalesPL = calcularTotalesPL([fila(1, 50, 100)]);
    expect(result).toHaveProperty("totalCosto");
    expect(result).toHaveProperty("totalVenta");
    expect(result).toHaveProperty("profit");
    expect(result).toHaveProperty("porcentaje");
  });

  it("lista vacía → todos ceros", () => {
    const result = calcularTotalesPL([]);
    expect(result.totalCosto).toBe(0);
    expect(result.totalVenta).toBe(0);
    expect(result.profit).toBe(0);
    expect(result.porcentaje).toBe(0);
  });
});

describe("profitUtils.extra — calcularTotalesPL cálculos", () => {
  it("una fila: totalCosto correcto", () => {
    const result = calcularTotalesPL([fila(3, 100, 200)]);
    expect(result.totalCosto).toBe(300);
  });

  it("una fila: totalVenta correcto", () => {
    const result = calcularTotalesPL([fila(3, 100, 200)]);
    expect(result.totalVenta).toBe(600);
  });

  it("una fila: profit = venta - costo", () => {
    const result = calcularTotalesPL([fila(3, 100, 200)]);
    expect(result.profit).toBe(300);
  });

  it("una fila: margen 50%", () => {
    const result = calcularTotalesPL([fila(3, 100, 200)]);
    expect(result.porcentaje).toBeCloseTo(50, 4);
  });

  it("múltiples filas acumulan correctamente", () => {
    const result = calcularTotalesPL([
      fila(2, 100, 200),
      fila(5, 50, 80),
    ]);
    expect(result.totalCosto).toBe(450);
    expect(result.totalVenta).toBe(800);
  });

  it("profit negativo cuando costo > venta", () => {
    const result = calcularTotalesPL([fila(1, 200, 100)]);
    expect(result.profit).toBe(-100);
  });

  it("margen negativo cuando costo > venta", () => {
    const result = calcularTotalesPL([fila(1, 200, 100)]);
    expect(result.porcentaje).toBeLessThan(0);
  });

  it("margen 0% cuando profit = 0", () => {
    const result = calcularTotalesPL([fila(1, 100, 100)]);
    expect(result.porcentaje).toBe(0);
    expect(result.profit).toBe(0);
  });

  it("precio y costo con decimales sin drift", () => {
    const result = calcularTotalesPL([fila(3, 0.1, 0.2)]);
    expect(result.totalCosto).toBeCloseTo(0.3, 10);
    expect(result.totalVenta).toBeCloseTo(0.6, 10);
  });

  it("cantidad fraccionaria funciona", () => {
    const result = calcularTotalesPL([fila(0.5, 200, 400)]);
    expect(result.totalCosto).toBe(100);
    expect(result.totalVenta).toBe(200);
    expect(result.profit).toBe(100);
  });
});
