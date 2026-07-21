/**
 * FIX-18 — helper defensivo para inputs numéricos de costos/venta/cantidad.
 */
import { describe, it, expect } from "vitest";
import { parseInputNumero } from "../../utils/parseInputNumero";

describe("parseInputNumero", () => {
  it("degrada entradas basura a 0", () => {
    for (const raw of ["", ".", "1.2.3", "abc", "-5", "NaN"]) {
      expect(parseInputNumero(raw)).toBe(0);
    }
  });
  it("parsea números válidos", () => {
    expect(parseInputNumero("12.34")).toBe(12.34);
    expect(parseInputNumero("0.1")).toBe(0.1);
    expect(parseInputNumero("100")).toBe(100);
  });
});
