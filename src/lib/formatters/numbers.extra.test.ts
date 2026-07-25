
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./numbers";

describe("formatCurrency cache (P1)", () => {
  it("produce el mismo output llamando 2 veces con la misma moneda (idempotente)", () => {
    const a = formatCurrency(1234.5, "USD");
    const b = formatCurrency(1234.5, "USD");
    expect(a).toBe(b);
  });
  it("mantiene el prefijo MXN forzado tras múltiples llamadas", () => {
    const a = formatCurrency(1000, "MXN");
    const b = formatCurrency(2000, "MXN");
    expect(a.startsWith("MXN")).toBe(true);
    expect(b.startsWith("MXN")).toBe(true);
  });
});
