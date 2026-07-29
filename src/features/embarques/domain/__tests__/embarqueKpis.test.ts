import { describe, it, expect } from "vitest";
import { computeEmbarqueKpis } from "@/features/embarques/domain/embarqueKpis";

describe("computeEmbarqueKpis", () => {
  it("retorna ceros con listas vacías", () => {
    const k = computeEmbarqueKpis([], [], 17.5, 19);
    expect(k).toEqual({ totalVenta: 0, totalCosto: 0, utilidad: 0, margen: 0, montosSinTipoCambio: 0 });
  });

  it("excluye conceptos en USD sin tipo de cambio confiable — FIX C6", () => {
    const k = computeEmbarqueKpis(
      [{ total: 1000, moneda: "MXN" }, { total: 100, moneda: "USD" }],
      [{ monto: 50, moneda: "EUR" }],
      1,
      0,
    );
    expect(k.totalVenta).toBe(1000);
    expect(k.totalCosto).toBe(0);
    expect(k.montosSinTipoCambio).toBe(2);
  });

  it("suma totales en MXN sin conversión cuando ya están en MXN", () => {
    const k = computeEmbarqueKpis(
      [{ total: 1000, moneda: "MXN" }, { total: 500, moneda: "MXN" }],
      [{ monto: 600, moneda: "MXN" }],
      17.5,
      19,
    );
    expect(k.totalVenta).toBe(1500);
    expect(k.totalCosto).toBe(600);
    expect(k.utilidad).toBe(900);
    expect(k.margen).toBeCloseTo(60);
  });

  it("convierte USD/EUR a MXN para los totales", () => {
    const k = computeEmbarqueKpis(
      [{ total: 100, moneda: "USD" }],
      [{ monto: 100, moneda: "EUR" }],
      17.5,
      19,
    );
    expect(k.totalVenta).toBeCloseTo(1750);
    expect(k.totalCosto).toBeCloseTo(1900);
    expect(k.utilidad).toBeCloseTo(-150);
  });

  it("margen 0 cuando venta es 0 (evita división por cero)", () => {
    const k = computeEmbarqueKpis([], [{ monto: 500, moneda: "MXN" }], 17.5, 19);
    expect(k.margen).toBe(0);
  });

  it("acepta totales como string-coercibles (Number())", () => {
    const k = computeEmbarqueKpis(
      [{ total: "1000" as unknown as number, moneda: "MXN" }],
      [{ monto: "200" as unknown as number, moneda: "MXN" }],
      17.5,
      19,
    );
    expect(k.totalVenta).toBe(1000);
    expect(k.totalCosto).toBe(200);
  });
});
