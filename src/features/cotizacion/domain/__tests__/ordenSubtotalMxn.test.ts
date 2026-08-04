import { describe, it, expect } from "vitest";
import { normalizarSubtotalMxn } from "../ordenSubtotalMxn";

describe("normalizarSubtotalMxn", () => {
  it("MXN se devuelve tal cual, sin requerir TC", () => {
    expect(normalizarSubtotalMxn(1000, "MXN", null)).toBe(1000);
  });

  it("USD con TC confiable se convierte a MXN", () => {
    expect(normalizarSubtotalMxn(100, "USD", 18)).toBe(1800);
  });

  it("USD sin TC confiable devuelve null (no convertible)", () => {
    expect(normalizarSubtotalMxn(100, "USD", null)).toBeNull();
    expect(normalizarSubtotalMxn(100, "USD", 0.5)).toBeNull();
  });
});
