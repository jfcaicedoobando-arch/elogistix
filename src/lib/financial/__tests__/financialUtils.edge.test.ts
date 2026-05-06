/**
 * Tests de borde para helpers financieros: round-trip MXN↔USD, montos
 * negativos, tasas == 0/1, EUR↔USD vía MXN y ausencia de tasas.
 */
import { describe, it, expect } from "vitest";
import {
  calcularIVA,
  calcularMargen,
  calcularTotalConIVA,
  calcularUtilidad,
  convertirAMXN,
  convertirAUSD,
} from "@/lib/financial/financialUtils";
import { aUSD, sumarEnUSD } from "@/lib/financial/costosUSD";
import { calcularTotalesPL } from "@/lib/financial/profitUtils";

describe("conversiones de moneda — bordes", () => {
  it("round-trip USD → MXN → USD preserva el monto", () => {
    const tcUSD = 17.5;
    const enMxn = convertirAMXN(123.45, "USD", tcUSD, 19);
    const deVuelta = convertirAUSD(enMxn, "MXN", tcUSD, 19);
    expect(deVuelta).toBeCloseTo(123.45, 6);
  });

  it("convertirAUSD para EUR pasa por la base MXN", () => {
    // 100 EUR a MXN a 19 = 1900 MXN; a USD a 17.5 = 1900/17.5
    expect(convertirAUSD(100, "EUR", 17.5, 19)).toBeCloseTo(1900 / 17.5);
  });

  it("convertirAMXN sin tasas (defaults=1) trata todo como MXN equivalente", () => {
    expect(convertirAMXN(100, "USD")).toBe(100);
    expect(convertirAMXN(100, "EUR")).toBe(100);
  });

  it("acepta montos negativos sin cambios de signo", () => {
    expect(convertirAMXN(-50, "USD", 17.5)).toBe(-875);
    expect(convertirAUSD(-1750, "MXN", 17.5, 19)).toBeCloseTo(-100);
  });

  it("convertirAUSD con tcUSD = 1 deja MXN igual", () => {
    expect(convertirAUSD(500, "MXN", 1, 1)).toBe(500);
  });

  it("calcularIVA y total con IVA aceptan tasa 0", () => {
    expect(calcularIVA(1000, 0)).toBe(0);
    expect(calcularTotalConIVA(1000, 0)).toBe(1000);
  });

  it("calcularMargen retorna 0 con venta y costo 0 (sin NaN)", () => {
    expect(calcularMargen(0, 0)).toBe(0);
  });

  it("calcularUtilidad funciona con valores negativos (devolución)", () => {
    expect(calcularUtilidad(-100, 50)).toBe(-150);
  });
});

describe("sumarEnUSD / aUSD", () => {
  it("suma items multi-moneda convirtiendo cada uno a USD", () => {
    const total = sumarEnUSD(
      [
        { monto: 100, moneda: "USD" },
        { monto: 1750, moneda: "MXN" }, // = 100 USD a 17.5
        { monto: 100, moneda: "EUR" }, // = 1900/17.5 USD
      ],
      17.5,
      19,
    );
    expect(total).toBeCloseTo(100 + 100 + 1900 / 17.5);
  });

  it("retorna 0 con lista vacía", () => {
    expect(sumarEnUSD([], 17.5, 19)).toBe(0);
  });

  it("aUSD es wrapper de convertirAUSD", () => {
    expect(aUSD(1750, "MXN", 17.5, 19)).toBeCloseTo(100);
    expect(aUSD(100, "USD", 17.5, 19)).toBe(100);
  });

  it("trata moneda desconocida como USD (passthrough)", () => {
    // El cast a Moneda en costosUSD no valida; el switch cae al return final.
    expect(aUSD(42, "XYZ", 17.5, 19)).toBe(42);
  });
});

describe("calcularTotalesPL — bordes", () => {
  it("retorna ceros con lista vacía sin NaN", () => {
    const r = calcularTotalesPL([]);
    expect(r).toEqual({ totalCosto: 0, totalVenta: 0, profit: 0, porcentaje: 0 });
  });

  it("calcula profit y margen para múltiples filas", () => {
    const r = calcularTotalesPL([
      { cantidad: 2, costo_unitario: 100, precio_venta: 150 },
      { cantidad: 1, costo_unitario: 50, precio_venta: 100 },
    ]);
    expect(r.totalCosto).toBe(250);
    expect(r.totalVenta).toBe(400);
    expect(r.profit).toBe(150);
    expect(r.porcentaje).toBeCloseTo(37.5);
  });

  it("profit negativo cuando costo > venta", () => {
    const r = calcularTotalesPL([{ cantidad: 1, costo_unitario: 200, precio_venta: 100 }]);
    expect(r.profit).toBe(-100);
    expect(r.porcentaje).toBeLessThan(0);
  });

  it("evita NaN cuando todas las ventas son 0", () => {
    const r = calcularTotalesPL([{ cantidad: 1, costo_unitario: 100, precio_venta: 0 }]);
    expect(r.totalVenta).toBe(0);
    expect(r.porcentaje).toBe(0);
  });
});
