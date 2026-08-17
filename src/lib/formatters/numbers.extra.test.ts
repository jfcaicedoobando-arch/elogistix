
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

describe("formatCurrency (Frente 2)", () => {
  it("negativos siempre en formato 'CODE -monto', sin símbolo $ pegado al signo", () => {
    expect(formatCurrency(-8000, "MXN")).toBe("MXN -8,000.00");
    expect(formatCurrency(-1234.5, "USD")).toBe("USD -1,234.50");
  });

  it("incluye el código ISO incluso cuando el monto es 0", () => {
    expect(formatCurrency(0, "MXN")).toBe("MXN 0.00");
    expect(formatCurrency(0, "USD")).toBe("USD 0.00");
  });

  it("no duplica el código de moneda", () => {
    const mxn = formatCurrency(500, "MXN");
    const usd = formatCurrency(500, "USD");
    expect(mxn.match(/MXN/g)?.length).toBe(1);
    expect(usd.match(/USD/g)?.length).toBe(1);
  });
});
