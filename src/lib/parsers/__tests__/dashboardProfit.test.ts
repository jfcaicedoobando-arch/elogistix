import { describe, it, expect } from "vitest";
import {
  numOr0,
  numOrCompute,
  safeMargen,
  parseEmbarqueConProfitRaw,
} from "../dashboardProfit";

describe("dashboardProfit helpers", () => {
  describe("numOr0", () => {
    it("convierte valores numéricos y trata null/undefined como 0", () => {
      expect(numOr0(5)).toBe(5);
      expect(numOr0("3.2")).toBe(3.2);
      expect(numOr0(null)).toBe(0);
      expect(numOr0(undefined)).toBe(0);
    });

    it("rechaza NaN/Infinity y los degrada a 0 (evita envenenar totales)", () => {
      expect(numOr0("NaN")).toBe(0);
      expect(numOr0("not-a-number")).toBe(0);
      expect(numOr0(Number.POSITIVE_INFINITY)).toBe(0);
      expect(numOr0(Number.NEGATIVE_INFINITY)).toBe(0);
      expect(numOr0("Infinity")).toBe(0);
    });
  });

  describe("numOrCompute", () => {
    it("usa el valor cuando viene definido, calcula con fallback si no", () => {
      expect(numOrCompute(7, () => 999)).toBe(7);
      expect(numOrCompute(null, () => 999)).toBe(999);
      expect(numOrCompute(undefined, () => 999)).toBe(999);
      // 0 es válido y no debe disparar fallback
      expect(numOrCompute(0, () => 999)).toBe(0);
    });
  });

  describe("safeMargen", () => {
    it("retorna 0 cuando la venta es 0 (evita división por cero)", () => {
      expect(safeMargen(100, 0)).toBe(0);
    });
    it("calcula porcentaje cuando venta > 0", () => {
      expect(safeMargen(25, 100)).toBe(25);
      expect(safeMargen(-50, 200)).toBe(-25);
    });
    it("retorna 0 cuando ambos son negativos y venta no es positiva", () => {
      // Contrato: sólo aplica división cuando venta > 0.
      expect(safeMargen(-100, -200)).toBe(0);
      expect(safeMargen(-100, 0)).toBe(0);
    });
    it("retorna 0 cuando profit=0 y venta=0", () => {
      expect(safeMargen(0, 0)).toBe(0);
    });
  });

  describe("parseEmbarqueConProfitRaw", () => {
    it("calcula profit y margen cuando no vienen en el payload", () => {
      const r = parseEmbarqueConProfitRaw({
        id: "abc",
        ventaUSD: 1000,
        costoUSD: 700,
        ventaMXN: 18000,
        costoMXN: 14000,
      });
      expect(r.profit).toBe(300);
      expect(r.margen).toBeCloseTo(30, 5);
      expect(r.profitMXN).toBe(4000);
      expect(r.margenMXN).toBeCloseTo((4000 / 18000) * 100, 5);
    });

    it("respeta profit/margen explícitos del payload", () => {
      const r = parseEmbarqueConProfitRaw({
        ventaUSD: 1000,
        costoUSD: 700,
        profit: 999,
        margen: 12.5,
      });
      expect(r.profit).toBe(999);
      expect(r.margen).toBe(12.5);
    });

    it("defaultea tipos de cambio y montos derivados a 0", () => {
      const r = parseEmbarqueConProfitRaw({ ventaUSD: 100, costoUSD: 50 });
      expect(r.tipoCambioUSD).toBe(0);
      expect(r.tipoCambioEUR).toBe(0);
      expect(r.ventaMxnFromUsd).toBe(0);
      expect(r.ventaMxnNative).toBe(0);
    });
  });
});
