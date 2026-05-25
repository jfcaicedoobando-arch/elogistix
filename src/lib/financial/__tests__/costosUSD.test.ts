import { describe, it, expect } from "vitest";
import { sumarEnUSD, aUSD } from "@/lib/financial/costosUSD";

describe("aUSD", () => {
  it("retorna el mismo monto si ya es USD", () => {
    expect(aUSD(100, "USD", 17.5, 19.0)).toBe(100);
  });
  it("convierte MXN a USD", () => {
    expect(aUSD(1750, "MXN", 17.5, 19.0)).toBeCloseTo(100);
  });
  it("convierte EUR a USD (vía MXN)", () => {
    expect(aUSD(100, "EUR", 17.5, 19.0)).toBeCloseTo((100 * 19) / 17.5);
  });
});

describe("sumarEnUSD", () => {
  it("retorna 0 con lista vacía", () => {
    expect(sumarEnUSD([], 17.5, 19)).toBe(0);
  });
  it("suma montos mixtos sin errores de punto flotante", () => {
    const total = sumarEnUSD(
      [
        { monto: 100, moneda: "USD" },
        { monto: 1750, moneda: "MXN" },
        { monto: 100, moneda: "EUR" },
      ],
      17.5,
      19,
    );
    expect(total).toBeCloseTo(100 + 100 + (100 * 19) / 17.5, 2);
  });
  it("acumula valores pequeños sin perder precisión (0.1 * 3)", () => {
    const total = sumarEnUSD(
      [
        { monto: 0.1, moneda: "USD" },
        { monto: 0.1, moneda: "USD" },
        { monto: 0.1, moneda: "USD" },
      ],
      17.5,
      19,
    );
    expect(total).toBe(0.3);
  });
});
