import { describe, it, expect } from "vitest";
import { calcularTotalesPL } from "../profitUtils";

describe("calcularTotalesPL", () => {
  it("devuelve ceros cuando no hay filas", () => {
    const r = calcularTotalesPL([]);
    expect(r).toEqual({ totalCosto: 0, totalVenta: 0, profit: 0, porcentaje: 0 });
  });

  it("acumula costos y ventas multiplicando por cantidad", () => {
    const r = calcularTotalesPL([
      { cantidad: 2, costo_unitario: 100, precio_venta: 150 },
      { cantidad: 3, costo_unitario: 50, precio_venta: 80 },
    ]);
    // costos: 2*100 + 3*50 = 350; ventas: 2*150 + 3*80 = 540
    expect(r.totalCosto).toBe(350);
    expect(r.totalVenta).toBe(540);
    expect(r.profit).toBe(190);
    expect(r.porcentaje).toBeCloseTo((190 / 540) * 100, 2);
  });

  it("evita drift de punto flotante en sumas largas", () => {
    const filas = Array.from({ length: 100 }, () => ({
      cantidad: 1,
      costo_unitario: 0.1,
      precio_venta: 0.2,
    }));
    const r = calcularTotalesPL(filas);
    expect(r.totalCosto).toBe(10);
    expect(r.totalVenta).toBe(20);
    expect(r.profit).toBe(10);
  });

  it("retorna margen 0 cuando totalVenta es 0", () => {
    const r = calcularTotalesPL([{ cantidad: 1, costo_unitario: 50, precio_venta: 0 }]);
    expect(r.totalVenta).toBe(0);
    expect(r.porcentaje).toBe(0);
  });

  it("acepta profit negativo cuando costo > venta", () => {
    const r = calcularTotalesPL([{ cantidad: 1, costo_unitario: 200, precio_venta: 100 }]);
    expect(r.profit).toBe(-100);
    expect(r.porcentaje).toBeLessThan(0);
  });
});
